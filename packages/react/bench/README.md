# ColorPlane Renderer Benchmark

This directory contains the committed benchmark gate used to select the default `ColorPlane` renderer.

## Files

- `color-plane-renderer-bench.mjs`: Repeatable benchmark harness.
- `results.color-plane.json`: Latest captured run output.

## Methodology

- Compare two prototype paths:
  - `canvas2d`: CPU pixel raster path.
  - `webglPrototype`: CPU raster + simulated texture upload/blit overhead.
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

Current baseline selected renderer: `canvas2d`.

- Both prototypes miss the desktop target in this CPU-only synthetic harness.
- `canvas2d` remains the default due lower complexity and deterministic behavior.
- `ColorPlane` still accepts `renderer="webgl"` and auto-falls back to `canvas2d` if WebGL is unavailable or errors.

## Re-run

```bash
node packages/react/bench/color-plane-renderer-bench.mjs > packages/react/bench/results.color-plane.json
```
