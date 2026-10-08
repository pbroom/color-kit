---
'color-kit': minor
---

**Breaking:** `color-kit/react` no longer exports the internal `BENCHMARK_SELECTED_COLOR_PLANE_RENDERER`, `COLOR_PLANE_VERTEX_SHADER_SOURCE` and `COLOR_PLANE_FRAGMENT_SHADER_SOURCE` constants. They were implementation details of `ColorPlane`; pick a renderer with its `renderer` prop instead. `assertGamutTarget` is now also exported from the `color-kit` root, in addition to `color-kit/plane`.
