---
'color-kit': minor
---

**Breaking:** `ColorPlane` drops its deprecated options. The `outOfGamut` prop (and the exported `ColorPlaneOutOfGamutConfig` type) is removed; use `edgeBehavior="transparent"` in place of `outOfGamut={{ repeatEdgePixels: false }}`, and `edgeBehavior="clamp"` (the default) in place of `repeatEdgePixels: true`. The `renderer="webgl"` alias is removed from `ColorPlaneRenderer`; use `renderer="gpu"`. Passing either old value is now a TypeScript error.
