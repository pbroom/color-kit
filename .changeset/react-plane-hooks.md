---
'color-kit': minor
---

`color-kit/react` adds headless plane hooks that return data and own no DOM:

- `useColorPlaneRenderer(plane, options)` rasterizes a color plane into your `<canvas>` with WebGL, falling back to a CPU renderer when WebGL is unavailable or its context is lost. It returns a stable `ref`, a `canvasKey` to use as the canvas `key`, and the active `renderer`.
- `useGamutBoundary`, `useChromaBand`, `useContrastRegion` and `useFallbackPoints` return memoized plane geometry: points, plus SVG path data from `toSvgPath`/`toSvgCompoundPath` for a `0 0 100 100` viewBox. `useContrastRegion` returns both contour lines (`path`) and closed fill polygons (`fillPath`). Pass `isDragging` and the queries run in a shared Web Worker while you drag, keeping the last result on screen until a fresh one arrives.
- `useAdaptiveQuality(profile)` lowers a `quality` level while measured frames are slow and raises it again when they recover. You feed that level to the hooks above.

Each hook takes a `ColorPlaneSpec`, `{ color, axes? }`. Its axes use the driver's `ColorAreaAxes` (lightness × chroma by default).
