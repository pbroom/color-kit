---
'@pbroom/color-kit': minor
---

Add contrast point solvers: find the nearest color that meets a contrast threshold.

- `ensureContrast(color, reference, options)` (root entry) returns the closest color that meets a WCAG ratio or APCA Lc threshold against `reference` by changing OKLCH lightness only. Hue is kept, and chroma is kept wherever the target gamut (`'srgb'` by default) can show it and otherwise reduced only as far as needed. Options: `metric`, `threshold` / `level` / `apcaPreset`, `apcaPolarity`, `apcaRole`, `gamut` and `direction` (`'nearest'`, `'lighter'` or `'darker'`). It throws a `RangeError` when no lightness reaches the threshold; `tryEnsureContrast()` returns `null` instead.
- New plane query `contrastPoint`, available as `sense(plane).contrastPoint()`, `getPlaneContrastPoint()` (`@pbroom/color-kit/plane`), `runPlaneQuery()`, the query cache, tracing and the packed compute ABI. Given a start color or point, a reference color, a contrast target and an optional gamut, it returns the nearest point of the plane (Euclidean distance in normalized plane coordinates) that meets the threshold and is in gamut, with the color there, the achieved contrast and the distance. `status` is `'satisfied'` when the start already passes (returned unchanged), `'adjusted'` when it was moved, and `'unreachable'` (with `point: null`) when nothing in the plane window passes. It works on every plane model.
- New types: `EnsureContrastOptions`, `EnsureContrastDirection`, `ContrastTargetOptions`, `PlaneContrastPointOptions`, `PlaneContrastPointQuery`, `PlaneContrastPointResult` and `PlaneContrastPointStatus`.

Packed results gain a `contrastPoint` descriptor kind. Existing descriptors and buffers are unchanged, so the packed ABI version stays at 2; a decoder from an older build rejects the new kind as unknown.
