import type { PlanePoint } from '../geometry/types.js';

/**
 * Discriminant of every supported plane query.
 *
 * `plane/types.ts` asserts that this matches `PlaneQuery['kind']` exactly.
 */
export type PlaneQueryKind =
  | 'gamutBoundary'
  | 'gamutRegion'
  | 'contrastBoundary'
  | 'contrastRegion'
  | 'chromaBand'
  | 'fallbackPoint'
  | 'gradient';

/** Compute backends that exist today. Only the JS backend is implemented. */
export type PlaneComputeBackendKind = 'js';

/** Why the scheduler picked a backend. Only the JS backend exists. */
export type PlaneComputeScheduleReason = 'default-js';

/**
 * How a gamut relates to the plane viewport (the `[0, 1]` square):
 * `'inside'` when the whole viewport is in gamut, `'outside'` when none of it
 * is, and `'intersects'` when the gamut boundary crosses it.
 */
export type PlaneViewportRelation = 'inside' | 'outside' | 'intersects';

/**
 * Strategy a gamut-region query used, picked from the plane's model, axes and
 * gamut:
 *
 * - `'domain-edge'`: the gamut is the model's own channel box (`rgb`, `hsl`,
 *   `hsv`, or `display-p3` against the P3 gamut), so the boundary is the
 *   domain edge.
 * - `'analytic-lc'`: OKLCH lightness × chroma plane, traced from the max-chroma
 *   curve.
 * - `'analytic-hc'`: OKLCH hue × chroma plane.
 * - `'analytic-hct'`: HCT hue or tone × chroma plane against sRGB.
 * - `'implicit-contour'`: any other plane; the gamut is sampled as a scalar
 *   field and contoured with adaptive marching squares.
 */
export type PlaneGamutSolver =
  | 'domain-edge'
  | 'analytic-lc'
  | 'analytic-hc'
  | 'analytic-hct'
  | 'implicit-contour';

/**
 * Contrast-region solver: luminance level curves traced along rays from
 * black (see `contrastRegionPaths`).
 */
export type PlaneContrastSolver = 'contrast-rays';

/**
 * Extent of gamut-region boundary paths: `'viewport'` clips them to the
 * visible `[0, 1]` square; `'full'` returns the whole gamut boundary, which
 * may extend outside it. The visible region is clipped either way.
 */
export type PlaneGamutRegionScope = 'viewport' | 'full';

/**
 * Detail captured by a query trace: `'summary'` fills only
 * {@link PlaneQueryTraceSummary}; `'stages'` adds per-stage records with
 * truncated paths; `'full'` also adds marching-squares cell events and the
 * sampled scalar grid.
 */
export type PlaneQueryTraceLevel = 'summary' | 'stages' | 'full';

/** Options for `inspectPlaneQuery` / `inspectPlaneQueries` and compute `trace` requests. */
export interface PlaneQueryTraceOptions {
  /**
   * How much detail to record.
   * @defaultValue `'stages'`
   */
  level?: PlaneQueryTraceLevel;
  /**
   * Cap on list-valued stage data: at most this many cell events or paths
   * per stage, and this many points per path. Clamped to `[8, 512]`.
   * @defaultValue 128
   */
  maxStageEntries?: number;
  /**
   * Record `scalarGrid` stages, including every sampled value, for each
   * scalar grid the solver samples. Only takes effect at `'stages'` or
   * `'full'` level.
   * @defaultValue `true` at `'full'` level, otherwise `false`
   */
  includeScalarGrid?: boolean;
}

/** Axis-aligned bounds in plane-normalized coordinates. */
export interface PlaneTraceBounds {
  /** Left edge. */
  minX: number;
  /** Right edge. */
  maxX: number;
  /** Top edge. */
  minY: number;
  /** Bottom edge. */
  maxY: number;
}

/**
 * Aggregate counters and metadata for one traced plane query. Present at
 * every {@link PlaneQueryTraceLevel}.
 *
 * Counters are work done by the solver; queries with closed-form results
 * (`gamutBoundary`, `chromaBand`, `fallbackPoint`, `gradient`) leave them at
 * `0` and only fill the `result*` counts.
 */
