# Changelog

All notable changes to Prism are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
`PROGRESS.md` remains the detailed session-by-session archive; this file is the curated release view.

## [Unreleased]

### Added

- PR check workflow (`.github/workflows/pr-check.yml`): typecheck, lint, and tests on every PR to `main` and every push to `main`.
- SDK unit tests (`packages/sdk/src/__tests__/`): 15 vitest tests covering `OpenCodeClient` construction, auth headers, health/whoami fallbacks, skill/command listing, directory scoping, and `NexusClient` orchestration.
- `CONTRIBUTING.md`: dev setup, check commands, PR process, code style, and safety defaults.
- `packages/ui` is now a real workspace package (`@ai4s/ui` with `package.json`, `tsconfig.json`, and an entry point) instead of an empty shell.

### Changed

- Aligned all manifests to version 0.3.3 (`package.json`, `tauri.conf.json`, `Cargo.toml`).
- Hardened the Tauri Content Security Policy (was `null`): `default-src 'self'`, no remote scripts, images from self/data/blob/asset, connections limited to self, Tauri IPC, and localhost/loopback (OpenCode sidecar HTTP + SSE).
- Removed the unused `xlsx` CDN-tarball dependency. Workbook preview rendering uses `exceljs`, which was already a dependency — no code changes required.
- Root `pnpm test` / `pnpm typecheck` now cover both `@ai4s/desktop` and `@ai4s/sdk`.

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
