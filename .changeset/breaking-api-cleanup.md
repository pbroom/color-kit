---
'color-kit': minor
---

**Breaking:** pre-launch API cleanup.

- **`'display-p3'` only:** `'p3'` is no longer accepted as an interpolation space, plane model, `toCss` format, or `packColors`/`unpackColors` layout; use `'display-p3'` (`'linear-p3'` is unchanged). Unknown interpolation spaces and plane models now throw a `TypeError` instead of silently falling back.
- **Removed aliases:** `PlaneSenseApi` (use `PlaneSense`) and `PLANE_DEFAULT_RANGES` (use `PLANE_MODEL_DEFAULT_RANGES.oklch`).
- **Smaller root entry:** the compute engine (backend, scheduler, telemetry, packed ABI helpers) is exported only from `color-kit/compute`, and the internal marching-squares contour helpers are no longer exported.
- **Explicit contrast-region engine:** contrast regions take `engine: 'hybrid' | 'legacy'` (default `'hybrid'`), and the engine no longer switches silently. The hybrid engine used to hand hard queries to the marching-squares engine. It now returns its best-effort paths and records `trace.summary.degradedReason` (`ContrastHybridFallbackReason` is renamed `ContrastHybridDegradedReason`). It also traces nearly constant-lightness contours without gaps. `ContrastRegionPathOptions` is a union discriminated by `engine`. The legacy-only options (`samplingMode` `'uniform'`/`'adaptive'`, `edgeInterpolation`, `adaptiveBaseSteps`, `adaptiveMaxDepth`) now require `engine: 'legacy'`, and `hybridMaxDepth`/`hybridErrorTolerance` are rejected with it. Mixing them is a type error and throws a `TypeError`, including through plane queries and `ColorAreaContrastRegionOptions`. `samplingMode: 'hybrid'` is removed. `ContrastRegionLayer` explicitly uses the legacy engine, as it effectively did before. Its `samplingMode` prop is `'uniform'` (default) or `'adaptive'`, and its no-op `hybridMaxDepth`/`hybridErrorTolerance` props are removed.
- **JS-only compute scheduler:** the `'webgpu'` backend kind, multi-backend scheduler options, and `circuitBreakers` telemetry are removed; every run reports backend `'js'` with reason `'default-js'`.
- **React renames:** `ColorSlider` `maxPointerRate` is now `maxUpdateHz` (same as `ColorArea`), `Thumb` `shiftStepRatio` is now `largeStepRatio`, and `useMultiColor`'s `removeColor` no longer takes a `source` argument.
