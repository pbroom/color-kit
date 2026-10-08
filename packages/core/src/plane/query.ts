import type { Color } from '../types.js';
import type { InternalPlaneTraceContext } from '../trace/context.js';
import { getPlaneGamutRegion } from './gamut-region/index.js';
import { planeToColor } from './mapping.js';
import {
  getPlaneChromaBand,
  getPlaneContrastBoundary,
  getPlaneContrastRegion,
  getPlaneFallbackPoint,
  getPlaneGamutBoundary,
  getPlaneQuerySpec,
  samplePlaneGradient,
} from './query-specs/index.js';
import { resolvePlaneDefinition } from './resolve.js';
import { createPlaneTraceContext, finalizePlaneTrace } from './trace.js';
import type {
  PlaneChromaBandQuery,
  PlaneChromaBandResult,
  PlaneContrastBoundaryResult,
  PlaneContrastRegionResult,
  PlaneContrastQueryOptions,
  PlaneDefinition,
  PlaneFallbackPointQuery,
  PlaneFallbackPointResult,
  PlaneGamutBoundaryQuery,
  PlaneGamutBoundaryResult,
  PlaneGamutRegionQuery,
  PlaneGamutRegionResult,
  PlaneGradientQuery,
  PlaneGradientResult,
  PlaneQueryInspection,
  PlaneQuery,
  PlaneQueryResult,
  PlaneQueryTraceOptions,
} from './types.js';

export {
  getPlaneChromaBand,
  getPlaneContrastBoundary,
  getPlaneContrastRegion,
  getPlaneFallbackPoint,
  getPlaneGamutBoundary,
  getPlaneGamutRegion,
  samplePlaneGradient,
};

function runPlaneQueryInternal(
  planeDefinition: PlaneDefinition,
  query: PlaneQuery,
  trace?: InternalPlaneTraceContext | null,
): PlaneQueryResult {
  return getPlaneQuerySpec(query.kind).run(planeDefinition, query, trace);
}

/**
 * Runs one plane query, dispatching on `query.kind`.
 *
 * Generic entry point behind the per-kind helpers
 * ({@link getPlaneGamutBoundary}, {@link getPlaneGamutRegion},
 * {@link getPlaneContrastBoundary}, {@link getPlaneContrastRegion},
 * {@link getPlaneChromaBand}, {@link getPlaneFallbackPoint},
 * {@link samplePlaneGradient}); useful when queries are built as data. The
 * call is stateless: the plane is resolved on every call and nothing is
 * cached (see {@link PlaneQueryCache}).
 *
 * @param planeDefinition - Plane to query; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param query - Query payload; `kind` selects the query type.
 * @returns A new result whose `kind` matches the query's.
 * @throws {TypeError} When `query.gamut` is not `'srgb'` or `'display-p3'`.
 * @throws {Error} When `query.kind` is unknown or the plane or query options
 * are invalid.
 * @see {@link inspectPlaneQuery} to also capture a solver trace.
 *
 * @example
 * ```ts
 * import { definePlane, runPlaneQuery } from 'color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } }); // OKLCH, x: l, y: c
 * const result = runPlaneQuery(plane, { kind: 'gamutBoundary', gamut: 'srgb' });
 * if (result.kind === 'gamutBoundary') {
 *   result.points.length; // → 101
 *   result.points[0]; // → { l: 0, c: 0, x: 0, y: 1 }
 * }
 * ```
 */
export function runPlaneQuery(
  planeDefinition: PlaneDefinition,
  query: PlaneQuery,
): PlaneQueryResult {
  return runPlaneQueryInternal(planeDefinition, query);
}

/**
 * Runs several plane queries against one plane, in order.
 *
 * Equivalent to mapping {@link runPlaneQuery} over `queries`.
 *
 * @param planeDefinition - Plane to query; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param queries - Query payloads to run.
 * @returns A new array with one result per query, in input order.
 * @throws {TypeError} When a query's `gamut` is not `'srgb'` or
 * `'display-p3'`.
 * @throws {Error} When a query kind is unknown or the plane or query options
 * are invalid.
 *
 * @example
 * ```ts
 * import { definePlane, runPlaneQueries } from 'color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } });
 * const results = runPlaneQueries(plane, [
 *   { kind: 'gamutBoundary', gamut: 'display-p3' },
 *   { kind: 'chromaBand', requestedChroma: 0.1 },
 * ]);
 * results.map((result) => result.kind); // → ['gamutBoundary', 'chromaBand']
 * ```
 */
export function runPlaneQueries(
  planeDefinition: PlaneDefinition,
  queries: PlaneQuery[],
): PlaneQueryResult[] {
  return queries.map((query) => runPlaneQueryInternal(planeDefinition, query));
}

