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

/**
 * Runs a batch of plane queries on a backend and returns packed results with
 * timings.
 *
 * Runs synchronously on the calling thread; call it from a worker to keep
 * heavy queries off the main thread, then post `response.result` back with
 * {@link getPackedPlaneQueryTransferables}. No telemetry is recorded; use
 * {@link runScheduledPlaneCompute} for that.
 *
 * @param request - Plane, queries and optional trace options.
 * @param backend - Backend to run on. Defaults to a shared JS backend created
 * on first use.
 * @returns Packed results, the backend kind, compute/marshal times, and
 * `debugTrace` when `request.trace` is set.
 * @throws {Error} When a query result contains non-finite values (see
 * {@link packPlaneQueryResults}).
 * @see {@link runPackedPlaneQueries}
 * @example
 * ```ts
 * import { runPlaneCompute } from 'color-kit/compute';
 *
 * const response = runPlaneCompute({
 *   plane: { model: 'oklch', fixed: { h: 250 } },
 *   queries: [{ kind: 'gamutRegion', gamut: 'srgb' }],
 * });
 *
 * response.backend; // → 'js'
 * response.result.queryDescriptors.map((d) => d.kind); // → ['gamutRegion']
 * response.debugTrace; // → undefined (set `trace` on the request to get one)
 * ```
 */
export function runPlaneCompute(
  request: PlaneComputeRequest,
  backend: PlaneComputeBackend = getDefaultPlaneComputeBackend(),
): PlaneComputeResponse {
  return backend.run(request);
}

/**
 * Runs a batch of plane queries and returns only the packed results.
 *
 * Shorthand for `runPlaneCompute(request, backend).result`.
 *
 * @param request - Plane, queries and optional trace options.
 * @param backend - Backend to run on. Defaults to the shared JS backend.
 * @returns Packed results; decode with {@link unpackPlaneQueryResults}.
 * @example
 * ```ts
 * import { runPackedPlaneQueries } from 'color-kit/compute';
 *
 * const packed = runPackedPlaneQueries({
 *   plane: { model: 'oklch', fixed: { h: 250 } },
 *   queries: [{ kind: 'gamutRegion', gamut: 'srgb' }],
 * });
 *
 * // [start, count] per path: a 16-point boundary, then a 94-point visible region.
 * packed.pathRanges; // → Uint32Array [0, 16, 16, 94]
 * ```
 */
export function runPackedPlaneQueries(
  request: PlaneComputeRequest,
  backend?: PlaneComputeBackend,
): PackedPlaneQueryResult {
  return runPlaneCompute(request, backend).result;
}

/**
 * Runs a batch of plane queries through a scheduler, which records timing
 * telemetry and adds routing details to the response.
 *
 * @param request - Plane, queries, hints and optional trace options.
 * @param scheduler - Scheduler to use. Defaults to a shared scheduler (created
 * on first use) whose telemetry {@link getDefaultPlaneComputeTelemetrySnapshot}
 * reads.
 * @returns The response, including `schedule`.
 * @see {@link createPlaneComputeScheduler}
 * @example
 * ```ts
 * import { runScheduledPlaneCompute } from 'color-kit/compute';
 *
 * const response = runScheduledPlaneCompute({
 *   plane: { model: 'oklch', fixed: { h: 250 } },
 *   queries: [{ kind: 'gamutRegion', gamut: 'srgb' }],
 * });
 *
 * response.schedule?.selectedBackend; // → 'js'
 * response.schedule?.reason; // → 'default-js'
 * ```
 */
export function runScheduledPlaneCompute(
  request: PlaneComputeRequest,
  scheduler: PlaneComputeScheduler = getDefaultPlaneComputeScheduler(),
): PlaneComputeResponse {
  return scheduler.run(request);
}

/**
 * Returns a copy of the shared default scheduler's telemetry, recorded by
 * {@link runScheduledPlaneCompute} calls that use the default scheduler.
 *
 * Each bucket groups runs of the same workload shape and counts them; timing
 * fields (`averageTotalMs`, `lastTotalMs`) vary from run to run.
 *
 * @returns Buckets, most recently used first.
 * @see {@link resetDefaultPlaneComputeTelemetry}
 * @example
 * ```ts
 * import {
 *   getDefaultPlaneComputeTelemetrySnapshot,
 *   resetDefaultPlaneComputeTelemetry,
 *   runScheduledPlaneCompute,
 *   type PlaneComputeRequest,
 * } from 'color-kit/compute';
 *
 * resetDefaultPlaneComputeTelemetry();
 * const request: PlaneComputeRequest = {
 *   plane: { model: 'oklch', fixed: { h: 250 } },
 *   queries: [{ kind: 'gamutRegion', gamut: 'srgb' }],
 * };
 * runScheduledPlaneCompute(request);
 * runScheduledPlaneCompute(request);
 * const { buckets } = getDefaultPlaneComputeTelemetrySnapshot();
 *
 * buckets.length; // → 1
 * buckets[0].totalSamples; // → 2
 * buckets[0].backends.js?.sampleCount; // → 2
 * ```
 */
export function getDefaultPlaneComputeTelemetrySnapshot() {
  return getDefaultPlaneComputeScheduler().getTelemetrySnapshot();
}

/**
 * Clears all telemetry held by the shared default scheduler.
 *
 * @example
 * ```ts
 * import {
 *   getDefaultPlaneComputeTelemetrySnapshot,
 *   resetDefaultPlaneComputeTelemetry,
 *   runScheduledPlaneCompute,
 * } from 'color-kit/compute';
 *
 * runScheduledPlaneCompute({
 *   plane: { model: 'oklch', fixed: { h: 250 } },
 *   queries: [{ kind: 'gamutRegion', gamut: 'srgb' }],
 * });
 * resetDefaultPlaneComputeTelemetry();
 *
 * getDefaultPlaneComputeTelemetrySnapshot().buckets.length; // → 0
 * ```
 */
export function resetDefaultPlaneComputeTelemetry(): void {
  getDefaultPlaneComputeScheduler().resetTelemetry();
}
