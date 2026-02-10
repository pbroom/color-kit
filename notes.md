# Color Kit — Design & Planning Notes v1.2

## Product Direction

Build a high-fidelity, high-performance color toolkit that preserves user intent across models and gamuts, while keeping interaction semantics honest and accessible.

## V1 Scope

### In scope (must ship)

- Canonical OKLCH state with explicit requested vs displayed values
- Deterministic sRGB/P3 fallback behavior for display paths
- Honest control semantics in `ColorArea`, `ColorSlider`, and wrappers
- Stable core geometry APIs for max-chroma and gamut boundaries
- A11y-complete keyboard and ARIA contracts for all existing React primitives
- Performance guardrails and regression checks in CI

### Out of scope (v1.2 planning horizon)

- HCT conversion and Material token workflows
- CMYK simulation and print-oriented behavior
- 3D viewer, histogram, bezier editor, and eyedropper UI
- Worker/WASM migration unless profiling proves current path insufficient

---

## Core Ideals

1. **Perceptual truth**: OKLCH/OKLAB are canonical. Other models are projections.
2. **Intent preservation**: Requested channel values never mutate due to gamut/display constraints.
3. **Visual honesty**: Controls show requested coordinates; UI separately communicates mapped display output.
4. **Speed with budgets**: Performance is tracked against explicit interaction budgets.
5. **Accessible by default**: Keyboard, ARIA, and screen reader behavior are required, not optional.
6. **Headless composability**: Components remain unstyled and data-attribute-driven.

---

## Model and Layer Status

### Supported models

| Model           | Core math | React UI behavior | Notes                                                                 |
| --------------- | --------- | ----------------- | --------------------------------------------------------------------- |
| OKLCH           | ✅        | ⚠️ Partial        | Canonical in core; React still uses single-color state model          |
| OKLAB           | ✅        | ⚠️ Partial        | Conversion complete; no dedicated UI semantics yet                    |
| sRGB / Hex      | ✅        | ✅                | Primary output path in display/swatches                               |
| HSL             | ✅        | ✅                | Parsing/conversion available                                          |
| HSV/HSB         | ✅        | ✅                | Parsing/conversion available                                          |
| Display P3      | ✅        | ⚠️ Partial        | Conversion/gamut checks in core; UI pathways still mostly sRGB-shaped |
| HCT             | ❌        | ❌                | Planned                                                               |
| CMYK simulation | ❌        | ❌                | Planned/optional                                                      |

### Repo track status

| Track            | Status              | Notes                                                                   |
| ---------------- | ------------------- | ----------------------------------------------------------------------- |
| `packages/core`  | Strong base         | Conversion/contrast/gamut/manipulation present                          |
| `packages/react` | Functional baseline | Core controls exist, but no requested/displayed dual-state contract yet |
| `apps/docs`      | Good baseline       | API demos/docs exist; needs semantic docs for requested/displayed model |

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
- `displayed.*` is deterministic for a given `requested` + algorithm.
- Switching `activeGamut` changes rendered/displayed output only; never mutates `requested`.
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
- When values diverge, UI can expose explicit indicators for mapped location/value.

### Hue and area gradients

- Gradients must be generated from model-specific math.
- No reuse of HSL ramps for OKLCH controls.
- 2D axis math, labels, and thumb coordinates must remain mathematically consistent.

### Accessibility semantics

- Keep `ColorSlider` as single-axis `role="slider"`.
- For `ColorArea`, define one target and enforce it consistently:
  - Option A: single composite `role="slider"` with rich `aria-valuetext`
  - Option B: fully composite widget pattern with internal focus management
- Choose one approach for v1 and encode in tests.

---

## API Roadmap (Execution-Oriented)

