import { createJsPlaneComputeBackend } from './backends/js-backend.js';
import { createPlaneComputeScheduler } from './scheduler.js';
import type {
  PackedPlaneQueryResult,
  PlaneComputeBackend,
  PlaneComputeRequest,
  PlaneComputeResponse,
  PlaneComputeScheduler,
} from './types.js';

export { createJsPlaneComputeBackend } from './backends/js-backend.js';
export { createPlaneComputeScheduler } from './scheduler.js';
export {
  getPackedPlaneQueryTransferables,
  packPlaneQueryResults,
} from './pack.js';
export { unpackPlaneQueryResults } from './unpack.js';
export type {
  PackedPlaneQueryDescriptor,
  PackedPlaneQueryResult,
  PlaneComputeBackend,
  PlaneComputeBackendKind,
  PlaneComputeDebugTrace,
  PlaneComputeCircuitBreakerState,
  PlaneComputePerformanceProfile,
  PlaneComputePriority,
  PlaneComputeQuality,
  PlaneComputeRequest,
  PlaneComputeResponse,
  PlaneComputeScheduleTrace,
  PlaneComputeScheduler,
  PlaneComputeSchedulerOptions,
  PlaneComputeTelemetryBackendStats,
  PlaneComputeTelemetryBucket,
  PlaneComputeTelemetrySnapshot,
} from './types.js';

const defaultPlaneComputeBackend = createJsPlaneComputeBackend();
const defaultPlaneComputeScheduler = createPlaneComputeScheduler({
  backends: {
    js: defaultPlaneComputeBackend,
  },
});

export function runPlaneCompute(
  request: PlaneComputeRequest,
  backend: PlaneComputeBackend = defaultPlaneComputeBackend,
): PlaneComputeResponse {
  return backend.run(request);
}

export function runPackedPlaneQueries(
  request: PlaneComputeRequest,
  backend?: PlaneComputeBackend,
): PackedPlaneQueryResult {
  return runPlaneCompute(request, backend).result;
}

export function runScheduledPlaneCompute(
  request: PlaneComputeRequest,
  scheduler: PlaneComputeScheduler = defaultPlaneComputeScheduler,
): PlaneComputeResponse {
  return scheduler.run(request);
}

export function getDefaultPlaneComputeTelemetrySnapshot() {
  return defaultPlaneComputeScheduler.getTelemetrySnapshot();
}

export function resetDefaultPlaneComputeTelemetry(): void {
  defaultPlaneComputeScheduler.resetTelemetry();
}
