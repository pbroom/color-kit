import { createJsPlaneComputeBackend } from './backends/js-backend.js';
import type {
  PackedPlaneQueryResult,
  PlaneComputeBackend,
  PlaneComputeRequest,
  PlaneComputeResponse,
} from './types.js';

export { createJsPlaneComputeBackend } from './backends/js-backend.js';
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
  PlaneComputePerformanceProfile,
  PlaneComputePriority,
  PlaneComputeQuality,
  PlaneComputeRequest,
  PlaneComputeResponse,
} from './types.js';

const defaultPlaneComputeBackend = createJsPlaneComputeBackend();

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
