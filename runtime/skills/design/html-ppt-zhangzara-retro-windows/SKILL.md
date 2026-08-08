---
name: html-ppt-zhangzara-retro-windows
description: |
  Windows 95 chrome — 3D-button gray, navy title bars, pixel-perfect inset/outset borders, MS Sans Serif-style pixel typography. Low formality. Best for nostalgia, retro-tech, playful training, product throwbacks.
---

# Retro Windows — HTML Deck

A single self-contained HTML presentation in the **Retro Windows**
visual system. Windows 95 chrome: gray title bars, MS Sans Serif, pixel typography, full nostalgia. Windows 95 system palette: 3D-button gray, navy title bars, pixel-perfect inset/outset borders, no anti-aliasing aesthetic

## At a glance

- **Scheme:** light · **Formality:** low · **Density:** medium
- **Slides in demo:** 10
- **Palette:** bg gray #C0C0C0; bg light #D4D0C8; blue navy #000080; blue light #1084D0; white #FFFFFF; black #000000
- **Typography:** 8-bit pixel display + Microsoft system sans + DOS terminal mono (VT323, Press+Start+2P)
- **Font loading:** link the Google Fonts stylesheet; if offline, fall
  back gracefully to system fonts — never block rendering on the fonts.

## Best for

Anything that should feel knowingly nostalgic: retro gaming, Y2K-aesthetic brands, creator portfolios with a 90s vibe, tech-history talks, deliberately tongue-in-cheek decks. A great choice anywhere a playful retro reference is the entire point.

## Avoid for

Decks that need to read as modern, elegant, or institutionally credible — the Win95 chrome will always read as a costume.

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

