// Scheduled agent jobs ("AI cowork automation"): run an OpenCode session
// turn on a schedule — once at a timestamp, on an interval, or on a cron
// expression — by asking the running sidecar to create a session and start a
// prompt in the active workspace. The job store lives in an app-private
// SQLite DB so schedules survive restarts; a background thread polls for due
// jobs and fires them through the sidecar HTTP API (Basic-auth protected like
// the gateway proxying does).
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::{Datelike, TimeZone};
use rusqlite::{params, Connection};
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
    /// The failure the last attempted fire hit, when it did not succeed.
    /// Surfaced on the Tasks page — a job can only fail silently in a
    /// background thread, and a silent failure reads as "it just never ran".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    /// Consecutive failed fires (drives the retry backoff). Internal only.
    #[serde(skip)]
    pub fail_count: i64,
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
    last_run_at INTEGER,
    last_error TEXT,
    fail_count INTEGER NOT NULL DEFAULT 0
);";

/// Tiny key/value table for install-time markers (the starter-task seed flag).
const CREATE_META_SQL: &str = "\
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);";

/// Columns added after the first shipped schema; a fresh DB already has them,
/// so the "duplicate column" error each migration re-raises is expected and
/// ignored.
fn migrate(conn: &Connection) {
    let _ = conn.execute_batch("ALTER TABLE jobs ADD COLUMN last_error TEXT;");
    let _ =
        conn.execute_batch("ALTER TABLE jobs ADD COLUMN fail_count INTEGER NOT NULL DEFAULT 0;");
    let _ = conn.execute_batch(CREATE_META_SQL);
}

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
    migrate(&conn);
    Ok(conn)
}

