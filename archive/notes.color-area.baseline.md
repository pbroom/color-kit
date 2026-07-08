# Color Area Analysis

Deep analysis of the Color Area component in the `/Users/peterbroomfield/plexiform` project.

## Initial prompt

I'm trying to construct a better version of the color area component in my color-kit library. I need a detailed analysis of the documented intent around its form and function, how the color area component works and what key decisions were made in the pursuit of performance, accessibility, usability, and delightful experience.

## GPT-5.3-Codex Analysis

### Documented Intent (Form + Function)

ColorArea is explicitly intended to be a composable 2D color plane with gamut awareness, overlays, and accessibility tools, not just a flat gradient picker.

- **Primary documentation:** color-area.mdx (line 3, 27, 66)
- **Legacy intent** (still relevant during migration): WebGL rendering, configurable axes, keyboard support, retina scaling — color-area-legacy.mdx (line 34)

### How It Works End-to-End

- **Color** creates a Legend State color observable and adapts it to the ColorAreaStore interface used by ColorArea.
  - Refs: color.tsx (line 36), color-store-adapter.ts (line 53)
- **ColorArea root** resolves axis defaults, tracks color-space transitions, and either renders defaults (Background + Gradient + Thumb) or your custom child composition.
  - Refs: color-area.tsx (line 125, 138, 155)
- **ColorAreaGradient** delegates rendering to WebGL (useWebGLGradient) and clips to rounded corners.
  - Refs: color-area.tsx (line 232), use-webgl-gradient.ts (line 143)
- **ColorAreaThumb** handles pointer drag + keyboard, converts position ↔ color channels, and animates movement.
  - Refs: color-area.tsx (line 371), use-color-coordinates.ts (line 45)
- **Overlays** (Boundary, FallbackIndicators, PalettePath, ContrastRegion, Legend) are additive SVG/HTML layers gated to valid contexts.
  - Refs: color-area-boundary.tsx (line 18), color-area-fallback-indicators.tsx (line 253), color-area-palette-path.tsx (line 218), color-area-contrast-region.tsx (line 365)

### Key Design Decisions by Goal

#### Performance

- GPU-first gradient rendering via fullscreen quad and fragment shader, with reusable uniforms/program setup.
  - Ref: use-webgl-gradient.ts (line 171)
- Retina crispness via CSS size + DPR backing-store size + viewport update, with ResizeObserver and DPR media query handling.
  - Ref: use-webgl-gradient.ts (line 334)
- Fine-grained store/computed model in color-observable to reduce unnecessary reactivity churn.
  - Ref: color-observable.ts (line 5)
- Hue-preservation thresholds prevent unstable hue drift at low chroma/saturation.
  - Ref: use-color-coordinates.ts (line 19)
- Overlay geometry moved largely to SVG path computation (useGamutPath) rather than per-pixel boundary detection in shader for current API ergonomics/styling.
  - Ref: use-gamut-path.ts (line 145)

#### Accessibility

- Thumb is keyboard-focusable and uses slider semantics with arrow key navigation + shift-step.
  - Ref: color-area.tsx (line 383)
- Human-readable aria-valuetext exposes both axis values.
  - Ref: color-area.tsx (line 486)
- Non-interactive overlay layers are aria-hidden and pointer-events-none so they don't interfere.
  - Ref: color-area-boundary.tsx (line 56)
- Contrast-region overlay bakes WCAG thresholds (3, 4.5, 7) into the picker surface.
  - Ref: color-area-contrast-region.tsx (line 368)

#### Usability

- Works with multiple color spaces and arbitrary channel mappings, while preserving hue continuity during conversions.
  - Ref: use-color-coordinates.ts (line 42)
- Color-space switching behavior intentionally saves/restores out-of-gamut OKLCH positions when toggling away and back.
  - Ref: color-observable.ts (line 287)
- Fallback indicators only render when requested color differs from P3/sRGB fallbacks, keeping noise low.
  - Ref: color-area-fallback-indicators.tsx (line 319)
- Palette path supports two mental models (clamp vs proportional) for chroma preservation across lightness.
  - Ref: color-area-palette-path.tsx (line 71)

#### Delight

- Spring animation + micro-interactions on thumb (whileHover, whileTap, drag shadow).
  - Ref: color-area.tsx (line 495)
- Fallback indicators mirror thumb animation and include collision-aware label placement to reduce clutter.
  - Ref: color-area-fallback-indicators.tsx (line 107)
- Shader anti-aliasing with derivatives (fwidth + smoothstep) softens gamut transitions and overlays.
  - Ref: color-area.frag (line 500)

### Important Drift Between Documented Intent and Current Implementation

- **plane** is documented but not implemented in ColorArea props/runtime.
  - Docs: color-area.mdx (line 80)
  - Code: no plane in color-area.tsx (line 66)
- **selectedGamut** and **root outOfGamutMode** are documented on ColorArea, but root does not consume them; they currently fall through `...props` to the DOM.
  - Refs: color-area.tsx (line 83, 149)
- **Compound API docs** list static members like ColorArea.Provider, but exports are flat named exports.
  - Docs: color-area.mdx (line 56)
  - Code: index.ts (line 1)
- **outOfGamutDim uniform** is wired in TS but unused in shader logic.
  - Refs: use-webgl-gradient.ts (line 243), color-area.frag (line 15)
- **Legacy shader pattern mode** still exists although TS side says mode 1 was removed.
  - Refs: use-webgl-gradient.ts (line 35), color-area.frag (line 50)
- **Legacy 2D canvas boundary hook** appears unused now (migration residue).
  - Ref: use-gamut-boundary.ts (line 118)
- **Accessibility semantics** are good but partial for slider role (no aria-valuemin/max/now).
  - Ref: color-area.tsx (line 483)
