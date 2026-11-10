# Changelog

All notable changes to Prism are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
`PROGRESS.md` remains the detailed session-by-session archive; this file is the curated release view.

## [Unreleased]

### Added

- Built-in starter tasks in the Tasks scheduler: a first launch seeds two runnable jobs — **Daily AI Research Digest** (web-researched arXiv/Hugging Face/GitHub digest written as a self-contained offline HTML file to `digests/digest-YYYY-MM-DD.html` in the workspace, with the Early Alzheimer's Detection research-track section at top) and **Hermes AI Coach** (persistent learning-and-career coach for the AI job/PhD-in-Italy track, keeping state in `coach/state.md`). Seeding runs once (guarded by a `meta` marker, so deleting a starter task is respected) and a "Restore starter tasks" action re-adds missing ones on demand (`restore_default_jobs`).
- Task failure surfaces: the scheduler records the last fire failure per job (`last_error` + retry count) with exponential retry backoff (1 m → 30 m cap), and the Tasks page shows a "Failed: …" chip with the full error on hover instead of failing silently in a background thread.
- OS keychain for provider API keys: every BYOK key the app saves is mirrored into the OS credential store (Apple Keychain / Windows Credential Manager / Linux Secret Service via `keyring`, pure-Rust zbus — no libsecret C dependency), a startup pass mirrors keys older installs kept only in the sidecar's plaintext files, and a `forget_provider_key` command purges every machine copy (keychain entry, `opencode.json(c)` provider block, `auth.json` entry) then restarts the sidecar. The plaintext files stay the sidecar's working copies; the keychain is the persistent, user-deletable authority. OAuth logins are not mirrored.
- Notebook plots: the Python kernel bridge forces the headless Agg backend before any user import (so `plt.plot(...)` buffers into the notebook instead of opening a native window) and captures figures each cell creates as base64 PNGs, shown under the cell and round-tripped through the existing `.ipynb` `image/png` support. A missing matplotlib degrades to text-only cells; `python3 kernel_bridge.py --self-test` verifies capture in one command.
- The Tasks page now works in the gateway web client (phone): new scheduler contract routes (`GET/POST /v1/jobs`, `/v1/jobs/<id>/enabled`, `/v1/jobs/<id>` delete, `/v1/jobs/<id>/run`, `/v1/jobs/restore-defaults`) serve the identical page over the gateway; read-only gateway tokens see the schedule with mutations disabled. Event-triggered jobs stay desktop-only (a sleeping phone is not a scheduler).

### Fixed

- Approve mode no longer lets code execution walk around the command gate: the gate covered `rm`/`sudo`/installs but a `python -c "os.remove(...)"`, `bash script.sh`, `npx <pkg>` or `uv run` executed without a prompt. The interpreters (`python`/`node`/`perl`/`ruby`/`php`/`deno`), shells (`bash`/`sh`/`zsh`) and fetch-and-run runners (`npx`, `npm exec`, `pnpm exec`/`dlx`, `yarn dlx`, `uv run`, `go run`, `cargo run`) are now gated too. Documented limits: absolute-path spellings (`./build.sh`, `/bin/python3`) and vetted project entry points (`make`, `npm run`) stay ungated; "full" mode is the off switch.
- Daily/weekday tasks could never run: the backend rejected the `daily` and `weekday` schedule kinds the page sends (`unknown schedule kind`), so every quick-template and time-picker task creation failed; both now normalize to their real `cron` form.
- Cron wall-clock times were evaluated against UTC: "daily at 07:00" fired at 07:00 UTC (e.g. 09:00 CET). Schedule matching now evaluates hour/day/month fields in the user's local time zone via `chrono` (already in the tree), resolving DST-ambiguous minutes to their earliest instant and skipping spring-forward gaps.
- Unfinished firing loop: a stalled sidecar HTTP connection could block the scheduler thread forever (no timeout on the fire client — now 10 s connect / 30 s total); a manually fired job stayed due so the scheduler fired it again within one tick (now rescheduled after a successful fire); re-enabling a paused task re-fired its stale past-due slot instead of its next future one (and an expired one-shot is now finished, not fired late); re-enabled jobs replay missed runs in a stampede (now recomputed to the next slot).
- Scheduled-task fire errors are explicit instead of opaque: the workspace path is (re-)created before a fire (the "agent failed to run in this workspace path" class of failure), and runtime-down fires read as such on the task record.
- Delete-confirmation dialog can no longer wedge open when the delete request fails, and the datetime picker's "at" minimum is local-time aware (it was built from a UTC `toISOString`, banning future times in non-UTC zones).

### Changed

- Clippy clean across all targets (lib + tests): `remove_provider` restructured to the `?`-operator form, killed kernel-test children reaped like production, and the startup mirror now skips rewriting a keychain entry that already holds the same key.
- New brand icon: a vector master (`assets/logo.svg`, white beam dispersing through a glass prism) regenerated into the full Tauri icon set (`.icns`, `.ico`, PNG sizes, Windows/Android/iOS) and the README's `assets/logo.png`.

## [0.3.4] - 2026-11-02

### Added

- PR check workflow (`.github/workflows/pr-check.yml`): typecheck, lint, and tests on every PR to `main` and every push to `main`.
- SDK unit tests (`packages/sdk/src/__tests__/`): 15 vitest tests covering `OpenCodeClient` construction, auth headers, health/whoami fallbacks, skill/command listing, directory scoping, and `NexusClient` orchestration.
- `CONTRIBUTING.md`: dev setup, check commands, PR process, code style, and safety defaults.
- `packages/ui` is now a real workspace package (`@ai4s/ui` with `package.json`, `tsconfig.json`, and an entry point) instead of an empty shell.

### Changed

- Aligned all manifests to version 0.3.4 (`package.json`, `tauri.conf.json`, `Cargo.toml`).
- Hardened the Tauri Content Security Policy (was `null`): `default-src 'self'`, no remote scripts, images from self/data/blob/asset, connections limited to self, Tauri IPC, and localhost/loopback (OpenCode sidecar HTTP + SSE).
- Removed the unused `xlsx` CDN-tarball dependency. Workbook preview rendering uses `exceljs`, which was already a dependency — no code changes required.
- Root `pnpm test` / `pnpm typecheck` now cover both `@ai4s/desktop` and `@ai4s/sdk`.

### Fixed

- Update checker now targets the live `bmo1177/Prism` repository on both paths: the desktop releases feed and the web API fallback. `CITATION.cff` points at the same repository instead of a dead 404.
- Removed the remaining user-visible Craft branding: macOS folder-access prompts, the approval notification, the import dialog in all 7 locales, the model probe user agent, generated SSH and git markers, the browser title, and the release pipeline's "Open Science" names.

## [0.3.3] - 2026-08-23

### Added

- First-class preregistration artifact (`*.prereg.json`, schema `prereg.v1`): deterministic AST diff of executed Python code against the plan — unplanned-test (HARKing guard), missing-test, correction, and seed checks. 17/17 `test_prereg_check.py` green.
- Notebook delete (desktop-only, with confirm dialog + toast), markdown cells with Preview/Edit toggle, and per-accent-per-theme overrides with a Settings appearance swatch row. Fully i18n'd (7 locales).
- Materials-science gate (P0-5): frac-coords, POSCAR round-trip (pymatgen when installed, stdlib structural check otherwise), and VASP-5 header-misread rules. 50/50 domain-check tests green.

### Changed

- "Mesophotic Descent" UI redesign: depth-based layering, focus-ring tokens, per-accent focus/depth colors, and softer entrance timing across all three themes.
- Standardized page headers across Science, Research, Skills, Notebooks, History, Projects, Runs, and Tasks.
- README visual overhaul: glassmorphism logo, hero banner, screenshot showcases.

### Fixed

- Full frontend suite green: 872/872 vitest (fixed i18n parity gaps, stale Sidebar expectation, ReasoningRow contract test) and eslint clean.
- Nexus unified API made truthful: `NexusClient` builds its own OpenCode client from `openCodeUrl`, `discoverSkills()` delegates to the live registry; gateway gained `GET /v1/provenance` + `/v1/provenance/query`. 192/192 Rust tests, clippy clean.

## [0.3.x] - 2026-08-07 to 2026-08-10

### Added

- Science pillar: `/research` starter dashboard + lab glance, `/provenance` global browsable trail with search/paging and Reproduce, `/science` gallery of 13 bundled science skills.
- Nexus platform services: `OpenCodeClient` (SSE/Fetch, status, retry), `RunService`, `ProvenanceService`, `EnvironmentService`, `GitService`, `SkillDiscoveryService`, `ConfigurationService`, `MonitoringService`, orchestrated by `NexusClient` over the gateway `/v1/*` contract.
- Craft rebranding to Prism (`productName: Prism`, `com.prism.desktop`); internal `@ai4s/*` package names intentionally unchanged.

### Fixed

- Full-stack verification: frontend typecheck 0 errors, eslint clean, 860/860 vitest, `pnpm build` OK, `cargo clippy` clean, `cargo test` 189/189.

## [0.1.0] - 2026-07-02

### Added

- Monorepo skeleton (apps / packages / runtime / docs / examples / scripts), `AGENTS.md`, English PRD + technical design.
- UI shell: three-column workspace (sessions sidebar / thread / inspector), warm paper theme.
- Agent runtime on OpenCode (pinned release, HTTP + SSE), bundled as a Tauri sidecar with app-private config and full isolation from any user-installed OpenCode.
- In-app API-key wiring into OpenCode config; live artifact surfacing in agent sessions.
- GitHub Actions multi-platform installer matrix (macOS aarch64/x86_64, Windows x86_64, Linux).
