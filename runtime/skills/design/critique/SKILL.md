---
name: critique
description: |
  Run a 5-dimension expert design review on any HTML artifact in the
  workspace — Philosophy / Visual hierarchy / Detail / Functionality /
  Innovation, each scored 0–10. Outputs a single self-contained HTML
  report with a radar chart, evidence-backed scores, and three lists:
  Keep / Fix / Quick-wins. Use when the brief asks for a "design
  review", "design critique", "design audit", or "what's wrong with my
  design".
---

# Critique Skill · 5-Dimension Expert Review

Produce a single-file HTML "design review report" that scores any
artifact across 5 dimensions and proposes actionable fixes.

## When to use

- After the agent (or user) generates an artifact (wireframe / landing
  page / dashboard) and the user asks "what's wrong with this?"
- As a self-check loop the agent can run on its own output **before**
  delivering it
- For comparing two variants of the same design

## What you produce

A single self-contained HTML file (`critique.html`) saved in the
workspace, including:

1. **Header** — what artifact was reviewed, date, reviewer ("Craft ·
   Critique skill"), 1-line verdict
2. **Radar chart** (inline SVG, no library) showing the 5 scores
3. **Five dimension cards**, each with:
   - Score 0–10 (band: 0–4 *Needs work* · 5–6 *Functional* · 7–8 *Strong*
     · 9–10 *Exceptional*)
   - 1-paragraph evidence (cite the elements / file names)
   - One Keep / Fix / Quick-win bullet
4. **Combined action lists** at the bottom:
   - **Keep** — what's working, don't touch
   - **Fix** — P0 / P1 issues that are visually expensive
   - **Quick wins** — 5–15 minute tweaks with disproportionate impact

## The 5 dimensions

> Each dimension is independent — a design can be 9/10 on Innovation
> but 4/10 on Hierarchy and the report should say so plainly. Don't
> average away interesting failures.

### 1. Philosophy consistency

> Does the artifact pick a clear *direction* and stick to it through
> every micro-decision (chrome / kicker / spacing / accent)?

**Evidence to look for:**
- Is there one declared design direction (e.g. Monocle / WIRED /
  Kinfolk) or is it three styles in a trench coat?
- Does the chrome / kicker vocabulary stay in one register?
- Are accent / serif / mono used by the same rule throughout?

**0–4** Three styles fighting each other. **5–6** One direction but
half the elements drift. **7–8** Coherent, occasional drift on edge
pages. **9–10** Every element argues for the same thesis.

### 2. Visual hierarchy

> Can a stranger figure out what to read first, second, third — without
> being told?

**Evidence to look for:**
- Is the largest type clearly the most important thing on each page?
- Do mono / serif / sans roles match the information's *role* (meta /
  body / display)?
- Lots of "loud" elements competing? Or a clear primary + secondary +
  tertiary tier?

**0–4** Everything shouts. **5–6** Hierarchy works on hero sections
but breaks on body. **7–8** Clear tiers, occasional collision. **9–10**
Eye moves with zero friction.

### 3. Detail execution

> The 90/10 stuff — alignment, leading, kerning at large sizes, image
> framing, chrome polish, edge-case spacing.

**Evidence to look for:**
- Big-stat pages: does the number sit on a baseline, or float?
- Left/right column tops aligned?
- Frame + caption proportions consistent?
- Mono labels: same letter-spacing? same uppercase rule?
- Any orphaned `<br>` causing 1-character lines?

**0–4** Visible tape and string. **5–6** Most clean, 1–2 ragged.
**7–8** Polished, expert eye finds 2–3 misses. **9–10** Magazine-grade
craft.

### 4. Functionality

> Does the artifact *work* for its intended use? Click targets, nav,
> readability, mobile fallback if relevant.

**Evidence to look for:**
- Landing: CTA above the fold? Navigation obvious?
- Anything interactive actually interactive?
- Critical info readable from presentation distance in a preview?

**0–4** Visually fine but doesn't accomplish the job. **5–6** Core
flow works, edge cases broken. **7–8** Robust through normal use.
**9–10** Defensively engineered.

### 5. Innovation

> Does this push past the median? Is there one element that makes
> people lean in?

**Evidence to look for:**
- One *unexpected* layout / motion / typographic move that wasn't
  required?
- Or entirely safe — could be any wire from any agency?
- Is the innovation *earned* (matches direction) or grafted on
  (random WebGL on a Kinfolk slow-living deck)?

**0–4** Generic median. **5–6** Competent and unmemorable. **7–8**
A memorable moment, the rest solid. **9–10** Moves you'd steal — each
serving the thesis.

## Scoring discipline (read before you score)

- **Always cite evidence** — "scored 4 because the wire hero mixes
  Playfair display with Inter sans on the same line" beats "feels
  inconsistent". Numbers without evidence get rejected.
- **Don't average up** — if Hierarchy is 5 because a section is broken,
  don't bump to 7 because the rest is fine. The score is the *worst
  sustained band*.
- **Don't grade-inflate** — a 7 means *strong*, not *acceptable*. If
  every score is 7+, you're not reviewing critically.
- **Innovation may be low** — 5/10 is fine. Don't punish appropriate
  conservatism.

## Output contract

Save one self-contained HTML file (`critique.html`) in the workspace.
One sentence before saving ("Reviewed X across 5 dimensions, see report
below.") and **stop** — don't paraphrase the report in chat.

## Hard rules

- **5 scores, every time** — partial (e.g. only 3 dimensions) forbidden.
- **Evidence per score** — no "feels off" / "needs work". If you can't
  cite an element, the score isn't justified.
- **Don't grade-inflate** — overall mean above 8 is suspicious.
- **Single-file HTML only** — no external CSS/JS. Inline everything.
- **Radar chart is mandatory** — gives the report a recognizable
  silhouette and lets the user spot weak axes at a glance.