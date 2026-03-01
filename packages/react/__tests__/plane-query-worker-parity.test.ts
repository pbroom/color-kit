import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createJsPlaneComputeBackend,
  type PlaneComputeBackend,
  type PlaneComputeRequest,
  type PlaneComputeResponse,
} from '@color-kit/core';
import type {
  PlaneQueryWorkerRequest,
  PlaneQueryWorkerResponse,
} from '../src/workers/plane-query.worker.types.js';
import { evaluateWasmParityGate } from '../src/workers/wasm-parity-gate.js';

interface WorkerHarnessScope {
  onmessage:
    | ((event: MessageEvent<PlaneQueryWorkerRequest>) => void | Promise<void>)
    | null;
  postMessage: (
    message: PlaneQueryWorkerResponse,
    transfer?: Transferable[],
  ) => void;
}

function createWorkerRequest(
  wasmParityMode: PlaneQueryWorkerRequest['wasmParityMode'] = 'shape',
): PlaneQueryWorkerRequest {
  return {
    id: 1,
    plane: {
      model: 'oklch',
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, 0.4] },
      fixed: { h: 230, alpha: 1 },
    },
    queries: [
      {
        kind: 'gamutBoundary',
        gamut: 'srgb',
        hue: 230,
        samplingMode: 'adaptive',
        steps: 24,
      },
    ],
    priority: 'drag',
    quality: 'high',
    performanceProfile: 'balanced',
    includeSchedulerTelemetry: true,
    includeWasmInitStatus: true,
    wasmParityMode,
  };
}

function createParityOkWasmBackend(): PlaneComputeBackend {
  const jsBackend = createJsPlaneComputeBackend();
  return {
    kind: 'wasm',
    run(request: PlaneComputeRequest): PlaneComputeResponse {
      const response = jsBackend.run(request);
      return {
        ...response,
        backend: 'wasm',
      };
    },
  };
}

function createParityMismatchWasmBackend(): PlaneComputeBackend {
  const jsBackend = createJsPlaneComputeBackend();
  return {
    kind: 'wasm',
    run(request: PlaneComputeRequest): PlaneComputeResponse {
      const response = jsBackend.run(request);
      return {
        ...response,
        backend: 'wasm',
        result: {
          ...response.result,
          pointXY:
            response.result.pointXY.length > 2
              ? response.result.pointXY.slice(0, -2)
              : new Float32Array(0),
          pointLC:
            response.result.pointLC.length > 2
              ? response.result.pointLC.slice(0, -2)
              : new Float32Array(0),
          pointColorLcha:
            response.result.pointColorLcha.length > 4
              ? response.result.pointColorLcha.slice(0, -4)
              : new Float32Array(0),
        },
      };
    },
  };
}

function createParityNumericMismatchWasmBackend(): PlaneComputeBackend {
  const jsBackend = createJsPlaneComputeBackend();
  return {
    kind: 'wasm',
    run(request: PlaneComputeRequest): PlaneComputeResponse {
      const response = jsBackend.run(request);
      const pointXY = response.result.pointXY.slice();
      if (pointXY.length > 0) {
        pointXY[0] += 0.001;
      }
      return {
        ...response,
        backend: 'wasm',
        result: {
          ...response.result,
          pointXY,
        },
      };
    },
  };
}

function createParityNumericLengthMismatchWasmBackend(): PlaneComputeBackend {
  const jsBackend = createJsPlaneComputeBackend();
  return {
    kind: 'wasm',
    run(request: PlaneComputeRequest): PlaneComputeResponse {
      const response = jsBackend.run(request);
      const pointLC =
        response.result.pointLC.length > 0
          ? response.result.pointLC.slice(0, -1)
          : response.result.pointLC;
      return {
        ...response,
        backend: 'wasm',
        result: {
          ...response.result,
          pointLC,
        },
      };
    },
  };
}

