---
name: html-ppt-zhangzara-8-bit-orbit
description: |
  Pixel-art neon arcade aesthetic on a deep navy void — Tektur display, Chakra Petch body, Space Mono labels, low formality, medium density. Best for anything that should feel like a CRT screen at 2am: cyberpunk, gaming, web3, indie dev tools, hackathon demos.
---

# 8-Bit Orbit — HTML Deck

A single self-contained HTML presentation in the **8-Bit Orbit**
visual system. Pixel-art neon arcade aesthetic on a deep navy void. deep navy/black void with neon pink, cyan, and yellow pops; pixel art accents and CRT-monitor energy

## At a glance

- **Scheme:** dark · **Formality:** low · **Density:** medium
- **Slides in demo:** 10
- **Palette:** neon pink #F0A6CA; neon cyan #5EDCF4; neon yellow #F4D03F; deep navy #0F1B3D; void #0A0E27; lavender #E2D5F2
- **Typography:** boxy display sans paired with technical mono, all unmistakably digital and pixel-flavored (Chakra+Petch, Space+Mono, Tektur)
- **Font loading:** link the Google Fonts stylesheet; if offline, fall
  back gracefully to system fonts — never block rendering on the fonts.

## Best for

Anything that should feel like a CRT screen at 2am: cyberpunk, gaming, web3, indie dev tools, hackathon demos. Just as good for a tech talk that wants to lean into nostalgic-digital craft, a synthwave brand deck, or a creative review that wants to feel like a console.

## Avoid for

Contexts where the dark neon palette would actively work against the message — quiet institutional finance disclosures, healthcare patient-facing materials, traditional luxury.

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

