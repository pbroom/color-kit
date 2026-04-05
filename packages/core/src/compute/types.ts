import type { GamutTarget } from '../gamut/index.js';
import type {
  PlaneDefinition,
  PlaneGamutRegionScope,
  PlaneGamutSolver,
  PlaneQuery,
  PlaneQueryResult,
  PlaneViewportRelation,
} from '../plane/types.js';

export type PlaneComputeBackendKind = 'js' | 'wasm' | 'webgpu';
export type PlaneComputePriority = 'drag' | 'idle';
export type PlaneComputeQuality = 'high' | 'medium' | 'low';
export type PlaneComputePerformanceProfile =
  | 'auto'
  | 'quality'
  | 'balanced'
  | 'performance';

export interface PackedPlaneQueryDescriptor {
  kind: PlaneQuery['kind'];
  pathStart: number;
  pathCount: number;
  regionPathStart?: number;
  regionPathCount?: number;
  hue?: number;
  gamut?: GamutTarget;
  scope?: PlaneGamutRegionScope;
  solver?: PlaneGamutSolver;
  viewportRelation?: PlaneViewportRelation;
}

/**
 * Transfer-friendly packed representation of batched plane query output.
 *
 * `pathRanges` contains `[startPoint, pointCount]` tuples.
 * `pointXY` contains `[x0, y0, x1, y1, ...]`.
 * `pointLC` contains `[l0, c0, l1, c1, ...]` (NaN when unavailable).
 * `pointColorLcha` contains `[l0, c0, h0, a0, ...]` (NaN when unavailable).
 */
export interface PackedPlaneQueryResult {
  queryDescriptors: PackedPlaneQueryDescriptor[];
  pathRanges: Uint32Array;
  pointXY: Float32Array;
  pointLC: Float32Array;
  pointColorLcha: Float32Array;
}

export interface PlaneComputeRequest {
  plane: PlaneDefinition;
  queries: PlaneQuery[];
  priority?: PlaneComputePriority;
  quality?: PlaneComputeQuality;
  performanceProfile?: PlaneComputePerformanceProfile;
}

export interface PlaneComputeScheduleTrace {
  bucketKey: string;
  selectedBackend: PlaneComputeBackendKind;
  reason:
    | 'default-js'
    | 'baseline-probe'
    | 'warmup'
    | 'telemetry-win'
    | 'circuit-open'
    | 'telemetry-regression'
    | 'backend-error';
}

export interface PlaneComputeResponse {
  backend: PlaneComputeBackendKind;
  computeTimeMs: number;
  marshalTimeMs: number;
  result: PackedPlaneQueryResult;
  schedule?: PlaneComputeScheduleTrace;
}

export interface PlaneComputeBackend {
  kind: PlaneComputeBackendKind;
  run: (request: PlaneComputeRequest) => PlaneComputeResponse;
}

export interface PlaneComputePackResult {
  packed: PackedPlaneQueryResult;
  raw: PlaneQueryResult[];
}

export interface PlaneComputeSchedulerOptions {
  preferredBackends?: PlaneComputeBackendKind[];
  minSamplesForDecision?: number;
  warmupSamples?: number;
  baselineProbeInterval?: number;
  ewmaAlpha?: number;
  dragRegressionRatio?: number;
  idleRegressionRatio?: number;
  hysteresisTrips?: number;
  circuitBreakerCooldownMs?: number;
  backendErrorTripCount?: number;
  maxTelemetryBuckets?: number;
}

export interface PlaneComputeTelemetryBackendStats {
  sampleCount: number;
  averageTotalMs: number;
  lastTotalMs: number;
}

export interface PlaneComputeTelemetryBucket {
  key: string;
  totalSamples: number;
  lastUsedBackend?: PlaneComputeBackendKind;
  backends: Partial<
    Record<PlaneComputeBackendKind, PlaneComputeTelemetryBackendStats>
  >;
}

export interface PlaneComputeCircuitBreakerState {
  disabledUntilMs: number;
  regressionStreak: number;
  errorStreak: number;
}

export interface PlaneComputeTelemetrySnapshot {
  buckets: PlaneComputeTelemetryBucket[];
  circuitBreakers: Partial<
    Record<PlaneComputeBackendKind, PlaneComputeCircuitBreakerState>
  >;
}

export interface PlaneComputeScheduler {
  run: (request: PlaneComputeRequest) => PlaneComputeResponse;
  getTelemetrySnapshot: () => PlaneComputeTelemetrySnapshot;
  resetTelemetry: () => void;
}
