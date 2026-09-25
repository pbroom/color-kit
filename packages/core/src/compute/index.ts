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

// The default backend and scheduler are created lazily on first use so that
// importing this module (or the root barrel) does no work at import time and
// bundlers can drop the compute engine when it is never called.
let defaultPlaneComputeBackend: PlaneComputeBackend | undefined;
let defaultPlaneComputeScheduler: PlaneComputeScheduler | undefined;

function getDefaultPlaneComputeBackend(): PlaneComputeBackend {
  defaultPlaneComputeBackend ??= createJsPlaneComputeBackend();
  return defaultPlaneComputeBackend;
}

function getDefaultPlaneComputeScheduler(): PlaneComputeScheduler {
  defaultPlaneComputeScheduler ??= createPlaneComputeScheduler({
    backends: {
      js: getDefaultPlaneComputeBackend(),
    },
  });
  return defaultPlaneComputeScheduler;
}

export function runPlaneCompute(
  request: PlaneComputeRequest,
  backend: PlaneComputeBackend = getDefaultPlaneComputeBackend(),
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
  scheduler: PlaneComputeScheduler = getDefaultPlaneComputeScheduler(),
): PlaneComputeResponse {
  return scheduler.run(request);
}

export function getDefaultPlaneComputeTelemetrySnapshot() {
  return getDefaultPlaneComputeScheduler().getTelemetrySnapshot();
}

export function resetDefaultPlaneComputeTelemetry(): void {
  getDefaultPlaneComputeScheduler().resetTelemetry();
}
