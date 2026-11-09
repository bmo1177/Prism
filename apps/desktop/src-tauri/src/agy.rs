//! agy CLI bridge: detect the `agy` (Google Antigravity) CLI, list its models,
//! and manage the local OpenAI-compatible bridge that exposes them to the
//! bundled OpenCode sidecar as a custom provider.
//!
//! agy is a full agent (its models run inside agy's own loop), not a raw
//! inference endpoint, so it cannot be registered as a provider directly:
//! `runtime/tools/agy-bridge/bridge.mjs` translates OpenAI chat-completions
//! calls into `agy --print` invocations, and the UI registers it in OpenCode
//! config as provider "agy". That makes agy models selectable in the normal
//! model picker — chat-only, without OpenCode tool-calls (documented in the
//! Settings card).

use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri::path::BaseDirectory;

/// Loopback port the local bridge listens on. Kept in sync with the default
/// in `runtime/tools/agy-bridge/bridge.mjs`.
pub const AGY_BRIDGE_PORT: u16 = 45678;

#[derive(Clone, Serialize)]
pub struct AgyModel {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Serialize)]
pub struct AgyStatus {
    /// An executable `agy` was found on PATH.
    pub found: bool,
    /// Resolved executable path, when found.
    pub path: Option<String>,
    /// `agy --version` (e.g. "1.5.3"), when it answers.
    pub version: Option<String>,
    /// Models from `agy models` (empty when agy is absent or errors).
    pub models: Vec<AgyModel>,
}

/// The bridge child process, if it is running.
pub struct AgyBridgeState(pub Arc<Mutex<Option<Child>>>);

impl Default for AgyBridgeState {
    fn default() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
}

fn find_agy() -> Option<PathBuf> {
    let candidates: Vec<String> = std::env::var("PATH")
        .unwrap_or_default()
        .split(std::path::MAIN_SEPARATOR)
        .map(|s| s.to_string())
        .collect();
    // Also probe the conventional user bin dirs (agy installs there, and the
    // desktop app's PATH can differ from the login shell's).
    let mut dirs = candidates;
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push(PathBuf::from(&home).join(".local/bin").to_string_lossy().into_owned());
    }
    let exe = if cfg!(windows) { "agy.exe" } else { "agy" };
    for dir in dirs {
        let p = PathBuf::from(&dir).join(exe);
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

fn run_agy(path: &std::path::Path, args: &[&str]) -> Option<String> {
    let out = Command::new(path)
        .args(args)
        .output()
        .ok()?;
    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        None
    }
}

/// Parse `agy models` output: "Fetching available models..." header, then
/// `<id><tab><display name>` lines. Falls back to whitespace-split when the
/// separator is not a tab.
fn parse_agy_models(output: &str) -> Vec<AgyModel> {
    let mut models = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("Fetching") {
            continue;
        }
        let (id, name) = match line.split_once('\t') {
            Some((id, name)) => (id.trim().to_string(), name.trim().to_string()),
            None => {
                let mut it = line.split_whitespace();
                let id = it.next().unwrap_or_default().to_string();
                let name = it.collect::<Vec<_>>().join(" ");
                if name.is_empty() {
                    (id.clone(), id)
                } else {
                    (id, name)
                }
            }
        };
        if !id.is_empty() {
            models.push(AgyModel {
                id: id.clone(),
                name: if name.is_empty() { id } else { name },
            });
        }
    }
    models
}

/// Detect the agy CLI and enumerate its models (desktop only).
#[tauri::command]
pub fn agy_detect() -> AgyStatus {
    let Some(path) = find_agy() else {
        return AgyStatus {
            found: false,
            path: None,
            version: None,
            models: Vec::new(),
        };
    };
    let version = run_agy(&path, &["--version"])
        .and_then(|v| v.lines().next().map(|l| l.trim().to_string()));
    let models = run_agy(&path, &["models"])
        .map(|out| parse_agy_models(&out))
        .unwrap_or_default();
    AgyStatus {
        found: true,
        path: Some(path.to_string_lossy().into_owned()),
        version,
        models,
    }
}

fn bridge_script(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve("tools/agy-bridge/bridge.mjs", BaseDirectory::Resource)
        .map_err(|e| format!("bridge script unavailable: {e}"))
}

/// Start the local agy↔OpenAI bridge (idempotent: returns the port when it is
/// already running). Returns the loopback port.
#[tauri::command]
pub fn agy_bridge_start(
    app: AppHandle,
    state: State<'_, AgyBridgeState>,
) -> Result<u16, String> {
    if bridge_running(state.inner()) {
        return Ok(AGY_BRIDGE_PORT);
    }
    let script = bridge_script(&app)?;
    if !script.is_file() {
        return Err(format!("bridge script not found at {}", script.display()));
    }
    let mut child = Command::new("node")
        .arg(&script)
        .arg("--port")
        .arg(AGY_BRIDGE_PORT.to_string())
        .spawn()
        .map_err(|e| format!("could not start the agy bridge (is node on PATH?): {e}"))?;

    // Give the bridge a moment to bind; report early exit as the error it is.
    std::thread::sleep(std::time::Duration::from_millis(400));
    if let Ok(Some(status)) = child.try_wait() {
        return Err(format!("agy bridge exited immediately: {status}"));
    }
    *state.0.lock().unwrap() = Some(child);
    Ok(AGY_BRIDGE_PORT)
}

fn bridge_running(state: &AgyBridgeState) -> bool {
    let guard = state.0.lock().unwrap();
    guard.is_some()
}

/// Stop the agy bridge, if it is running.
#[tauri::command]
pub fn agy_bridge_stop(state: State<'_, AgyBridgeState>) {
    if let Some(mut child) = state.0.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

/// Whether the agy bridge process is currently running.
#[tauri::command]
pub fn agy_bridge_status(state: State<'_, AgyBridgeState>) -> bool {
    bridge_running(state.inner())
}

#[cfg(test)]
mod tests {
    use super::parse_agy_models;

    #[test]
    fn parses_tab_separated_agy_models() {
        let out = "Fetching available models...\ngemini-3.8-flash-high\tGemini 3.8 Flash (High)\nclaude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)\n";
        let models = parse_agy_models(out);
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].id, "gemini-3.8-flash-high");
        assert_eq!(models[0].name, "Gemini 3.8 Flash (High)");
        assert_eq!(models[1].id, "claude-sonnet-4-6");
    }

    #[test]
    fn skips_header_and_empty_lines() {
        let models = parse_agy_models("Fetching available models...\n\n");
        assert!(models.is_empty());
    }
}
