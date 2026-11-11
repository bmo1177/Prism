//! `prism agent` — the headless CLI for driving a running Prism app.
//!
//! The app's Remote Access Gateway (loopback :4098 by default) exposes the
//! `/v1` contract; this module is the thin, script-friendly client for it.
//!
//! Contract (see docs/agent-api.md):
//! - JSON on **stdout** by default; `--human` for a readable summary.
//! - Every failure is an envelope on stdout, never stderr:
//!   `{ "error": { "code": "...", "message": "...", "hint": "..." } }`
//! - Exit codes: 0 ok · 1 user error · 2 transport · 3 not found.
//!
//! The app must be running with Remote Access enabled — the CLI never starts
//! the gateway itself (that would break the app's single-instance rule).

use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Duration;

use serde_json::{json, Value};

/// Bundle identifier from `tauri.conf.json`; the gateway config lives under
/// `<data_dir>/<identifier>/runtime/gateway.txt`.
const APP_IDENTIFIER: &str = "com.prism.desktop";

// ---- errors -----------------------------------------------------------------

#[derive(Debug)]
pub(crate) struct CliError {
    pub(crate) code: &'static str,
    pub(crate) message: String,
    pub(crate) hint: String,
    pub(crate) exit: u8,
}

impl CliError {
    pub(crate) fn user(message: impl Into<String>, hint: impl Into<String>) -> Self {
        CliError { code: "user_error", message: message.into(), hint: hint.into(), exit: 1 }
    }
    pub(crate) fn app_not_running(message: impl Into<String>, hint: impl Into<String>) -> Self {
        CliError { code: "app_not_running", message: message.into(), hint: hint.into(), exit: 2 }
    }
    pub(crate) fn transport(message: impl Into<String>, hint: impl Into<String>) -> Self {
        CliError { code: "transport_error", message: message.into(), hint: hint.into(), exit: 2 }
    }
    pub(crate) fn not_found(message: impl Into<String>, hint: impl Into<String>) -> Self {
        CliError { code: "not_found", message: message.into(), hint: hint.into(), exit: 3 }
    }
}

fn print_error(e: &CliError) {
    let envelope = json!({
        "error": {
            "code": e.code,
            "message": e.message,
            "hint": e.hint,
        }
    });
    println!("{}", serde_json::to_string(&envelope).unwrap_or_else(|_| e.message.clone()));
}

// ---- config discovery -------------------------------------------------------

#[derive(Debug)]
pub(crate) struct GatewayConfig {
    pub(crate) token: String,
    pub(crate) url: String,
}

fn config_path() -> Option<PathBuf> {
    dirs::data_dir().map(|d| d.join(APP_IDENTIFIER).join("runtime").join("gateway.txt"))
}

/// Read the token + bound port the app persisted. `--url` / `--token` override
/// both, so CI can point at a non-default port without touching the file.
pub(crate) fn resolve_config(args: &Args) -> Result<GatewayConfig, CliError> {
    if let Some(url) = &args.url {
        let token = args
            .token
            .clone()
            .ok_or_else(|| CliError::user("--url given without --token", "pass --token <gateway-token>"))?;
        return Ok(GatewayConfig { token, url: url.clone() });
    }

    let path = config_path().ok_or_else(|| {
        CliError::user(
            "could not resolve the Prism data directory",
            "pass --url and --token explicitly",
        )
    })?;
    if !path.exists() {
        return Err(CliError::app_not_running(
            "Prism is not running (gateway config not found)",
            "open Prism and enable Remote Access in Settings → Remote Access, or pass --url and --token",
        ));
    }
    let text = std::fs::read_to_string(&path).map_err(|e| {
        CliError::user(
            format!("could not read {}: {e}", path.display()),
            "check the file is readable by your user",
        )
    })?;

    // Same grammar the gateway writes (single source of truth).
    let p = crate::gateway::parse_persisted(&text);
    if !p.enabled {
        return Err(CliError {
            code: "gateway_disabled",
            message: "Prism Remote Access is disabled".into(),
            hint: "enable it in Prism → Settings → Remote Access".into(),
            exit: 1,
        });
    }
    if p.token.is_empty() {
        return Err(CliError {
            code: "no_token",
            message: "Prism gateway token is missing".into(),
            hint: "enable Remote Access (or regenerate the token) in Prism → Settings".into(),
            exit: 1,
        });
    }
    if p.port == 0 {
        return Err(CliError::app_not_running(
            "Prism gateway is not running",
            "start Prism so the gateway is up, then retry",
        ));
    }
    Ok(GatewayConfig { token: p.token, url: format!("http://127.0.0.1:{}", p.port) })
}

