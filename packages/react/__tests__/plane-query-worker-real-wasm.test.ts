import { afterEach, describe, expect, it, vi } from 'vitest';
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

const requireRealWasm = process.env.COLOR_KIT_REQUIRE_REAL_WASM === '1';
const parityGateMode =
  process.env.COLOR_KIT_WASM_PARITY_GATE === 'strict' ? 'strict' : 'warn';

function createWorkerRequest(): PlaneQueryWorkerRequest {
  return {
    id: 7,
    plane: {
      model: 'oklch',
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, 0.4] },
      fixed: { h: 230, alpha: 1 },
    },
    queries: [
      {
        kind: 'contrastRegion',
        reference: { l: 0.6, c: 0.17, h: 230, alpha: 1 },
        hue: 230,
        metric: 'wcag',
        samplingMode: 'hybrid',
        lightnessSteps: 32,
        chromaSteps: 32,
      },
    ],
    priority: 'drag',
    quality: 'high',
    performanceProfile: 'balanced',
    includeSchedulerTelemetry: true,
    includeWasmInitStatus: true,
    wasmParityMode: 'numeric',
  };
}

async function runWorkerOnce(): Promise<PlaneQueryWorkerResponse> {
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
      __COLOR_KIT_WASM_PLANE_BACKEND__?: unknown;
      __COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__?: boolean;
    }
  ).self = scope;
  delete (
    globalThis as unknown as {
      __COLOR_KIT_WASM_PLANE_BACKEND__?: unknown;
    }
  ).__COLOR_KIT_WASM_PLANE_BACKEND__;
  (
    globalThis as unknown as {
      __COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__?: boolean;
    }
  ).__COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__ = false;

  await import('../src/workers/plane-query.worker.ts');
  expect(typeof scope.onmessage).toBe('function');
  await scope.onmessage?.({
    data: createWorkerRequest(),
  } as MessageEvent<PlaneQueryWorkerRequest>);
  await Promise.resolve();
  expect(responses.length).toBeGreaterThan(0);
  return responses[responses.length - 1];
}

afterEach(() => {
  delete (
    globalThis as unknown as {
      self?: WorkerHarnessScope;
      __COLOR_KIT_WASM_PLANE_BACKEND__?: unknown;
      __COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__?: boolean;
    }
  ).self;
  delete (
    globalThis as unknown as {
      __COLOR_KIT_WASM_PLANE_BACKEND__?: unknown;
    }
  ).__COLOR_KIT_WASM_PLANE_BACKEND__;
  delete (
    globalThis as unknown as {
      __COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__?: boolean;
    }
  ).__COLOR_KIT_DISABLE_WASM_AUTO_BOOTSTRAP__;
  vi.resetModules();
});

describe('plane-query worker real wasm integration', () => {
  const runRealWasmTest = requireRealWasm ? it : it.skip;

  runRealWasmTest(
    'boots real wasm backend and passes numeric parity gate',
    async () => {
      const response = await runWorkerOnce();
      expect(response.error).toBeUndefined();
      expect(response.wasmInit?.status).toBe('ready');
      expect(response.wasmInit?.backendVersion).toBeTruthy();
      expect(response.wasmParity?.mode).toBe('numeric');
      expect(response.wasmParity?.status).toBe('ok');
      expect(response.backend).toBe('wasm');
      expect(
        evaluateWasmParityGate(response.wasmParity, parityGateMode).status,
      ).toBe('pass');
    },
  );
});