/**
 * Runs one plane query and also returns a trace of how it was solved.
 *
 * `result` is identical to what {@link runPlaneQuery} returns. `trace` is a
 * {@link PlaneQueryTrace} with:
 *
 * - `summary`: the query kind and trace level; the solver that ran
 *   (gamut-region solvers such as `'analytic-lc'` or `'implicit-contour'`,
 *   or `'contrast-rays'`) and its sampling mode; the viewport relation
 *   (`'inside'`, `'outside'` or `'intersects'`); work counters (samples,
 *   scalar evaluations, marching-squares cells and segments, intermediate
 *   paths and points); the result's path and point counts; fidelity settings;
 *   and wall-clock time in milliseconds (`totalTimeMs`, plus per-phase
 *   `timings` where a solver records them).
 * - `stages`: an ordered list of solver steps (`'solver'`, `'scalarGrid'`,
 *   `'viewportClassification'`, `'marchingSquares'`, `'paths'` with the
 *   intermediate paths, and a final `'metrics'` snapshot). Empty when `level`
 *   is `'summary'`.
 *
 * Which counters and stages appear depends on the query kind: gamut-region
 * and contrast queries record solver detail; gamut-boundary, chroma-band,
 * fallback-point and gradient queries record only result counts, total time
 * and the `'metrics'` stage. Times vary between runs; never compare them for
 * equality.
 *
 * @param planeDefinition - Plane to query; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param query - Query payload; `kind` selects the query type and narrows the
 * returned `result`.
 * @param options - Trace detail. `level` defaults to `'stages'`; `'full'` also
 * records per-cell marching-squares events and (unless `includeScalarGrid` is
 * `false`) the sampled scalar grid. `maxStageEntries` (default 128, clamped to
 * `[8, 512]`) caps how many cells, paths and points per path each stage keeps.
 * @returns A new `{ result, trace }` pair.
 * @throws {TypeError} When `query.gamut` is not `'srgb'` or `'display-p3'`.
 * @throws {Error} When `query.kind` is unknown or the plane or query options
 * are invalid.
 * @see {@link inspectPlaneQueries}
 *
 * @example
 * ```ts
 * import { definePlane, inspectPlaneQuery } from 'color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } }); // OKLCH, x: l, y: c
 * const { result, trace } = inspectPlaneQuery(plane, { kind: 'gamutRegion' });
 * result.viewportRelation; // → 'intersects'
 * trace.summary.solver; // → 'analytic-lc'
 * trace.summary.resultPointCount; // → 131
 * trace.stages.map((stage) => stage.kind);
 * // → ['solver', 'marchingSquares', 'viewportClassification', 'paths',
 * //    'paths', 'marchingSquares', 'paths', 'metrics']
 * ```
 */
export function inspectPlaneQuery<Result extends PlaneQuery = PlaneQuery>(
  planeDefinition: PlaneDefinition,
  query: Result,
  options?: PlaneQueryTraceOptions,
): PlaneQueryInspection<Extract<PlaneQueryResult, { kind: Result['kind'] }>> {
  const trace = createPlaneTraceContext(query, options);
  const result = runPlaneQueryInternal(planeDefinition, query, trace);
  return finalizePlaneTrace(
    trace,
    result as Extract<PlaneQueryResult, { kind: Result['kind'] }>,
  );
}

/**
 * Runs several plane queries in order, returning a result and trace for each.
 *
 * Equivalent to mapping {@link inspectPlaneQuery} over `queries` with the same
 * trace options; each query gets its own independent trace.
 *
 * @param planeDefinition - Plane to query; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param queries - Query payloads to run.
 * @param options - Trace detail applied to every query; see
 * {@link inspectPlaneQuery}.
 * @returns A new array of `{ result, trace }` pairs, in input order.
 * @throws {TypeError} When a query's `gamut` is not `'srgb'` or
 * `'display-p3'`.
 * @throws {Error} When a query kind is unknown or the plane or query options
 * are invalid.
 *
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * import { definePlane, inspectPlaneQueries } from 'color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } });
 * const inspections = inspectPlaneQueries(
 *   plane,
 *   [
 *     { kind: 'gamutBoundary' },
 *     { kind: 'contrastRegion', reference: parse('#ffffff') },
 *   ],
 *   { level: 'summary' },
 * );
 * inspections.map(({ trace }) => trace.summary.resultPointCount); // → [101, 53]
 * inspections.map(({ trace }) => trace.stages.length); // → [0, 0]
 * ```
 */
