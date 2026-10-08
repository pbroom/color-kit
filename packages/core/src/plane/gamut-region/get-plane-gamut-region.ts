import { assertGamutTarget } from '../../gamut/target.js';
import { resolvePlaneDefinition } from '../plane.js';
import {
  limitTracePaths,
  recordTraceStage,
  setTraceSummaryField,
  type InternalPlaneTraceContext,
} from '../../trace/context.js';
import type {
  PlaneDefinition,
  PlaneGamutRegionQuery,
  PlaneGamutRegionResult,
} from '../types.js';
import {
  buildDomainEdgeViewportResult,
  buildFullBoundaryPaths,
  buildImplicitBoundaryPaths,
  createFieldEvaluator,
  DEFAULT_BOUNDARY_STEPS,
  DEFAULT_FULL_RESOLUTION,
  DEFAULT_IMPLICIT_MAX_DEPTH,
  DEFAULT_VIEWPORT_BASE_RESOLUTION,
  DEFAULT_VIEWPORT_FILL_RESOLUTION,
  DEFAULT_VIEWPORT_RESOLUTION,
  fieldInsideTolerance,
  resolveGamutSolver,
} from './gamut-solvers.js';
import {
  buildSegmentPaths,
  buildViewportVisibleRegion,
  classifyAdaptiveContourResult,
  clipPathsToViewport,
  createScalarSampler,
  extractAdaptiveContourSegments,
  extractBoundaryPathsFromVisibleRegion,
  sampleScalarGrid,
  simplifyPlanePaths,
} from './viewport-geometry.js';

/**
 * Computes the in-gamut area of a plane: the visible region to fill and the
 * gamut boundary lines to stroke.
 *
 * Works on every plane model and axis pair. The solver is chosen from the
 * plane and gamut and reported as `solver`: `'domain-edge'` when the whole
 * model domain is in gamut (RGB, HSL and HSV planes, Display P3 planes with a
 * `'display-p3'` target), analytic solvers for OKLCH lightness × chroma
 * (`'analytic-lc'`), OKLCH hue × chroma (`'analytic-hc'`) and HCT hue/tone ×
 * chroma (`'analytic-hct'`, sRGB only), and an adaptive marching-squares
 * contour of the gamut field (`'implicit-contour'`) for everything else.
 *
 * The result reports how the gamut relates to the plane window in
 * `viewportRelation` (`'inside'`, `'outside'` or `'intersects'`), the gamut
 * edge as polylines in `boundaryPaths`, and the fillable in-gamut area as
 * closed outlines in `visibleRegion.paths`, all in normalized plane
 * coordinates. The visible region is always clipped to the plane window;
 * with `scope: 'full'`, `boundaryPaths` instead cover the whole channel
 * domain, so they can extend outside `[0, 1]`. In-gamut membership follows
 * {@link inSrgbGamut} / {@link inP3Gamut}.
 *
 * @param planeDefinition - Plane to analyze; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param query - Region options; see {@link PlaneGamutRegionQuery}.
 * @param trace - Internal trace hook; leave it out and use
 * {@link inspectPlaneQuery} to capture a trace.
 * @returns A new result with the gamut, scope, solver, viewport relation,
 * boundary paths and visible region.
 * @throws {TypeError} When `gamut` is not `'srgb'` or `'display-p3'`
 * (including the removed `'p3'`).
 * @see {@link toSvgCompoundPath} to draw the region.
 * @see {@link sense} for the fluent form.
 *
 * @example
 * ```ts
 * import { definePlane, getPlaneGamutRegion } from 'color-kit/plane';
 *
 * const region = getPlaneGamutRegion(definePlane({ fixed: { h: 264 } }));
 * region.solver; // → 'analytic-lc'
 * region.viewportRelation; // → 'intersects'
 * region.visibleRegion.paths.length; // → 1
 *
 * getPlaneGamutRegion(definePlane({ model: 'rgb' })).viewportRelation; // → 'inside'
 * ```
 */
