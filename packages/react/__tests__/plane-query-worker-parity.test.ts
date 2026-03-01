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
  onmessage: ((event: MessageEvent<PlaneQueryWorkerRequest>) => void) | null;
  postMessage: (
    message: PlaneQueryWorkerResponse,
    transfer?: Transferable[],
  ) => void;
}

function createWorkerRequest(): PlaneQueryWorkerRequest {
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
    wasmParityMode: 'shape',
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
    }
  ).self = scope;
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
  scope.onmessage?.({
    data: createWorkerRequest(),
  } as MessageEvent<PlaneQueryWorkerRequest>);
  expect(responses).toHaveLength(1);
  return responses[0];
}

afterEach(() => {
  delete (
    globalThis as unknown as {
      self?: WorkerHarnessScope;
      __COLOR_KIT_WASM_PLANE_BACKEND__?: PlaneComputeBackend;
    }
  ).self;
  delete (
    globalThis as unknown as {
      __COLOR_KIT_WASM_PLANE_BACKEND__?: PlaneComputeBackend;
    }
  ).__COLOR_KIT_WASM_PLANE_BACKEND__;
  vi.resetModules();
});

describe('plane-query worker wasm parity', () => {
  it('reports no-wasm parity status when no backend is installed', async () => {
    const response = await runWorkerOnce(null);
    expect(response.error).toBeUndefined();
    expect(response.wasmParity?.status).toBe('no-wasm');
    expect(response.wasmParity?.attempted).toBe(false);
    expect(response.schedulerTelemetry?.buckets.length).toBeGreaterThanOrEqual(
      1,
    );
    expect(evaluateWasmParityGate(response.wasmParity, 'strict').status).toBe(
      'pass',
    );
  });

  it('reports parity-ok when wasm and js packed outputs match', async () => {
    const response = await runWorkerOnce(createParityOkWasmBackend());
    expect(response.error).toBeUndefined();
    expect(response.wasmParity?.status).toBe('ok');
    expect(response.wasmParity?.attempted).toBe(true);
    expect(response.wasmParity?.pathCountDelta ?? 0).toBe(0);
    expect(response.wasmParity?.pointCountDelta ?? 0).toBe(0);
    expect(evaluateWasmParityGate(response.wasmParity, 'strict').status).toBe(
      'pass',
    );
  });

  it('reports shape mismatches and supports strict CI gate decisions', async () => {
    const response = await runWorkerOnce(createParityMismatchWasmBackend());
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

  it('reports parity errors and fails strict gate mode', async () => {
    const response = await runWorkerOnce(createParityErrorWasmBackend());
    expect(response.error).toBeUndefined();
    expect(response.wasmParity?.status).toBe('error');
    expect(response.wasmParity?.error).toContain('wasm backend crashed');
    expect(evaluateWasmParityGate(response.wasmParity, 'warn').status).toBe(
      'warn',
    );
    expect(evaluateWasmParityGate(response.wasmParity, 'strict').status).toBe(
      'fail',
    );
  });
});
