import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  PlaneQueryWorkerRequest,
  PlaneQueryWorkerResponse,
} from '../src/workers/plane-query.worker.types.js';

interface WorkerHarnessScope {
  onmessage: ((event: MessageEvent<PlaneQueryWorkerRequest>) => void) | null;
  postMessage: (
    message: PlaneQueryWorkerResponse,
    transfer?: Transferable[],
  ) => void;
}

function createWorkerRequest(
  overrides: Partial<PlaneQueryWorkerRequest> = {},
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
    ...overrides,
  };
}

async function runWorkerOnce(
  request: PlaneQueryWorkerRequest,
): Promise<PlaneQueryWorkerResponse> {
  vi.resetModules();
  const responses: PlaneQueryWorkerResponse[] = [];
  const scope: WorkerHarnessScope = {
    onmessage: null,
    postMessage: (message) => {
      responses.push(message);
    },
  };
  (globalThis as unknown as { self?: WorkerHarnessScope }).self = scope;

  await import('../src/workers/plane-query.worker.ts');
  expect(typeof scope.onmessage).toBe('function');
  scope.onmessage?.({
    data: request,
  } as MessageEvent<PlaneQueryWorkerRequest>);
  expect(responses.length).toBeGreaterThan(0);
  return responses[responses.length - 1];
}

afterEach(() => {
  delete (globalThis as unknown as { self?: WorkerHarnessScope }).self;
  vi.resetModules();
});

describe('plane-query worker', () => {
  it('runs js compute and emits a packed protocol response', async () => {
    const response = await runWorkerOnce(createWorkerRequest());
    expect(response.error).toBeUndefined();
    expect(response.id).toBe(1);
    expect(response.backend).toBe('js');
    expect(response.result?.pathRanges.length ?? 0).toBeGreaterThan(0);
    expect(response.result?.pointXY.length ?? 0).toBeGreaterThan(0);
    expect(response.computeTimeMs ?? -1).toBeGreaterThanOrEqual(0);
    expect(response.marshalTimeMs ?? -1).toBeGreaterThanOrEqual(0);
    expect(response.schedule?.selectedBackend).toBe('js');
  });

  it('includes scheduler telemetry only when requested', async () => {
    const withTelemetry = await runWorkerOnce(
      createWorkerRequest({ includeSchedulerTelemetry: true }),
    );
    expect(
      withTelemetry.schedulerTelemetry?.buckets.length,
    ).toBeGreaterThanOrEqual(1);

    const withoutTelemetry = await runWorkerOnce(
      createWorkerRequest({ includeSchedulerTelemetry: false }),
    );
    expect(withoutTelemetry.schedulerTelemetry).toBeUndefined();
  });

  it('reports compute failures as protocol errors', async () => {
    const response = await runWorkerOnce(
      createWorkerRequest({
        plane: null as unknown as PlaneQueryWorkerRequest['plane'],
      }),
    );
    expect(response.id).toBe(1);
    expect(response.error).toBeTruthy();
    expect(response.result).toBeUndefined();
  });
});
