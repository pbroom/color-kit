import type {
  PackedPlaneQueryResult,
  PlaneComputeBackendKind,
  PlaneComputePerformanceProfile,
  PlaneComputePriority,
  PlaneComputeQuality,
  PlaneComputeScheduleTrace,
  PlaneComputeTelemetrySnapshot,
  PlaneDefinition,
  PlaneQuery,
} from '@color-kit/core';

export type PlaneQueryWorkerWasmParityMode = 'off' | 'shape' | 'numeric';
export type PlaneQueryWorkerWasmInitStatus =
  | 'pending'
  | 'ready'
  | 'unavailable'
  | 'error';

export interface PlaneQueryWorkerWasmInitState {
  status: PlaneQueryWorkerWasmInitStatus;
  attempted: boolean;
  backendVersion?: string;
  error?: string;
}

export interface PlaneQueryWorkerWasmParityResult {
  mode: Exclude<PlaneQueryWorkerWasmParityMode, 'off'>;
  status: 'ok' | 'shape-mismatch' | 'numeric-mismatch' | 'no-wasm' | 'error';
  wasmAvailable: boolean;
  attempted: boolean;
  jsTotalTimeMs?: number;
  wasmTotalTimeMs?: number;
  pathCountDelta?: number;
  pointCountDelta?: number;
  numericTolerance?: number;
  numericMismatchCount?: number;
  maxAbsDelta?: number;
  meanAbsDelta?: number;
  error?: string;
}

export interface PlaneQueryWorkerRequest {
  id: number;
  plane: PlaneDefinition;
  queries: PlaneQuery[];
  priority?: PlaneComputePriority;
  quality?: PlaneComputeQuality;
  performanceProfile?: PlaneComputePerformanceProfile;
  includeSchedulerTelemetry?: boolean;
  includeWasmInitStatus?: boolean;
  wasmParityMode?: PlaneQueryWorkerWasmParityMode;
}

export interface PlaneQueryWorkerResponse {
  id: number;
  backend?: PlaneComputeBackendKind;
  result?: PackedPlaneQueryResult;
  computeTimeMs?: number;
  marshalTimeMs?: number;
  schedule?: PlaneComputeScheduleTrace;
  schedulerTelemetry?: PlaneComputeTelemetrySnapshot;
  wasmInit?: PlaneQueryWorkerWasmInitState;
  wasmParity?: PlaneQueryWorkerWasmParityResult;
  error?: string;
}
