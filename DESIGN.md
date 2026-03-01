# Color Kit Design Rationale

A searchable reference for design decisions, considerations, and requirements across color-kit. Use this document when you need to recall **why** something works the way it does. It is structured for lookup (headings, search) rather than sequential reading.

**Related documents:** [notes.md](notes.md) (roadmap, milestones), [notes.execution-gap.md](notes.execution-gap.md) (intent-to-implementation status), [notes.color-area.shift.md](notes.color-area.shift.md) (component model discussion), [notes.color-area.baseline.md](notes.color-area.baseline.md) (ColorArea analysis).

---

## 1. Foundations

### Internal representation: OKLCH

Color-kit uses **OKLCH** (D65, CSS reference range) as the single canonical internal format. All stored colors, interpolation, and gamut mapping operate in OKLCH.

> **Why:** OKLCH is perceptually uniform: equal numeric steps produce roughly equal perceived differences. Lightness (L), chroma (C), and hue (H) map to how humans see color, which makes manipulation and UI controls predictable. It has native CSS support (`oklch()`), so output is directly usable. Cylindrical coordinates (L/C/H) are more intuitive for users than cartesian (OKLAB a/b) when adjusting saturation and hue independently.

**Alternatives not chosen:**

- **CIELAB / Lab** — Less perceptually uniform than OKLAB-derived spaces; not the CSS-native choice.
- **HSL** — Not perceptually uniform; same numeric saturation produces very different perceived intensity across hues. Kept as an interop view only.
- **OKLAB (cartesian)** — Same perceptual base as OKLCH, but a/b axes are harder to explain (green–red, blue–yellow). OKLCH chroma and hue match user language (“saturation”, “hue”).

### Dual-state contract: requested vs displayed

The system tracks two color values: **requested** (exact user-selected OKLCH) and **displayed** (gamut-mapped result for rendering). Both sRGB and P3 displayed values are always computed; `activeGamut` selects which one is used for output.

> **Why:** Users may select colors outside the current output gamut. Silently clamping requested values would move thumbs, lose intent, and make undo/redo confusing. By keeping requested untouched and deriving displayed via a deterministic mapping, the UI can show the user’s intent (thumb position, requested readouts) alongside what is actually shown (swatch, CSS), and use fallback indicators to show where the mapped color lands.

**Type definition** (from [packages/react/src/color-state.ts](packages/react/src/color-state.ts)):

```ts
export type GamutTarget = 'srgb' | 'display-p3';
export type ViewModel = 'oklch' | 'oklab' | 'rgb' | 'hex' | 'hsl' | 'hsv';

export interface ColorState {
  requested: Color; // Exact user-selected OKLCH channels
  displayed: {
    srgb: Color; // Requested mapped to sRGB gamut
    p3: Color; // Requested mapped to P3 gamut
  };
  activeGamut: GamutTarget;
  activeView: ViewModel;
  meta: {
    source: 'user' | 'programmatic' | 'derived';
    outOfGamut: { srgb: boolean; p3: boolean };
  };
}
```

**Invariants:**

- `requested` is never silently clamped.
- `displayed.srgb` and `displayed.p3` are deterministic for a given `requested` and mapping algorithm.
- Changing `activeGamut` only changes which displayed value is used for rendering; it does not mutate `requested`.
- Channel persistence holds through degenerate states (e.g. L=0, C=0): stored channel values remain until the user changes them.

### P3-first rendering stance

Display P3 is the **primary** output target; sRGB is the fallback when P3 is not supported or when the consumer explicitly chooses sRGB.

> **Why:** Wide-gamut displays and CSS `color(display-p3 ...)` adoption make P3 the forward-looking default. Consumers who need sRGB can set `activeGamut: 'srgb'`. The fallback chain is deterministic so behavior is reproducible across environments.

### Zero-dependency core

`@color-kit/core` has **no external color library**. All conversion and gamut math is implemented in-house.

