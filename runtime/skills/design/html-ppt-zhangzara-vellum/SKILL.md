---
name: html-ppt-zhangzara-vellum
description: |
  Humanities lecture deck — vellum paper tones, serif-led typography, scholarly and restrained. Best for lectures, seminars, source-and-argument presentations, humanities research.
---

# Vellum — HTML Deck

A single self-contained HTML presentation in the **Vellum**
visual system. Deep navy canvas with warm-yellow italic Cormorant serifs and a single dusty teal accent. A quiet, scholarly aesthetic. deep periwinkle navy canvas with warm yellow italic-serif type and one dusty-teal accent for quote marks; a single coherent palette across every slide, no inverted theme

## At a glance

- **Scheme:** dark · **Formality:** high · **Density:** low
- **Slides in demo:** 9
- **Palette:** bg #2a3870; bg alt #343f80; fg #E8D85C; accent #3a7878
- **Typography:** italic transitional serif as the structural display face, paired with clean DM Sans body and Courier Prime mono for attributions and labels; bilingual EN/CN support (Cormorant+Garamond, DM+Sans, Courier+Prime, Noto+Serif+SC, Noto+Sans+SC)
- **Font loading:** link the Google Fonts stylesheet; if offline, fall
  back gracefully to system fonts — never block rendering on the fonts.

## Best for

Anything that should feel scholarly, literary, and quietly intelligent: research synthesis, white papers, academic and policy briefs, advisory deliverables, longform editorial pieces, founder reflections. Equally strong for any deck — including tech, business, or creator work — that wants a calm, considered atmosphere instead of energetic visuals.

## Avoid for

Contexts that need visual heat or pop — the navy + warm-yellow italic-Cormorant aesthetic is intentionally low-tempo.

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

