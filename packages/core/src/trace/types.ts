import type { ContrastHybridFallbackReason } from '../contrast/types.js';
import type { GamutTarget } from '../gamut/index.js';
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

export type PlaneComputeBackendKind = 'js' | 'webgpu';

export type PlaneComputeScheduleReason =
  | 'default-js'
  | 'baseline-probe'
  | 'warmup'
  | 'telemetry-win'
  | 'circuit-open'
  | 'unsupported-backend'
  | 'telemetry-regression'
  | 'backend-error';

export type PlaneViewportRelation = 'inside' | 'outside' | 'intersects';

export type PlaneGamutSolver =
  | 'domain-edge'
  | 'analytic-lc'
  | 'analytic-hc'
  | 'analytic-hct'
  | 'implicit-contour';

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
  solver?:
    | PlaneGamutSolver
    | 'contrast-hybrid'
    | 'contrast-legacy-uniform'
    | 'contrast-legacy-adaptive';
  fallbackReason?: ContrastHybridFallbackReason;
  samplingMode?: 'analytic' | 'uniform' | 'adaptive' | 'hybrid';
  viewportRelation?: PlaneViewportRelation;
  backend?: PlaneComputeBackendKind;
  bucketKey?: string;
  scheduleReason?: PlaneComputeScheduleReason;
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
      | 'cusp'
      | 'rootFinding'
      | 'refinement'
      | 'branching'
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

export interface PlaneQueryTraceCuspStage {
  kind: 'cusp';
  hue: number;
  lightness: number;
  chroma: number;
  gamut: GamutTarget;
  method: 'direct' | 'lut';
  durationMs?: number;
}

export interface PlaneQueryTraceHybridSample {
  lightness: number;
  maxChroma: number;
  roots: number[];
}

export interface PlaneQueryTraceHybridSamplesStage {
  kind: 'hybridSamples';
  label: 'seed' | 'refined';
  samples: PlaneQueryTraceHybridSample[];
  durationMs?: number;
}

export interface PlaneQueryTraceRootIteration {
  lo: number;
  hi: number;
  mid: number;
  value: number;
}

export interface PlaneQueryTraceRootStage {
  kind: 'rootBisection';
  lightness: number;
  loStart: number;
  hiStart: number;
  valueLoStart: number;
  valueHiStart: number;
  root: number;
  iterations?: PlaneQueryTraceRootIteration[];
  durationMs?: number;
}

export interface PlaneQueryTraceRefinementDecision {
  left: number;
  right: number;
  midpoint: number;
  depth: number;
  split: boolean;
}

export interface PlaneQueryTraceRefinementStage {
  kind: 'refinement';
  decisions: PlaneQueryTraceRefinementDecision[];
  durationMs?: number;
}

export interface PlaneQueryTraceBranchingStage {
  kind: 'branching';
  activeCount: number;
  finishedCount: number;
  pathCount: number;
  hasComplexTopology: boolean;
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
  | PlaneQueryTraceCuspStage
  | PlaneQueryTraceHybridSamplesStage
  | PlaneQueryTraceRootStage
  | PlaneQueryTraceRefinementStage
  | PlaneQueryTraceBranchingStage
  | PlaneQueryTraceMetricsStage;

export interface PlaneQueryTrace {
  summary: PlaneQueryTraceSummary;
  stages: PlaneQueryTraceStage[];
}
