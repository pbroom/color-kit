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

export type PlaneQueryWorkerWasmParityMode = 'off' | 'shape';

export interface PlaneQueryWorkerWasmParityResult {
  mode: Exclude<PlaneQueryWorkerWasmParityMode, 'off'>;
  status: 'ok' | 'shape-mismatch' | 'no-wasm' | 'error';
  wasmAvailable: boolean;
  attempted: boolean;
  jsTotalTimeMs?: number;
  wasmTotalTimeMs?: number;
  pathCountDelta?: number;
  pointCountDelta?: number;
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
  wasmParity?: PlaneQueryWorkerWasmParityResult;
  error?: string;
}