function createParityNumericNaNMismatchWasmBackend(): PlaneComputeBackend {
  const jsBackend = createJsPlaneComputeBackend();
  return {
    kind: 'wasm',
    run(request: PlaneComputeRequest): PlaneComputeResponse {
      const response = jsBackend.run(request);
      const pointLC = response.result.pointLC.slice();
      if (pointLC.length > 0) {
        pointLC[0] = Number.NaN;
      }
      return {
        ...response,
        backend: 'wasm',
        result: {
          ...response.result,
          pointLC,
        },
      };
    },
  };
}

function createParityErrorWasmBackend(): PlaneComputeBackend {
  return {
    kind: 'wasm',
    run(): PlaneComputeResponse {
      throw new Error('wasm backend crashed');
    },
  };
}

async function runWorkerOnce(
  wasmBackend: PlaneComputeBackend | null,
  options: {
    disableAutoBootstrap?: boolean;
    wasmParityMode?: PlaneQueryWorkerRequest['wasmParityMode'];
  } = {},
): Promise<PlaneQueryWorkerResponse> {
  vi.resetModules();
  const responses: PlaneQueryWorkerResponse[] = [];
  const scope: WorkerHarnessScope = {
    onmessage: null,
    postMessage: (message) => {
      responses.push(message);
    },
  };
  (
    globalThis as unknown as {
      self?: WorkerHarnessScope;
      __COLOR_KIT_WASM_PLANE_BACKEND__?: PlaneComputeBackend;
      __COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__?: boolean;
    }
  ).self = scope;
  (
    globalThis as unknown as {
      __COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__?: boolean;
    }
  ).__COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__ =
    options.disableAutoBootstrap ?? false;
  if (wasmBackend) {
    (
      globalThis as unknown as {
        __COLOR_KIT_WASM_PLANE_BACKEND__?: PlaneComputeBackend;
      }
    ).__COLOR_KIT_WASM_PLANE_BACKEND__ = wasmBackend;
  } else {
    delete (
      globalThis as unknown as {
        __COLOR_KIT_WASM_PLANE_BACKEND__?: PlaneComputeBackend;
      }
    ).__COLOR_KIT_WASM_PLANE_BACKEND__;
  }

  await import('../src/workers/plane-query.worker.ts');
  expect(typeof scope.onmessage).toBe('function');
  await scope.onmessage?.({
    data: createWorkerRequest(options.wasmParityMode ?? 'shape'),
  } as MessageEvent<PlaneQueryWorkerRequest>);
  await Promise.resolve();
  expect(responses.length).toBeGreaterThan(0);
  return responses[responses.length - 1];
}

afterEach(() => {
  delete (
    globalThis as unknown as {
      self?: WorkerHarnessScope;
      __COLOR_KIT_WASM_PLANE_BACKEND__?: PlaneComputeBackend;
      __COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__?: boolean;
    }
  ).self;
  delete (
    globalThis as unknown as {
      __COLOR_KIT_WASM_PLANE_BACKEND__?: PlaneComputeBackend;
      __COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__?: boolean;
    }
  ).__COLOR_KIT_WASM_PLANE_BACKEND__;
  delete (
    globalThis as unknown as {
      __COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__?: boolean;
    }
  ).__COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__;
  vi.resetModules();
});