> **Why:** Keeps bundle size minimal and allows full control over precision, gamut mapping behavior, and edge cases (e.g. degenerate L/C/H). Tree-shaking stays effective because consumers only pay for what they import. The main alternative, [culori](https://github.com/nicksrandall/culori), is excellent but would delegate gamut mapping and conversion details; color-kit needs those to stay fixed for the requested/displayed contract and for consistent overlay geometry.

### Notes

Looking at the ColorArea component demo, I think I'm arriving at a common abstraction. A lot of this is already in place or close, but the lines of responsibility and composability can be stronger. The architecture can be simpler in a way that highlights the API more clearly, exposing how it works. The API needs to provide ready vector space path data for the different lines, areas, shapes, regions, and slices within 2d and 3d color space. Parameters or color data in, color data out. Let's look at some of the things we need to calculate.

- P3 gamut boundary
- sRGB gamut boundary
- Out-of-gamut region for P3
- Out-of-gamut region for sRGB
- In-gamut region for P3
- In-gamut region for sRGB
- Contrast boundaries (in any given color model or axis combination) for WCAG 3:1, 4.5:1, 7:1
- Contrast regions (in any given color model or axis combination) for WCAG 3:1, 4.5:1, 7:1
- P3 chroma band for the current hue using proportional chroma %
- P3 chroma band for the current hue using closest chroma value
- sRGB chroma band for the current hue using proportional chroma %
- sRGB chroma band for the current hue using closest chroma value
- Eased interpolation between proportional and closest variant chroma bands
- Nearest point within an area relative to a given point in UV/XY space
- Intersection points/lines/regions for overlapping lines/areas, union, intersection, difference, etc.
- Distance between points, lines, areas, regions, etc.
- Translation of points, lines, areas, and regions from one color space to another
- The gradient produced from moving between two or more colors within a given color space
- Linearized gradients from lines curving through 2d or 3d color space
- Eased gradients
- The different gradients produced from drawing a path between two colors in various color spaces
- P3 fallback point for out-of-P3 gamut point
- sRGB fallback point for out-of-sRGB gamut point
- Gradients for model channels (OKLCH, OKLAB, RGB, HSL, HSV, HCT, alpha)
- 2d space gradients:

**OKLCH**

| LL | LC | LH |  
| CH | CC | CH |  
| HH | HC | HH |

**HCT**

| HH | HC | HT |
| CH | CC | CT |
| TH | TC | TT |

**RGB**

| RR | RG | RB |
| GR | GG | GB |
| BR | BG | BB |

**HSL**

| HL | HC | HH |
| CH | CC | CH |
| LH | LC | LL |

**HSV**

| HH | HS | HV |
| SH | SS | SV |
| VH | VS | VV |

We need to be able to calculate each of these points, lines, or shapes concurrently in real time while the user drags input thumbs around quickly. Ideally, these would be vector space calculations with limited/no sampling and rasterization taking place as late as possible so that things remain as efficient, accurate, and precise as possible. We also need a reliable way to calculate splines/bezier curves and such. We don't want to be stuck outputting hundreds or thousands of points per shape or line segment. We want to pass the simplest, most-accurate data for use in drawing SVG paths that are smooth, precise, and perfectly positioned.

With all these color and math concerns, it would be a great experience to have the API be able to serve you whichever part you want and use it as the path on the color area to chart lines, regions, etc. The API has to work as Javascript for maximum compatibility, but Typescript and React should have first-class support via typed API and hook/component implementations.

With the knowledge I have now, it seems smartest to lower how oppinionated the component implementation is to the most simple, minimal primitives possible and provide detailed recipes.

```JSX

<Color>
  <ColorArea>
    <Layer />
    <ColorPlane />
    <Layer />
    <Thumb />
  </ColorArea>
</Color>

```

Questions:

- What should be the API structure pattern?
- Can we get performance wins by building the solvers and calculation engine in rust or zig?

---

## 2. Color Science Considerations

### Gamut mapping strategy: chroma reduction

Out-of-gamut colors are brought into gamut by **reducing chroma** (binary search) while keeping lightness and hue fixed. No lightness compression or hue rotation is used for the default mapping.

> **Why:** Chroma reduction is perceptually stable and deterministic. It aligns with CSS Color Level 4 guidance and preserves the user’s lightness and hue. Reducing lightness instead would darken or brighten the color; hue rotation would change the color family. Both would violate the “requested represents intent” principle when we only need to show a displayable variant.

**Example regression (lightness-based mapping):** If we mapped by reducing lightness, a requested `oklch(0.9 0.25 200)` could become a much darker blue when displayed, and the thumb would still sit at L=0.9 — the UI would lie about what the user selected.

### Epsilon tolerance in gamut checks

Gamut checks (`inSrgbGamut`, `inP3Gamut`) use a small **epsilon** (~0.000075) when comparing linear channel values to the [0, 1] range. Values in `[-epsilon, 1+epsilon]` are treated as in-gamut.

> **Why:** Matrix math in color space conversion produces tiny floating-point errors. An in-gamut color can yield linear values like -0.00003. Without tolerance, those would be incorrectly flagged as out-of-gamut. Gamut checks must use **unclamped** linear values; using the clamped conversion pipeline would hide out-of-gamut colors. See [AGENTS.md](AGENTS.md) learnings on gamut check implementation.

**Passing test (in-gamut with rounding):**

```ts
// In-gamut color may produce linear values just below 0 or above 1
const color = { l: 0.5, c: 0.2, h: 200, alpha: 1 };
expect(inSrgbGamut(color)).toBe(true);
```

**Failing regression (no epsilon):** If the implementation compared raw linear values with `>= 0 && <= 1` and no epsilon, some valid sRGB colors would fail `inSrgbGamut` due to rounding. For example, a color that roundtrips from hex might produce linear values like -0.00002; without epsilon it would be wrongly classified out-of-gamut.

### Hue preservation at degenerate states

Hue is **stored and preserved** even when chroma is 0 or lightness is 0 or 1. Mathematically, hue is undefined at C=0 and L=0/1, but the user model keeps the last user-set hue.

> **Why:** If we cleared hue at C=0 or L=0, moving the chroma or lightness slider back would jump to a different hue. Channel persistence and “handles never jump” require that we retain all channel values until the user changes them. So we treat the stored color as the user’s intent, not a strict mathematical OKLCH triple.

### Conversion pipeline architecture

All conversions use a **single canonical path**: any input format → sRGB → linear sRGB → OKLAB → OKLCH for storage; and OKLCH → OKLAB → linear sRGB → sRGB → target format for output. There are no shortcut conversions between non-sRGB spaces that could drift from this path.

> **Why:** A single pipeline guarantees consistency and makes roundtrip and gamut behavior predictable. Shortcuts (e.g. HSL ↔ OKLCH directly) could introduce subtle differences and make debugging and testing harder.

### Max chroma and gamut boundary geometry

Maximum chroma at a given (L, H) or (H) and gamut boundary paths are computed with **binary search** (or equivalent iterative search) with configurable `tolerance` and `maxIterations`. The sRGB/P3 gamut boundary in OKLCH space is not analytically expressible, so we sample and search.

> **Why:** This gives deterministic, tunable precision. Shared options (`tolerance`, `maxIterations`) keep behavior consistent across `maxChromaAt`, `maxChromaForHue`, `gamutBoundaryPath`, and related APIs. See [packages/core/src/gamut/index.ts](packages/core/src/gamut/index.ts) for defaults (e.g. `DEFAULT_TOLERANCE = 0.0001`, `DEFAULT_MAX_ITERATIONS = 30`).

### HCT considerations

HCT (Material Design 3: Hue, Chroma, Tone) is **deferred**. Core has HCT conversion and helpers (`toHct`, `maxHctChromaForHue`, `maxHctPeakToneForHue`) but the full HCT workflow and token integration are not in v1 scope.

> **Why:** HCT depends on CAM16 and a tone solver. The dependency choice (Material’s implementation vs internal math) and how HCT fits into the OKLCH-first pipeline are still open. v1 focuses on OKLCH, sRGB, and P3; HCT is a later addition once the dependency and API are decided.

---

## 3. Universal UX Principles

### Handles never jump

Thumbs, sliders, and area cursors **stay where the user put them**. They do not snap to “valid” or in-gamut positions when the user is not actively moving that axis.

> **Why:** Physical metaphor and trust. If dragging lightness to 0 reset hue or chroma, or if the thumb snapped from an out-of-gamut point to the boundary, the user would lose their mental model. Channel persistence and degenerate-state handling (L=0, C=0) exist so that restoring L or C returns the same hue and chroma.

### Intent is never silently clamped

Out-of-gamut **intent is allowed and visible**. The UI may show divergence (e.g. fallback markers, different readouts for requested vs displayed) but must not silently change the user’s requested values.

> **Why:** Silent clamping would break undo, copy/paste, and user trust. The design uses fallback indicators and optional dual readouts so the user sees both what they asked for and what will be displayed.

### Visual honesty in gradients

Gradients (sliders, areas, hue strips) are generated from **model-specific math**, not from HSL ramps reused for OKLCH.

> **Why:** OKLCH hue 0° is not the same as HSL hue 0°. OKLCH hue gradients require sampling the hue circle and, for each hue, finding the maximum in-gamut chroma (and optionally the lightness at that chroma) to form gradient stops. Reusing HSL stops would misrepresent OKLCH and break perceptual uniformity.

### Preview vs commit interaction model

During pointer drag, **pointer move** updates a high-frequency preview (requested color); **pointer up** (or Enter/blur where applicable) commits. Heavy work (e.g. gamut boundary, contrast regions) is not recomputed on every pointer move.

> **Why:** Keeps interaction responsive and avoids redundant work. Commit-on-release also gives clear undo semantics and allows coalescing (e.g. one commit per drag). See performance section for invalidation boundaries.

---

## 4. Component Architecture (React)

### Headless by design

React primitives are **unstyled** and use **data attributes** (`data-color-area`, `data-color-slider-thumb`, etc.) for styling and testing. No built-in theme or visual design is imposed.

> **Why:** Consumers bring their own design system. Headless components own semantics and behavior; styling is consumer-owned. This also fits the shadcn distribution model (copy components into the app and style them).

### Color context provider model

The `**<Color>` component wraps the color UI and provides a single source of truth for color state (requested, displayed, activeGamut, activeView). Hooks like `useColor()` and components like `ColorArea` consume this context when used without explicit `color`/`onChange` props.

> **Why:** Centralizes state so all controls (area, sliders, inputs, swatches) stay in sync. Shared gamut and view settings apply consistently. Multi-color (`useMultiColor`) extends this idea for named collections (e.g. palette entries, gradient stops).

### Component-specific considerations

Each primitive has a focused role. Summary:

| Component               | Role                                                 | Key decisions                                                                             |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **ColorArea**           | 2D plane: geometry, coordinate mapping, interaction. | UI plane (0–1), not constrained to gamut; thumb at requested; WebGL for gradient. See §5. |
| **ColorSlider**         | Single-axis slider for any channel (L, C, H, alpha). | `role="slider"`, arrow keys + shift-step; gradient from model-specific math.              |
| **ColorDial / HueDial** | Angular input for hue (or other channel).            | Same requested/displayed contract; angle ↔ value mapping.                                 |
| **ColorWheel**          | 2D hue/chroma wheel.                                 | Polar coordinates; one thumb; same state contract.                                        |
| **ColorInput**          | Numeric channel input (OKLCH, RGB, HSL).             | Parsing/formatting per model; updates requested.                                          |
| **ColorStringInput**    | Free-form string (hex, rgb(), oklch(), etc.).        | Parse on blur/Enter; validate and set requested.                                          |
| **ColorDisplay**        | Visual swatch/preview.                               | Uses **displayed** color for background (P3-first with fallback).                         |
| **Swatch**              | Single color chip; optional selection.               | Can show requested or displayed; click sets requested.                                    |
| **SwatchGroup**         | Collection of swatches with selection.               | Listbox/option semantics; shared context.                                                 |
| **ContrastBadge**       | WCAG contrast ratio vs a reference.                  | Uses displayed color; shows ratio and AA/AAA pass.                                        |

**Accessibility:** All interactive components are keyboard-focusable, use appropriate ARIA roles and labels, and expose human-readable `aria-valuetext` where applicable. Non-interactive overlays are `aria-hidden` and `pointer-events: none`. See §8.

**Performance:** Heavy work (gamut boundary, contrast regions, chroma bands) is cached and invalidated only when relevant inputs change (e.g. hue, size, gamut), not on every thumb move.

---

## 5. ColorArea Deep Dive

### Composable scene model

ColorArea is built from **primitives** (ColorPlane, Layer, Line, Point, Thumb, Background) rather than one monolithic component. The host provides the bounded 2D space, coordinate systems (UV ↔ color), and interaction; children provide rendering and overlays.

> **Why:** Composability allows consumers to choose which layers (gamut boundary, contrast regions, fallback points, chroma band) to show and in what order. It keeps responsibilities separated: ColorArea owns space and interaction; ColorPlane owns raster; Layer/Line/Point own overlays; Thumb owns input. See [notes.color-area.shift.md](notes.color-area.shift.md) for the full contract discussion.

**Contract summary:**

- **ColorArea** — Bounding rect, DPR, UV ↔ color mapping, pointer/keyboard. Does not do color math or render pixels.
- **ColorPlane** — Rasterized 2D color surface. Redraws when plane config/gamut/size change, not on thumb move.
- **Layer** — Stacking and renderer type (DOM/SVG/canvas). Structural only.
- **Line** — Vector path in area coordinates (e.g. gamut boundary, contrast contours).
- **Point** — Marker at a UV coordinate (e.g. fallback indicators).
- **Thumb** — Single draggable/focusable control; updates intent; commits on pointer up / Enter.

### UI plane vs mathematical plane

The 2D area is a **UI plane**: normalized (0–1) X and Y map to two color channels (e.g. X=chroma, Y=lightness). The user can place the thumb **anywhere** in this plane, including outside the gamut boundary.

> **Why:** If the area were constrained to in-gamut positions only, the thumb would jump or be clamped when the user clicked outside the boundary. Allowing out-of-gamut positions keeps the thumb under user control; fallback indicators and displayed color show where the mapped color lands. This matches the “intent is never silently clamped” principle.

### WebGL rendering

The main gradient surface (ColorPlane / ColorAreaGradient) is rendered with **WebGL** (GPU fragment shader), not Canvas 2D pixel loops.

> **Why:** At pointer-move frequency, canvas 2D with per-pixel sampling cannot keep up on typical 2D sizes. WebGL generates pixels from uniforms and UV in the shader, avoiding CPU-side color conversion per pixel. See [notes.color-area.baseline.md](notes.color-area.baseline.md) and agent learnings on keeping WebGL paths shader-native.

### Overlay invalidation boundaries

Overlays have **different recomputation triggers** than the main plane:

- **Gamut boundary / chroma band** — Depend on hue, gamut target, and optionally axis config. Do not depend on current requested color (except for chroma band anchor).
- **Contrast region** — Depends on reference color, threshold(s), and plane geometry. Can be offloaded to a worker.
- **Fallback points** — Depend on requested color and gamut; update when requested or activeGamut changes.

> **Why:** So that thumb movement does not trigger expensive path or contour recomputation. Only the thumb position and fallback markers need to update at pointer frequency; the rest is cached until its inputs change.

### Layer roles: gamut boundary, contrast region, chroma band, fallback points

- **GamutBoundaryLayer** — Draws the sRGB and/or P3 boundary in area coordinates. Uses `gamutBoundaryPath` from core. Invalidated by hue, gamut, size.
- **ContrastRegionLayer** — Draws WCAG contrast contours (e.g. 3:1, 4.5:1, 7:1) for a reference color. Uses `contrastRegionPath`/`contrastRegionPaths`. Invalidated by reference color, thresholds, size.
- **ChromaBandLayer** — Draws a tonal strip (clamped or proportional chroma) for the current hue. Uses `chromaBand`. Invalidated by hue, chroma mode, gamut.
- **FallbackPointsLayer** — Shows markers for where requested maps to P3 and sRGB when out of gamut. Invalidated by requested color and activeGamut.

---

## 6. Developer Experience

### API surface: fewer, stable, composable

The public API favors **fewer, stable entry points** and **composition** over large configuration surfaces. New behavior is added via composition (e.g. adding a Layer or Line) or optional props rather than new top-level APIs.

> **Why:** Reduces API churn and keeps the mental model simple. Escape hatches (e.g. custom sampler, custom conversions) are designed in where needed so advanced users don’t have to fork.

### Dual-track distribution: npm + shadcn

Packages are published to **npm** (`@color-kit/core`, `@color-kit/react`). React components are also available via a **shadcn-style registry** so consumers can copy source into their app.

> **Why:** Library consumers get versioned dependencies and tree-shaking; copy-paste consumers get full control over the code and styling. Both tracks are first-class.

### Multi-color state

`**useMultiColor` manages named color collections (e.g. `base`, `accent`, palette entries) with shared `activeGamut` and `activeView`. Operations (setChannel, setRequested, etc.) take an entry key.

> **Why:** Design tools need multiple colors (foreground/background, palette, gradient stops) with coherent settings. A single `useColor` per context would duplicate settings and make shared overlays (e.g. contrast against “background”) harder.

### Legend State for performance

React state for high-frequency updates (e.g. during drag) uses **Legend State** (or similar) for fine-grained reactivity so only dependent subscribers re-run, not the whole tree.

> **Why:** Reduces re-renders during pointer move. The contract is that **canonical color state** (requested, displayed) still lives in one place (Color context); Legend State is used for derived values and ephemeral preview state, not as a second source of truth.

### Functional state updates

`useMultiColor` (and any batch-update path) uses **functional updates** when computing the next state from the previous (e.g. `setState(prev => ({ ...prev, ... }))`).

> **Why:** Batched React updates can apply multiple setState calls in one tick; closure-based updates can see stale `prev`, so sequential edits in one event can be dropped. Functional updates always see the latest committed state. See [AGENTS.md](AGENTS.md) learnings.

---

## 7. Performance

### Performance budgets as release gates

Targets are defined as **release gates** (see [notes.md](notes.md)):

- Slider drag: p95 update ≤ 8 ms.
- Area drag: p95 update ≤ 10 ms.
- No long tasks > 50 ms during continuous drag.
- Core conversion throughput ≥ 100k colors/sec (Node benchmark).
- Gamut boundary stable (no oscillation near boundary).

Hardware baselines: Apple Silicon (e.g. M1/M2 MacBook Air), mid-tier Intel i5-class Windows laptop.

> **Why:** So that interaction stays smooth on typical design-tool hardware. Budgets are enforced in CI once baseline variance is characterized; initially they may be non-blocking for calibration.

### Interaction-frequency update model

Updates at **pointer-move frequency** (e.g. thumb position, requested color) must not trigger heavy recomputation (gamut boundary, contrast regions, full plane redraw). Invalidation is explicit: only inputs that affect a result trigger recompute.

> **Why:** Keeps the main thread responsive. Caching and invalidation boundaries (see §5) ensure that expensive work runs only when its inputs change. Agent learnings: cache geometry outside the pointer hot path; use RAF and coalesced events to tame pointer pressure.

### Future performance paths

**Workers** and **WASM** are deferred until profiling shows necessity. Contrast region generation is a good candidate for a worker; bulk conversion or histogram could justify WASM later.

> **Why:** Complexity and maintenance cost. Current pure-TypeScript path is sufficient for v1; optimization is driven by measurement, not speculation.

---

## 8. Accessibility

### Single-slider pattern for ColorArea (v1)

ColorArea uses **one** `role="slider"` with **rich `aria-valuetext`** (e.g. both axes read together) rather than a composite widget (e.g. two sliders or a gridcell pattern).

> **Why:** Simpler for screen readers and consistent with common 2D slider patterns. Revisit composite widget only if usability testing shows material gaps.

### Keyboard navigation model

Sliders and area use **arrow keys** for increment/decrement; **Shift + arrow** for larger steps. ColorArea maps arrows to the two axes (e.g. Left/Right = x-channel, Up/Down = y-channel). Values clamp to channel ranges.

> **Why:** Matches platform slider expectations and extends naturally to 2D. Shift-step gives power users finer control.

### Focus visibility on dynamic backgrounds

Focus indicators must remain **visible** on the color surface (gradient, swatch). Thumbs and controls sit on varying colors, so outline or ring must contrast against both light and dark regions.

> **Why:** WCAG 2.4.7 (focus visible). Dynamic backgrounds make a single outline color insufficient; the contract is that focus style is visible against the full range of the control’s background.

### Non-color-only constraint cues

Gamut and contrast states (out-of-gamut, failing contrast) must not be communicated **only** by color. Use icons, labels, or text (e.g. “Out of sRGB gamut”, contrast ratio readout) in addition to any color coding.

> **Why:** Accessibility for low vision and color blindness. See [notes.md](notes.md) Accessibility Contract.

---

## 9. Testing Philosophy

### Test examples: passing vs failing

Key behaviors are covered by tests that encode both **expected passing** and **regression** cases.

**Gamut check with epsilon:** In-gamut colors must pass even when linear channel values are slightly outside [0, 1] due to rounding:

```ts
it('treats near-boundary in-gamut as in-gamut', () => {
  const c = { l: 0.5, c: 0.2, h: 200, alpha: 1 };
  expect(inSrgbGamut(c)).toBe(true);
});
```

**Channel persistence:** Changing one channel must not alter others:

```ts
it('preserves hue and chroma when setting L to 0', () => {
  const state = createColorState({ l: 0.5, c: 0.2, h: 150, alpha: 1 });
  const next = createColorState({ ...state.requested, l: 0 });
  expect(next.requested.h).toBe(150);
  expect(next.requested.c).toBe(0.2);
});
```

**Roundtrip fidelity:** Conversion roundtrips (e.g. OKLCH → RGB → OKLCH) must stay within tolerance; see [packages/core/**tests**/roundtrip.test.ts](packages/core/__tests__/roundtrip.test.ts).

### Test gates per milestone

Test gates are defined in [notes.md](notes.md) (Test Gates by Milestone). Each milestone (M1–M6) has associated test files that must pass before the milestone is considered done. Release gate: `pnpm build`, `pnpm test`, `pnpm format:check`, and (when implemented) a11y suite.

> **Why:** Ensures that delivered features are guarded by regression tests and that the build stays green before merging.

---

## 10. Alternatives Considered

| Alternative                                | Decision | Reason                                                                                                                                 |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **culori for core math**                   | Rejected | Need full control over gamut mapping and precision; zero-dependency core keeps bundle small and behavior predictable.                  |
| **CIELAB as canonical**                    | Rejected | OKLCH/OKLAB are more perceptually uniform and OKLCH is CSS-native.                                                                     |
| **Lightness-based gamut mapping**          | Rejected | Would change perceived brightness; chroma reduction preserves lightness and hue.                                                       |
| **Monolithic ColorPicker component**       | Rejected | Composability (Area, Slider, Input, Swatch) supports diverse UIs and keeps each primitive testable and reusable.                       |
| **CSS Houdini for gradients**              | Not used | GPU path is WebGL for broad support and full control; Houdini could be explored later for specific effects.                            |
| **Virtual DOM / scene graph for overlays** | Rejected | Overlays are explicit Layer/Line/Point children; no separate virtual scene. Simpler mental model and alignment with React composition. |

---

_This document is the canonical reference for design rationale. For roadmap and execution status, see [notes.md](notes.md) and [notes.execution-gap.md](notes.execution-gap.md)._
