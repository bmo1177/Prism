// Scheduled agent jobs ("AI cowork automation"): run an OpenCode session
// turn on a schedule — once at a timestamp, on an interval, or on a cron
// expression — by asking the running sidecar to create a session and start a
// prompt in the active workspace. The job store lives in an app-private
// SQLite DB so schedules survive restarts; a background thread polls for due
// jobs and fires them through the sidecar HTTP API (Basic-auth protected like
// the gateway proxying does).
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{Connection, params};
use tauri::{AppHandle, Manager};

use crate::runtime::{
    random_hex, runtime_root, server_password, sidecar_url, workspace_dir, RuntimeState,
};

const DB_FILE: &str = "jobs.db";
/// Scheduler wake-up interval in seconds.
const TICK_SECS: u64 = 30;

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobRecord {
    pub id: String,
    pub title: String,
    /// Prompt payload sent to the session when the job fires.
    pub prompt: String,
    /// "at" | "every" | "cron".
    pub schedule_kind: String,
    /// unix-seconds (at), interval seconds (every), or 5-field cron expr (cron).
    pub schedule_value: String,
    pub enabled: bool,
    /// Next unix-seconds the job is due to fire. Null when finished/disabled.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_run_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_run_at: Option<i64>,
}

/// Schema for the jobs table.
const CREATE_SQL: &str = "\
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    schedule_kind TEXT NOT NULL,
    schedule_value TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    next_run_at INTEGER,
    last_run_at INTEGER
);";

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(runtime_root(app)?.join(DB_FILE))
}

fn open(app: &AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch(CREATE_SQL).map_err(|e| e.to_string())?;
    Ok(conn)
}

fn row_to_job(row: &rusqlite::Row) -> rusqlite::Result<JobRecord> {
    Ok(JobRecord {
        id: row.get(0)?,
        title: row.get(1)?,
        prompt: row.get(2)?,
        schedule_kind: row.get(3)?,
        schedule_value: row.get(4)?,
        enabled: row.get::<_, i64>(5)? != 0,
        next_run_at: row.get(6)?,
        last_run_at: row.get(7)?,
    })
}

// ---- schedule computation -------------------------------------------------

/// Translate a schedule into the job's next run time. The three kinds mirror
/// AionUi's cron_jobs schema: "at" (one-shot unix-seconds timestamp), "every"
/// (repeat interval in seconds), "cron" (5-field expression). Returns None for
/// an invalid schedule or a one-shot that already passed.
pub fn next_run(kind: &str, value: &str, now: i64) -> Option<i64> {
    match kind {
        "at" => value.trim().parse::<i64>().ok().filter(|t| *t > now),
        "every" => {
            let interval = value.trim().parse::<i64>().ok()?.max(5);
            Some(now + interval)
        }
        "cron" => next_cron(value, now),
        "event" => None, // Event jobs fire on trigger, not fixed wall time
        _ => None,
    }
}

/// Parse one cron field into the set of values it selects. `min`..=`max` is
/// the legal value range; `*` expands to the full range; `a-b` ranges, `*/s`
/// steps and comma lists are combined. `names` maps month/dow names to values
/// (empty for the numeric-only minute/hour/dom fields).
fn parse_field(
    field: &str,
    min: usize,
    max: usize,
    names: &[(&str, usize)],
) -> Option<Vec<usize>> {
    let mut out = Vec::new();
    for part in field.split(',') {
        let part = part.trim();
        if part.is_empty() {
            return None;
        }
        let (base, step) = if let Some((a, b)) = part.split_once('/') {
            (a, b.parse::<usize>().ok()?.max(1))
        } else {
            (part, 1)
        };
        let (lo, hi) = if base == "*" {
            (min, max)
        } else if let Some(range) = base.split_once('-') {
            (value_of(range.0, names)?, value_of(range.1, names)?)
        } else {
            let v = value_of(base, names)?;
            (v, v)
        };
        if lo > hi {
            return None;
        }
        let mut v = lo;
        while v <= hi {
            out.push(v);
            v += step;
        }
    }
    out.sort_unstable();
    out.dedup();
    if out.is_empty() {
        None
    } else {
        Some(out)
    }
}