// ---- HTTP -------------------------------------------------------------------

fn http_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .unwrap_or_else(|_| reqwest::blocking::Client::new())
}

/// One authenticated call. Never prints: the caller decides the shape.
fn call(cfg: &GatewayConfig, method: &str, path: &str, body: Option<Value>) -> Result<Value, CliError> {
    let url = format!("{}{}", cfg.url.trim_end_matches('/'), path);
    let client = http_client();
    let req = match method {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "DELETE" => client.delete(&url),
        _ => return Err(CliError::user(format!("unsupported method {method}"), "this is a bug in the CLI")),
    };
    let req = req.header("Authorization", format!("Bearer {}", cfg.token));
    let req = match body {
        Some(b) => req.json(&b),
        None => req,
    };

    let resp = req.send().map_err(|e| {
        if e.is_connect() {
            CliError::app_not_running(
                format!("gateway unreachable at {}: connection refused", cfg.url),
                "start Prism so the gateway is up, or pass --url",
            )
        } else {
            CliError::transport(
                format!("gateway request failed at {}: {e}", cfg.url),
                "check network connectivity or retry",
            )
        }
    })?;
    let status = resp.status();
    let text = resp.text().unwrap_or_default();
    let value: Value = if text.trim().is_empty() {
        json!({ "ok": true })
    } else {
        serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }))
    };

    if status.is_success() {
        return Ok(value);
    }
    let message = value
        .get("error")
        .and_then(|e| e.as_str())
        .map(|s| s.to_string())
        .or_else(|| value.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()))
        .unwrap_or_else(|| format!("gateway returned HTTP {status}"));
    match status.as_u16() {
        401 => Err(CliError {
            code: "unauthorized",
            message: format!("unauthorized: {message}"),
            hint: "the gateway token changed — re-read it from Prism → Settings → Remote Access, or pass --token".into(),
            exit: 1,
        }),
        403 => Err(CliError {
            code: "read_only_mode",
            message: format!("forbidden: {message}"),
            hint: "the gateway is in read-only mode; enable full access in Prism → Settings → Remote Access".into(),
            exit: 1,
        }),
        404 => Err(CliError::not_found(message, "check the id and retry")),
        _ => Err(CliError::user(format!("gateway error: {message}"), "retry; if it persists, restart Prism")),
    }
}

// ---- commands ---------------------------------------------------------------

fn cmd_status(cfg: &GatewayConfig, human: bool) -> Result<Value, CliError> {
    let whoami = call(cfg, "GET", "/v1/whoami", None)?;
    let mode = whoami.get("mode").and_then(|m| m.as_str()).unwrap_or("unknown");
    let directory = whoami.get("directory").and_then(|d| d.as_str()).unwrap_or("");
    let out = json!({
        "ok": true,
        "url": cfg.url,
        "mode": mode,
        "directory": directory,
    });
    if human {
        println!("Prism gateway: running ({mode}) at {url}", url = cfg.url);
        if !directory.is_empty() {
            println!("workspace: {directory}");
        }
    } else {
        println!("{}", serde_json::to_string(&out).unwrap());
    }
    Ok(out)
}

fn cmd_sessions_list(cfg: &GatewayConfig, human: bool) -> Result<Value, CliError> {
    let v = call(cfg, "GET", "/v1/sessions", None)?;
    let sessions = v.as_array().cloned().unwrap_or_default();
    if human {
        if sessions.is_empty() {
            println!("no sessions");
        } else {
            for s in &sessions {
                let id = s.get("id").and_then(|x| x.as_str()).unwrap_or("?");
                let title = s.get("title").and_then(|x| x.as_str()).unwrap_or("(untitled)");
                println!("{id}\t{title}");
            }
        }
    } else {
        println!("{}", serde_json::to_string(&v).unwrap());
    }
    Ok(v)
}

fn cmd_sessions_show(cfg: &GatewayConfig, id: &str, human: bool) -> Result<Value, CliError> {
    let v = call(cfg, "GET", &format!("/v1/sessions/{}/messages", enc(id)), None)?;
    if human {
        // A message list is awkward to tabulate; pretty-print is the honest view.
        println!("{}", serde_json::to_string_pretty(&v).unwrap());
    } else {
        println!("{}", serde_json::to_string(&v).unwrap());
    }
    Ok(v)
}

