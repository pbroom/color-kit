import {
  createPlaneComputeScheduler,
  createJsPlaneComputeBackend,
  getPackedPlaneQueryTransferables,
} from '@color-kit/core';
import type { PlaneComputeBackend } from '@color-kit/core';
import type {
  PlaneQueryWorkerRequest,
  PlaneQueryWorkerResponse,
} from './plane-query.worker.types.js';

interface MinimalWorkerScope {
  onmessage: ((event: MessageEvent<PlaneQueryWorkerRequest>) => void) | null;
  postMessage: (
    message: PlaneQueryWorkerResponse,
    transfer?: Transferable[],
  ) => void;
}

const workerScope = self as unknown as MinimalWorkerScope;
const jsBackend = createJsPlaneComputeBackend();
const scheduler = createPlaneComputeScheduler({
  backends: {
    js: jsBackend,
    wasm: resolveInstalledWasmBackend(),
  },
  options: {
    preferredBackends: ['wasm', 'js'],
    minSamplesForDecision: 3,
    warmupSamples: 2,
    baselineProbeInterval: 8,
    dragRegressionRatio: 1.1,
    idleRegressionRatio: 1.25,
    hysteresisTrips: 3,
    circuitBreakerCooldownMs: 20_000,
  },
});

function resolveInstalledWasmBackend(): PlaneComputeBackend | undefined {
  const maybeBackend = (
    globalThis as unknown as {
      __COLOR_KIT_WASM_PLANE_BACKEND__?: unknown;
    }
  ).__COLOR_KIT_WASM_PLANE_BACKEND__;
  if (
    maybeBackend &&
    typeof maybeBackend === 'object' &&
    'kind' in maybeBackend &&
    'run' in maybeBackend
  ) {
    return maybeBackend as PlaneComputeBackend;
  }
  return undefined;
}

workerScope.onmessage = (event): void => {
  const payload = event.data;

  try {
    const response = scheduler.run({
      plane: payload.plane,
      queries: payload.queries,
      priority: payload.priority,
      quality: payload.quality,
      performanceProfile: payload.performanceProfile,
    });

    workerScope.postMessage(
      {
        id: payload.id,
        backend: response.backend,
        result: response.result,
        computeTimeMs: response.computeTimeMs,
        marshalTimeMs: response.marshalTimeMs,
        schedule: response.schedule,
      },
      getPackedPlaneQueryTransferables(response.result),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    workerScope.postMessage({
      id: payload.id,
      error: message,
    });
  }
};

export {};
