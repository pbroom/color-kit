---
'color-kit': minor
---

**Breaking:** the legacy marching-squares contrast-region engine is removed. `contrastRegionPaths`, `contrastRegionPath`, and the `contrastBoundary` / `contrastRegion` plane queries always use the root-tracing solver.

- The `engine`, `samplingMode`, `edgeInterpolation`, `adaptiveBaseSteps`, and `adaptiveMaxDepth` options are removed. Passing one is a type error and throws a `TypeError`. Tune the solver with `lightnessSteps`, `chromaSteps`, `hybridMaxDepth`, and `hybridErrorTolerance`.
- The `ContrastRegionEngine`, `ContrastRegionBaseOptions`, `ContrastRegionHybridOptions`, and `ContrastRegionLegacyOptions` types are removed. `ContrastRegionPathOptions` is now a single options interface.
- The `contrast-legacy-uniform` and `contrast-legacy-adaptive` trace solver names are removed, and scheduler telemetry keys for contrast queries no longer include a sampling mode (`contrast:wcag` rather than `contrast:wcag:hybrid`).
- `ContrastRegionLayer` (`color-kit/react`) uses the root-tracing solver. Its `samplingMode`, `edgeInterpolation`, `adaptiveBaseSteps`, and `adaptiveMaxDepth` props are removed, and it gains `hybridMaxDepth` and `hybridErrorTolerance` props. Its defaults (`lightnessSteps` 12, `chromaSteps` 16, `hybridMaxDepth` 3 at high quality, `hybridErrorTolerance` 0.003) take about half the time per region of the old layer, with fills that match the contrast check more closely. `ContrastRegionLayerMetrics.samplingMode` is replaced by `hybridMaxDepth`.

The solver also fixes three contour defects found by a brute-force check: a folded contour no longer splits at a fold tip that falls between lightness samples, and contours that meet the gamut edge where the contrast barely changes with chroma now end on the edge instead of stopping short or splitting off a short stub. Roots are placed only where pass/fail changes along chroma, so they always agree with the pass/fail state at the axis and the gamut edge.
