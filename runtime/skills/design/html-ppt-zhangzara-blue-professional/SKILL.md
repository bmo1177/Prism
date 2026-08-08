---
name: html-ppt-zhangzara-blue-professional
description: |
  Warm cream paper background with one electric cobalt blue accent, restrained ink-black text, Space Grotesk + Inter. Medium-high formality, clean modern professional. Best for QBRs, exec reviews, business cases, corporate updates.
---

# Blue Professional — HTML Deck

A single self-contained HTML presentation in the **Blue Professional**
visual system. Cream paper background with electric cobalt blue accents; clean modern professional. warm cream paper background with one electric cobalt blue accent; restrained ink black text and soft muted greys

## At a glance

- **Scheme:** light · **Formality:** medium-high · **Density:** medium
- **Slides in demo:** 10
- **Palette:** bg #FDFAE7; primary #1E2BFA; text #111111; text muted #6B6B6B
- **Typography:** modern sans pairing; quiet, professional, no decorative flourishes (Space+Grotesk, Inter)
- **Font loading:** link the Google Fonts stylesheet; if offline, fall
  back gracefully to system fonts — never block rendering on the fonts.

## Best for

Anything that should feel modern-considered and lightly authoritative: B2B SaaS pitches, consulting deliverables, advisory updates, investor reports. Also a clean, tasteful choice whenever you want to read as professional without going stiff — research synthesis, internal reviews, brand work for service businesses.

## Avoid for

Contexts where the deck should feel hot, playful, or intentionally informal — the cool electric-blue restraint will read as overly polished.

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

