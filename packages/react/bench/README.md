# Color Plane Benchmarks

This directory contains the committed benchmark gate used to select the default renderer of `useColorPlaneRenderer`, plus an interaction budget for plane drags.

## Files

- `color-plane-renderer-bench.mjs`: Repeatable renderer benchmark harness.
- `plane-interaction-bench.mjs`: Pointer-interaction budget harness for plane drag scenarios (a color update per frame, with and without gamut-boundary and contrast-region overlays).
- `results.color-plane.json`, `results.plane-interaction.json`: Latest captured run output.

## Methodology

- Compare two prototype paths:
  - `cpu`: CPU pixel raster path.
  - `gpuPrototype`: shader-based path with CPU fallback safety checks.
- Profiles:
  - `desktop`: `512x512`, 4 iterations.
  - `mobile`: `256x256`, 6 iterations.
- Metrics captured per profile:
  - Median frame time (`medianMs`)
  - p95 frame time (`p95Ms`)
  - Median FPS (`medianFps`)
- Targets:
  - Desktop: `medianFps >= 90` and `p95Ms <= 11`
  - Mobile: `medianFps >= 55` and `p95Ms <= 18`

## Result

Current baseline selected renderer: `gpu` (what `renderer: 'auto'` resolves to).

- Benchmarks are directional only and should be paired with interaction traces (`pnpm --filter @color-kit/docs profile:plane-picker`).
- `useColorPlaneRenderer` keeps the CPU fallback when GPU setup fails or the WebGL context is lost at runtime.

## Re-run

```bash
node packages/react/bench/color-plane-renderer-bench.mjs > packages/react/bench/results.color-plane.json
node packages/react/bench/plane-interaction-bench.mjs > packages/react/bench/results.plane-interaction.json
```
