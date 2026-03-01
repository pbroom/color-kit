import {
  createPlaneComputeScheduler,
  createJsPlaneComputeBackend,
  getPackedPlaneQueryTransferables,
} from '@color-kit/core';
import type {
  PlaneComputeBackend,
  PlaneComputeRequest,
  PlaneComputeSchedulerOptions,
} from '@color-kit/core';
import type {
  PlaneQueryWorkerRequest,
  PlaneQueryWorkerResponse,
  PlaneQueryWorkerWasmInitState,
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
const FLOAT32_PARITY_TOLERANCE = 1e-4;
const SCHEDULER_OPTIONS: PlaneComputeSchedulerOptions = {
  preferredBackends: ['wasm', 'js'],
  minSamplesForDecision: 3,
  warmupSamples: 2,
  baselineProbeInterval: 8,
  dragRegressionRatio: 1.1,
  idleRegressionRatio: 1.25,
  hysteresisTrips: 3,
  circuitBreakerCooldownMs: 20_000,
};

let installedWasmBackend = resolveInstalledWasmBackend();
let scheduler = createWorkerScheduler(installedWasmBackend);
let wasmBootstrapPromise: Promise<void> | null = null;
const wasmInitState: PlaneQueryWorkerWasmInitState = installedWasmBackend
  ? {
      status: 'ready',
      attempted: true,
    }
  : {
      status: 'pending',
      attempted: false,
    };

function createWorkerScheduler(
  wasmBackend: PlaneComputeBackend | undefined,
): ReturnType<typeof createPlaneComputeScheduler> {
  return createPlaneComputeScheduler({
    backends: {
      js: jsBackend,
      wasm: wasmBackend,
    },
    options: SCHEDULER_OPTIONS,
  });
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

function shouldDisableAutoWasmBootstrap(): boolean {
  return Boolean(
    (
      globalThis as unknown as {
        __COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__?: boolean;
      }
    ).__COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__,
  );
}

function snapshotWasmInitState(): PlaneQueryWorkerWasmInitState {
  return {
    status: wasmInitState.status,
    attempted: wasmInitState.attempted,
    backendVersion: wasmInitState.backendVersion,
    error: wasmInitState.error,
  };
}

function compareNumericParity(
  jsValues: Float32Array,
  wasmValues: Float32Array,
  tolerance: number,
): {
  mismatchCount: number;
  maxAbsDelta: number;
  meanAbsDelta: number;
} {
  const compared = Math.min(jsValues.length, wasmValues.length);
  if (compared === 0) {
    return {
      mismatchCount: 0,
      maxAbsDelta: 0,
      meanAbsDelta: 0,
    };
  }
  let mismatchCount = 0;
  let maxAbsDelta = 0;
  let sumAbsDelta = 0;
  for (let index = 0; index < compared; index += 1) {
    const left = jsValues[index];
    const right = wasmValues[index];
    if (Number.isNaN(left) && Number.isNaN(right)) {
      continue;
    }
    const delta = Math.abs(left - right);
    sumAbsDelta += delta;
    if (delta > maxAbsDelta) {
      maxAbsDelta = delta;
    }
    if (delta > tolerance) {
      mismatchCount += 1;
    }
  }
  return {
    mismatchCount,
    maxAbsDelta,
    meanAbsDelta: sumAbsDelta / compared,
  };
}

async function bootstrapWasmBackendIfNeeded(): Promise<void> {
  if (wasmInitState.attempted) {
    return;
  }
  wasmInitState.attempted = true;
  wasmInitState.status = 'pending';
  wasmInitState.error = undefined;
  if (shouldDisableAutoWasmBootstrap()) {
    wasmInitState.status = 'unavailable';
    wasmInitState.error = 'auto bootstrap disabled';
    return;
  }
  try {
    const wasmModule = (await import('@color-kit/core-wasm')) as {
      loadWasmPlaneComputeBackend?: () => Promise<PlaneComputeBackend | null>;
      getLoadedWasmBackendVersion?: () => string | undefined;
    };
    if (typeof wasmModule.loadWasmPlaneComputeBackend !== 'function') {
      wasmInitState.status = 'unavailable';
      wasmInitState.error = 'core-wasm loader export is unavailable';
      return;
    }
    const loadedBackend = await wasmModule.loadWasmPlaneComputeBackend();
    if (!loadedBackend) {
      wasmInitState.status = 'unavailable';
      return;
    }
    installedWasmBackend = loadedBackend;
    scheduler = createWorkerScheduler(installedWasmBackend);
    wasmInitState.status = 'ready';
    if (typeof wasmModule.getLoadedWasmBackendVersion === 'function') {
      wasmInitState.backendVersion = wasmModule.getLoadedWasmBackendVersion();
    }
    (
      globalThis as unknown as {
        __COLOR_KIT_WASM_PLANE_BACKEND__?: PlaneComputeBackend;
      }
    ).__COLOR_KIT_WASM_PLANE_BACKEND__ = loadedBackend;
  } catch (error) {
    wasmInitState.status = 'error';
    wasmInitState.error =
      error instanceof Error ? error.message : String(error);
  }
}

async function ensureWasmBootstrap(): Promise<void> {
  if (!wasmBootstrapPromise) {
    wasmBootstrapPromise = bootstrapWasmBackendIfNeeded();
  }
  await wasmBootstrapPromise;
}

workerScope.onmessage = async (event): Promise<void> => {
  const payload = event.data;

  try {
    await ensureWasmBootstrap();

    const request: PlaneComputeRequest = {
      plane: payload.plane,
      queries: payload.queries,
      priority: payload.priority,
      quality: payload.quality,
      performanceProfile: payload.performanceProfile,
    };
    const response = scheduler.run(request);
    let wasmParity: PlaneQueryWorkerWasmParityResult | undefined;

    if (
      payload.wasmParityMode === 'shape' ||
      payload.wasmParityMode === 'numeric'
    ) {
      if (!installedWasmBackend) {
        wasmParity = {
          mode: payload.wasmParityMode,
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
          let parityStatus: PlaneQueryWorkerWasmParityResult['status'] =
            pathCountDelta === 0 && pointCountDelta === 0
              ? 'ok'
              : 'shape-mismatch';
          let numericMismatchCount: number | undefined;
          let maxAbsDelta: number | undefined;
          let meanAbsDelta: number | undefined;

          if (parityStatus === 'ok' && payload.wasmParityMode === 'numeric') {
            const pointXYParity = compareNumericParity(
              jsResponse.result.pointXY,
              wasmResponse.result.pointXY,
              FLOAT32_PARITY_TOLERANCE,
            );
            const pointLCParity = compareNumericParity(
              jsResponse.result.pointLC,
              wasmResponse.result.pointLC,
              FLOAT32_PARITY_TOLERANCE,
            );
            const pointColorParity = compareNumericParity(
              jsResponse.result.pointColorLcha,
              wasmResponse.result.pointColorLcha,
              FLOAT32_PARITY_TOLERANCE,
            );
            numericMismatchCount =
              pointXYParity.mismatchCount +
              pointLCParity.mismatchCount +
              pointColorParity.mismatchCount;
            maxAbsDelta = Math.max(
              pointXYParity.maxAbsDelta,
              pointLCParity.maxAbsDelta,
              pointColorParity.maxAbsDelta,
            );
            meanAbsDelta =
              (pointXYParity.meanAbsDelta +
                pointLCParity.meanAbsDelta +
                pointColorParity.meanAbsDelta) /
              3;
            if (numericMismatchCount > 0) {
              parityStatus = 'numeric-mismatch';
            }
          }

          wasmParity = {
            mode: payload.wasmParityMode,
            status: parityStatus,
            wasmAvailable: true,
            attempted: true,
            jsTotalTimeMs: jsResponse.computeTimeMs + jsResponse.marshalTimeMs,
            wasmTotalTimeMs:
              wasmResponse.computeTimeMs + wasmResponse.marshalTimeMs,
            pathCountDelta,
            pointCountDelta,
            numericTolerance:
              payload.wasmParityMode === 'numeric'
                ? FLOAT32_PARITY_TOLERANCE
                : undefined,
            numericMismatchCount,
            maxAbsDelta,
            meanAbsDelta,
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          wasmParity = {
            mode: payload.wasmParityMode,
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
        wasmInit: payload.includeWasmInitStatus
          ? snapshotWasmInitState()
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
