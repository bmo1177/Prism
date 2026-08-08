---
name: html-ppt-zhangzara-monochrome
description: |
  Ivory ledger paper with all-black type — no color at all; the system runs on typography, line, and white space. Lora serif headlines, Jost body, JetBrains Mono labels. High formality, high density. Best for grants, theses, policy proposals, academic deliverables.
---

# Monochrome — HTML Deck

A single self-contained HTML presentation in the **Monochrome**
visual system. Ivory ledger paper with all-black type; Lora serif headlines, Jost body, no color at all. ivory and pale-cream paper with deep ink-black type only; no color at all; the system runs on typography, line, and white space

## At a glance

- **Scheme:** light · **Formality:** high · **Density:** high
- **Slides in demo:** 16
- **Palette:** bg #fafadf; bg alt #f2f2d2; bg cream #f5f0e4; fg #1a1a16; fg 2 #5e5e54
- **Typography:** literary serif headlines + clean geometric sans body + technical mono; reads like a hand-typeset ledger (Jost, JetBrains+Mono, Lora, Noto+Serif+SC, Noto+Sans+SC)
- **Font loading:** link the Google Fonts stylesheet; if offline, fall
  back gracefully to system fonts — never block rendering on the fonts.

## Best for

Anything that should feel like a hand-typeset ledger: user research synthesis, white papers, longform reports, academic and policy briefs, advisory deliverables, bilingual EN/CN reports. Equally good for tech, design, or brand decks that want their words to be the only thing on the page.

## Avoid for

Decks that need visual personality or color-led storytelling — the all-ink palette is intentionally austere.

## Workflow

1. **Stay inside this visual system.** Never substitute fonts, recolor
   the palette, restructure the layout grid, or strip decorative
   elements — they are part of the identity. Mixing layouts from other
   templates breaks the system.
2. **Plan the deck** from the brief: audience, decision target, and the
   must-keep numbers. Ask only for the missing essentials (audience,
   source materials, deadline, must-keep numbers) when they are absent.
3. **Build the slides** following the slide grammar implied by this
   system: a cover, an agenda, section dividers, content slides with
   the system's type hierarchy, and a closing slide.
4. **Adjust length** by duplicating the most appropriate slide layout
   for more content, or dropping slides for less; keep page-number
   labels accurate.
5. **Embed the deck runtime** (below) inline — arrow keys, dots, wheel,
   touch, auto-scale, and print layout. No external JS files.

## Deck runtime (embed inline — never reference external files)

The deck must be a single self-contained HTML file with all JS inline:

- **Slides:** one `<section class="slide">` per slide; only the active one
  is visible (keep others in the DOM with `visibility:hidden;opacity:0`).
- **Keyboard:** ArrowRight/Down, PageDown, Space advance; ArrowLeft/Up,
  PageUp go back; Home/End jump to first/last. Ignore events from inputs.
- **Wheel/trackpad:** accumulated deltaX+deltaY past a small threshold
  moves exactly one slide, then resets quickly so one gesture never
  overshoots.
- **Touch:** horizontal swipe ≥50px (greater than vertical movement)
  moves previous/next.
- **Dots:** one clickable button per slide; active dot marked
  `aria-current="true"` and updated on every navigation path.
- **Active state:** mark the visible slide `.slide.active` (keep in sync
  with every navigation path).
- **Fit:** design slides at 1920×1080 and scale them with
  `transform:scale()` to fit the viewport, letterboxed.
- **Print:** `@media print` lays every slide out as its own page at the
  design size so Print → Save as PDF gives one page per slide.
- **Fallback:** with JS disabled, every slide is still exposed (hide
  non-active slides only after the runtime has booted).

## Output contract

Save exactly one self-contained HTML file (`deck.html`) in the workspace.
One sentence before saving, nothing after.

