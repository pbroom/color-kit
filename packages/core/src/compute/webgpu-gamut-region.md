# WebGPU `gamutRegion` Backend

This note captures the intended `webgpu` backend shape for the viewport-first
`gamutRegion` query.

## Goals

- Classify the current viewport before emitting geometry.
- Refine only mixed tiles.
- Read back compact local boundary segments plus path metadata instead of full
  offscreen contours.

## Tile Pipeline

1. Upload the resolved plane, query options, and viewport bounds.
2. Run a classify pass over a coarse tile grid in normalized viewport space.
3. Mark each tile as `inside`, `outside`, or `mixed` from signed gamut-margin
   samples.
4. Short-circuit:
   - all `inside` -> return `viewportRelation: 'inside'`, rectangle
     `visibleRegion`, no boundary readback
   - all `outside` -> return `viewportRelation: 'outside'`, empty region, no
     boundary readback
5. For `mixed` tiles only, run a refinement pass:
   - subdivide to the requested contour precision
   - evaluate the same analytic/domain/generic field used by the JS reference
     path
   - emit local zero-crossing segments into a storage buffer
6. Run a stitching pass (GPU or CPU, depending segment count) to assemble:
   - viewport `boundaryPaths`
   - clipped `visibleRegion.paths`

## Readback Contract

- Read back a compact segment buffer, not a full raster.
- Each segment record should carry:
  - tile id
  - local start/end points
  - optional flags for viewport-edge contact
- A second metadata buffer should provide:
  - segment count
  - tile count
  - solver id
  - viewport relation summary

This maps cleanly onto the existing packed transfer format:

- `pathStart` / `pathCount` for `boundaryPaths`
- `regionPathStart` / `regionPathCount` for `visibleRegion.paths`

## Scheduler Expectations

- Prefer `webgpu` only once telemetry shows that `gamutRegion` buckets beat the
  JS backend for the current `scope` and workload size.
- Keep the JS implementation as the source-of-truth fallback for:
  - unsupported adapters
  - small `viewport` queries where readback overhead dominates
  - any backend error or circuit-breaker event

## Field Reuse

The GPU path should mirror the JS dispatch matrix exactly:

- `domain-edge` tiles clip against model-valid bounds directly.
- `analytic-lc`, `analytic-hc`, and `analytic-hct` use their closed-form margin
  functions in the shader.
- `implicit-contour` evaluates the generic signed gamut margin field.

That keeps solver telemetry comparable across `js` and future `webgpu`
backends.
