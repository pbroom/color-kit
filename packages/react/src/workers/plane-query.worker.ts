import {
  createPlaneComputeScheduler,
  createJsPlaneComputeBackend,
  getPackedPlaneQueryTransferables,
} from '@color-kit/core';
import type {
  PlaneComputeBackend,
  PlaneComputeRequest,
  PlaneComputeResponse,
} from '@color-kit/core';
import type {
  PlaneQueryWorkerRequest,
  PlaneQueryWorkerResponse,
  PlaneQueryWorkerWasmParityResult,
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
const installedWasmBackend = resolveInstalledWasmBackend();
const scheduler = createPlaneComputeScheduler({
  backends: {
    js: jsBackend,
    wasm: installedWasmBackend,
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

const FLOAT32_PARITY_EPSILON = 1e-4;

function uint32ArraysEqual(a: Uint32Array, b: Uint32Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

function float32ArraysEqualWithinEpsilon(
  a: Float32Array,
  b: Float32Array,
  epsilon: number = FLOAT32_PARITY_EPSILON,
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (Math.abs(a[index] - b[index]) > epsilon) {
      return false;
    }
  }
  return true;
}

function packedResultsShapeMatch(
  jsResponse: PlaneComputeResponse,
  wasmResponse: PlaneComputeResponse,
): boolean {
  return (
    uint32ArraysEqual(jsResponse.result.pathRanges, wasmResponse.result.pathRanges) &&
    float32ArraysEqualWithinEpsilon(
      jsResponse.result.pointXY,
      wasmResponse.result.pointXY,
    ) &&
    float32ArraysEqualWithinEpsilon(
      jsResponse.result.pointLC,
      wasmResponse.result.pointLC,
    ) &&
    float32ArraysEqualWithinEpsilon(
      jsResponse.result.pointColorLcha,
      wasmResponse.result.pointColorLcha,
    )
  );
}

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
    const request: PlaneComputeRequest = {
      plane: payload.plane,
      queries: payload.queries,
      priority: payload.priority,
      quality: payload.quality,
      performanceProfile: payload.performanceProfile,
    };
    const response = scheduler.run(request);
    let wasmParity: PlaneQueryWorkerWasmParityResult | undefined;

    if (payload.wasmParityMode === 'shape') {
      if (!installedWasmBackend) {
        wasmParity = {
          mode: 'shape',
          status: 'no-wasm',
          wasmAvailable: false,
          attempted: false,
        };
      } else {
        try {
          const jsResponse =
            response.backend === 'js' ? response : jsBackend.run(request);
          const wasmResponse =
            response.backend === 'wasm'
              ? response
              : installedWasmBackend.run(request);
          const jsPathCount = Math.floor(
            jsResponse.result.pathRanges.length / 2,
          );
          const wasmPathCount = Math.floor(
            wasmResponse.result.pathRanges.length / 2,
          );
          const jsPointCount = Math.floor(jsResponse.result.pointXY.length / 2);
          const wasmPointCount = Math.floor(
            wasmResponse.result.pointXY.length / 2,
          );
          const pathCountDelta = Math.abs(jsPathCount - wasmPathCount);
          const pointCountDelta = Math.abs(jsPointCount - wasmPointCount);
          const shapeMatches =
            pathCountDelta === 0 &&
            pointCountDelta === 0 &&
            packedResultsShapeMatch(jsResponse, wasmResponse);

          wasmParity = {
            mode: 'shape',
            status: shapeMatches ? 'ok' : 'shape-mismatch',
            wasmAvailable: true,
            attempted: true,
            jsTotalTimeMs: jsResponse.computeTimeMs + jsResponse.marshalTimeMs,
            wasmTotalTimeMs:
              wasmResponse.computeTimeMs + wasmResponse.marshalTimeMs,
            pathCountDelta,
            pointCountDelta,
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          wasmParity = {
            mode: 'shape',
            status: 'error',
            wasmAvailable: true,
            attempted: true,
            error: message,
          };
        }
      }
    }

    workerScope.postMessage(
      {
        id: payload.id,
        backend: response.backend,
        result: response.result,
        computeTimeMs: response.computeTimeMs,
        marshalTimeMs: response.marshalTimeMs,
        schedule: response.schedule,
        schedulerTelemetry: payload.includeSchedulerTelemetry
          ? scheduler.getTelemetrySnapshot()
          : undefined,
        wasmParity,
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
