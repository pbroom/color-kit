---
'color-kit': minor
---

Add tuple and typed-array interop for GPU pipelines, three.js, and WebGL/WebGPU, exported from the root and a new `color-kit/interop` subpath.

- `to<Space>Array(color, out?, offset?, options?)` and `from<Space>Array(array, offset?)` for `LinearSrgb`, `Srgb`, `LinearP3`, `P3`, `Oklab`, and `Oklch`, plus `*Array4` variants that carry alpha. Writers fill any `number[]` or typed array without allocating.
- `packColors` / `unpackColors` write and read many colors in one flat buffer, with `stride`, `offset`, and `alpha` layout options.
- Writers emit unclamped floats by default (correct for HDR and linear pipelines, and matching three.js). `clamp: true` clips RGB channels to 0–1, and `gamutMap: 'srgb' | 'display-p3'` reduces chroma first.
- New `ColorTuple` / `ColorTuple4` types.