describe('plane-query worker wasm parity', () => {
  it('reports no-wasm parity status when no backend is installed', async () => {
    const response = await runWorkerOnce(null, {
      disableAutoBootstrap: true,
      wasmParityMode: 'shape',
    });
    expect(response.error).toBeUndefined();
    expect(response.wasmParity?.status).toBe('no-wasm');
    expect(response.wasmParity?.attempted).toBe(false);
    expect(response.wasmInit?.status).toBe('unavailable');
    expect(response.schedulerTelemetry?.buckets.length).toBeGreaterThanOrEqual(
      1,
    );
    expect(evaluateWasmParityGate(response.wasmParity, 'strict').status).toBe(
      'pass',
    );
  });

  it('reports parity-ok when wasm and js packed outputs match', async () => {
    const response = await runWorkerOnce(createParityOkWasmBackend(), {
      wasmParityMode: 'shape',
    });
    expect(response.error).toBeUndefined();
    expect(response.wasmParity?.status).toBe('ok');
    expect(response.wasmParity?.attempted).toBe(true);
    expect(response.wasmParity?.pathCountDelta ?? 0).toBe(0);
    expect(response.wasmParity?.pointCountDelta ?? 0).toBe(0);
    expect(response.wasmInit?.status).toBe('ready');
    expect(response.backend).toBe('wasm');
    expect(response.schedule?.reason).toBe('warmup');
    expect(evaluateWasmParityGate(response.wasmParity, 'strict').status).toBe(
      'pass',
    );
  });

  it('reports shape mismatches and supports strict CI gate decisions', async () => {
    const response = await runWorkerOnce(createParityMismatchWasmBackend(), {
      wasmParityMode: 'shape',
    });
    expect(response.error).toBeUndefined();
    expect(response.wasmParity?.status).toBe('shape-mismatch');
    expect(response.wasmParity?.pathCountDelta ?? 0).toBeGreaterThanOrEqual(0);
    expect(response.wasmParity?.pointCountDelta ?? 0).toBeGreaterThan(0);
    expect(evaluateWasmParityGate(response.wasmParity, 'warn').status).toBe(
      'warn',
    );
    expect(evaluateWasmParityGate(response.wasmParity, 'strict').status).toBe(
      'fail',
    );
  });

  it('reports numeric mismatches with float32-friendly tolerance', async () => {
    const response = await runWorkerOnce(
      createParityNumericMismatchWasmBackend(),
      {
        wasmParityMode: 'numeric',
      },
    );
    expect(response.error).toBeUndefined();
    expect(response.wasmParity?.mode).toBe('numeric');
    expect(response.wasmParity?.status).toBe('numeric-mismatch');
    expect(response.wasmParity?.numericTolerance).toBeCloseTo(1e-4, 8);
    expect(response.wasmParity?.numericMismatchCount ?? 0).toBeGreaterThan(0);
    expect(response.wasmParity?.maxAbsDelta ?? 0).toBeGreaterThan(1e-4);
    expect(evaluateWasmParityGate(response.wasmParity, 'warn').status).toBe(
      'warn',
    );
    expect(evaluateWasmParityGate(response.wasmParity, 'strict').status).toBe(
      'fail',
    );
  });

  it('reports numeric mismatches when compared numeric buffers differ in length', async () => {
    const response = await runWorkerOnce(
      createParityNumericLengthMismatchWasmBackend(),
      {
        wasmParityMode: 'numeric',
      },
    );
    expect(response.error).toBeUndefined();
    expect(response.wasmParity?.mode).toBe('numeric');
    expect(response.wasmParity?.status).toBe('numeric-mismatch');
    expect(response.wasmParity?.numericMismatchCount ?? 0).toBeGreaterThan(0);
    expect(evaluateWasmParityGate(response.wasmParity, 'strict').status).toBe(
      'fail',
    );
  });

  it('reports numeric mismatches when one side emits NaN', async () => {
    const response = await runWorkerOnce(
      createParityNumericNaNMismatchWasmBackend(),
      {
        wasmParityMode: 'numeric',
      },
    );
    expect(response.error).toBeUndefined();
    expect(response.wasmParity?.mode).toBe('numeric');
    expect(response.wasmParity?.status).toBe('numeric-mismatch');
    expect(response.wasmParity?.numericMismatchCount ?? 0).toBeGreaterThan(0);
    expect(evaluateWasmParityGate(response.wasmParity, 'strict').status).toBe(
      'fail',
    );
  });

  it('reports parity errors and fails strict gate mode', async () => {
    const response = await runWorkerOnce(createParityErrorWasmBackend(), {
      wasmParityMode: 'shape',
    });
    expect(response.error).toBeUndefined();
    expect(response.wasmParity?.status).toBe('error');
    expect(response.wasmParity?.error).toContain('wasm backend crashed');
    expect(response.backend).toBe('js');
    expect(response.schedule?.reason).toBe('backend-error');
    expect(evaluateWasmParityGate(response.wasmParity, 'warn').status).toBe(
      'warn',
    );
    expect(evaluateWasmParityGate(response.wasmParity, 'strict').status).toBe(
      'fail',
    );
  });
});