fn cmd_prompt(cfg: &GatewayConfig, session: &str, text: &str, human: bool) -> Result<Value, CliError> {
    if text.trim().is_empty() {
        return Err(CliError::user("prompt text is empty", "pass the text as the last argument"));
    }
    let body = json!({ "text": text });
    let v = call(cfg, "POST", &format!("/v1/sessions/{}/prompt", enc(session)), Some(body))?;
    if human {
        // The upstream response carries the assistant text when OpenCode returns it.
        if let Some(t) = v.get("text").and_then(|x| x.as_str()) {
            println!("{t}");
        } else {
            println!("{}", serde_json::to_string_pretty(&v).unwrap());
        }
    } else {
        println!("{}", serde_json::to_string(&v).unwrap());
    }
    Ok(v)
}

fn cmd_provenance_list(cfg: &GatewayConfig, session: Option<&str>, human: bool) -> Result<Value, CliError> {
    let mut q = serde_json::Map::new();
    q.insert("limit".into(), json!(100));
    if let Some(s) = session {
        q.insert("sessionId".into(), json!(s));
    }
    let query = serde_json::to_string(&Value::Object(q)).unwrap();
    let path = format!("/v1/provenance/query?q={}", enc(&query));
    let v = call(cfg, "GET", &path, None)?;
    let rows = v.get("rows").and_then(|r| r.as_array()).cloned().unwrap_or_default();
    if human {
        if rows.is_empty() {
            println!("no provenance recorded");
        } else {
            for r in &rows {
                let path = r.get("path").and_then(|x| x.as_str()).unwrap_or("?");
                let version = r.get("version").and_then(|x| x.as_u64()).unwrap_or(0);
                let tool = r.get("tool").and_then(|x| x.as_str()).unwrap_or("");
                println!("{path}\tv{version}\t{tool}");
            }
        }
    } else {
        println!("{}", serde_json::to_string(&v).unwrap());
    }
    Ok(v)
}

fn cmd_jobs_list(cfg: &GatewayConfig, human: bool) -> Result<Value, CliError> {
    let v = call(cfg, "GET", "/v1/jobs", None)?;
    let jobs = v.as_array().cloned().unwrap_or_default();
    if human {
        if jobs.is_empty() {
            println!("no scheduled tasks");
        } else {
            for j in &jobs {
                let id = j.get("id").and_then(|x| x.as_str()).unwrap_or("?");
                let title = j.get("title").and_then(|x| x.as_str()).unwrap_or("(untitled)");
                let enabled = j.get("enabled").and_then(|x| x.as_bool()).unwrap_or(false);
                println!("{id}\t{}\t{}", if enabled { "on" } else { "paused" }, title);
            }
        }
    } else {
        println!("{}", serde_json::to_string(&v).unwrap());
    }
    Ok(v)
}

fn cmd_jobs_create(cfg: &GatewayConfig, args: &Args, human: bool) -> Result<Value, CliError> {
    let title = args
        .title
        .clone()
        .ok_or_else(|| CliError::user("--title is required", "pass --title \"Morning digest\""))?;
    let prompt = args
        .prompt
        .clone()
        .ok_or_else(|| CliError::user("--prompt is required", "pass --prompt \"...\""))?;
    let kind = args
        .kind
        .clone()
        .ok_or_else(|| CliError::user("--kind is required", "one of: daily, weekday, every, cron, at, event"))?;
    let value = args
        .value
        .clone()
        .ok_or_else(|| CliError::user("--value is required", "e.g. --value \"0 8 * * *\" or --value 3600"))?;
    let body = json!({
        "title": title,
        "prompt": prompt,
        "schedule_kind": kind,
        "schedule_value": value,
    });
    let v = call(cfg, "POST", "/v1/jobs", Some(body))?;
    if human {
        let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("?");
        println!("created task {id}");
    } else {
        println!("{}", serde_json::to_string(&v).unwrap());
    }
    Ok(v)
}

fn cmd_jobs_run(cfg: &GatewayConfig, id: &str, human: bool) -> Result<Value, CliError> {
    let v = call(cfg, "POST", &format!("/v1/jobs/{}/run", enc(id)), None)?;
    if human {
        println!("started task {id}");
    } else {
        println!("{}", serde_json::to_string(&v).unwrap());
    }
    Ok(v)
}