/// Open the in-memory store used by tests (same schema + migration).
#[cfg(test)]
fn open_memory() -> Connection {
    let conn = Connection::open_in_memory().expect("in-memory db");
    conn.execute_batch(CREATE_SQL).expect("create schema");
    migrate(&conn);
    conn
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
        last_error: row.get(8)?,
        fail_count: row.get(9)?,
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
fn parse_field(field: &str, min: usize, max: usize, names: &[(&str, usize)]) -> Option<Vec<usize>> {
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

/// Compute the next run for a cron expression strictly after `now` (unix secs).
/// The wall-clock fields (hour, day, …) are evaluated in LOCAL time — "daily at
/// 07:00" must mean 07:00 on the user's clock, not 07:00 UTC — so each matching
/// local wall minute is resolved back to a real instant (earliest unambiguous
/// one for a DST-ambiguous hour). A missing local minute (spring-forward) is
/// skipped. Searches the next ~10 years; every valid expression matches within
/// a year, so this always terminates.
fn next_cron(expr: &str, now: i64) -> Option<i64> {
    let cf = CronFields::parse(expr)?;
    let dom_star = cf.doms.len() == 31;
    let dow_star = cf.dows.len() == 7;
    let tz = chrono::Local;
    let first_day = tz.timestamp_opt(now, 0).single()?.date_naive();
    for step in 0..(10 * 366) {
        let date = first_day.checked_add_signed(chrono::Duration::days(step))?;
        let mo = date.month0() as usize + 1;
        if !cf.months.contains(&mo) {
            continue;
        }
        let dow = date.weekday().num_days_from_sunday() as usize;
        let d = date.day() as usize;
        let day_ok = match (dom_star, dow_star) {
            (true, true) => true,
            (true, false) => cf.dows.contains(&dow),
            (false, true) => cf.doms.contains(&d),
            (false, false) => cf.doms.contains(&d) || cf.dows.contains(&dow),
        };
        if !day_ok {
            continue;
        }
        for hour in &cf.hours {
            for minute in &cf.minutes {
                // The named local wall minute → a real instant. Ambiguous
                // (repeated) minutes resolve to their earliest occurrence;
                // skipped minutes have none and are left out.
                let resolved = match tz.with_ymd_and_hms(
                    date.year(),
                    date.month(),
                    date.day(),
                    *hour as u32,
                    *minute as u32,
                    0,
                ) {
                    chrono::LocalResult::Single(dt) => Some(dt.timestamp()),
                    chrono::LocalResult::Ambiguous(early, _) => Some(early.timestamp()),
                    chrono::LocalResult::None => None,
                };
                if let Some(t) = resolved {
                    if t > now {
                        return Some(t);
                    }
                }
            }
        }
    }
    None
}

// ---- persistence ----------------------------------------------------------

/// List every job, newest created first.
#[tauri::command]
pub fn list_jobs(app: AppHandle) -> Result<Vec<JobRecord>, String> {
    let conn = open(&app)?;
    let mut stmt = conn
        .prepare("SELECT id, title, prompt, schedule_kind, schedule_value, enabled, next_run_at, last_run_at, last_error, fail_count FROM jobs ORDER BY rowid DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], row_to_job).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewJob {
    pub title: String,
    pub prompt: String,
    pub schedule_kind: String,
    pub schedule_value: String,
}

/// Insert a job row and compute its first due time. Shared by create_job and
/// the starter-task seeding so both get identical semantics.
fn insert_job(
    conn: &Connection,
    title: &str,
    prompt: &str,
    kind: &str,
    value: &str,
) -> Result<JobRecord, String> {
    let next = if kind == "event" {
        None
    } else {
        Some(
            next_run(kind, value, now_secs())
                .ok_or_else(|| "invalid schedule value".to_string())?,
        )
    };
    let title = if title.trim().is_empty() {
        "Scheduled job".to_string()
    } else {
        title.trim().to_string()
    };
    let id = random_hex(8);
    conn.execute(
        "INSERT INTO jobs (id, title, prompt, schedule_kind, schedule_value, enabled, next_run_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)",
        params![id, title, prompt, kind, value, next],
    )
    .map_err(|e| e.to_string())?;
    Ok(JobRecord {
        id,
        title,
        prompt: prompt.to_string(),
        schedule_kind: kind.to_string(),
        schedule_value: value.to_string(),
        enabled: true,
        next_run_at: next,
        last_run_at: None,
        last_error: None,
        fail_count: 0,
    })
}

/// Create a scheduled job and compute its first due time. The sidecar must be
/// running for the job to fire, but a job may be created anytime. The page
/// spells out the friendly kinds ("daily", "weekday") for skill presets, but
/// both are internally 5-field cron expressions, so they normalize here.
#[tauri::command]
pub fn create_job(app: AppHandle, job: NewJob) -> Result<JobRecord, String> {
    let kind = normalize_kind(&job.schedule_kind);
    if !matches!(kind, "at" | "every" | "cron" | "event") {
        return Err(format!("unknown schedule kind \"{kind}\""));
    }
    let conn = open(&app)?;
    insert_job(
        &conn,
        &job.title,
        &job.prompt,
        kind,
        job.schedule_value.trim(),
    )
}

/// "daily" and "weekday" are cron expressions with a friendlier page label.
fn normalize_kind(kind: &str) -> &str {
    match kind.trim() {
        "daily" | "weekday" => "cron",
        k => k,
    }
}

/// Delete a job.
#[tauri::command]
pub fn delete_job(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open(&app)?;
    conn.execute("DELETE FROM jobs WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Toggle a job's enabled state. Disabling stops it firing; enabling recomputes
/// the next run when the stored one has gone stale (e.g. a paused daily job
/// resurfacing a week later must fire at its next slot, not the missed one —
/// and an expired one-shot is marked finished instead of firing late).
#[tauri::command]
pub fn set_job_enabled(app: AppHandle, id: String, enabled: bool) -> Result<JobRecord, String> {
    let conn = open(&app)?;
    conn.execute(
        "UPDATE jobs SET enabled = ?2 WHERE id = ?1",
        params![id, enabled as i64],
    )
    .map_err(|e| e.to_string())?;
    let mut job = fetch_job(&conn, &id).ok_or_else(|| "job not found".to_string())?;
    if enabled {
        let next = recompute_stale_schedule(&conn, &job, now_secs());
        if next != job.next_run_at {
            job.next_run_at = next;
        }
    }
    Ok(job)
}

/// Recompute a just-enabled job's next run when the stored time is in the
/// past: for repeating schedules the next future slot, for a passed one-shot
/// None (finished — the moment never returns). Returns the existing value
/// untouched when it is still in the future. Writes back to the store.
fn recompute_stale_schedule(conn: &Connection, job: &JobRecord, now: i64) -> Option<i64> {
    let stale = matches!(job.next_run_at, Some(t) if t <= now);
    if !stale {
        return job.next_run_at;
    }
    // A one-shot whose moment passed is finished — never re-fired late. A
    // repeating schedule picks up at its next future slot instead of
    // stampeding every missed run at once.
    let next = match job.schedule_kind.as_str() {
        "at" => None,
        _ => next_run(&job.schedule_kind, &job.schedule_value, now),
    };
    let _ = conn.execute(
        "UPDATE jobs SET next_run_at = ?2 WHERE id = ?1",
        params![job.id, next],
    );
    next
}

/// Fire a job now, immediately and unconditionally (a "run now" button). A
/// successful fire reschedules the next run, so the job is not fired again
/// next tick by the scheduler while the stored due time is still in the past.
#[tauri::command]
pub fn run_job_now(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open(&app)?;
    let job = fetch_job(&conn, &id).ok_or_else(|| "job not found".to_string())?;
    match fire_job(&app, &job) {
        Ok(()) => {
            reschedule(&conn, &job);
            Ok(())
        }
        Err(e) => {
            record_failure(&conn, &job, &e);
            Err(e)
        }
    }
}

/// Trigger all enabled jobs subscribed to an event name.
pub fn trigger_event_jobs(app: &AppHandle, event_name: &str) {
    let Ok(conn) = open(app) else {
        return;
    };
    let mut stmt = match conn.prepare(
        "SELECT id, title, prompt, schedule_kind, schedule_value, enabled, next_run_at, last_run_at, last_error, fail_count FROM jobs WHERE enabled = 1 AND schedule_kind = 'event' AND schedule_value = ?1",
    ) {
        Ok(s) => s,
        Err(_) => return,
    };
    let Ok(rows) = stmt.query_map(params![event_name], row_to_job) else {
        return;
    };
    // Collect first: firing (and recording failures) writes to the same table
    // the cursor is walking, so the read must finish before the writes begin.
    let due: Vec<JobRecord> = rows.flatten().collect();
    for job in due {
        match fire_job(app, &job) {
            Ok(()) => reschedule(&conn, &job),
            Err(e) => {
                eprintln!("cron: job {} failed: {e}", job.id);
                record_failure(&conn, &job, &e);
            }
        }
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
        "SELECT id, title, prompt, schedule_kind, schedule_value, enabled, next_run_at, last_run_at, last_error, fail_count FROM jobs WHERE id = ?1",
        params![id],
        row_to_job,
    )
    .ok()
}

/// Query a job's stored schedule and persist the next run time after a fire.
/// Also clears any recorded failure: the job just succeeded.
fn reschedule(conn: &Connection, job: &JobRecord) {
    let next = if job.enabled {
        next_run(&job.schedule_kind, &job.schedule_value, now_secs())
    } else {
        None
    };
    let _ = conn.execute(
        "UPDATE jobs SET next_run_at = ?2, last_run_at = ?3, last_error = NULL, fail_count = 0 WHERE id = ?1",
        params![job.id, next, now_secs()],
    );
}

/// Record a failed fire: surface the error on the job record and back the next
/// attempt off exponentially (1m, 2m, 4m … capped at 30m) so a persistently
/// failing job — runtime down, provider error, unreachable workspace — cannot
/// hammer the runtime every 30-second tick. A success later reschedules from
/// the stored schedule and clears the error, so this only shapes retries.
/// The consecutive-failure count is re-read from the store: the caller's job
/// snapshot may be stale when the scheduler and a manual fire overlap.
fn record_failure(conn: &Connection, job: &JobRecord, error: &str) -> i64 {
    let current: i64 = conn
        .query_row(
            "SELECT fail_count FROM jobs WHERE id = ?1",
            params![job.id],
            |r| r.get(0),
        )
        .unwrap_or(job.fail_count);
    let fails = current + 1;
    let backoff: i64 = (60 * (1u64 << (fails - 1).min(5) as u32) as i64).min(1800);
    let next = if job.schedule_kind == "event" {
        None
    } else {
        Some(now_secs() + backoff)
    };
    let _ = conn.execute(
        "UPDATE jobs SET next_run_at = COALESCE(?2, next_run_at), last_run_at = ?3, last_error = ?4, fail_count = ?5 WHERE id = ?1",
        params![job.id, next, now_secs(), error, fails],
    );
    fails
}

// ---- firing ---------------------------------------------------------------

/// Ask the running sidecar to create a session in the active workspace and
/// start the job's prompt in it. Mirrors the gateway's auth (Basic
/// `opencode:<password>`), so only the running app can fire a job.
fn fire_job(app: &AppHandle, job: &JobRecord) -> Result<(), String> {
    let state = app.state::<RuntimeState>();
    let base = sidecar_url(state.inner())
        .ok_or_else(|| "agent runtime not started — launch Prism and wait for the runtime, then the task fires on its next due time".to_string())?;
    let pw = server_password();
    // The session must be scoped to the active workspace, exactly like the
    // SDK's createSession and the gateway's proxy do — the directory query is
    // what routes the turn to the right OpenCode instance. A missing workspace
    // path is the classic "agent failed to run in this workspace path" failure
    // (the folder was deleted, moved, or is on an unmounted volume), so the
    // path is (re-)created before it is handed to the sidecar.
    let workspace =
        workspace_dir(app).map_err(|e| format!("could not resolve the workspace path: {e}"))?;
    if let Err(e) = std::fs::create_dir_all(&workspace) {
        return Err(format!(
            "workspace path {} is not available: {e}",
            workspace.display()
        ));
    }

    let client = reqwest::blocking::Client::builder()
        // The scheduler thread is a singleton: a stalled sidecar connection
        // must time out, or every scheduled task freezes behind this call.
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    // Create the session (POST /session?directory=<ws>) with the job title.
    let create_url = format!(
        "{base}/session?directory={}",
        urlencode(&workspace.to_string_lossy())
    );
    let resp = client
        .post(&create_url)
        .basic_auth("opencode", Some(pw))
        .json(&serde_json::json!({ "title": job.title }))
        .send()
        .map_err(|e| format!("agent runtime unreachable at {base}: {e}"))?;
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
        .map_err(|e| format!("agent runtime unreachable at {base}: {e}"))?;
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
                "SELECT id, title, prompt, schedule_kind, schedule_value, enabled, next_run_at, last_run_at, last_error, fail_count FROM jobs WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?1",
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
                    // Surface the failure on the job record and back off before
                    // retrying, so a persistently failing job cannot hammer
                    // the runtime every tick and the error is visible on the
                    // Tasks page.
                    if let Ok(conn) = open(&app) {
                        record_failure(&conn, &job, &e);
                    }
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

// ---- starter (default) tasks -----------------------------------------------

/// Meta marker so starter tasks are seeded exactly once per install. Deleting
/// a starter task afterwards sticks: the marker is set, nothing re-seeds.
const SEED_MARK: &str = "starter_tasks_seeded";

/// The prompt the "Daily AI Research Digest" starter task fires with. Agent
/// content sent verbatim to the model — English only, never UI copy.
const DIGEST_PROMPT: &str = r#"Compile today's AI research digest as a self-contained HTML report. Search the web across these topics: Machine Learning, MLOps, Deep Learning, Early Alzheimer's Detection, Vision-Language Models (VLM), and Agentic AI. Sources: arXiv preprints from the last 48 hours, Hugging Face trending models and blog posts, GitHub trending AI repositories, and major AI news sites.

SPECIAL PRIORITY - EARLY ALZHEIMER'S DETECTION: give this topic its own dedicated section at the top. Track new papers on MRI/PET-based classification, MCI-to-AD conversion prediction, efficient CNN/transformer models for clinical deployment, explainability in medical imaging AI, and hybrid systems combining ML models with symbolic or rule-based safety gates. Flag anything directly relevant to the ongoing "NeuroDetect Lite" work (AD MRI benchmarks, efficient architectures, MMSE/cognitive-score integration, FDA/CE regulatory news for AD imaging AI).

Structure the digest as bullet points grouped by topic, in this order: Early Alzheimer's Detection, General AI / Industry, Model Releases, Deep Learning / Research, Vision-Language Models, MLOps & Infra, Agentic AI, Neuroscience & Alzheimer's AI. For each notable item include a header (title, author(s), publication date), a clear 2-3 sentence plain-English summary, a short limitations note, and the source link. End with a "Top 3 takeaways" section for the day.

OUTPUT: write everything into ONE HTML file: digests/digest-YYYY-MM-DD.html in the current workspace (create the digests folder if it does not exist; use today's date). All CSS must be embedded in the file — no external dependencies, works offline. Include a title header with the date, a table of contents with anchor links to each section, the dedicated Alzheimer's section at the top, the topic sections, the Top 3 takeaways, and a fine-print footer reading "Auto-generated by Prism Tasks".

Work topic by topic — search, summarize, write that section to the file, then move on — instead of holding the entire digest in memory; append to the file incrementally. Finish your reply with the exact file path you wrote and a five-line summary of the day's highlights."#;

/// The prompt the "Hermes AI Coach" starter task fires with. Agent content
/// sent verbatim to the model — English only, never UI copy.
const COACH_PROMPT: &str = r#"Act as the user's personal learning-and-career coach. Keep persistent state across runs in coach/state.md inside the current workspace (create the folder and file on first run): goals, learning tracks, milestones, and the application pipeline with deadlines. Read it FIRST, plan from it, then update it.

Background: the user researches lightweight deep learning for early Alzheimer's detection (Master's thesis: "NeuroDetect Lite: a hybrid clinical decision support system for lightweight Alzheimer's MRI classification with a symbolic MMSE safety gate") and is pursuing AI industry roles and PhD programs in Italy.

Today's brief:
1. Review coach/state.md and any new notes in the workspace; update learning progress, milestones, and application statuses.
2. Search the web for NEW items worth today's attention, deduplicated against state.md: PhD openings in AI/ML at Italian universities and research centers (e.g. Politecnico di Milano, Politecnico di Torino, Sapienza, Bologna, Pisa, Trento, SISSA, IMT Lucca, FBK, IIT), relevant fellowships and scholarships, industry roles (ML engineer / applied scientist / research engineer) in Italy, and conference, grant, or application deadlines.
3. Anything closing within 10 days goes at the top of the brief, each with the exact deadline date and a link.
4. Produce a short daily plan: 3 learning tasks, 1 career task, 1 research task tied to NeuroDetect Lite. Keep it achievable in about 4 hours of focused work.
5. Update coach/state.md with anything new (deadlines found, status changes, next actions) and append a one-line history entry with today's date.

Reply concisely: deadlines found (with links), the daily plan, and one suggested focus for the week. If web access is unavailable in this run, say so explicitly and work from what is already recorded in state.md."#;

/// Built-in starter jobs, seeded on first launch so a fresh install wakes up
/// with useful automations instead of a blank Tasks page. (title, prompt,
/// schedule kind, schedule value).
const DEFAULT_JOBS: &[(&str, &str, &str, &str)] = &[
    (
        "Daily AI Research Digest",
        DIGEST_PROMPT,
        "cron",
        "0 7 * * *",
    ),
    ("Hermes AI Coach", COACH_PROMPT, "cron", "0 7 * * *"),
];

/// Seed the starter tasks once per install, guarded by the meta marker so a
/// deliberately deleted starter task is NOT resurrected on the next launch.
/// Called once from app setup.
pub fn seed_default_jobs(app: &AppHandle) {
    let Ok(conn) = open(app) else { return };
    if seed_guarded(&conn).unwrap_or(false) {
        return;
    }
    if let Err(e) = seed_missing_defaults(&conn) {
        eprintln!("cron: seeding starter tasks failed: {e}");
    }
    let _ = meta_set(&conn, SEED_MARK, "1");
}

/// Positive when the one-time seed mark is already recorded.
fn seed_guarded(conn: &Connection) -> Result<bool, String> {
    Ok(meta_get(conn, SEED_MARK)?.is_some())
}

/// Insert every starter task that is not currently present (matched by title).
/// Also behind the Tasks page's "Restore starter tasks" action, which is why
/// it is deliberately unconditional: an explicit user action may re-add a
/// deleted starter task. Returns how many were added.
fn seed_missing_defaults(conn: &Connection) -> Result<usize, String> {
    let mut added = 0;
    for (title, prompt, kind, value) in DEFAULT_JOBS {
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM jobs WHERE title = ?1",
                params![title],
                |r| r.get::<_, i64>(0),
            )
            .map(|c| c > 0)
            .map_err(|e| e.to_string())?;
        if !exists {
            insert_job(conn, title, prompt, kind, value)?;
            added += 1;
        }
    }
    Ok(added)
}

/// Re-add the built-in starter tasks that are missing ("Restore starter
/// tasks" on the Tasks page). Returns the number of tasks added.
#[tauri::command]
pub fn restore_default_jobs(app: AppHandle) -> Result<usize, String> {
    let conn = open(&app)?;
    seed_missing_defaults(&conn)
}

fn meta_get(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    conn.query_row("SELECT value FROM meta WHERE key = ?1", params![key], |r| {
        r.get(0)
    })
    .map(Some)
    .or_else(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(other.to_string()),
    })
}

fn meta_set(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
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
        force_utc();
        // Every day at 09:30 → next is the next in-future 09:30 boundary.
        // 2023-11-06 was a Monday; 09:30 UTC = 1699263000.
        let monday_0945 = 1_699_263_900; // 2023-11-06T09:45:00Z (after 09:30)
        assert_eq!(
            next_run("cron", "30 9 * * *", monday_0945),
            Some(1_699_349_400)
        ); // 2023-11-07T09:30:00Z
        let monday_0915 = 1_699_262_100; // 2023-11-06T09:15:00Z (before 09:30)
        assert_eq!(
            next_run("cron", "30 9 * * *", monday_0915),
            Some(1_699_263_000)
        ); // 2023-11-06T09:30:00Z
    }

    #[test]
    fn cron_weekday_only() {
        force_utc();
        // Every Monday 08:00. 2023-11-06T08:00:00Z = 1699257600.
        let monday_08 = 1_699_257_600;
        let sunday_noon = monday_08 - 20 * 3600; // 2023-11-05T12:00:00Z
        assert_eq!(
            next_run("cron", "0 8 * * mon", sunday_noon),
            Some(monday_08)
        );
    }

    #[test]
    fn cron_named_months() {
        force_utc();
        // 00:00 on the 1st of January — from December, next is Jan 1 next year.
        let dec15 = 1_702_598_400; // 2023-12-15T00:00:00Z
        let jan1 = 1_704_067_200; // 2024-01-01T00:00:00Z
        assert_eq!(next_run("cron", "0 0 1 jan *", dec15), Some(jan1));
    }

    #[test]
    fn cron_step_and_lists() {
        force_utc();
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
    fn daily_schedule_fires_when_stored_slot_is_later_today() {
        force_utc();
        // 2023-11-06T09:45 → the same day's 21:30, not tomorrow (the old
        // minute-scan bug this guard preserves against).
        let t = 1_699_263_900; // 2023-11-06T09:45:00Z
        let next = next_run("cron", "30 21 * * *", t).unwrap();
        assert_eq!(next, 1_699_306_200); // 2023-11-06T21:30:00Z
    }

    /// The cron wall-clock is LOCAL; tests need deterministic expectations.
    /// Rust test threads run in parallel, so every setter sets the same value.
    fn force_utc() {
        std::env::set_var("TZ", "UTC");
    }

    #[test]
    fn starter_tasks_seed_once_and_fill_only_missing() {
        force_utc();
        let conn = open_memory();
        assert_eq!(
            seed_missing_defaults(&conn).unwrap(),
            2,
            "both starters on empty"
        );
        // Idempotent: nothing to add while both titles exist.
        assert_eq!(seed_missing_defaults(&conn).unwrap(), 0);
        let one_gone = "DELETE FROM jobs WHERE title = 'Daily AI Research Digest'";
        conn.execute(one_gone, []).unwrap();
        assert_eq!(
            seed_missing_defaults(&conn).unwrap(),
            1,
            "only the deleted one"
        );
        let titles: Vec<String> = conn
            .prepare("SELECT title FROM jobs ORDER BY title")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(titles, ["Daily AI Research Digest", "Hermes AI Coach"]);
    }

    /// Mirrors seed_default_jobs' marker flow: guarded seed runs once; the
    /// explicit restore path bypasses the guard.
    #[test]
    fn starter_seed_marker_blocks_reseeding_but_restore_bypasses_it() {
        force_utc();
        let conn = open_memory();
        seed_missing_defaults(&conn).unwrap();
        meta_set(&conn, SEED_MARK, "1").unwrap();
        assert!(seed_guarded(&conn).unwrap());
        // Guarded seeding must not touch anything…
        conn.execute("DELETE FROM jobs", []).unwrap();
        assert!(seed_guarded(&conn).unwrap());
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM jobs", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            0,
            "no resurrection while the guard is set"
        );
        // …but an explicit user action re-adds the missing starters.
        assert_eq!(seed_missing_defaults(&conn).unwrap(), 2);
    }

    #[test]
    fn failures_record_error_and_back_off_then_success_reschedules_from_schedule() {
        force_utc();
        let conn = open_memory();
        let mut job = insert_job(&conn, "t", "p", "cron", "0 7 * * *").unwrap();
        let original_next = job.next_run_at.unwrap();
        record_failure(&conn, &job, "HTTP 502");
        let stored = fetch_job(&conn, &job.id).unwrap();
        assert!(
            stored.next_run_at.unwrap() > now_secs(),
            "retry pushed into the future, not re-fired every tick"
        );
        assert_eq!(stored.last_error.as_deref(), Some("HTTP 502"));
        assert_eq!(stored.fail_count, 1);

        // Backoff is exponential in the consecutive-failure count, capped.
        job.fail_count = 1;
        record_failure(&conn, &job, "second failure");
        let after_two = fetch_job(&conn, &job.id).unwrap();
        assert_eq!(after_two.fail_count, 2);
        assert!(after_two.next_run_at.unwrap() > stored.next_run_at.unwrap());
        job.fail_count = 99;
        record_failure(&conn, &job, "many failures");
        let capped = fetch_job(&conn, &job.id).unwrap();
        assert!(
            capped.next_run_at.unwrap() - now_secs() <= 1800 + 5,
            "backoff is capped at 30 minutes"
        );

        // A success wipes the error and returns to the stored schedule.
        reschedule(&conn, &job);
        let healed = fetch_job(&conn, &job.id).unwrap();
        assert!(healed.last_error.is_none() && healed.fail_count == 0);
        assert_eq!(
            healed.next_run_at.unwrap(),
            original_next,
            "back on the daily 07:00 slot"
        );
    }

    #[test]
    fn recompute_stale_schedule_skips_missed_slots_on_enable() {
        force_utc();
        let conn = open_memory();
        // A daily 07:00 job paused for two days: its stored next run is past.
        let yesterday = now_secs() - 86_400;
        let mut job = insert_job(&conn, "t", "p", "cron", "0 7 * * *").unwrap();
        conn.execute(
            "UPDATE jobs SET next_run_at = ?2, enabled = 0 WHERE id = ?1",
            params![job.id, yesterday],
        )
        .unwrap();
        job.next_run_at = Some(yesterday);
        let next = recompute_stale_schedule(&conn, &job, now_secs());
        let fresh_next = next_run("cron", "0 7 * * *", now_secs()).unwrap();
        assert_eq!(
            next,
            Some(fresh_next),
            "next FUTURE slot, not the missed one"
        );
        assert!(
            conn.query_row(
                "SELECT next_run_at FROM jobs WHERE id = ?1",
                params![job.id],
                |r| r.get::<_, i64>(0)
            )
            .unwrap()
                == fresh_next,
            "stale time was written back"
        );
        // A still-future next run is left untouched.
        job.next_run_at = Some(now_secs() + 3600);
        assert_eq!(
            recompute_stale_schedule(&conn, &job, now_secs()),
            Some(now_secs() + 3600),
            "pending job keeps its schedule"
        );
        // A passed one-shot is finished, not fired late.
        let expired = insert_job(&conn, "one", "p", "at", "9999999999").unwrap();
        conn.execute(
            "UPDATE jobs SET next_run_at = ?2 WHERE id = ?1",
            params![expired.id, now_secs() - 10],
        )
        .unwrap();
        let mut expired_job = fetch_job(&conn, &expired.id).unwrap();
        expired_job.next_run_at = Some(now_secs() - 10);
        assert_eq!(
            recompute_stale_schedule(&conn, &expired_job, now_secs()),
            None
        );
    }
}
