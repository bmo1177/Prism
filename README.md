<div align="center">

# Prism

**Light bent into work.**

One beam in, every wavelength out. Prism is a local-first, model-agnostic AI
workbench that refracts your questions across agents, notebooks, files, figures,
reports, and review — each a different color of the same thought.

Built with Tauri 2, React, MCP, agent skills, and reproducible artifacts.
Runs on macOS, Windows, and Linux.

<p>
  <b>English</b> ·
  <a href="./README.zh.md">简体中文</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.de.md">Deutsch</a> ·
  <a href="./README.fr.md">Français</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.ar.md">العربية</a>
</p>

<p>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platforms">
  <img src="https://img.shields.io/badge/built%20with-Tauri%202%20%2B%20React-24C8DB" alt="Built with Tauri + React">
</p>

</div>

---

## What is Prism?

Prism is a desktop AI workbench. You ask a question. Prism bends it through every
tool you have — agents, notebooks, files, browsers, remote machines — and gives
you back not just an answer, but the whole spectrum: figures, code, reports,
provenance, and the exact path the thinking took.

**One input. Every wavelength.**

- A research question becomes a literature survey, an experiment, a figure, and a paper.
- A design brief becomes prototypes, exports, and presentation decks.
- A data question becomes analysis, notebooks, charts, and a report.
- A coding task becomes agents, tools, tests, and documentation.

All of it local. All of it yours. All of it traceable.

---

## Why "Prism"?

A prism takes one beam of light and reveals it was always made of many colors.
Prism takes one question and reveals it was always made of many tasks — each one
a different wavelength of the same thought, each one producing something real.

---

## Features

### Autonomous agents that produce real artifacts
Not just chat. Every agent action produces inspectable files — figures, code,
reports, notebooks — linked back to the exact inputs, environment, and conversation
that created them.

### Everything traces back
Provenance tracking links every output to its source. Open any artifact and see
the script, the data, the model output, and the conversation that made it.

### Local-first by default
Your sessions, data, provenance, notebooks, and run records live on your machine.
Nothing leaves unless you want it to.

### Model-agnostic
Bring your own model. The runtime supports any provider — OpenAI, Anthropic,
local models, custom endpoints. Skills and MCP servers stay pluggable.

### Reach it from anywhere
A built-in gateway serves the real desktop UI to a browser on your LAN or phone.
Start a run at your desk, check results from your phone.

### Drive your own browser
The agent can control your real Chrome — profile and logins intact — or use an
isolated private browser.

### Plan before acting
`/plan` lays out an execution plan. `/goal` fixes the objective, constraints, and
acceptance criteria. Then the agent executes.

### Work on several things at once
Tile panes side by side. Run different models in each. Drag to dock. Independent
Screens for different projects.

---

## Research loop

The full scientific method, as a skill chain:

| Stage | What it does | Output |
| --- | --- | --- |
| Explore | Turn a broad direction into concrete topics | Topic matrix, literature pre-survey |
| Survey | Search and synthesize the literature | 6–20 pp PDF, 60+ real citations |
| Experiment | Design and run experiments | Code, results, figures, provenance |
| Write | Draft a publication | 8–14 pp PDF, 200+ citations, figures |

Each stage is self-contained. Run them individually or let the meta-skill chain
them end to end.

---

## Connectors

One-click science integrations:

- Literature: arXiv, PubMed, Crossref, Semantic Scholar, bioRxiv/medRxiv
- Biomedical: ClinicalTrials.gov, MyVariant/ClinVar
- Materials: Materials Project
- Economics: FRED
- Climate: Open-Meteo
- Space weather, USGS water data

Add any MCP server or local tool from Settings.

---

## Install

Download from the [Releases page](https://github.com/bmo1177/Prism/releases/latest).

| Platform | Format |
| --- | --- |
| macOS | `.dmg` / `.app` (Apple Silicon & Intel) |
| Windows | `.exe` / `.msi` |
| Linux | `.deb` / `.rpm` / AppImage |

```bash
# Linux .deb
sudo apt install ./Prism_*.deb

# Linux .rpm
sudo rpm -i Prism-*.rpm

# AppImage
chmod +x Prism_*.AppImage
./Prism_*.AppImage
```

---

## Build from source

Requirements: Node.js ≥ 20, pnpm 9, Rust toolchain, Tauri system dependencies.

```bash
git clone https://github.com/bmo1177/Prism
cd Prism
pnpm install

# Fetch bundled sidecars and skills
bash scripts/dev/fetch-opencode.sh
bash scripts/dev/fetch-uv.sh
bash scripts/dev/fetch-skills.sh

# Develop
pnpm --filter @ai4s/desktop tauri dev

# Build
pnpm --filter @ai4s/desktop tauri build
```

---

## Safety

- Workspace files stay local by default.
- Command execution, file deletion, and remote connections require approval.
- Provider credentials are stored in app-private config, never in git or provenance.
- Settings shows a plain-language data-flow view.

---

## Repository layout

| Path | What |
| --- | --- |
| `apps/desktop/` | Tauri + React desktop shell |
| `packages/sdk/` | Runtime client wrapper |
| `packages/shared/` | Shared types and chart palette |
| `packages/ui/` | Shared UI components |
| `runtime/skills/` | Agent skills (core + external) |
| `runtime/mcp/` | MCP configuration |
| `runtime/harness/` | Runtime operator context |
| `examples/` | Example workspaces |
| `scripts/dev/` | Sidecar and skill fetchers |
| `docs/` | Product and technical docs |

---

## Status

Active development. MVP stage. See [PROGRESS.md](./PROGRESS.md) for the current
implementation log.

---

## Citation

```bibtex
@software{prism,
  author  = {{The Prism Contributors}},
  title   = {Prism: light bent into work},
  year    = {2026},
  version = {0.3.3},
  doi     = {10.5281/zenodo.21805331},
  url     = {https://github.com/bmo1177/Prism},
  license = {MIT}
}
```

---

## License

[MIT](./LICENSE)

> Prism is beta software. Treat outputs as drafts — verify before you publish.
