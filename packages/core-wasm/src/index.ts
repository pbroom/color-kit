import {
  createJsPlaneComputeBackend,
  createPlaneComputeScheduler,
  type PlaneComputeBackend,
  type PlaneComputeRequest,
  type PlaneComputeResponse,
  type PlaneComputeScheduler,
  type PlaneComputeSchedulerOptions,
} from '@color-kit/core';

export type WasmPlaneComputeBackendFactory = () => PlaneComputeBackend | null;

interface WasmBackendGlobal {
  __COLOR_KIT_WASM_PLANE_BACKEND__?: PlaneComputeBackend;
}

let registeredWasmBackendFactory: WasmPlaneComputeBackendFactory | null = null;
let defaultWasmAwareScheduler: PlaneComputeScheduler | null = null;

function getDefaultWasmAwareScheduler(): PlaneComputeScheduler {
  if (!defaultWasmAwareScheduler) {
    defaultWasmAwareScheduler = createWasmAwarePlaneComputeScheduler();
  }
  return defaultWasmAwareScheduler;
}

export function registerWasmPlaneComputeBackendFactory(
  factory: WasmPlaneComputeBackendFactory,
): void {
  registeredWasmBackendFactory = factory;
  defaultWasmAwareScheduler = null;
}

export function clearWasmPlaneComputeBackendFactory(): void {
  registeredWasmBackendFactory = null;
  defaultWasmAwareScheduler = null;
}

export function getRegisteredWasmPlaneComputeBackend(): PlaneComputeBackend | null {
  if (!registeredWasmBackendFactory) {
    return null;
  }
  try {
    return registeredWasmBackendFactory();
  } catch {
    return null;
  }
}

export function installWasmPlaneComputeBackendOnGlobal(
  backend: PlaneComputeBackend | null,
  target: typeof globalThis = globalThis,
): void {
  const targetWithBackend = target as unknown as WasmBackendGlobal;
  if (backend) {
    targetWithBackend.__COLOR_KIT_WASM_PLANE_BACKEND__ = backend;
    return;
  }
  delete targetWithBackend.__COLOR_KIT_WASM_PLANE_BACKEND__;
}

export function installRegisteredWasmPlaneComputeBackendOnGlobal(
  target: typeof globalThis = globalThis,
): PlaneComputeBackend | null {
  const backend = getRegisteredWasmPlaneComputeBackend();
  installWasmPlaneComputeBackendOnGlobal(backend, target);
  return backend;
}

export function createWasmAwarePlaneComputeScheduler(
  options?: PlaneComputeSchedulerOptions,
): PlaneComputeScheduler {
  const jsBackend = createJsPlaneComputeBackend();
  const wasmBackend = getRegisteredWasmPlaneComputeBackend();
  return createPlaneComputeScheduler({
    backends: {
      js: jsBackend,
      wasm: wasmBackend ?? undefined,
    },
    options,
  });
}

export function runWasmAwarePlaneCompute(
  request: PlaneComputeRequest,
  scheduler?: PlaneComputeScheduler,
): PlaneComputeResponse {
  return (scheduler ?? getDefaultWasmAwareScheduler()).run(request);
}