export function inspectPlaneQueries(
  planeDefinition: PlaneDefinition,
  queries: PlaneQuery[],
  options?: PlaneQueryTraceOptions,
): PlaneQueryInspection[] {
  return queries.map((query) =>
    inspectPlaneQuery(planeDefinition, query, options),
  );
}

/**
 * Query helpers bound to one plane, returned by {@link sense}.
 *
 * Each method calls the matching `getPlane*` function with the bound plane;
 * the query options are the same minus `kind`.
 */
export interface PlaneSense {
  /** Computes a projected gamut boundary contour. */
  gamutBoundary: (
    query?: Omit<PlaneGamutBoundaryQuery, 'kind'>,
  ) => PlaneGamutBoundaryResult;
  /** Computes visible gamut geometry for the current plane window. */
  gamutRegion: (
    query?: Omit<PlaneGamutRegionQuery, 'kind'>,
  ) => PlaneGamutRegionResult;
  /** Computes a projected contrast-threshold contour. */
  contrastBoundary: (
    query: PlaneContrastQueryOptions,
  ) => PlaneContrastBoundaryResult;
  /** Computes one or more projected filled contrast regions. */
  contrastRegion: (
    query: PlaneContrastQueryOptions,
  ) => PlaneContrastRegionResult;
  /** Computes a projected chroma-band point sequence. */
  chromaBand: (
    query?: Omit<PlaneChromaBandQuery, 'kind'>,
  ) => PlaneChromaBandResult;
  /** Maps a color into gamut and projects it to one plane point. */
  fallbackPoint: (
    query: Omit<PlaneFallbackPointQuery, 'kind'>,
  ) => PlaneFallbackPointResult;
  /** Samples a gradient and projects each sample to plane coordinates. */
  gradient: (query: Omit<PlaneGradientQuery, 'kind'>) => PlaneGradientResult;
}

/**
 * Binds a plane to a set of query helpers, so queries read as
 * `sense(plane).gamutRegion()`.
 *
 * Each helper forwards to the matching function ({@link getPlaneGamutBoundary},
 * {@link getPlaneGamutRegion}, {@link getPlaneContrastBoundary},
 * {@link getPlaneContrastRegion}, {@link getPlaneChromaBand},
 * {@link getPlaneFallbackPoint}, {@link samplePlaneGradient}). Nothing is
 * cached: the definition is captured as given and resolved on every call.
 *
 * @param planeDefinition - Plane captured by every helper; a {@link Plane} or
 * any {@link PlaneDefinition}.
 * @returns A new {@link PlaneSense} object.
 *
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * import { definePlane, sense } from 'color-kit/plane';
 *
 * const plane = sense(definePlane({ fixed: { h: 264 } }));
 * const white = parse('#ffffff');
 * plane.gamutBoundary({ gamut: 'display-p3' }).points.length; // → 101
 * plane.contrastRegion({ reference: white, level: 'AA' }).paths.length; // → 1
 * ```
 */
export function sense(planeDefinition: PlaneDefinition): PlaneSense {
  return {
    gamutBoundary: (query = {}) =>
      getPlaneGamutBoundary(planeDefinition, query),
    gamutRegion: (query = {}) => getPlaneGamutRegion(planeDefinition, query),
    contrastBoundary: (query) =>
      getPlaneContrastBoundary(planeDefinition, query),
    contrastRegion: (query) => getPlaneContrastRegion(planeDefinition, query),
    chromaBand: (query = {}) => getPlaneChromaBand(planeDefinition, query),
    fallbackPoint: (query) => getPlaneFallbackPoint(planeDefinition, query),
    gradient: (query) => samplePlaneGradient(planeDefinition, query),
  };
}

/**
 * Returns the color at a normalized point of a plane definition.
 *
 * Resolves `planeDefinition` and calls {@link planeToColor}: `x`/`y` are
 * clamped to `[0, 1]` and the result is not gamut-mapped. When the plane is
 * already resolved, call `planeToColor()` directly to skip re-resolving it.
 *
 * @param planeDefinition - Plane to sample; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param point - Normalized plane point (`x`, `y` in `[0, 1]`).
 * @returns A new OKLCH color.
 * @throws {TypeError} When the plane model is not supported.
 * @throws {Error} When the plane definition is otherwise invalid.
 *
 * @example
 * ```ts
 * import { toHex } from 'color-kit';
 * import { colorAtPlanePoint } from 'color-kit/plane';
 *
 * toHex(colorAtPlanePoint({ fixed: { h: 264 } }, { x: 0.6, y: 0.75 }));
 * // → '#617fbc'
 * ```
 */
export function colorAtPlanePoint(
  planeDefinition: PlaneDefinition,
  point: { x: number; y: number },
): Color {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  return planeToColor(resolvedPlane, point);
}