fn value_of(s: &str, names: &[(&str, usize)]) -> Option<usize> {
    if let Ok(n) = s.parse::<usize>() {
        return Some(n);
    }
    let l = s.to_ascii_lowercase();
    names.iter().find(|(n, _)| *n == l).map(|(_, v)| *v)
}

const MONTH_NAMES: &[(&str, usize)] = &[
    ("jan", 1),
    ("feb", 2),
    ("mar", 3),
    ("apr", 4),
    ("may", 5),
    ("jun", 6),
    ("jul", 7),
    ("aug", 8),
    ("sep", 9),
    ("oct", 10),
    ("nov", 11),
    ("dec", 12),
];

const DOW_NAMES: &[(&str, usize)] = &[
    ("sun", 0),
    ("mon", 1),
    ("tue", 2),
    ("wed", 3),
    ("thu", 4),
    ("fri", 5),
    ("sat", 6),
];

struct CronFields {
    minutes: Vec<usize>,
    hours: Vec<usize>,
    doms: Vec<usize>,
    months: Vec<usize>,
    dows: Vec<usize>,
}

impl CronFields {
    fn parse(expr: &str) -> Option<Self> {
        let f: Vec<&str> = expr.split_whitespace().collect();
        if f.len() != 5 {
            return None;
        }
        Some(CronFields {
            minutes: parse_field(f[0], 0, 59, &[])?,
            hours: parse_field(f[1], 0, 23, &[])?,
            doms: parse_field(f[2], 1, 31, &[])?,
            months: parse_field(f[3], 1, 12, MONTH_NAMES)?,
            dows: parse_field(f[4], 0, 6, DOW_NAMES)?,
        })
    }
}

/// Day of week, 0=Sunday (cron convention). Uses the 1970-01-01 = Thursday
/// anchor and the fact that the era repeats every 400 years.
fn day_of_week(year: i64, month: usize, day: usize) -> usize {
    let days = days_from_civil(year, month, day);
    // 1970-01-01 was a Thursday (4).
    (days.rem_euclid(7) as usize + 4) % 7
}

/// Civil date arithmetic (proleptic Gregorian), days since 1970-01-01.
fn days_from_civil(year: i64, month: usize, day: usize) -> i64 {
    let m = month as i64;
    let y = if m <= 2 { year - 1 } else { year };
    let era = y.div_euclid(400);
    let yoe = y - era * 400; // [0, 399]
    let mp = if m > 2 { m - 3 } else { m + 9 }; // [0, 11]
    let doy = (153 * mp + 2) / 5 + day as i64 - 1; // [0, 365]
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn civil_from_days(days: i64) -> (i64, usize, usize) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097); // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 }; // [1, 12]
    (y + if m <= 2 { 1 } else { 0 }, m as usize, d as usize)
}

/// Compute the next run for a cron expression strictly after `now` (unix secs).
/// Searches minute-by-minute across at most the next 5 years; every valid
/// expression matches within a year, so this always terminates.
fn next_cron(expr: &str, now: i64) -> Option<i64> {
    let cf = CronFields::parse(expr)?;
    let dom_star = cf.doms.len() == 31;
    let dow_star = cf.dows.len() == 7;
    let end = now + 5 * 366 * 86_400;
    let start = (now / 60 + 1) * 60; // next minute boundary
    let mut t = start;
    while t <= end {
        let days = t.div_euclid(86_400);
        let sec = t.rem_euclid(86_400);
        let (y, mo, d) = civil_from_days(days);
        let dow = day_of_week(y, mo, d);
        let hour = (sec / 3600) as usize;
        let minute = ((sec % 3600) / 60) as usize;
        if cf.months.contains(&mo) && cf.hours.contains(&hour) && cf.minutes.contains(&minute) {
            // Day matching per cron: when both dom and dow are `*` every day
            // matches; when one is `*` the other decides; when both are
            // restricted, EITHER matching counts.
            let day_ok = match (dom_star, dow_star) {
                (true, true) => true,
                (true, false) => cf.dows.contains(&dow),
                (false, true) => cf.doms.contains(&d),
                (false, false) => cf.doms.contains(&d) || cf.dows.contains(&dow),
            };
            if day_ok {
                return Some(t);
            }
        }
        t += 60;
    }
    None
}

