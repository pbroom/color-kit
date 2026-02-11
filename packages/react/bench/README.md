# ColorPlane Renderer Benchmark

This directory contains the committed benchmark gate used to select the default `ColorPlane` renderer.

## Files

- `color-plane-renderer-bench.mjs`: Repeatable benchmark harness.
- `color-area-interaction-bench.mjs`: Pointer-interaction budget harness for ColorArea drag scenarios.
- `results.color-plane.json`: Latest captured run output.

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

Current baseline selected renderer: `gpu`.

- Benchmarks are directional only and should be paired with interaction traces.
- `ColorPlane` keeps CPU fallback when GPU setup fails at runtime.
- `ColorPlane` accepts legacy aliases (`webgl`, `canvas2d`) and remaps to (`gpu`, `cpu`) with deprecation warnings.

## Re-run

```bash
node packages/react/bench/color-plane-renderer-bench.mjs > packages/react/bench/results.color-plane.json
```
