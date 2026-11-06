---
name: Precision Chrono-Architectural Minimal
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#e5bdbd'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#ac8888'
  outline-variant: '#5c3f40'
  surface-tint: '#ffb3b4'
  primary: '#ffb3b4'
  on-primary: '#680017'
  primary-container: '#d7193f'
  on-primary-container: '#ffeded'
  inverse-primary: '#bf0032'
  secondary: '#c6c7c5'
  on-secondary: '#2f3130'
  secondary-container: '#454746'
  on-secondary-container: '#b5b5b4'
  tertiary: '#c6c6cb'
  on-tertiary: '#2f3034'
  tertiary-container: '#6d6d72'
  on-tertiary-container: '#f1f0f6'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdada'
  primary-fixed-dim: '#ffb3b4'
  on-primary-fixed: '#40000b'
  on-primary-fixed-variant: '#920024'
  secondary-fixed: '#e2e3e1'
  secondary-fixed-dim: '#c6c7c5'
  on-secondary-fixed: '#1a1c1b'
  on-secondary-fixed-variant: '#454746'
  tertiary-fixed: '#e3e2e7'
  tertiary-fixed-dim: '#c6c6cb'
  on-tertiary-fixed: '#1a1b1f'
  on-tertiary-fixed-variant: '#46464b'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-hero:
    fontFamily: Space Grotesk
    fontSize: 64px
    fontWeight: '600'
    lineHeight: 72px
    letterSpacing: -0.04em
  display-hero-mobile:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '500'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-mono:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.12em
  label-ui:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2.5rem
  margin-sm: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
  space-2xl: 4rem
---

## Brand & Style

This design system defines the visual language for an elite engineering and digital product studio. The brand personality is uncompromisingly disciplined, cerebral, and mathematically resolved—evoking the meticulous craft of horology, aerospace instrumentation, and Swiss International typographic structure.

The target audience comprises technical founders, VP-level engineering leadership, and design purists who value uncompromising speed, architectural rigor, and signal-over-noise clarity. The experience should evoke absolute confidence, precision, and restrained power: every pixel, baseline, and stroke exists for a clear functional reason.

The design movement is **Technical Minimalist / Precision Swiss Modernism**. It rejects decorative gradients, playful blurs, and soft skeuomorphism in favor of:
- Unyielding 1px structural hair-lines and modular crosshair grids.
- Pitch black voids juxtaposed with matte carbon surfaces.
- A razor-sharp, surgical focal accent (Precision Crimson) derived from high-precision chronograph needles and cockpit indicators.
- Technical, monoline metadata anchoring geometric display typography.

## Colors

The palette operates in strict, high-contrast monochrome punctuated by a calculated burst of arterial red.

- **Pitch Black (`#050505`)**: The core foundational void. Applied across base canvas backgrounds to minimize ocular fatigue and establish profound depth.
- **Deep Graphite / Matte Carbon (`#0D0D0D`, `#121212`, `#171717`)**: Tonal step-ups for interactive panels, contextual cards, and navigation surfaces.
- **Subtle Surface Wireframe (`#222222`, `#2A2A2A`)**: Delicate 1px delineators that define architectural boundaries without visual clutter.
- **Crisp Off-White (`#F4F4F2`)**: Primary typographic content, icons, and hero numbers. Highly luminous without the harsh eye-strain of pure `#FFFFFF`.
- **Titanium Grey / Muted (`#8E8E93`, `#636366`)**: Secondary captions, technical specs, metadata, and disabled boundaries.
- **Precision Crimson Red (`#D7193F`)**: The focal catalyst. Used strictly and sparingly for micro-status indicators, active state needle points, terminal warnings, and definitive high-intent call-to-actions.

## Typography

The typographic hierarchy juxtaposes the engineered, geometric tension of **Space Grotesk** with the utilitarian precision of **Inter**.

- **Space Grotesk** is reserved for high-impact titles, structural section markers, metric counters, and uppercase technical badges (`label-mono`). It imparts an assertive, modernist personality reminiscent of technical drawings and high-end instrument clusters.
- **Inter** handles long-form editorial copy, granular specifications, interactive form labels, and multi-line body descriptions. Its tall x-height and neutral character guarantee effortless readability across high-density layouts.
- **Letter Spacing & Casing**: Micro-labels and status indicators leverage `Space Grotesk` set to uppercase with wide tracking (`0.12em`) to ground the interface with an architectural feel. Headlines employ negative tracking to tighten display impact.

