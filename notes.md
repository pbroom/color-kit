# Color Kit — Design & Planning Notes v1.3

## Product Direction

Color Kit is built first for **web-first design tools teams**. The goal is a future-forward color platform that preserves user intent at high precision while staying practical for real product interfaces.

## Product Shape

Color Kit is explicitly dual-track, with equal importance:

- **Engine track**: standalone precision color logic usable across environments (React, Vue, Angular, CLI/TUI, backend scripts).
- **UI track**: polished React primitives that deliver best-in-class developer and end-user experience out of the box.

### Package Identity

- Current engine package: `@color-kit/core` (public product language can refer to this as **Color Kit Core/Engine**).
- Current React UI package: `@color-kit/react` (optional future naming alias: **Color Kit UI** / `@color-kit/ui-react`).

---

## Direction Lock (2026-02-10)

1. Primary user is web-first design tools teams.
2. Engine and UI are both first-class product tracks.
3. Non-negotiables: API simplicity, performance, and intent preservation.
4. Go deep on CSS-native/supported models; avoid broad low-value model expansion.
5. Gamut fallback default is chroma reduction for v1.
6. Alternative fallback strategies are post-v1 and plugin-oriented.
7. Rendering stance is P3-first with deterministic fallback behavior.
8. API strategy is fewer, stable, and composable APIs.
9. M3+ feature priority is: multi-color state, geometry APIs, contrast regions, chroma bands, HCT.
10. Compatibility target is future-forward, not legacy-first.
11. Docs strategy is implementation-first.
12. Experiments are gated by tests; releases are gated by tests + a11y.

---

## V1 Scope

### In scope (must ship)

- Canonical OKLCH state with explicit `requested` vs `displayed` values
- Deterministic sRGB/P3 fallback behavior for display paths
- Honest control semantics in `ColorArea`, `ColorSlider`, and wrappers
- Stable core APIs for max-chroma and gamut boundary geometry
- Multi-color state management for common design-tool workflows
- A11y-complete contracts for existing React primitives
- Performance guardrails and regression checks in CI

### Out of scope (v1.3 planning horizon)

- HCT conversion and token workflow integration
- CMYK simulation and print-focused behavior
- Worker/WASM migration unless profiling proves necessity
- 3D viewer, histogram, bezier editor, eyedropper UI

---

## Core Ideals

1. **Perceptual truth**: OKLCH/OKLAB are canonical.
2. **Intent preservation**: Requested channel values never mutate due to display constraints.
3. **Visual honesty**: Controls represent requested values; visual output reflects displayed values.
4. **Speed with budgets**: Interaction and conversion performance are measured and gated.
5. **Composable simplicity**: API surface stays small, stable, and predictable.
6. **Headless by design**: Styling is consumer-owned; semantics and behavior are library-owned.

---

## Model and Layer Status

### Supported models

| Model           | Core math | React UI behavior | Strategy                       |
| --------------- | --------- | ----------------- | ------------------------------ |
| OKLCH           | ✅        | ⚠️ Partial        | Canonical and central          |
| OKLAB           | ✅        | ⚠️ Partial        | Internal/perceptual operations |
| sRGB / Hex      | ✅        | ✅                | Baseline output compatibility  |
| HSL             | ✅        | ✅                | Interop model                  |
| HSV/HSB         | ✅        | ✅                | Interop model                  |
| Display P3      | ✅        | ⚠️ Partial        | **P3-first output target**     |
| HCT             | ❌        | ❌                | Later                          |
| CMYK simulation | ❌        | ❌                | Optional/later                 |

### Repo track status

| Track            | Status              | Notes                                                    |
| ---------------- | ------------------- | -------------------------------------------------------- |
| `packages/core`  | Strong base         | Conversion/contrast/gamut/manipulation present           |
| `packages/react` | Functional baseline | Needs dual-state semantics and P3-first display behavior |
| `apps/docs`      | Good baseline       | Needs implementation-first guidance for new state model  |

---