export interface PlaneQueryTraceSummary {
  /** Kind of the traced query. */
  queryKind: PlaneQueryKind;
  /** Trace level that was recorded. */
  level: PlaneQueryTraceLevel;
  /** Wall-clock time for the whole query, in milliseconds. Non-deterministic. */
  totalTimeMs: number;
  /** Scalar-field samples taken (cached repeats are not counted). */
  sampleCount: number;
  /** Scalar-field function evaluations; equals `sampleCount` for current solvers. */
  scalarEvaluationCount: number;
  /** Marching-squares cells visited, across all contouring passes. */
  cellCount: number;
  /** Contour segments emitted by marching squares before path assembly. */
  segmentCount: number;
  /** Paths produced by the solver. */
  pathCount: number;
  /** Points across the solver's paths. */
  pointCount: number;
  /** Paths in the returned result. */
  resultPathCount: number;
  /** Points in the returned result. */
  resultPointCount: number;
  /** Solver used by gamut-region and contrast queries. */
  solver?: PlaneGamutSolver | PlaneContrastSolver;
  /**
   * Sampling strategy: `'analytic'` for closed-form gamut solvers,
   * `'adaptive'` for refined sampling, `'uniform'` for a fixed grid.
   */
  samplingMode?: 'analytic' | 'uniform' | 'adaptive';
  /** Gamut-region queries: how the gamut relates to the viewport. */
  viewportRelation?: PlaneViewportRelation;
  /** Compute backend that ran the query (set by `color-kit/compute`). */
  backend?: PlaneComputeBackendKind;
  /** Scheduler telemetry bucket the request was filed under (scheduled runs only). */
  bucketKey?: string;
  /** Why the scheduler picked the backend (scheduled runs only). */
  scheduleReason?: PlaneComputeScheduleReason;
  /**
   * Contrast queries: contour pieces the solver dropped because no end point
   * passed the public checks (0 unless something is badly wrong).
   */
  droppedPieceCount?: number;
  /** Resolution settings the solver ran with; fields depend on the solver. */
  fidelity?: {
    /** Path simplification tolerance from the query, when set. */
    simplifyTolerance?: number;
    /** Sampling grid resolution, or initial ray/sample count for contrast. */
    resolution?: number;
    /** Boundary steps for analytic gamut solvers. */
    steps?: number;
    /** Maximum adaptive refinement depth. */
    maxDepth?: number;
    /** Adaptive refinement error tolerance. */
    errorTolerance?: number;
  };
  /**
   * Accumulated per-phase durations in milliseconds. Non-deterministic.
   * Currently only `compute` and `marshal` are filled, by `color-kit/compute`
   * backends when a request asks for a trace; the other keys are reserved.
   */
  timings?: Partial<
    Record<
      | 'run'
      | 'sampling'
      | 'classification'
      | 'contouring'
      | 'paths'
      | 'simplify'
      | 'clipping'
      | 'visibleRegion'
      | 'refinement'
      | 'compute'
      | 'marshal',
      number
    >
  >;
}

/** Stage recording which solver a query picked. */
export interface PlaneQueryTraceSolverStage {
  kind: 'solver';
  /** Solver that ran. */
  solver: PlaneQueryTraceSummary['solver'];
  /** Sampling strategy. */
  samplingMode?: PlaneQueryTraceSummary['samplingMode'];
  /** Viewport relation, when known at solver selection. */
  viewportRelation?: PlaneViewportRelation;
  /** Gamut-region scope. */
  scope?: PlaneGamutRegionScope;
  /** Stage duration in milliseconds. Reserved; not currently populated. */
  durationMs?: number;
}

/**
 * Stage describing a sampled gamut scalar field (positive inside the gamut,
 * zero on its boundary). Recorded only when `includeScalarGrid` is on.
 */
export interface PlaneQueryTraceScalarGridStage {
  kind: 'scalarGrid';
  /** Which grid this is (e.g. `'viewport-grid'`). */
  label: string;
  /** Sampled area in plane-normalized coordinates. */
  bounds: PlaneTraceBounds;
  /** Cells per axis. */
  resolution: number;
  /** Samples taken (`(resolution + 1)²` for a full grid). */
  sampleCount: number;
  /** Smallest sampled value. */
  minValue: number;
  /** Largest sampled value. */
  maxValue: number;
  /** Sampled values as rows (`values[y][x]`). */
  values?: number[][];
  /** Stage duration in milliseconds. Reserved; not currently populated. */
  durationMs?: number;
}

/**
 * Stage classifying the viewport against the gamut from the sampled field's
 * extremes (positive values are in gamut).
 */
