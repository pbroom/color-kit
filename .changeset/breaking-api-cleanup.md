---
'color-kit': minor
---

**Breaking:** pre-launch API cleanup.

- **`'display-p3'` only:** `'p3'` is no longer accepted as an interpolation space, plane model, `toCss` format, or `packColors`/`unpackColors` layout; use `'display-p3'` (`'linear-p3'` is unchanged). Unknown interpolation spaces and plane models now throw a `TypeError` instead of silently falling back.
- **Removed aliases:** `PlaneSenseApi` (use `PlaneSense`) and `PLANE_DEFAULT_RANGES` (use `PLANE_MODEL_DEFAULT_RANGES.oklch`).
- **Smaller root entry:** the compute engine (backend, scheduler, telemetry, packed ABI helpers) is exported only from `color-kit/compute`, and the internal marching-squares contour helpers are no longer exported.
- **No silent contrast-region fallback:** the contrast-region solver used to hand hard queries to the marching-squares engine. It now returns its best-effort paths and records `trace.summary.degradedReason` (`ContrastHybridFallbackReason` is renamed `ContrastHybridDegradedReason`). It also traces nearly constant-lightness contours without gaps. `samplingMode: 'hybrid'` is removed. The marching-squares engine itself is removed in a separate entry.
- **JS-only compute scheduler:** the `'webgpu'` backend kind, multi-backend scheduler options, and `circuitBreakers` telemetry are removed; every run reports backend `'js'` with reason `'default-js'`.
- **React renames:** `ColorSlider` `maxPointerRate` is now `maxUpdateHz` (same as `ColorArea`), `Thumb` `shiftStepRatio` is now `largeStepRatio`, and `useMultiColor`'s `removeColor` no longer takes a `source` argument.