## Canonical State Contract (Must Define First)

The dual-value model is the keystone for all remaining work.

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
    outOfGamut: {
      srgb: boolean;
      p3: boolean;
    };
  };
}
```

### State invariants

- `requested` is never silently clamped.
- `displayed.*` is deterministic for a given `requested` and fallback algorithm.
- Switching `activeGamut` changes rendered output only; never mutates `requested`.
- Channel persistence remains stable through degenerate states (`l=0/1`, `c=0`).

### Event contract

```ts
interface ColorUpdateEvent {
  next: ColorState;
  changedChannel?: 'l' | 'c' | 'h' | 'alpha';
  interaction: 'pointer' | 'keyboard' | 'text-input' | 'programmatic';
}
```

---

## Rendering and Interaction Semantics

### Requested vs displayed

- Thumb/handle positions always represent `requested`.
- Visual fill/inkwell/swatch output uses `displayed[activeGamut]`.
- When values diverge, UI may expose mapped indicators and text values.

### Hue and area gradients

- Gradients must be generated from model-specific math.
- No reuse of HSL ramps for OKLCH controls.
- 2D axis math, labels, and coordinates must remain mathematically consistent.

### Accessibility semantics (v1 choice)

- `ColorSlider` remains single-axis `role="slider"`.
- `ColorArea` uses the single-slider pattern for v1 (`role="slider"` + rich `aria-valuetext`).
- Revisit composite widget pattern only if usability testing reveals material gaps.

---

## API Roadmap (Execution-Oriented)

| Item                                               | Priority | Depends on                 | Definition of Done                              |
| -------------------------------------------------- | -------- | -------------------------- | ----------------------------------------------- |
| Dual-state `useColor` contract                     | P0       | none                       | `requested`/`displayed` available and tested    |
| Gamut-aware setters (`setRequested`, `setChannel`) | P0       | dual-state                 | Channel edits preserve untouched channel state  |
| Multi-color state manager                          | P0       | dual-state                 | Named color collections with shared config      |
| Max chroma lookup (`maxChromaAt`)                  | P1       | none                       | Stable API + tolerance-tested sampling          |
| Gamut boundary path API                            | P1       | max-chroma lookup          | Deterministic point arrays for sRGB/P3 overlays |
| Contrast region path API                           | P2       | dual-state + boundary APIs | AA/AAA contours generated consistently          |
| Chroma band generation                             | P2       | max-chroma lookup          | `clamped` and `proportional` modes              |
| HCT conversion                                     | P3       | dependency decision        | Conversion API + validation vectors             |
| Delta E utilities                                  | P3       | none                       | `deltaEok`, optional `deltaE2000`               |

---

## Milestone Plan

### Now (M1-M2)

1. **M1: Dual-state foundation**
   - Implement canonical `ColorState` in `packages/react`.
   - Add deterministic adapters around existing `toSrgbGamut`/`toP3Gamut`.
   - Publish migration notes for current `useColor` consumers.

2. **M2: Honest controls + P3-first display semantics**
   - Update `ColorArea`, `ColorSlider`, `HueSlider`, `AlphaSlider`, `ColorDisplay`, and `Swatch` to consume `requested` + `displayed`.
   - Enforce no thumb teleporting/clamping behavior.
   - Ensure display pathways prefer P3 output with deterministic fallback.

### Next (M3-M4)

3. **M3: Multi-color state management**
   - Add first-class multi-color APIs for palette entries and gradient stops.
   - Ensure shared settings (gamut, view model) apply coherently.

4. **M4: Geometry APIs**
   - Ship `maxChromaAt` and gamut boundary path generation in `packages/core`.
   - Expose stable overlay data contracts for React components.

### Later (M5+)

5. **M5: Contrast regions**
   - Add AA/AAA region path generation and integration points.
6. **M6: Chroma bands**
   - Add tonal strip generation in `clamped` and `proportional` modes.
7. **M7+: Optional model expansion**
   - HCT and optional CMYK simulation.

---

## Performance Budgets

These are release gates, not aspirations.

### Baseline hardware targets

- Apple Silicon baseline: MacBook Air M1/M2 class.
- Windows baseline: mid-tier Intel i5 class laptop.

### Budgets

| Scenario                     | Budget                                      | Measure                                        |
| ---------------------------- | ------------------------------------------- | ---------------------------------------------- |
| Slider drag (single channel) | p95 update <= 8ms                           | React interaction benchmark in browser harness |
| Area drag (2D control)       | p95 update <= 10ms                          | Browser interaction benchmark and trace        |
| Main thread stability        | No long tasks > 50ms during continuous drag | Browser Performance timeline checks            |
| Core conversion throughput   | >= 100k color conversions/sec               | Node benchmark in CI                           |
| Gamut boundary stability     | No oscillation/jitter near boundary         | Deterministic property tests                   |

### Rollout

- Perf checks start as non-blocking for initial calibration.
- Perf checks become blocking once baseline variance is characterized.

---

## Accessibility Contract

- Full keyboard operation for every interactive primitive.
- Accurate ARIA values and readable `aria-valuetext` by channel/model.
- Clear non-color-only cues for constrained/out-of-gamut states.
- Focus indicators visible on dynamic backgrounds.
- Automated axe checks plus manual screen-reader sanity checks for complex controls.

---

## Test Gates by Milestone

### Existing baseline

- `packages/core/__tests__/conversion.test.ts`
- `packages/core/__tests__/gamut.test.ts`
- `packages/core/__tests__/contrast.test.ts`
- `packages/react/__tests__/api.test.ts`
- `packages/react/__tests__/color-input.test.tsx`
- `packages/react/__tests__/swatch-group.test.tsx`

### M1 gate

- Add `packages/react/__tests__/requested-displayed.test.tsx`
- Add `packages/core/__tests__/roundtrip.test.ts`
- Add `packages/core/__tests__/persistence.test.ts`

### M2 gate

- Add `packages/react/__tests__/color-area.test.tsx`
- Add `packages/react/__tests__/color-slider.test.tsx`
- Add `packages/react/__tests__/wrapper-sliders.test.tsx`
- Add `packages/react/__tests__/color-display.test.tsx`
- Add `packages/react/__tests__/swatch.test.tsx`

### M3 gate

- Add `packages/react/__tests__/multi-color-state.test.tsx`

### M4 gate

- Add `packages/core/__tests__/gamut-boundary.test.ts`
- Add `packages/core/__tests__/max-chroma.test.ts`

### M5 gate

- Add `packages/core/__tests__/contrast-regions.test.ts`

### M6 gate

- Add `packages/core/__tests__/chroma-band.test.ts`

### Release gate

- `pnpm build`
- `pnpm test`
- `pnpm format:check`
- a11y suite passing in CI

---

## CI and Release Policy

- Experiments may ship behind flags when test gates pass.
- Stable releases require test gates and a11y gates.
- Keep CI strict on correctness; tighten performance gates incrementally after calibration.

---

## Documentation Strategy

Implementation-first documentation:

- Lead with concrete API usage and integration examples.
- Keep color-science explanation concise and tied to practical outcomes.
- Prioritize migration guides and “how to build” paths over theory-heavy narratives.

---

## Exploration Backlog (Not in Active Delivery)

- `Gradient` and `GradientStop`
- `Dial`
- `Eyedropper`
- `Histogram`
- `3DColorSpaceViewer`
- `BezierCurvesEditor`

These proceed only after current release gates are consistently met.

---

## Open Decisions

1. Whether to publish optional package aliases (`@color-kit/engine`, `@color-kit/ui-react`) or keep canonical names only.
2. HCT dependency strategy (internal math vs third-party implementation).

---

## Version Notes

- **v1.3**: Locks strategic direction from product decisions; sets web-first design-tools focus, dual-track product shape, P3-first rendering stance, stable API-first roadmap, reordered milestone priorities, and explicit release/performance gates.