export interface PlaneQueryTraceViewportStage {
  kind: 'viewportClassification';
  /** Resulting relation. */
  relation: PlaneViewportRelation;
  /** Smallest sampled field value. */
  minValue: number;
  /** Largest sampled field value. */
  maxValue: number;
  /** Stage duration in milliseconds. Reserved; not currently populated. */
  durationMs?: number;
}

/** One marching-squares cell that produced contour segments (`'full'` level). */
export interface PlaneQueryTraceCellEvent {
  /** Cell column index. */
  xIndex: number;
  /** Cell row index. */
  yIndex: number;
  /** 4-bit marching-squares corner mask (`0`–`15`). */
  mask: number;
  /** Segment end points emitted for the cell, in plane-normalized coordinates. */
  points: PlanePoint[];
}

/** Stage summarizing one marching-squares contouring pass. */
export interface PlaneQueryTraceMarchingSquaresStage {
  kind: 'marchingSquares';
  /** Which pass this is (e.g. `'viewport-boundary'`, `'visible-region'`). */
  label: string;
  /** Base grid cells per axis. */
  resolution: number;
  /** Cells visited, including adaptive refinements. */
  cellCount: number;
  /** Segments emitted. */
  segmentCount: number;
  /**
   * Cells that emitted segments, capped at `maxStageEntries`. Collected only
   * at `'full'` level; an empty array at `'stages'`.
   */
  cells?: PlaneQueryTraceCellEvent[];
  /** Stage duration in milliseconds. Reserved; not currently populated. */
  durationMs?: number;
}

/** Stage recording a set of paths produced during a solve. */
export interface PlaneQueryTracePathStage {
  kind: 'paths';
  /** Which paths these are (e.g. `'visible-region'`, `'contrast-region-paths'`). */
  label: string;
  /** Number of paths (before truncation). */
  pathCount: number;
  /** Number of points across all paths (before truncation). */
  pointCount: number;
  /**
   * The paths in plane-normalized coordinates, capped at `maxStageEntries`
   * paths of at most `maxStageEntries` points each.
   */
  paths?: PlanePoint[][];
  /** Stage duration in milliseconds. Reserved; not currently populated. */
  durationMs?: number;
}

/** Final stage: a copy of the summary counters when the query finished. */
export interface PlaneQueryTraceMetricsStage {
  kind: 'metrics';
  /** Counter snapshot (see {@link PlaneQueryTraceSummary}). */
  summary: Pick<
    PlaneQueryTraceSummary,
    | 'sampleCount'
    | 'scalarEvaluationCount'
    | 'cellCount'
    | 'segmentCount'
    | 'pathCount'
    | 'pointCount'
    | 'resultPathCount'
    | 'resultPointCount'
  >;
  /** Stage duration in milliseconds. Reserved; not currently populated. */
  durationMs?: number;
}

/** Any stage record in {@link PlaneQueryTrace}`.stages`, discriminated by `kind`. */
export type PlaneQueryTraceStage =
  | PlaneQueryTraceSolverStage
  | PlaneQueryTraceScalarGridStage
  | PlaneQueryTraceViewportStage
  | PlaneQueryTraceMarchingSquaresStage
  | PlaneQueryTracePathStage
  | PlaneQueryTraceMetricsStage;

/**
 * Diagnostic record of how a plane query was solved, returned by
 * `inspectPlaneQuery` / `inspectPlaneQueries` and by compute requests that set
 * `trace`.
 *
 * @example
 * ```ts
 * import { inspectPlaneQuery } from 'color-kit/plane';
 *
 * const { trace } = inspectPlaneQuery({ model: 'oklch', fixed: { h: 250 } }, { kind: 'gamutRegion', gamut: 'srgb' });
 *
 * trace.summary.solver; // → 'analytic-lc'
 * trace.summary.resultPointCount; // → 110
 * trace.stages.map((stage) => stage.kind);
 * // → ['solver', 'marchingSquares', 'viewportClassification', 'paths', 'paths', 'marchingSquares', 'paths', 'metrics']
 * ```
 */
export interface PlaneQueryTrace {
  /** Aggregate counters and metadata; always present. */
  summary: PlaneQueryTraceSummary;
  /** Ordered stage records; empty at `'summary'` level, ends with `metrics` otherwise. */
  stages: PlaneQueryTraceStage[];
}
