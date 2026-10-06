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

export type PlaneViewportRelation = 'inside' | 'outside' | 'intersects';

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

export type PlaneGamutRegionScope = 'viewport' | 'full';

export type PlaneQueryTraceLevel = 'summary' | 'stages' | 'full';

export interface PlaneQueryTraceOptions {
  level?: PlaneQueryTraceLevel;
  maxStageEntries?: number;
  includeScalarGrid?: boolean;
}

export interface PlaneTraceBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PlaneQueryTraceSummary {
  queryKind: PlaneQueryKind;
  level: PlaneQueryTraceLevel;
  totalTimeMs: number;
  sampleCount: number;
  scalarEvaluationCount: number;
  cellCount: number;
  segmentCount: number;
  pathCount: number;
  pointCount: number;
  resultPathCount: number;
  resultPointCount: number;
  solver?: PlaneGamutSolver | PlaneContrastSolver;
  samplingMode?: 'analytic' | 'uniform' | 'adaptive';
  viewportRelation?: PlaneViewportRelation;
  backend?: PlaneComputeBackendKind;
  bucketKey?: string;
  scheduleReason?: PlaneComputeScheduleReason;
  /**
   * Contrast queries: contour pieces the solver dropped because no end point
   * passed the public checks (0 unless something is badly wrong).
   */
  droppedPieceCount?: number;
  fidelity?: {
    simplifyTolerance?: number;
    resolution?: number;
    steps?: number;
    maxDepth?: number;
    errorTolerance?: number;
  };
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

export interface PlaneQueryTraceSolverStage {
  kind: 'solver';
  solver: PlaneQueryTraceSummary['solver'];
  samplingMode?: PlaneQueryTraceSummary['samplingMode'];
  viewportRelation?: PlaneViewportRelation;
  scope?: PlaneGamutRegionScope;
  durationMs?: number;
}

export interface PlaneQueryTraceScalarGridStage {
  kind: 'scalarGrid';
  label: string;
  bounds: PlaneTraceBounds;
  resolution: number;
  sampleCount: number;
  minValue: number;
  maxValue: number;
  values?: number[][];
  durationMs?: number;
}

export interface PlaneQueryTraceViewportStage {
  kind: 'viewportClassification';
  relation: PlaneViewportRelation;
  minValue: number;
  maxValue: number;
  durationMs?: number;
}

export interface PlaneQueryTraceCellEvent {
  xIndex: number;
  yIndex: number;
  mask: number;
  points: PlanePoint[];
}

export interface PlaneQueryTraceMarchingSquaresStage {
  kind: 'marchingSquares';
  label: string;
  resolution: number;
  cellCount: number;
  segmentCount: number;
  cells?: PlaneQueryTraceCellEvent[];
  durationMs?: number;
}

export interface PlaneQueryTracePathStage {
  kind: 'paths';
  label: string;
  pathCount: number;
  pointCount: number;
  paths?: PlanePoint[][];
  durationMs?: number;
}

export interface PlaneQueryTraceMetricsStage {
  kind: 'metrics';
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
  durationMs?: number;
}

export type PlaneQueryTraceStage =
  | PlaneQueryTraceSolverStage
  | PlaneQueryTraceScalarGridStage
  | PlaneQueryTraceViewportStage
  | PlaneQueryTraceMarchingSquaresStage
  | PlaneQueryTracePathStage
  | PlaneQueryTraceMetricsStage;

export interface PlaneQueryTrace {
  summary: PlaneQueryTraceSummary;
  stages: PlaneQueryTraceStage[];
}
