---
'@pbroom/color-kit': minor
---

Slim the root entry to the everyday toolkit plus the plane essentials.

Breaking: these are no longer exported from `@pbroom/color-kit` (or `/core`):

- Array interop (`to*Array`, `from*Array`, `packColors`, `unpackColors` and their types): import from `@pbroom/color-kit/interop`.
- Advanced plane APIs (`runPlaneQuery`, `runPlaneQueries`, `getPlane*`, `PlaneQueryCache`, `runCachedPlaneQuery`, `createPlaneQueryKey`, `inspectPlaneQuery`, region operations and transforms, `PLANE_MODEL_*`, `resolvePlaneDefinition`, `samplePlaneGradient`, `colorAtPlanePoint`, `planeHue` and the `PlaneQueryTrace*` types): import from `@pbroom/color-kit/plane`.
- `clamp`, `round` and `lerp`: removed from the public API.

The root still exports `definePlane`, `definePlaneFromColor`, `sense`, `toSvgPath`, `toSvgCompoundPath`, `colorToPlane`, `planeToColor` and the plane query and result types.