| Item                                               | Priority | Depends on                      | Definition of Done                                         |
| -------------------------------------------------- | -------- | ------------------------------- | ---------------------------------------------------------- |
| Dual-state `useColor` contract                     | P0       | none                            | `requested`/`displayed` available and tested               |
| Gamut-aware setters (`setRequested`, `setChannel`) | P0       | dual-state                      | User channel edits preserve untouched channels             |
| Max chroma lookup (`maxChromaAt`)                  | P0       | none                            | Stable API + tolerance-tested across hue/lightness samples |
| Gamut boundary path API                            | P0       | max-chroma lookup               | Returns deterministic point arrays for sRGB/P3 overlays    |
| Requested vs displayed UI indicators               | P1       | dual-state + boundary API       | `ColorArea`/`ColorSlider` can render divergence hints      |
| Contrast region path API                           | P1       | dual-state                      | AA/AAA region generation with deterministic contours       |
| Multi-color state manager                          | P2       | dual-state                      | Named color collections with shared config                 |
| Chroma band generation                             | P2       | max-chroma lookup               | `clamped` and `proportional` modes with tests              |
| HCT conversion                                     | P3       | decision on dependency strategy | Conversion API + validation vectors                        |
| Delta E utilities                                  | P3       | none                            | `deltaEok`, optional `deltaE2000` exposed in core          |

---

## Milestone Plan

### Now (M1-M2)

1. **M1: Dual-state foundation**
   - Implement canonical `ColorState` in `packages/react`.
   - Add deterministic mapping adapters around existing `toSrgbGamut`/`toP3Gamut`.
   - Publish migration notes for current `useColor` consumers.

2. **M2: Honest controls**
   - Update `ColorArea`, `ColorSlider`, `HueSlider`, `AlphaSlider`, `ColorDisplay`, and `Swatch` to consume `requested` + `displayed` semantics.
   - Ensure no thumb teleporting/clamping behavior.

### Next (M3-M4)

3. **M3: Geometry APIs**
   - Ship `maxChromaAt` and gamut boundary path generation in `packages/core`.
   - Expose stable overlay data contracts for React components.

4. **M4: A11y and performance hardening**
   - Lock final ARIA pattern for `ColorArea`.
   - Add regression suites and CI budgets.

### Later (M5+)

5. **M5: Advanced analysis + multi-color**
   - Contrast regions, multi-color manager, chroma band generation.
6. **M6+: Optional model expansion**
   - HCT, delta E, optional CMYK simulation.

---

## Performance Budgets

These are release gates, not aspirations.

| Scenario                     | Budget                                                            | Measure                                                                              |
| ---------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Slider drag (single channel) | p95 update <= 8ms                                                 | React interaction benchmark in jsdom/browser harness                                 |
| Area drag (2D control)       | No dropped frame bursts over 250ms drag window on baseline laptop | Browser perf trace in docs demo                                                      |
| Core conversion throughput   | >= 100k color conversions/sec in Node baseline benchmark          | Scripted benchmark in CI (non-blocking first, blocking after baseline stabilization) |
| Gamut mapping stability      | No oscillation/jitter at boundary under repeated updates          | Deterministic property tests                                                         |

---

## Accessibility Contract

- Full keyboard operation for every interactive primitive.
- Accurate ARIA values and readable `aria-valuetext` by channel/model.
- Clear non-color-only cues for constrained/out-of-gamut states.
- Focus indicators visible on dynamic backgrounds.
- Automated axe checks plus manual screen reader sanity checks for complex controls.

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

- Add `packages/core/__tests__/gamut-boundary.test.ts`
- Add `packages/core/__tests__/max-chroma.test.ts`

### M4 gate

- Add `packages/react/__tests__/a11y.test.tsx`
- Add perf benchmark script(s) referenced by CI workflow

---

## CI Alignment

- Keep `pnpm build`, `pnpm test`, `pnpm format:check` as core CI checks.
- Add milestone-gated suites incrementally so CI remains trustworthy while scope grows.
- Promote perf checks from informational to blocking only after baseline calibration.

---

## Exploration Backlog (Not in Active Delivery)

- `Gradient` and `GradientStop`
- `Dial`
- `Eyedropper`
- `Histogram`
- `3DColorSpaceViewer`
- `BezierCurvesEditor`

These can proceed only after M4 is complete or as explicitly isolated spikes.

---

## Open Decisions

1. Final fallback projection algorithm policy beyond chroma-reduction (if expanded in future).
2. Chosen `ColorArea` ARIA pattern (single slider vs composite widget).
3. HCT dependency strategy (internal math vs third-party implementation).

---

## Version Notes

- **v1.2**: Introduces explicit V1 scope, state contract, milestone execution plan, measurable performance budgets, layered status tracking, and test gates.
