// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PlaneQueryWorkerRequest,
  PlaneQueryWorkerResponse,
} from '../src/workers/plane-query.worker.types.js';
import type { PlaneQueryWorkerPayload } from '../src/workers/plane-query-client.js';

class MockWorker {
  static instances: MockWorker[] = [];

  readonly messages: PlaneQueryWorkerRequest[] = [];
  private readonly listeners = new Set<EventListenerOrEventListenerObject>();

  constructor() {
    MockWorker.instances.push(this);
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    if (type === 'message') {
      this.listeners.add(listener);
    }
  }

  postMessage(message: PlaneQueryWorkerRequest): void {
    this.messages.push(message);
  }

  terminate(): void {}

  emit(response: PlaneQueryWorkerResponse): void {
    const event = { data: response } as MessageEvent<PlaneQueryWorkerResponse>;
    for (const listener of this.listeners) {
      if (typeof listener === 'function') {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
    }
  }
}

const payload: PlaneQueryWorkerPayload = {
  plane: {
    model: 'oklch',
    x: { channel: 'l', range: [0, 1] },
    y: { channel: 'c', range: [0, 0.4] },
    fixed: { h: 220, alpha: 1 },
  },
  queries: [
    {
      kind: 'gamutBoundary',
      gamut: 'srgb',
      hue: 220,
    },
  ],
};

beforeEach(() => {
  vi.resetModules();
  MockWorker.instances = [];
  vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('plane-query client', () => {
  it('multiplexes concurrent requests through one worker by response id', async () => {
    const { postPlaneQueryRequest } =
      await import('../src/workers/plane-query-client.js');
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const first = postPlaneQueryRequest(payload, firstHandler);
    const second = postPlaneQueryRequest(payload, secondHandler);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(MockWorker.instances).toHaveLength(1);
    expect(MockWorker.instances[0].messages.map(({ id }) => id)).toEqual([
      first?.id,
      second?.id,
    ]);

    MockWorker.instances[0].emit({ id: second!.id, computeTimeMs: 2 });
    expect(secondHandler).toHaveBeenCalledWith({
      id: second!.id,
      computeTimeMs: 2,
    });
    expect(firstHandler).not.toHaveBeenCalled();

    MockWorker.instances[0].emit({ id: first!.id, computeTimeMs: 1 });
    MockWorker.instances[0].emit({ id: first!.id, computeTimeMs: 3 });
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(firstHandler).toHaveBeenCalledWith({
      id: first!.id,
      computeTimeMs: 1,
    });
  });

  it('drops a late response after cancellation', async () => {
    const { postPlaneQueryRequest } =
      await import('../src/workers/plane-query-client.js');
    const handler = vi.fn();

    const request = postPlaneQueryRequest(payload, handler);
    expect(request).not.toBeNull();

    request!.cancel();
    MockWorker.instances[0].emit({ id: request!.id, computeTimeMs: 1 });

    expect(handler).not.toHaveBeenCalled();
  });
});