## Layout & Spacing

The layout philosophy follows a strict 12-column modular grid rooted in mathematical rhythms and structural alignment.

- **Desktop (>= 1280px)**: 12-column fluid grid, `2.5rem` outer canvas margin, `1.5rem` column gutters. Section modules snap directly to baseline steps (`space-2xl` for section separation).
- **Tablet (768px - 1279px)**: 8-column layout with `1.5rem` gutters and margins. Grid cards consolidate into pairs or full-width spans.
- **Mobile (< 768px)**: 4-column layout with `1rem` gutters and `1.25rem` outer margins. Content collapses into vertical stacks with strict horizontal alignment guides.
- **Architectural Framing**: Cards and containers use explicit full-bleed 1px grid seams. Negative space is calculated, purposeful, and uncluttered, balancing dense data readouts with serene breathing room.

## Elevation & Depth

This design system avoids theatrical drop shadows or floating, blurry elevations. Depth is constructed purely through **tonal stratification and sharp 1px borders**:

- **Ground Level (`#050505`)**: The baseline canvas.
- **Tier 1 Surfaces (`#0D0D0D`)**: Primary cards, modular table blocks, and navigational strips, framed by a continuous 1px border (`#222222`).
- **Tier 2 Interactive Flyouts & Drawers (`#141414`)**: Popovers and floating menus, defined by a 1px border (`#2A2A2A`) accompanied by an imperceptible ambient occlusion shadow (`box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.8)`).
- **Precision Insets**: Recessed inputs, active tabs, and code blocks adopt a darker backdrop (`#080808`) with a recessed 1px edge to simulate milled metal bezels.

## Shapes

The shape system adopts a **Soft (Level 1)** curvature:
- Standard elements (buttons, badge tags, inputs, metric cells) use `0.25rem` (4px) corner radii.
- Larger modular structural cards adopt `0.5rem` (8px).
- Status needles, chronometer indicators, and radial focal nodes retain pure circles (`rounded-full`).

This subtle radius softens harsh digital aliasing while strictly preserving an industrial, precision-machined edge.

## Components

### Buttons
- **Primary / Focal**: Precision Crimson background (`#D7193F`), crisp white text (`#F4F4F2`), `4px` radius, typography `label-ui` (medium weight). On hover: shifts to `#E62349` with a subtle 1px border flare. Active: scales slightly (`transform: scale(0.99)`).
- **Secondary / Technical**: Pitch matte background (`#121212`), 1px outline (`#2A2A2A`), white text (`#F4F4F2`). On hover: border transitions to `#636366` with background lifting to `#171717`.
- **Tertiary / Ghost**: Transparent background, titanium text (`#8E8E93`), hover color `#F4F4F2` with monoline underline.

### Cards & Modular Cells
- Contained within `1px solid #222222` borders on `#0D0D0D` surfaces.
- Optional architectural detail: tiny `+` (crosshair) glyphs at exterior corner joints or upper-right metric coordinates.
- Padding follows strict internal intervals (`space-lg` desktop, `space-md` mobile).

### Chips & Badges
- Uppercase `label-mono` typography.
- Background `#141414`, bordered with `#2A2A2A`, text `#8E8E93`.
- Active / Live status chips feature a pulsing 6px solid `#D7193F` dot placed 8px to the left of the label.

### Form Inputs
- Background `#080808`, border `1px solid #222222`, text `#F4F4F2`, typography `body-md`.
- Focus state: border transforms instantly to `#D7193F` without default browser outline halo.
- Placeholder text set to `#636366`.

### Checkboxes & Radios
- Checkboxes: 16x16px boxes with 2px radius, border `1px solid #333333`. Checked state fills `#D7193F` with an off-white geometric checkmark.
- Radio buttons: 16x16px circles. Checked state features a centered 6px solid `#D7193F` core mimicking a chronometer axle.

### Lists & Data Grids
- Separated by hairline dividers (`1px solid #1A1A1A`).
- Left-aligned primary attributes in crisp `#F4F4F2`; right-aligned metadata, timings, and hash indicators in `#8E8E93` using `Space Grotesk`.
- Hover state: entire row shifts background subtly to `#121212`.