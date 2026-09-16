# Contributing to Prism

Thanks for helping build Prism — a local-first AI workspace for cowork, design, and science.

## Development setup

Prerequisites: Node.js ≥ 20, pnpm 9.x, a stable Rust toolchain, and the
[Tauri 2 system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS.

```bash
git clone https://github.com/bmo1177/Prism.git
cd Prism
pnpm install

# Fetch bundled runtime sidecars & default skills
bash scripts/dev/fetch-opencode.sh
bash scripts/dev/fetch-uv.sh
bash scripts/dev/fetch-skills.sh

# Launch the desktop app in development
pnpm --filter @ai4s/desktop tauri dev
```

## Project structure

- `apps/desktop/` — Tauri 2 shell (`src-tauri/`, Rust) + React/TypeScript frontend (`src/`)
- `packages/sdk/` — `OpenCodeClient` / `NexusClient` runtime wrapper. The UI never calls OpenCode directly.
- `packages/shared/` — Common types and schemas shared across packages
- `packages/ui/` — Shared presentational component library (app-agnostic; no runtime coupling)
- `runtime/` — Skills, MCP integrations, agent harness, kernel bridges
- `docs/` — Product specs (`PRD.md`, `TECHNICAL_DESIGN.md`, `REQUIREMENTS.md`)
- `examples/` — Built-in demo projects

## Checks (run before every PR)

```bash
pnpm typecheck   # tsc --noEmit for desktop + SDK
pnpm lint        # eslint for the desktop app
pnpm test        # vitest: desktop suite + SDK unit tests
```

The `pr-check` GitHub workflow runs the same three commands on every PR to `main`.
The full multi-platform installer build (`build.yml`) runs only on `v*` tags.

## Pull request process

1. Fork the repo and create a feature branch from `main`.
2. Keep changes minimal and verifiable — one concern per PR.
3. Run `pnpm typecheck`, `pnpm lint`, and `pnpm test` locally; all must be green.
4. Update `CHANGELOG.md` under `[Unreleased]` when the change is user-facing.
5. Open the PR against `main` with a clear description of what changed and how it was verified.

## Code style

- All project files and code are in English; discussion may be in any language.
- TypeScript + React: follow the existing patterns in `apps/desktop/src` (Tailwind + Radix UI primitives, Zustand stores, `react-router-dom` routes).
- Rust: one concern per module, `cargo clippy` clean, inline `#[cfg(test)]` unit tests for new logic.
- Keep components dumb where possible: no agent-runtime coupling outside `packages/sdk`.
- Cross-platform by default: every feature must work on Windows, macOS, Linux, and the gateway web client (phone-width viewports included). If a feature fundamentally cannot work over the web (local kernels, native dialogs, host filesystem access), hide it in web mode (`isGatewayWeb`) instead of shipping a control that fails.

## Safety defaults (non-negotiable)

- The agent may only access the current workspace.
- Command execution, file deletion, dependency install, and remote connections require approval (manual approval mode by default).
- API keys go to the OS keychain / credential manager — never into provenance, logs, crash reports, git, or exported projects.

## Commit messages

Use a short imperative summary (≤ 72 chars), optionally with an emoji prefix matching repo history, e.g. `✨ Add CSV export to provenance view`. explain the *why* in the body when it is not obvious from the diff.
