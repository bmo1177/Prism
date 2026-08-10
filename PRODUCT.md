# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

Tauri 2 (Rust) + React 18 + TypeScript + Vite 5. Tailwind CSS 3.4 with CSS custom properties for theming. Radix UI primitives. Zustand for state. 7 locales (en, zh-Hans, ja, es, fr, ko, de, ar).

## Users

- **Researchers & scientists** — literature reviews, paper organization, reproducibility, lab work, provenance tracking
- **AI/ML developers** — building agents, automating workflows, experimenting with models across providers
- **Hybrid knowledge workers** — refracting one question across agents, notebooks, files, figures, and reports
- **Students & academics** — grad/PhD students managing research, notes, code, and citations

## Product Purpose

Prism is a local-first, model-agnostic AI workbench that unifies three pillars — **Cowork** (agents, documents, automation), **Design** (templates, prototypes, exports), and **Science** (research sessions, notebooks, provenance). It transforms a single question into traceable, reproducible artifacts across all three domains.

## Positioning

The only open-source tool that combines: (1) local-first data with any model provider, (2) three integrated work pillars in one workspace, and (3) full provenance and reproducibility for every artifact, run, and decision. No vendor lock-in. All auditable.

## Operating Context

- Knowledge workers operating across research, coding, and documentation simultaneously
- Sessions involve multi-step agent runs, file generation, notebook execution, and artifact inspection
- Work happens across macOS, Windows, and Linux with a gateway web client (including phone-width viewports)
- Manual approval mode for agent actions (command execution, file deletion, dependency install, remote connections)
- Workspace-based: each project is a local git repo; the app initializes and commits locally
- API keys stored in OS keychain, never in provenance/logs/git

## Capabilities and Constraints

- 13 main surfaces: Live, Skills, Design, Research, Provenance, Science, Tasks, Notebooks, Files, Runs, Projects, History, Settings
- Three-column workspace layout (sidebar + thread + inspector) is core to the workflow
- Agent runtime via OpenCode sidecar (HTTP + SSE API), accessed through `packages/sdk`
- Skills, MCP servers, and model providers are pluggable
- Artifact schema and workflow templates are versioned and stable
- Must work on macOS, Windows, Linux, and gateway web client (including phone-width viewports)
- Desktop-only features (local kernels, native dialogs, host filesystem) hidden in web mode (`isGatewayWeb`)
- 3 themes (warm, light, dark) × 5 accent colors (terracotta, blue, green, violet, rose)
- Chart palette system shared between native app and agent-generated figures
- Full i18n with 7 locales and parity testing

## Brand Commitments

- Name: **Prism** — "Light bent into work."
- Bundle identifier: `com.prism.desktop`
- Internal package names `@ai4s/*` intentionally unchanged
- Open-source project
- Voice: precise, technical, trustworthy without being cold

## Evidence on Hand

- Built-in demo project: `examples/bci-trends/` (brain-computer interface trends)
- Active development: v0.3.3 released, daily progress entries through August 2026
- Test suite: 871+ frontend tests, 192+ Rust tests
- Documentation: README.md, docs/PRD.md, docs/technical specs

## Product Principles

1. **Local-first** — user data stays on the user's machine; no cloud dependency for core functionality
2. **Model-agnostic** — any LLM provider, any agent runtime; no vendor lock-in
3. **Traceable** — every artifact, run, and decision has provenance; science demands reproducibility
4. **Unified** — one workspace for cowork, design, and science; context switching is friction
5. **Cross-platform** — identical capability across macOS, Windows, Linux, and web gateway

## Accessibility & Inclusion

- Accent-color-aware contrast (`--accent-fg`) for readable filled elements
- Focus-visible rings on interactive elements
- Keyboard navigation support (command palette, Radix primitives)
- 7-language i18n with parity testing
- Must support reduced-motion preferences
