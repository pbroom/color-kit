import type { PlaneDefinition, PlaneQuery } from '@color-kit/core';
import type {
  PackedPlaneQueryResult,
  PlaneComputeBackendKind,
  PlaneComputePerformanceProfile,
  PlaneComputePriority,
  PlaneComputeQuality,
  PlaneComputeScheduleTrace,
  PlaneComputeTelemetrySnapshot,
} from '@color-kit/core/compute';

export interface PlaneQueryWorkerRequest {
  id: number;
  plane: PlaneDefinition;
  queries: PlaneQuery[];
  priority?: PlaneComputePriority;
  quality?: PlaneComputeQuality;
  performanceProfile?: PlaneComputePerformanceProfile;
  includeSchedulerTelemetry?: boolean;
}

export interface PlaneQueryWorkerResponse {
  id: number;
  backend?: PlaneComputeBackendKind;
  result?: PackedPlaneQueryResult;
  computeTimeMs?: number;
  marshalTimeMs?: number;
  schedule?: PlaneComputeScheduleTrace;
  schedulerTelemetry?: PlaneComputeTelemetrySnapshot;
  error?: string;
}
