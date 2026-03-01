import type {
  PackedPlaneQueryResult,
  PlaneComputeBackendKind,
  PlaneComputePerformanceProfile,
  PlaneComputePriority,
  PlaneComputeQuality,
  PlaneDefinition,
  PlaneQuery,
} from '@color-kit/core';

export interface PlaneQueryWorkerRequest {
  id: number;
  plane: PlaneDefinition;
  queries: PlaneQuery[];
  priority?: PlaneComputePriority;
  quality?: PlaneComputeQuality;
  performanceProfile?: PlaneComputePerformanceProfile;
}

export interface PlaneQueryWorkerResponse {
  id: number;
  backend?: PlaneComputeBackendKind;
  result?: PackedPlaneQueryResult;
  computeTimeMs?: number;
  marshalTimeMs?: number;
  error?: string;
}
