---
name: html-ppt-zhangzara-pin-and-paper
description: |
  Field-note aesthetic — Caveat hand-lettering for annotations, Space Grotesk for structure, DM Mono labels, pinned paper cards. Best for research field notes, capstones, surveys, observational studies.
---

# Pin & Paper — HTML Deck

A single self-contained HTML presentation in the **Pin & Paper**
visual system. Yellow paper with safety-pin illustrations, ink-blue handwritten Caveat, paper-grain texture. saturated yellow paper, soft cream alternate, deep ink-blue type, plus rust red, kraft, and olive accents; visible paper grain texture

## At a glance

- **Scheme:** light · **Formality:** medium · **Density:** medium
- **Slides in demo:** 11
- **Palette:** paper #EFE56A; cream #F8F1D6; ink #1F3A8A; red #C2342B
- **Typography:** handwritten script for warmth + grotesk for legibility + mono for captions; textbook annotation feel (Caveat, Space+Grotesk, DM+Mono)
- **Font loading:** link the Google Fonts stylesheet; if offline, fall
  back gracefully to system fonts — never block rendering on the fonts.

## Best for

Anything that should feel hand-crafted, warm, and literary: qualitative research findings, founder reflections, longform brand stories, workshop debriefs. The signature safety-pin illustrations and paper-grain texture make it especially good for any deck — including tech or business — that wants personality and warmth over polish.

## Avoid for

Decks that need to feel digital-native polished or rigorously data-driven — handwritten Caveat is intentionally informal.

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

