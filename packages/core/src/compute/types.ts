import type { PackedPlaneQueryResult } from '../plane/packed-abi.js';
import type {
  PlaneDefinition,
  PlaneQuery,
  PlaneQueryResult,
  PlaneQueryTrace,
  PlaneQueryTraceOptions,
} from '../plane/types.js';
import type {
  PlaneComputeBackendKind,
  PlaneComputeScheduleReason,
} from '../trace/types.js';

export type {
  PlaneComputeBackendKind,
  PlaneComputeScheduleReason,
} from '../trace/types.js';
export type {
  PackedPlaneQueryDescriptor,
  PackedPlaneQueryResult,
} from '../plane/packed-abi.js';
export type PlaneComputePriority = 'drag' | 'idle';
export type PlaneComputeQuality = 'high' | 'medium' | 'low';
export type PlaneComputePerformanceProfile =
  | 'auto'
  | 'quality'
  | 'balanced'
  | 'performance';

export interface PlaneComputeRequest {
  plane: PlaneDefinition;
  queries: PlaneQuery[];
  priority?: PlaneComputePriority;
  quality?: PlaneComputeQuality;
  performanceProfile?: PlaneComputePerformanceProfile;
  trace?: PlaneQueryTraceOptions;
}

export interface PlaneComputeScheduleTrace {
  bucketKey: string;
  selectedBackend: PlaneComputeBackendKind;
  reason: PlaneComputeScheduleReason;
}

export interface PlaneComputeResponse {
  backend: PlaneComputeBackendKind;
  computeTimeMs: number;
  marshalTimeMs: number;
  result: PackedPlaneQueryResult;
  schedule?: PlaneComputeScheduleTrace;
  debugTrace?: PlaneComputeDebugTrace;
}

export interface PlaneComputeBackend {
  kind: PlaneComputeBackendKind;
  supportsRequest?: (request: PlaneComputeRequest) => boolean;
  run: (request: PlaneComputeRequest) => PlaneComputeResponse;
}

export interface PlaneComputePackResult {
  packed: PackedPlaneQueryResult;
  raw: PlaneQueryResult[];
}

export interface PlaneComputeDebugTrace {
  queries: PlaneQueryTrace[];
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