export function getPlaneGamutRegion(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneGamutRegionQuery, 'kind'> = {},
  trace?: InternalPlaneTraceContext | null,
): PlaneGamutRegionResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  assertGamutTarget(query.gamut, 'gamutRegion()');
  const gamut = query.gamut ?? 'srgb';
  const scope = query.scope ?? 'viewport';
  const solver = resolveGamutSolver(resolvedPlane, gamut);
  setTraceSummaryField(trace, 'solver', solver);
  setTraceSummaryField(
    trace,
    'samplingMode',
    solver === 'implicit-contour' ? 'adaptive' : 'analytic',
  );
  setTraceSummaryField(trace, 'fidelity', {
    simplifyTolerance: query.simplifyTolerance,
    resolution:
      solver === 'implicit-contour'
        ? scope === 'full'
          ? DEFAULT_FULL_RESOLUTION
          : DEFAULT_VIEWPORT_RESOLUTION
        : DEFAULT_BOUNDARY_STEPS,
    steps: solver === 'implicit-contour' ? undefined : DEFAULT_BOUNDARY_STEPS,
  });
  recordTraceStage(trace, {
    kind: 'solver',
    solver,
    samplingMode: solver === 'implicit-contour' ? 'adaptive' : 'analytic',
    scope,
  });

  if (solver === 'domain-edge') {
    const result = buildDomainEdgeViewportResult(
      resolvedPlane,
      gamut,
      scope,
      query.simplifyTolerance,
    );
    setTraceSummaryField(trace, 'viewportRelation', result.viewportRelation);
    setTraceSummaryField(
      trace,
      'pathCount',
      result.boundaryPaths.length + result.visibleRegion.paths.length,
    );
    setTraceSummaryField(
      trace,
      'pointCount',
      result.boundaryPaths.reduce((total, path) => total + path.length, 0) +
        result.visibleRegion.paths.reduce(
          (total, path) => total + path.length,
          0,
        ),
    );
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'domain-edge-boundary',
      pathCount: result.boundaryPaths.length,
      pointCount: result.boundaryPaths.reduce(
        (total, path) => total + path.length,
        0,
      ),
      paths: limitTracePaths(trace, result.boundaryPaths),
    });
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'domain-edge-visible-region',
      pathCount: result.visibleRegion.paths.length,
      pointCount: result.visibleRegion.paths.reduce(
        (total, path) => total + path.length,
        0,
      ),
      paths: limitTracePaths(trace, result.visibleRegion.paths),
    });
    return result;
  }

  const field = createFieldEvaluator(resolvedPlane, gamut);
  const sampler = createScalarSampler(field, trace);
  const viewportContour = extractAdaptiveContourSegments(
    sampler,
    { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    DEFAULT_VIEWPORT_BASE_RESOLUTION,
    DEFAULT_IMPLICIT_MAX_DEPTH,
    trace,
    'viewport-boundary',
  );
  const viewportClassification = classifyAdaptiveContourResult(
    viewportContour,
    fieldInsideTolerance(resolvedPlane, gamut),
  );
  const viewportRelation = viewportClassification.relation;
  setTraceSummaryField(trace, 'viewportRelation', viewportRelation);
  recordTraceStage(trace, {
    kind: 'viewportClassification',
    relation: viewportRelation,
    minValue: viewportClassification.minValue,
    maxValue: viewportClassification.maxValue,
  });
  const viewportGrid =
    viewportRelation === 'intersects'
      ? sampleScalarGrid(
          sampler,
          { minX: 0, maxX: 1, minY: 0, maxY: 1 },
          DEFAULT_VIEWPORT_FILL_RESOLUTION,
          trace,
          'viewport-grid',
        )
      : null;

  if (
    solver === 'analytic-lc' ||
    solver === 'analytic-hc' ||
    solver === 'analytic-hct'
  ) {
    const fullBoundaryPaths = buildFullBoundaryPaths(
      resolvedPlane,
      gamut,
      solver,
      query.simplifyTolerance,
    );
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'analytic-full-boundary',
      pathCount: fullBoundaryPaths.length,
      pointCount: fullBoundaryPaths.reduce(
        (total, path) => total + path.length,
        0,
      ),
      paths: limitTracePaths(trace, fullBoundaryPaths),
    });
    const viewportBoundaryPaths = simplifyPlanePaths(
      clipPathsToViewport(fullBoundaryPaths),
      query.simplifyTolerance,
    );
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'analytic-viewport-boundary',
      pathCount: viewportBoundaryPaths.length,
      pointCount: viewportBoundaryPaths.reduce(
        (total, path) => total + path.length,
        0,
      ),
      paths: limitTracePaths(trace, viewportBoundaryPaths),
    });
    const resolvedViewportRelation =
      viewportBoundaryPaths.length > 0 ? 'intersects' : viewportRelation;
    const resolvedViewportGrid =
      resolvedViewportRelation === 'intersects'
        ? (viewportGrid ??
          sampleScalarGrid(
            sampler,
            { minX: 0, maxX: 1, minY: 0, maxY: 1 },
            DEFAULT_VIEWPORT_FILL_RESOLUTION,
            trace,
            'viewport-grid',
          ))
        : null;
    const visibleRegion = buildViewportVisibleRegion(
      resolvedViewportGrid,
      resolvedViewportRelation,
      trace,
    );
    if (resolvedViewportRelation !== 'intersects') {
      recordTraceStage(trace, {
        kind: 'paths',
        label: 'analytic-visible-region',
        pathCount: visibleRegion.paths.length,
        pointCount: visibleRegion.paths.reduce(
          (total, path) => total + path.length,
          0,
        ),
        paths: limitTracePaths(trace, visibleRegion.paths),
      });
    }
    const boundaryPaths =
      scope === 'full'
        ? fullBoundaryPaths
        : viewportBoundaryPaths.length > 0
          ? viewportBoundaryPaths
          : [];
    setTraceSummaryField(trace, 'viewportRelation', resolvedViewportRelation);
    setTraceSummaryField(
      trace,
      'pathCount',
      boundaryPaths.length + visibleRegion.paths.length,
    );
    setTraceSummaryField(
      trace,
      'pointCount',
      boundaryPaths.reduce((total, path) => total + path.length, 0) +
        visibleRegion.paths.reduce((total, path) => total + path.length, 0),
    );

    return {
      kind: 'gamutRegion',
      gamut,
      scope,
      viewportRelation: resolvedViewportRelation,
      solver,
      boundaryPaths,
      visibleRegion,
    };
  }

  const implicitBoundaryPaths =
    scope === 'full'
      ? buildImplicitBoundaryPaths(
          sampler,
          'full',
          resolvedPlane,
          query.simplifyTolerance,
          trace,
        )
      : viewportRelation === 'intersects'
        ? simplifyPlanePaths(
            buildSegmentPaths(viewportContour.segments),
            query.simplifyTolerance,
          )
        : [];
  const visibleRegion = buildViewportVisibleRegion(
    viewportGrid,
    viewportRelation,
    trace,
  );
  if (viewportRelation !== 'intersects') {
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'implicit-visible-region',
      pathCount: visibleRegion.paths.length,
      pointCount: visibleRegion.paths.reduce(
        (total, path) => total + path.length,
        0,
      ),
      paths: limitTracePaths(trace, visibleRegion.paths),
    });
  }
  const boundaryPaths =
    scope === 'viewport' &&
    viewportRelation === 'intersects' &&
    implicitBoundaryPaths.length === 0
      ? simplifyPlanePaths(
          extractBoundaryPathsFromVisibleRegion(visibleRegion),
          query.simplifyTolerance,
        )
      : implicitBoundaryPaths;
  if (
    scope === 'viewport' &&
    viewportRelation === 'intersects' &&
    implicitBoundaryPaths.length === 0
  ) {
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'visible-region-boundary-fallback',
      pathCount: boundaryPaths.length,
      pointCount: boundaryPaths.reduce((total, path) => total + path.length, 0),
      paths: limitTracePaths(trace, boundaryPaths),
    });
  }
  setTraceSummaryField(
    trace,
    'pathCount',
    boundaryPaths.length + visibleRegion.paths.length,
  );
  setTraceSummaryField(
    trace,
    'pointCount',
    boundaryPaths.reduce((total, path) => total + path.length, 0) +
      visibleRegion.paths.reduce((total, path) => total + path.length, 0),
  );

  return {
    kind: 'gamutRegion',
    gamut,
    scope,
    viewportRelation,
    solver,
    boundaryPaths,
    visibleRegion,
  };
}
