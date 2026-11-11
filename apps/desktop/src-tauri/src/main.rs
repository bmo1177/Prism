// Prevents an extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::ExitCode;

fn main() -> ExitCode {
    // `prism agent ...` is the headless CLI: it drives a RUNNING app through
    // the Remote Access Gateway and exits, so it must never boot Tauri (which
    // would start a second instance / the whole GUI). Everything else is the
    // desktop app.
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(|s| s.as_str()) == Some("agent") {
        return craft_lib::cli::run(&args[1..]);
    }
    craft_lib::run();
    ExitCode::SUCCESS
}