/// Percent-encode a path segment (same contract as the gateway's `enc`).
fn enc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        let ok = b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~');
        if ok {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

// ---- argument parsing -------------------------------------------------------

#[derive(Debug, Default)]
pub(crate) struct Args {
    pub(crate) human: bool,
    pub(crate) token: Option<String>,
    pub(crate) url: Option<String>,
    pub(crate) session: Option<String>,
    pub(crate) title: Option<String>,
    pub(crate) prompt: Option<String>,
    pub(crate) kind: Option<String>,
    pub(crate) value: Option<String>,
    pub(crate) positional: Vec<String>,
}

const HELP: &str = "\
prism agent — drive a running Prism app from the command line

USAGE:
  prism agent <command> [options]

COMMANDS:
  status                       gateway health + workspace
  sessions list                list sessions
  sessions show <id>           messages of one session
  prompt <session> \"<text>\"    send a prompt to a session
  provenance list [--session <id>]
                               recent written versions (newest first)
  jobs list                    scheduled tasks
  jobs create --title T --prompt P --kind K --value V
  jobs run <id>                fire a task now

OPTIONS:
  --human                      readable output instead of JSON
  --token <token>              gateway token (default: read from the app)
  --url <url>                  gateway base URL (default: http://127.0.0.1:<port>)
  --session <id>               provenance filter
  --title/--prompt/--kind/--value   job fields

OUTPUT:
  JSON on stdout by default. Errors are always on stdout:
    {\"error\":{\"code\":\"...\",\"message\":\"...\",\"hint\":\"...\"}}

EXIT CODES:
  0 ok · 1 user error · 2 transport error · 3 not found

The app must be running with Remote Access enabled. See docs/agent-api.md.
";

fn take_value(args: &[String], i: usize, flag: &str) -> Result<String, CliError> {
    args.get(i)
        .cloned()
        .ok_or_else(|| CliError::user(format!("{flag} needs a value"), "run `prism agent --help`"))
}

pub(crate) fn parse_args(args: &[String]) -> Result<Args, CliError> {
    let mut a = Args::default();
    let mut i = 0;
    while i < args.len() {
        let arg = args[i].as_str();
        match arg {
            "--human" => a.human = true,
            "--token" => {
                i += 1;
                a.token = Some(take_value(args, i, "--token")?);
            }
            "--url" => {
                i += 1;
                a.url = Some(take_value(args, i, "--url")?);
            }
            "--session" => {
                i += 1;
                a.session = Some(take_value(args, i, "--session")?);
            }
            "--title" => {
                i += 1;
                a.title = Some(take_value(args, i, "--title")?);
            }
            "--prompt" => {
                i += 1;
                a.prompt = Some(take_value(args, i, "--prompt")?);
            }
            "--kind" => {
                i += 1;
                a.kind = Some(take_value(args, i, "--kind")?);
            }
            "--value" => {
                i += 1;
                a.value = Some(take_value(args, i, "--value")?);
            }
            "--help" | "-h" => {
                print!("{HELP}");
                std::process::exit(0);
            }
            _ if arg.starts_with('-') => {
                return Err(CliError::user(format!("unknown flag: {arg}"), "run `prism agent --help`"));
            }
            _ => a.positional.push(arg.to_string()),
        }
        i += 1;
    }
    Ok(a)
}

pub(crate) fn dispatch(args: &Args) -> Result<(), CliError> {
    // Bare `prism agent` (or `--help`) prints usage without needing a gateway.
    let cmd = args.positional.first().map(|s| s.as_str()).unwrap_or("");
    if cmd.is_empty() {
        print!("{HELP}");
        return Ok(());
    }
    let cfg = resolve_config(args)?;
    match cmd {
        "status" => {
            cmd_status(&cfg, args.human)?;
        }
        "sessions" => match args.positional.get(1).map(|s| s.as_str()) {
            Some("list") => {
                cmd_sessions_list(&cfg, args.human)?;
            }
            Some("show") => {
                let id = args
                    .positional
                    .get(2)
                    .ok_or_else(|| CliError::user("sessions show needs a session id", "pass it as the next argument"))?;
                cmd_sessions_show(&cfg, id, args.human)?;
            }
            Some(other) => {
                return Err(CliError::user(format!("unknown sessions subcommand: {other}"), "use `list` or `show`"));
            }
            None => return Err(CliError::user("sessions needs a subcommand", "use `list` or `show`")),
        },
        "prompt" => {
            let session = args
                .positional
                .get(1)
                .ok_or_else(|| CliError::user("prompt needs a session id", "pass it as the next argument"))?;
            let text = args.positional[2..].join(" ");
            cmd_prompt(&cfg, session, &text, args.human)?;
        }
        "provenance" => match args.positional.get(1).map(|s| s.as_str()) {
            Some("list") => {
                cmd_provenance_list(&cfg, args.session.as_deref(), args.human)?;
            }
            Some(other) => {
                return Err(CliError::user(format!("unknown provenance subcommand: {other}"), "use `list`"));
            }
            None => return Err(CliError::user("provenance needs a subcommand", "use `list`")),
        },
        "jobs" => match args.positional.get(1).map(|s| s.as_str()) {
            Some("list") => {
                cmd_jobs_list(&cfg, args.human)?;
            }
            Some("create") => {
                cmd_jobs_create(&cfg, args, args.human)?;
            }
            Some("run") => {
                let id = args
                    .positional
                    .get(2)
                    .ok_or_else(|| CliError::user("jobs run needs a job id", "pass it as the next argument"))?;
                cmd_jobs_run(&cfg, id, args.human)?;
            }
            Some(other) => {
                return Err(CliError::user(format!("unknown jobs subcommand: {other}"), "use `list`, `create` or `run`"));
            }
            None => return Err(CliError::user("jobs needs a subcommand", "use `list`, `create` or `run`")),
        },
        other => {
            return Err(CliError::user(format!("unknown command: {other}"), "run `prism agent --help`"));
        }
    }
    Ok(())
}

/// Entry point called from `main()` when the first argument is `agent`.
pub fn run(args: &[String]) -> ExitCode {
    let parsed = match parse_args(args) {
        Ok(a) => a,
        Err(e) => {
            print_error(&e);
            return ExitCode::from(e.exit);
        }
    };
    if let Err(e) = dispatch(&parsed) {
        print_error(&e);
        return ExitCode::from(e.exit);
    }
    ExitCode::SUCCESS
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enc_keeps_unreserved_and_encodes_the_rest() {
        assert_eq!(enc("ses_abc-123"), "ses_abc-123");
        assert_eq!(enc("a/b c"), "a%2Fb%20c");
        assert_eq!(enc("{\"a\":1}"), "%7B%22a%22%3A1%7D");
    }

    #[test]
    fn error_envelope_serializes_with_code_message_hint() {
        let e = CliError::user("bad", "fix it");
        let envelope = json!({
            "error": { "code": e.code, "message": e.message, "hint": e.hint }
        });
        let v: Value = serde_json::from_str(&serde_json::to_string(&envelope).unwrap()).unwrap();
        assert_eq!(v["error"]["code"], "user_error");
        assert_eq!(v["error"]["message"], "bad");
        assert_eq!(v["error"]["hint"], "fix it");

        let stopped = CliError::app_not_running("not up", "start it");
        assert_eq!(stopped.code, "app_not_running");
        assert_eq!(stopped.exit, 2);
    }

    #[test]
    fn exit_codes_are_stable() {
        assert_eq!(CliError::user("x", "y").exit, 1);
        assert_eq!(CliError::app_not_running("x", "y").exit, 2);
        assert_eq!(CliError::transport("x", "y").exit, 2);
        assert_eq!(CliError::not_found("x", "y").exit, 3);
    }

    #[test]
    fn parse_args_reads_flags_and_positionals() {
        let raw = vec![
            "status".to_string(),
            "--human".to_string(),
            "--token".to_string(),
            "abc".to_string(),
        ];
        let a = parse_args(&raw).unwrap();
        assert!(a.human);
        assert_eq!(a.token.as_deref(), Some("abc"));
        assert_eq!(a.positional, vec!["status".to_string()]);
    }

    #[test]
    fn parse_args_rejects_unknown_flags() {
        let raw = vec!["status".to_string(), "--nope".to_string()];
        let e = parse_args(&raw).unwrap_err();
        assert_eq!(e.exit, 1);
        assert!(e.message.contains("--nope"));
    }

    #[test]
    fn parse_args_requires_flag_values() {
        let raw = vec!["status".to_string(), "--token".to_string()];
        let e = parse_args(&raw).unwrap_err();
        assert_eq!(e.exit, 1);
    }

    #[test]
    fn dispatch_without_command_prints_help_and_succeeds() {
        let a = Args::default();
        assert!(dispatch(&a).is_ok());
    }

    #[test]
    fn resolve_config_with_explicit_url_and_token() {
        let a = Args {
            url: Some("http://localhost:9999".into()),
            token: Some("tok123".into()),
            ..Default::default()
        };
        let cfg = resolve_config(&a).unwrap();
        assert_eq!(cfg.url, "http://localhost:9999");
        assert_eq!(cfg.token, "tok123");
    }

    #[test]
    fn resolve_config_rejects_url_without_token() {
        let a = Args {
            url: Some("http://localhost:9999".into()),
            token: None,
            ..Default::default()
        };
        let err = resolve_config(&a).unwrap_err();
        assert_eq!(err.exit, 1);
        assert_eq!(err.code, "user_error");
    }
}