// ---- persistence ----------------------------------------------------------

/// List every job, newest created first.
#[tauri::command]
pub fn list_jobs(app: AppHandle) -> Result<Vec<JobRecord>, String> {
    let conn = open(&app)?;
    let mut stmt = conn
        .prepare("SELECT id, title, prompt, schedule_kind, schedule_value, enabled, next_run_at, last_run_at FROM jobs ORDER BY rowid DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_to_job)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewJob {
    pub title: String,
    pub prompt: String,
    pub schedule_kind: String,
    pub schedule_value: String,
}

/// Create a scheduled job and compute its first due time. The sidecar must be
/// running for the job to fire, but a job may be created anytime.
#[tauri::command]
pub fn create_job(app: AppHandle, job: NewJob) -> Result<JobRecord, String> {
    let kind = job.schedule_kind.trim();
    if !matches!(kind, "at" | "every" | "cron" | "event") {
        return Err(format!("unknown schedule kind \"{kind}\""));
    }
    let next = if kind == "event" {
        None
    } else {
        Some(
            next_run(kind, &job.schedule_value, now_secs())
                .ok_or_else(|| "invalid schedule value".to_string())?,
        )
    };
    let id = random_hex(8);
    let title = if job.title.trim().is_empty() {
        "Scheduled job".to_string()
    } else {
        job.title.trim().to_string()
    };
    let conn = open(&app)?;
    conn.execute(
        "INSERT INTO jobs (id, title, prompt, schedule_kind, schedule_value, enabled, next_run_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)",
        params![id, title, job.prompt, kind, job.schedule_value.trim(), next],
    )
    .map_err(|e| e.to_string())?;
    Ok(JobRecord {
        id,
        title,
        prompt: job.prompt,
        schedule_kind: kind.to_string(),
        schedule_value: job.schedule_value.trim().to_string(),
        enabled: true,
        next_run_at: next,
        last_run_at: None,
    })
}

/// Delete a job.
#[tauri::command]
pub fn delete_job(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open(&app)?;
    conn.execute("DELETE FROM jobs WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Toggle a job's enabled state. Disabling stops it firing (next run is kept
/// so re-enabling resumes where it left off); enabling a paused one-shot with
/// a passed run time recomputes it.
#[tauri::command]
pub fn set_job_enabled(app: AppHandle, id: String, enabled: bool) -> Result<JobRecord, String> {
    let conn = open(&app)?;
    conn.execute(
        "UPDATE jobs SET enabled = ?2 WHERE id = ?1",
        params![id, enabled as i64],
    )
    .map_err(|e| e.to_string())?;
    fetch_job(&conn, &id).ok_or_else(|| "job not found".to_string())
}

/// Fire a job now, immediately and unconditionally (a "run now" button).
#[tauri::command]
pub fn run_job_now(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open(&app)?;
    let job = fetch_job(&conn, &id).ok_or_else(|| "job not found".to_string())?;
    fire_job(&app, &job)
}

/// Trigger all enabled jobs subscribed to an event name.
pub fn trigger_event_jobs(app: &AppHandle, event_name: &str) {
    let Ok(conn) = open(app) else { return; };
    let mut stmt = match conn.prepare(
        "SELECT id, title, prompt, schedule_kind, schedule_value, enabled, next_run_at, last_run_at FROM jobs WHERE enabled = 1 AND schedule_kind = 'event' AND schedule_value = ?1",
    ) {
        Ok(s) => s,
        Err(_) => return,
    };
    let Ok(rows) = stmt.query_map(params![event_name], row_to_job) else { return; };
    for job in rows.flatten() {
        let _ = fire_job(app, &job);
        reschedule(&conn, &job);
    }
}

/// Expose event trigger invocation to frontend or other rust handlers.
#[tauri::command]
pub fn trigger_event(app: AppHandle, event_name: String) -> Result<(), String> {
    trigger_event_jobs(&app, &event_name);
    Ok(())
}

fn fetch_job(conn: &Connection, id: &str) -> Option<JobRecord> {
    conn.query_row(
        "SELECT id, title, prompt, schedule_kind, schedule_value, enabled, next_run_at, last_run_at FROM jobs WHERE id = ?1",
        params![id],
        row_to_job,
    )
    .ok()
}

/// Query a job's stored schedule and persist the next run time after a fire.
fn reschedule(conn: &Connection, job: &JobRecord) {
    let next = if job.enabled {
        next_run(&job.schedule_kind, &job.schedule_value, now_secs())
    } else {
        None
    };
    let _ = conn.execute(
        "UPDATE jobs SET next_run_at = ?2, last_run_at = ?3 WHERE id = ?1",
        params![job.id, next, now_secs()],
    );
}

// ---- firing ---------------------------------------------------------------

/// Ask the running sidecar to create a session in the active workspace and
/// start the job's prompt in it. Mirrors the gateway's auth (Basic
/// `opencode:<password>`), so only the running app can fire a job.
fn fire_job(app: &AppHandle, job: &JobRecord) -> Result<(), String> {
    let state = app.state::<RuntimeState>();
    let base = sidecar_url(state.inner()).ok_or("agent runtime not started")?;
    let pw = server_password();
    // The session must be scoped to the active workspace, exactly like the
    // SDK's createSession and the gateway's proxy do — the directory query is
    // what routes the turn to the right OpenCode instance.
    let workspace = workspace_dir(app).map_err(|e| e.to_string())?;

    let client = reqwest::blocking::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    // Create the session (POST /session?directory=<ws>) with the job title.
    let create_url = format!("{base}/session?directory={}", urlencode(&workspace.to_string_lossy()));
    let resp = client
        .post(&create_url)
        .basic_auth("opencode", Some(pw))
        .json(&serde_json::json!({ "title": job.title }))
        .send()
        .map_err(|e| format!("failed to create session: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("create session failed: HTTP {}", resp.status()));
    }
    let session_id: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    let sid = session_id
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or("sidecar did not return a session id")?
        .to_string();

    // Start the prompt (POST /session/:id/prompt_async) — the turn streams
    // into the session like any interactive one, visible in History.
    let prompt_url = format!("{base}/session/{sid}/prompt_async");
    let resp = client
        .post(&prompt_url)
        .basic_auth("opencode", Some(pw))
        .json(&serde_json::json!({ "parts": [{ "type": "text", "text": job.prompt }] }))
        .send()
        .map_err(|e| format!("failed to start prompt: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("start prompt failed: HTTP {}", resp.status()));
    }
    Ok(())
}

fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Background loop: every TICK_SECS, fire every enabled, due job. Jobs keep
/// their due time until they actually fire, so a stopped runtime only delays
/// them, and firing reschedules the next run.
fn scheduler_loop(app: AppHandle) {
    loop {
        let due: Vec<JobRecord> = {
            let conn = match open(&app) {
                Ok(c) => c,
                Err(_) => {
                    std::thread::sleep(std::time::Duration::from_secs(TICK_SECS));
                    continue;
                }
            };
            let now = now_secs();
            let mut stmt = match conn.prepare(
                "SELECT id, title, prompt, schedule_kind, schedule_value, enabled, next_run_at, last_run_at FROM jobs WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?1",
            ) {
                Ok(s) => s,
                Err(_) => continue,
            };
            let mut out = Vec::new();
            if let Ok(rows) = stmt.query_map(params![now], row_to_job) {
                for row in rows.flatten() {
                    out.push(row);
                }
            }
            out
        };
        for job in due {
            match fire_job(&app, &job) {
                Ok(()) => {
                    if let Ok(conn) = open(&app) {
                        reschedule(&conn, &job);
                    }
                }
                Err(e) => {
                    eprintln!("cron: job {} failed: {e}", job.id);
                    // Leave next_run_at untouched: the job stays due and fires
                    // next tick after the runtime comes back.
                }
            }
        }
        std::thread::sleep(std::time::Duration::from_secs(TICK_SECS));
    }
}

/// Start the background scheduler; called once from setup. Idempotent.
pub fn start_scheduler(app: &AppHandle) {
    let handle = app.clone();
    std::thread::spawn(move || scheduler_loop(handle));
}

// ---- tests ----------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_shot_fires_once_and_expires() {
        let now = 1_700_000_000;
        assert_eq!(next_run("at", "1700000100", now), Some(1_700_000_100));
        // A past one-shot never runs again.
        assert_eq!(next_run("at", "1699999999", now), None);
        // Invalid timestamps are rejected.
        assert_eq!(next_run("at", "banana", now), None);
    }

    #[test]
    fn every_repeats_at_least_five_seconds_out() {
        let now = 1_700_000_000;
        assert_eq!(next_run("every", "3600", now), Some(now + 3600));
        assert_eq!(next_run("every", "1", now), Some(now + 5)); // clamped
        assert_eq!(next_run("every", "garbage", now), None);
    }

    #[test]
    fn cron_minute_hour_match() {
        // Every day at 09:30 → next is the next in-future 09:30 boundary.
        // 2023-11-06 was a Monday; 09:30 UTC = 1699263000.
        let monday_0945 = 1_699_263_900; // 2023-11-06T09:45:00Z (after 09:30)
        assert_eq!(next_run("cron", "30 9 * * *", monday_0945), Some(1_699_349_400)); // 2023-11-07T09:30:00Z
        let monday_0915 = 1_699_262_100; // 2023-11-06T09:15:00Z (before 09:30)
        assert_eq!(next_run("cron", "30 9 * * *", monday_0915), Some(1_699_263_000)); // 2023-11-06T09:30:00Z
    }

    #[test]
    fn cron_weekday_only() {
        // Every Monday 08:00. 2023-11-06T08:00:00Z = 1699257600.
        let monday_08 = 1_699_257_600;
        let sunday_noon = monday_08 - 20 * 3600; // 2023-11-05T12:00:00Z
        assert_eq!(next_run("cron", "0 8 * * mon", sunday_noon), Some(monday_08));
    }

    #[test]
    fn cron_named_months() {
        // 00:00 on the 1st of January — from December, next is Jan 1 next year.
        let dec15 = 1_702_598_400; // 2023-12-15T00:00:00Z
        let jan1 = 1_704_067_200; // 2024-01-01T00:00:00Z
        assert_eq!(next_run("cron", "0 0 1 jan *", dec15), Some(jan1));
    }

    #[test]
    fn cron_step_and_lists() {
        // Every 15 minutes (from 2023-11-14T21:33:20Z, next is 21:45).
        let t = 1_699_997_600;
        let next = next_run("cron", "*/15 * * * *", t).unwrap();
        assert!(next % 900 == 0 && next > t);
        assert_eq!(next, 1_699_998_300); // 21:45
        // 09:00 and 17:00 weekdays: from 2023-11-09T10:00 (Thu), next 17:00.
        let thursday_10am = 1_699_524_000;
        let next = next_run("cron", "0 9,17 * * 1-5", thursday_10am).unwrap();
        assert_eq!(next, 1_699_549_200); // 2023-11-09T17:00:00Z
    }

    #[test]
    fn civil_arithmetic_roundtrip() {
        // Known anchor: 1970-01-01 → day 0.
        assert_eq!(days_from_civil(1970, 1, 1), 0);
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        // Leap day.
        assert_eq!(days_from_civil(2024, 2, 29), days_from_civil(2024, 3, 1) - 1);
        assert_eq!(civil_from_days(days_from_civil(2024, 2, 29)), (2024, 2, 29));
    }

    #[test]
    fn day_of_week_known_values() {
        // 1970-01-01 Thursday (4); 2023-11-06 Monday (1).
        assert_eq!(day_of_week(1970, 1, 1), 4);
        assert_eq!(day_of_week(2023, 11, 6), 1);
    }
}