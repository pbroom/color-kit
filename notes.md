# Color Kit — Design & Planning Notes v1.1

## Philosophy

Color Kit is a precision color toolkit built on perceptual color science. Every design decision flows from one principle: **respect the user's intent**. The internal representation is OKLCH (D65, CSS reference range) because it's perceptually uniform — lightness, chroma, and hue map to how humans actually see color. But the toolkit meets users wherever they are: hex, RGB, HSL, OKLCH, or beyond.

### Core tenets

1. **Perceptual truth** — OKLCH is the source of truth. All storage, interpolation, and gamut mapping happen in perceptual space. Other models are views, not storage formats.
2. **Precision without loss** — The stored color never loses precision when switching views or color models. Precision is only reduced when the user explicitly chooses a lower-precision value (e.g., picking an 8-bit hex).
3. **Honest controls** — Thumbs, handles, and stops only move when the user moves them. The UI communicates constraints gently rather than silently clamping values (see [UX Principles](#ux-principles) below).
4. **Screaming fast** — Color math runs at interaction speed. Canvas rendering, gamut mapping, and conversions must never cause dropped frames during drag operations.
5. **Accessible by default** — Every component passes thorough accessibility tests. Keyboard navigation, screen reader labels, contrast compliance, and focus management are first-class concerns.
6. **Headless and composable** — React primitives are unstyled, data-attribute-driven, and composable. Consumers bring their own design system.

---

## Color Models

### Internal format

OKLCH (D65) in the CSS reference range is the canonical representation.

| OKLCH Channel | Range      | Description |
| ------------- | ---------- | ----------- |
| `L`           | `[0, 1]`   | Lightness   |
| `C`           | `[0, 0.4]` | Chroma      |
| `H`           | `[0, 360)` | Hue         |

| OKLAB Channel | CSS Reference Range | Description           |
| ------------- | ------------------- | --------------------- |
| `L`           | `[0, 1]`            | Lightness             |
| `a`           | `[-0.4, 0.4]`       | Green–red component   |
| `b`           | `[-0.4, 0.4]`       | Blue–yellow component |

### Supported models

| Model      | Status         | Notes                                                                                                                                                  |
| ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OKLCH      | ✅ Done        | Internal representation                                                                                                                                |
| OKLAB      | ✅ Done        | Sibling perceptual model                                                                                                                               |
| sRGB       | ✅ Done        | 8-bit channels, 0–255                                                                                                                                  |
| Hex        | ✅ Done        | 3/4/6/8-digit shorthand parsing                                                                                                                        |
| HSL        | ✅ Done        | Cylindrical sRGB                                                                                                                                       |
| HSV/HSB    | ✅ Done        | Cylindrical sRGB (brightness variant)                                                                                                                  |
| Display P3 | ✅ Done        | Wide-gamut display target                                                                                                                              |
| HCT        | 🔲 Planned     | Material Design 3 color model (Hue, Chroma, Tone). Tone maps to CIELAB L\*, chroma is CAM16 chroma. Useful for design-token generation and M3 interop. |
| CMYK       | 🔲 Considering | Simulation only — no ICC profiles. Useful for print previews, but lossy by nature. May be better as an optional add-on.                                |

---

## UX Principles

### Requested vs. actual color

The most important UX concept in Color Kit. Every color has two facets:

- **Requested color** — The value the user chose, stored at full OKLCH precision. This is what the thumbs/handles represent. It may be out of gamut.
- **Displayed color** — The closest in-gamut color that can actually be rendered. This is what swatches, previews, and CSS output show.

The user always controls the requested color. The system communicates the displayed color alongside it, but never silently moves the user's selection.

### Channel persistence

Every channel has a default value and retains its current value until the user explicitly changes it. This is the general rule — it applies to every slider, dial, area axis, and input field uniformly.

- **Defaults** — When a color is first created, every channel gets a sensible default (e.g., H=0, C=0, L=0.5, alpha=1). These defaults are used wherever the channel hasn't been set yet.
- **Sticky values** — Once the user sets a channel, that value persists regardless of what other channels do. Changing lightness to 0 doesn't reset hue. Reducing chroma to 0 doesn't reset hue. Switching color models and back doesn't reset anything. The value only changes when the user directly acts on that channel again.
- **Degenerate states are not special** — Mathematically, hue is undefined at zero chroma and both hue and chroma are undefined at L=0 (black) or L=1 (white). Color Kit ignores this. The stored requested value for each channel is always the last user-set value, never a mathematical artifact. There is no NaN in the user model.

This same principle extends to 2D areas: if an area maps X to lightness and Y to chroma, both axes retain their positions independently. Moving the thumb horizontally changes lightness without snapping chroma, and vice versa.

### Handles never jump

Thumbs, stops, and handles are physical metaphors. They stay where the user puts them. This is the visual consequence of channel persistence.

- **Lightness to zero:** When L reaches 0, the color is black — but hue and chroma controls don't snap to zero. They stay in place so the user can raise lightness again and return to the exact same color. A saturation slider still shows the selected hue's gradient. A lightness × chroma area still uses the selected hue as its base.
- **Out-of-gamut chroma:** If the user selects `oklch(0.5 0.38 200)`, the thumb rests at C=0.38 even though sRGB max chroma at that L/H is much lower. The slider shows the thumb position (requested) alongside a marker for the actual displayable chroma and the maximum chroma for the given L+H and H.
- **Color area out of gamut:** On a 2D area (e.g., Y=chroma, X=lightness), the thumb can rest outside the gamut boundary. The thumb's loupe/inkwell shows the fallback color. Mini-thumb indicators show where the gamut-mapped values land.

Reference: [Figma mockup — chroma slider with requested vs. actual markers](https://www.figma.com/design/LsKRJGa3DdtITEfQ5d8H7v/Plexiform?node-id=890-6031&t=StAXfudPUlXVSB0c-11)

### Visual honesty in gradients

Hue sliders must be accurate to their color model. OKLCH hue 0° is not the same as HSL hue 0°.

- **HSL hue gradient:** Simple — define stops at the six RGB primaries/secondaries evenly spaced at 60° intervals (`hsl(0, 100%, 50%)` through `hsl(360, 100%, 50%)`).
- **OKLCH hue gradient:** Requires sampling the hue circle and finding the maximum chroma at each hue along with the lightness value where that maximum exists. These (L, C, H) triples form the gradient stops, producing a physically accurate representation of the OKLCH hue wheel at peak saturation.

Channel gradients on sliders and areas must reflect the actual color model math, not a convenient RGB approximation.

---

## Architecture

### Packages

```
color-kit/
├── packages/
│   ├── core/          Pure TypeScript — zero dependencies
│   │   ├── conversion/    Bidirectional converters between all models
│   │   ├── contrast/      WCAG 2.1 + APCA contrast calculations
│   │   ├── gamut/         Gamut detection and mapping (binary search on chroma)
│   │   ├── harmony/       Complementary, analogous, triadic, etc.
│   │   ├── manipulation/  Lighten, darken, saturate, mix, invert, etc.
│   │   ├── scale/         Interpolation and scale generation
│   │   └── utils/         Clamp, lerp, normalize, trig helpers
│   └── react/         Headless React primitives
│       ├── context.ts     ColorProvider + useColorContext
│       ├── use-color.ts   Core state hook (controlled + uncontrolled)
│       ├── color-area.tsx  2D channel picker
│       ├── color-slider.tsx  1D channel slider
│       ├── hue-slider.tsx    Hue convenience wrapper
│       ├── alpha-slider.tsx  Alpha convenience wrapper
│       ├── swatch.tsx        Single color swatch
│       ├── swatch-group.tsx  Selectable swatch collection
│       ├── color-input.tsx   Text input with parsing
│       ├── color-display.tsx Visual color preview
│       ├── contrast-badge.tsx WCAG contrast display
│       └── api/              Per-component utility functions
├── apps/
│   └── docs/          Vite + React Router + MDX documentation site
└── registry/          shadcn/ui-compatible component registry
```

### Performance strategy

The current implementation is pure TypeScript with hand-rolled matrix math — no external color library dependency. This was a deliberate choice over culori for:

- **Bundle size** — Zero dependencies in `@color-kit/core`
- **Tree-shaking** — Consumers only pay for what they import
- **Control** — Gamut mapping and precision behavior can't be overridden by upstream changes

Future performance considerations:

- **GPU-accelerated rendering** — ColorArea's 2D gradient should use WebGL/WebGPU shaders for smooth P3 rendering. Canvas 2D with `getImageData` pixel loops won't keep up during drag.
- **Memoization** — Gamut boundary calculations and max-chroma lookups for a given hue should be cached and invalidated only when the relevant channel changes.
- **Web Workers** — Heavy operations like generating full gamut boundary paths or WCAG contrast region maps could be offloaded.
- **WASM** — If the pure-TS path becomes a bottleneck for bulk operations (e.g., histogram computation, 3D point clouds), a Rust/WASM module for the hot paths is worth exploring.

---

## API

### What exists today

| Capability                                | Module                         | Status  |
| ----------------------------------------- | ------------------------------ | ------- |
| Store a color (OKLCH internal)            | `Color` type                   | ✅ Done |
| Convert between all supported models      | `conversion/*`                 | ✅ Done |
| Parse and serialize CSS color strings     | `parse()`, `toCss()`           | ✅ Done |
| Gamut detection (sRGB, P3)                | `gamut/`                       | ✅ Done |
| Gamut mapping (chroma reduction)          | `toSrgbGamut()`, `toP3Gamut()` | ✅ Done |
| WCAG 2.1 contrast ratio + AA/AAA checks   | `contrast/`                    | ✅ Done |
| APCA contrast                             | `contrastAPCA()`               | ✅ Done |
| Color harmonies                           | `harmony/`                     | ✅ Done |
| Interpolation and scale generation        | `scale/`                       | ✅ Done |
| Manipulation (lighten, darken, mix, etc.) | `manipulation/`                | ✅ Done |

### Planned API additions

| Capability                         | Description                                                                                                                                                                                                                                                                                                                                                | Priority  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **Requested/displayed color pair** | A data structure or hook that maintains both the user's unbounded selection and the gamut-mapped fallback. Core to the UX model.                                                                                                                                                                                                                           | 🔴 High   |
| **Gamut boundary paths**           | For a given hue, produce the sRGB and P3 gamut boundary as a path (array of L,C points) suitable for rendering as an SVG `<path>` or Canvas line on a 2D area.                                                                                                                                                                                             | 🔴 High   |
| **WCAG contrast region paths**     | For a given foreground color, produce paths/regions on a 2D area showing where the background meets AA (4.5:1), AAA (7:1), or large-text (3:1) contrast thresholds.                                                                                                                                                                                        | 🟡 Medium |
| **Max chroma lookup**              | For a given hue (and optionally lightness), find the maximum chroma within a gamut. Needed for accurate hue-slider gradients and chroma-slider markers.                                                                                                                                                                                                    | 🔴 High   |
| **Multi-color state management**   | Manage multiple named colors (foreground, background, palette entries) with shared context. Currently the provider holds one color.                                                                                                                                                                                                                        | 🟡 Medium |
| **Chroma band generation**         | For a given hue and chroma, produce a tonal strip from L=0 to L=1 (OKLCH) or T=0 to T=100 (HCT). Two modes: _clamped_ (chroma is the nearest in-gamut value to the request) and _proportional_ (chroma is the same percentage of max in-gamut chroma as the selected point). Returns an array of colors suitable for palette generation and visualization. | 🔴 High   |
| **Color difference (ΔE)**          | Perceptual color difference metrics — ΔE (OKLAB Euclidean), CIEDE2000, or both. Useful for palette deduplication and accessibility analysis.                                                                                                                                                                                                               | 🟢 Low    |
| **HCT conversion**                 | Bidirectional HCT ↔ OKLCH for Material Design 3 interop.                                                                                                                                                                                                                                                                                                   | 🟢 Low    |

---

## Components

### Currently implemented

| Component       | Package | Description                              |
| --------------- | ------- | ---------------------------------------- |
| `ColorProvider` | react   | Context provider — shared color state    |
| `ColorArea`     | react   | 2D picker (configurable X/Y channels)    |
| `ColorSlider`   | react   | 1D slider (any channel)                  |
| `HueSlider`     | react   | Convenience wrapper — hue channel        |
| `AlphaSlider`   | react   | Convenience wrapper — alpha channel      |
| `Swatch`        | react   | Single color preview, click-to-select    |
| `SwatchGroup`   | react   | Collection with keyboard nav + selection |
| `ColorInput`    | react   | Text input with format parsing           |
| `ColorDisplay`  | react   | Background color preview                 |
| `ContrastBadge` | react   | WCAG contrast ratio display              |

### Planned components

#### Gradient + Gradient Stop

A composable gradient builder for creating and editing multi-stop gradients.

- `Gradient` — Container that renders a CSS gradient and manages an ordered list of stops.
- `GradientStop` — Draggable stop within the gradient. Supports position (0–1), color, and optional easing between stops.
- Interpolation in OKLCH by default (perceptually uniform), with an option for other models.
- Add/remove stops by clicking the track or pressing a key.

#### Dial

A radial/angular input for hue selection. Behaves like a circular slider — the user drags around the ring to select a hue angle. Useful as an alternative to a linear hue slider, especially for showing color relationships (harmony lines, complementary markers).

#### Area (enhanced composition model)

The current `ColorArea` is a single interactive 2D surface. The planned model makes it composable:

| Sub-component     | Role                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Area`            | Outer container — sets dimensions, handles coordinate mapping, and composes layers                                                        |
| `Area.Background` | Convenience wrapper around `Layer` that renders a solid or checker background                                                             |
| `Area.ColorPlane` | WebGL/WebGPU canvas that renders the 2D color gradient in P3. This is the visual surface.                                                 |
| `Area.Layer`      | Generic composable layer — can hold SVG overlays, gamut boundaries, contrast regions, or custom content                                   |
| `Area.Point`      | Positioned marker with optional label. Used for fallback indicators (mini-thumbs showing where the gamut-mapped color lands)              |
| `Area.Line`       | SVG line or path — used for gamut boundaries (sRGB, P3) and WCAG contrast threshold curves                                                |
| `Area.Thumb`      | The interactive input element. Positioned at the user's requested color. Shows the fallback color in its loupe/inkwell when out of gamut. |

This composition allows consumers to build rich, layered color areas:

```tsx
<Area xChannel="l" yChannel="c" hue={selectedHue}>
  <Area.ColorPlane />
  <Area.Layer>
    <Area.Line path={srgbBoundary} stroke="white" strokeDasharray="2 2" />
    <Area.Line path={p3Boundary} stroke="white" opacity={0.5} />
    <Area.Line path={contrastAARegion} fill="rgba(0,255,0,0.1)" />
  </Area.Layer>
  <Area.Layer>
    <Area.Point position={gamutMappedPosition} variant="fallback" />
    <Area.Thumb />
  </Area.Layer>
</Area>
```

#### Bezier Curves Editor

An interactive easing curve editor for defining interpolation curves between gradient stops or scale steps. Drag control points to shape the curve. Outputs a cubic-bezier value or a set of interpolation weights.

#### Eyedropper

Wraps the [EyeDropper API](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API) with a consistent component interface. Falls back gracefully on unsupported browsers. Returns the picked color parsed into the internal OKLCH format.

#### Histogram

Displays the distribution of a channel (L, C, H, R, G, B, etc.) across an image or palette. Rendered as a lightweight canvas bar chart. Useful for image analysis and palette diagnostics.

#### 3D Color Space Viewer

An interactive three-axis visualization of a color space (OKLCH, OKLAB, or sRGB cube). Renders a point cloud or wireframe showing the gamut volume. The user can rotate, zoom, and place markers. Useful for understanding gamut boundaries and how colors relate in 3D. Likely implemented with Three.js or a lightweight WebGL renderer.

---

## Gamut & Boundary Rendering

This is a critical capability that bridges core math and component rendering.

### Gamut boundary path generation

For a 2D color area at a given hue:

1. Sweep lightness from 0 to 1 in fine steps.
2. At each lightness, binary-search for the maximum chroma within the target gamut (sRGB or P3).
3. Collect the (L, C) pairs into a closed path.
4. Return as an array of points suitable for SVG `<path>` or Canvas `lineTo`.

This path is what `Area.Line` renders as the dashed gamut boundary overlay.

### Max chroma for hue slider gradients

For an OKLCH hue slider at peak saturation:

1. Sample hue at N evenly-spaced angles (e.g., every 1° for smoothness).
2. At each hue, find the (L, C) pair where chroma is maximized within the target gamut.
3. Convert each (L, C, H) triple to a CSS color for the gradient stops.

This produces the physically accurate OKLCH hue wheel, not an RGB approximation.

### Chroma band (tonal strip)

Given a hue H and a user-selected chroma C_req (plus a target gamut), produce an array of colors sweeping lightness from 0 to 1 (OKLCH) or tone from 0 to 100 (HCT). The band represents a tonal palette through that hue — think Material Design 3 tonal palettes, but generalized.

Two modes control how chroma behaves across the lightness range:

**Mode 1 — Clamped**

At each lightness step, use the closest in-gamut chroma to the requested value:

1. For each L in `[0, 1]` at N steps:
2. Compute `C_max` = max in-gamut chroma at (L, H).
3. `C_actual` = `min(C_req, C_max)`.
4. Emit `oklch(L, C_actual, H)`.

The band holds the requested chroma wherever the gamut allows it, and clamps to the gamut boundary where it doesn't. This produces a strip that is fully saturated in the middle lightness range and fades toward the extremes where the gamut narrows.

**Mode 2 — Proportional**

At each lightness step, use the same _percentage_ of max chroma as the selected point represents:

1. Compute `C_max_at_selected` = max in-gamut chroma at (L_selected, H).
2. `ratio` = `C_req / C_max_at_selected` (clamped to [0, 1]).
3. For each L in `[0, 1]` at N steps:
4. Compute `C_max` = max in-gamut chroma at (L, H).
5. `C_actual` = `ratio × C_max`.
6. Emit `oklch(L, C_actual, H)`.

The band follows the shape of the gamut — wider where the gamut is wider, narrower where it's narrower — while maintaining a consistent _relative_ saturation. This produces smoother, more uniform-feeling tonal palettes because the chroma scales with what's available at each lightness rather than hitting a hard clamp.

**Comparison at a glance:**

|                             | Clamped                                     | Proportional                                     |
| --------------------------- | ------------------------------------------- | ------------------------------------------------ |
| Middle lightness            | Identical to requested chroma (if in gamut) | Slightly lower if ratio < 1                      |
| Extremes (near black/white) | Hard clamp to boundary — band "flattens"    | Gradual taper — band follows gamut curvature     |
| Use case                    | Maximally vivid at each step                | Perceptually uniform saturation across the strip |

Both modes work identically in HCT space (substituting tone for lightness and CAM16 chroma for OKLCH chroma) once HCT conversion is available.

### WCAG contrast regions

For a 2D area showing lightness × chroma at a fixed hue, with a given reference color:

1. At each (L, C) sample point, compute the contrast ratio against the reference color.
2. Contour the region where contrast ≥ threshold (4.5:1 for AA, 7:1 for AAA, 3:1 for large text).
3. Return the contour as a path for overlay rendering.

---

## Accessibility

### Component-level requirements

- **Keyboard navigation:** All interactive components support arrow keys, Home/End, and Tab/Shift+Tab. 2D areas support both axes via arrow keys.
- **ARIA roles and labels:** Sliders use `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` (human-readable, e.g., "Hue: 240 degrees"). Areas use a composite pattern.
- **Focus indicators:** Clear, visible focus rings that meet WCAG 2.1 SC 2.4.7 at minimum.
- **Screen reader announcements:** Color changes announced via `aria-live` regions when appropriate. Gamut warnings communicated textually.
- **Reduced motion:** Respect `prefers-reduced-motion` for any transitions or animations.
- **Color contrast of controls themselves:** Thumb outlines, boundary lines, and markers must be visible against the dynamic color background.

### Testing strategy

- Unit tests for ARIA attribute correctness
- Integration tests with `@testing-library/react` for keyboard interaction flows
- Axe-core automated scans in CI
- Manual screen reader testing (VoiceOver, NVDA) for complex components (Area, Gradient)

---

## Tests

### Current coverage

| Area                                   | Test file                               | Status |
| -------------------------------------- | --------------------------------------- | ------ |
| Conversions (hex, RGB, HSL, roundtrip) | `core/__tests__/conversion.test.ts`     | ✅     |
| Contrast ratio + WCAG compliance       | `core/__tests__/contrast.test.ts`       | ✅     |
| Gamut checking + mapping               | `core/__tests__/gamut.test.ts`          | ✅     |
| Color harmonies                        | `core/__tests__/harmony.test.ts`        | ✅     |
| Interpolation + scale generation       | `core/__tests__/scale.test.ts`          | ✅     |
| API utility functions                  | `react/__tests__/api.test.ts`           | ✅     |
| ColorInput component                   | `react/__tests__/color-input.test.tsx`  | ✅     |
| SwatchGroup component                  | `react/__tests__/swatch-group.test.tsx` | ✅     |

### Gaps to fill

#### Conversion roundtrip fidelity (`core/__tests__/roundtrip.test.ts`)

Verify that converting Color (OKLCH) → Model → Color preserves values within a reasonable epsilon for every supported model. The existing `conversion.test.ts` only roundtrips through hex (which is 8-bit lossy). These tests should use `toBeCloseTo` with higher precision.

- OKLCH → RGB → OKLCH (via `toRgb` / `fromRgb`) for a spread of hues, lightnesses, and chromas
- OKLCH → HSL → OKLCH (via `toHsl` / `fromHsl`) — include edge cases: pure grays (C=0), fully saturated primaries, mid-tones
- OKLCH → HSV → OKLCH (via `toHsv` / `fromHsv`) — same spread as HSL
- OKLCH → OKLAB → OKLCH (via `toOklab` / `fromOklab`) — should be near-lossless since it's the same color space family
- OKLCH → Hex → OKLCH (via `toHex` / `fromHex`) — verify that the only precision loss is 8-bit quantization (delta per channel ≤ 1/255)
- Alpha preservation — confirm alpha survives roundtrip for every model
- Edge colors: black `(0, 0, 0)`, white `(1, 0, 0)`, mid-gray `(0.5, 0, 0)`, high-chroma `(0.7, 0.3, 150)`

#### HSV conversions (`core/__tests__/hsv.test.ts`)

Test `rgbToHsv` and `hsvToRgb` against known values. The implementation uses standard hexagonal-cone math.

- **Primary/secondary colors:** Red → `(0, 100, 100)`, Green → `(120, 100, 100)`, Blue → `(240, 100, 100)`, Cyan → `(180, 100, 100)`, Magenta → `(300, 100, 100)`, Yellow → `(60, 100, 100)`
- **Grayscale:** Black → `(0, 0, 0)`, White → `(0, 0, 100)`, Mid-gray → `(0, 0, 50)`
- **Partial saturation:** e.g., `rgb(128, 64, 64)` → hue ≈ 0, saturation ≈ 50, value ≈ 50
- **Roundtrip:** `hsvToRgb(rgbToHsv(rgb))` should match input for 8-bit values
- **Alpha passthrough:** Alpha should be preserved in both directions
- **Hue normalization:** Ensure hue wraps to `[0, 360)` and never returns NaN

#### OKLAB conversions (`core/__tests__/oklab.test.ts`)

Test `linearRgbToOklab` and `oklabToLinearRgb` against Björn Ottosson's reference values.

- **Reference colors:** D65 white `(1, 1, 1)` → L ≈ 1.0, a ≈ 0, b ≈ 0. Pure black `(0, 0, 0)` → L = 0, a = 0, b = 0.
- **sRGB red, green, blue** — compare L, a, b output against published OKLAB reference values (available from Ottosson's blog post)
- **Roundtrip:** `oklabToLinearRgb(linearRgbToOklab(linear))` should be identity within ε ≈ 1e-10
- **Symmetry check:** The `a` axis should be positive for reds, negative for greens. The `b` axis should be positive for yellows, negative for blues.
- **Edge values:** Very small linear values near zero (verify cube-root doesn't produce NaN)

#### P3 conversions (`core/__tests__/p3.test.ts`)

Test the four functions in `conversion/p3.ts`.

- **Matrix roundtrip:** `linearP3ToLinearSrgb(linearSrgbToLinearP3(srgb))` should be identity within ε
- **Gamma roundtrip:** `p3ToLinearP3(linearP3ToP3(linear))` should be identity within ε
- **Known colors:** sRGB white `(1, 1, 1)` maps to P3 `(1, 1, 1)` (both are D65 white). sRGB red `(1, 0, 0)` maps to P3 with r < 1 (sRGB red is inside P3 gamut but not at the P3 red primary).
- **Gamma transfer function:** Values ≤ 0.0031308 should use the linear segment. Values above should use the power curve. Test a value on each side of the breakpoint.
- **Clamping in `linearP3ToP3`:** Confirm output is clamped to `[0, 1]` (this is intentional in the display path — the unclamped check lives in `gamut/`).
- **Negative value handling:** Both gamma and linearize functions use `Math.sign(c)` for negative inputs. Verify this works for slightly-negative values from matrix rounding.

#### Manipulation functions (`core/__tests__/manipulation.test.ts`)

Test all 9 functions in `manipulation/index.ts`.

- **`lighten(color, amount)`**
  - `lighten(mid, 0)` returns same lightness
  - `lighten(mid, 1)` returns L = 1 (white)
  - `lighten(mid, 0.5)` moves halfway from current L to 1 (relative scaling: `L + amount * (1 - L)`)
  - Preserves hue, chroma, and alpha

- **`darken(color, amount)`**
  - `darken(mid, 0)` returns same lightness
  - `darken(mid, 1)` returns L = 0 (black)
  - `darken(mid, 0.5)` moves halfway from current L to 0 (relative scaling: `L - amount * L`)
  - Preserves hue, chroma, and alpha

- **`saturate(color, amount)`**
  - Increases chroma by `amount * 0.4` (absolute offset against max range)
  - Clamps to `[0, 0.4]`
  - `saturate(gray, 1)` → C = 0.4

- **`desaturate(color, amount)`**
  - Decreases chroma by `amount * C` (relative scaling)
  - `desaturate(color, 1)` → C = 0
  - `desaturate(color, 0)` → unchanged

- **`adjustHue(color, degrees)`**
  - `adjustHue(red, 180)` → hue ≈ 180
  - `adjustHue(color, 360)` → same hue (wraps)
  - `adjustHue(color, -30)` → wraps correctly through 0
  - Preserves L, C, and alpha

- **`setAlpha(color, alpha)`**
  - `setAlpha(color, 0.5)` → alpha = 0.5
  - Clamps to `[0, 1]`
  - `setAlpha(color, -1)` → alpha = 0
  - `setAlpha(color, 2)` → alpha = 1

- **`mix(color1, color2, t)`**
  - `mix(a, b, 0)` → a
  - `mix(a, b, 1)` → b
  - `mix(a, b, 0.5)` → midpoint (L, C, alpha are averaged; hue takes shortest path)
  - Hue shortest-path: `mix(h=10, h=350, 0.5)` → h = 0 or 360 (not 180)
  - Alpha interpolation: `mix(alpha=0, alpha=1, 0.5)` → alpha = 0.5

- **`invert(color)`**
  - L is flipped: `1 - L`
  - Hue rotates 180°
  - Chroma and alpha are preserved

- **`grayscale(color)`**
  - C = 0
  - L, H, and alpha are preserved

#### Requested vs. displayed logic (future — `react/__tests__/requested-displayed.test.tsx`)

Once the dual-value model is implemented:

- Setting an out-of-gamut color stores the full requested value (e.g., `C = 0.38`)
- `displayed` returns a gamut-mapped version (lower C) while `requested` stays at 0.38
- Changing a single channel (e.g., lightness) on the requested color preserves all other requested channels
- The displayed color updates reactively when the requested color changes
- Switching target gamut (sRGB ↔ P3) updates displayed but not requested
- Setting an in-gamut color makes requested === displayed

#### ColorArea interaction (`react/__tests__/color-area.test.tsx`)

Test the `ColorArea` component using `@testing-library/react` with `jsdom`.

- **Rendering:**
  - Renders a root `[data-color-area]` div with a `[data-color-area-thumb]` child
  - Has `role="slider"` and `tabIndex={0}`
  - `aria-valuetext` reflects both channel values
  - Thumb position (`data-x`, `data-y`) matches the color's channel values normalized to their ranges

- **Pointer interaction:**
  - `pointerdown` sets `[data-dragging]` and updates color from position
  - `pointermove` while dragging updates color continuously
  - `pointerup` clears `[data-dragging]`
  - Clicking at (0, 0) sets the x-channel to min and y-channel to max (top-left); clicking at (1, 1) sets x to max and y to min (bottom-right, because Y is inverted: top = max)

- **Keyboard interaction:**
  - `ArrowRight` increases x-channel by step (0.01 default, 0.1 with Shift)
  - `ArrowLeft` decreases x-channel
  - `ArrowUp` increases y-channel
  - `ArrowDown` decreases y-channel
  - Values clamp to their ranges

- **Channel configuration:**
  - Default channels `{ x: 'c', y: 'l' }` maps X to chroma, Y to lightness
  - Custom channels (e.g., `{ x: 'h', y: 'c' }`) map correctly
  - Custom ranges are respected in position calculations

- **Context vs. props:**
  - Works with `<ColorProvider>` context
  - Works with explicit `color`/`onChange` props
  - Throws if neither is provided

#### ColorSlider interaction (`react/__tests__/color-slider.test.tsx`)

- **Rendering:**
  - Renders `[data-color-slider]` with `[data-color-slider-thumb]`
  - `data-channel` reflects the channel name
  - `data-orientation` reflects `horizontal` or `vertical`
  - `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-orientation`
  - Default `aria-label` includes channel name (e.g., "Lightness slider")

- **Horizontal pointer:**
  - Clicking at left edge → channel = min
  - Clicking at right edge → channel = max
  - Dragging updates value continuously
  - Thumb `data-value` matches normalized position

- **Vertical pointer:**
  - Clicking at top → channel = max (inverted)
  - Clicking at bottom → channel = min

- **Keyboard:**
  - `ArrowRight`/`ArrowUp` increases value by step
  - `ArrowLeft`/`ArrowDown` decreases value by step
  - Shift multiplies step by 10
  - Values clamp to range

- **Per-channel ranges:**
  - `l` defaults to `[0, 1]`
  - `c` defaults to `[0, 0.4]`
  - `h` defaults to `[0, 360]`
  - `alpha` defaults to `[0, 1]`
  - Custom range overrides the default

#### HueSlider / AlphaSlider (`react/__tests__/wrapper-sliders.test.tsx`)

- `HueSlider` renders a `ColorSlider` with `channel="h"` and `[data-hue-slider]`
- `HueSlider` default `aria-label` is "Hue"
- `AlphaSlider` renders a `ColorSlider` with `channel="alpha"` and `[data-alpha-slider]`
- `AlphaSlider` default `aria-label` is "Opacity"
- Both forward `orientation`, `color`, `onChange`, and `ref` props correctly
- Custom `aria-label` overrides the default

#### Swatch (`react/__tests__/swatch.test.tsx`)

- **Non-interactive mode (no `onSelect`):**
  - `role="img"` with `aria-label` showing hex value
  - No `tabIndex`
  - `[data-swatch]` present, `[data-interactive]` absent
  - `backgroundColor` matches the hex of the color

- **Interactive mode (with `onSelect`):**
  - `role="button"` with `tabIndex={0}`
  - `[data-interactive]` present
  - Click fires `onSelect` with the color
  - Enter key fires `onSelect`
  - Space key fires `onSelect`

- **Selection state:**
  - `[data-selected]` present when `isSelected={true}`
  - `[data-selected]` absent when `isSelected={false}` or omitted

- **Data attributes:**
  - `[data-color]` reflects the hex string of the color
  - Hex updates when color prop changes

#### ColorDisplay (`react/__tests__/color-display.test.tsx`)

- Renders `[data-color-display]` with `role="img"`
- `aria-label` includes the hex value (e.g., "Current color: #3b82f6")
- `data-color` attribute matches the hex
- `backgroundColor` is set to the hex for opaque colors
- `backgroundColor` uses `rgb()` format for translucent colors (alpha < 1)
- Works with `<ColorProvider>` context
- Works with explicit `color` prop
- Throws if neither context nor prop is provided

#### ContrastBadge (`react/__tests__/contrast-badge.test.tsx`)

- **Data attributes:**
  - `[data-contrast-badge]` always present
  - `[data-ratio]` shows the contrast ratio to 2 decimal places
  - `[data-meets-aa]` is `"true"` or `"false"`
  - `[data-meets-aaa]` is `"true"` or `"false"`
  - `[data-passes]` present when the selected level passes

- **Known contrast pairs:**
  - Black on white → ratio ≈ 21:1, AA = true, AAA = true
  - Similar grays → ratio < 3:1, AA = false, AAA = false
  - WCAG boundary pair (4.5:1 exactly) → AA = true, AAA = false

- **Level prop:**
  - `level="AA"` checks against 4.5:1
  - `level="AAA"` checks against 7:1
  - Default is "AA"

- **Accessibility:**
  - `role="status"` for live updates
  - `aria-label` includes ratio text and level label (e.g., "Contrast ratio: 4.52:1, Passes AA")

- **Content:**
  - Default children render the ratio text
  - Custom children override the default content

#### Accessibility (`react/__tests__/a11y.test.tsx`)

Integration tests using `vitest-axe` or `@axe-core/react`:

- `ColorArea` with a color passes axe scan (no violations)
- `ColorSlider` for each channel passes axe scan
- `HueSlider` and `AlphaSlider` pass axe scan
- `SwatchGroup` with multiple swatches passes axe scan (correct listbox/option pattern)
- `Swatch` in both interactive and non-interactive modes passes axe scan
- `ColorInput` passes axe scan (label association)
- `ColorDisplay` passes axe scan (img role + label)
- `ContrastBadge` passes axe scan (status role + label)

#### Channel persistence (`core/__tests__/persistence.test.ts` + `react/__tests__/persistence.test.tsx`)

Core level:

- Creating a `Color` with `{ l: 0, c: 0.2, h: 150, alpha: 1 }` → all four values stored exactly as given, despite L=0 making the color black
- Converting black-with-hue to RGB and back → the hue should survive (or be documented as lost at the RGB level, since RGB black has no hue information)
- `toOklab({ l: 0, c: 0, h: 150, alpha: 1 })` → hue information is not present in OKLAB (a=0, b=0 at zero chroma), but the original `Color` struct should remain unchanged (hue is stored, not derived)

React level (once dual-value model exists):

- `useColor` initialized with `defaultColor` stores the exact channel values
- Changing lightness to 0 via `setColor` does not alter hue or chroma on the stored color
- Changing chroma to 0 via slider does not alter hue on the stored color
- Restoring lightness from 0 back to 0.5 returns the exact same hue and chroma

#### Edge cases (`core/__tests__/edge-cases.test.ts`)

- **Alpha = 0:**
  - `toHex` with alpha=0 returns an 8-digit hex ending in `00`
  - `toCss(color, 'rgb')` includes `/ 0` alpha syntax
  - `parse('rgba(255, 0, 0, 0)')` → alpha = 0, other channels preserved

- **Extreme chroma:**
  - `C = 0.4` (max reference range) — `inSrgbGamut` returns false for most hues
  - `C = 0` — all gamut checks return true regardless of L and H
  - `C > 0.4` — functions don't crash, gamut mapping returns a valid color

- **CSS parsing edge cases:**
  - `color(display-p3 1 0 0)` — parses into P3 red (if supported by parser)
  - `oklch(none 0.2 180)` — `none` keyword for lightness (CSS Color 4 spec)
  - `oklch(0.5 0.2 none)` — `none` keyword for hue
  - `rgb(255, 0, 0)` — legacy comma syntax
  - `rgb(255 0 0 / 50%)` — modern slash syntax with percentage alpha
  - `hsl(0deg 100% 50%)` — `deg` unit on hue
  - `#f00` — 3-digit shorthand
  - `#ff000080` — 8-digit hex with alpha
  - Empty string and `null` — should throw or return null, not crash

- **Boundary lightness:**
  - L = 0 (black) — `toRgb` → `(0, 0, 0)` regardless of H and C
  - L = 1 (white) — `toRgb` → `(255, 255, 255)` regardless of H and C
  - L slightly above 0 and below 1 — gamut mapping still works correctly

- **Hue wrapping:**
  - H = 360 normalizes to 0
  - H = -30 normalizes to 330
  - H = 720 normalizes to 0
  - Conversion through HSL/HSV preserves hue wrapping semantics
