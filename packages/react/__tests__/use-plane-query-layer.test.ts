// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlaneQueryWorkerResponse } from '../src/workers/plane-query.worker.types.js';

const workerMock = vi.hoisted(() => ({
  respond: null as ((response: PlaneQueryWorkerResponse) => void) | null,
}));

vi.mock('../src/workers/plane-query-client.js', () => ({
  canUseWorkerOffload: () => true,
  postPlaneQueryRequest: (
    _payload: unknown,
    onResponse: (response: PlaneQueryWorkerResponse) => void,
  ) => {
    workerMock.respond = onResponse;
    return { id: 7, cancel: () => {} };
  },
}));

afterEach(() => {
  workerMock.respond = null;
});

describe('usePlaneQueryLayer()', () => {
  it('treats a response that fails to decode as a worker error', async () => {
    const { usePlaneQueryLayer } =
      await import('../src/use-plane-query-layer.js');
    const onWorkerResponse = vi.fn();
    const extractResult = () => {
      throw new Error('Invalid packed plane query result: abiVersion');
    };
    const workerPayload = {
      plane: {},
      queries: [],
    } as unknown as Parameters<
      typeof usePlaneQueryLayer<number>
    >[0]['workerPayload'];

    const { result } = renderHook(() =>
      usePlaneQueryLayer<number>({
        external: false,
        isDragging: true,
        computeSync: () => 1,
        syncWhileDragging: 'never',
        workerPayload,
        extractResult,
        onWorkerResponse,
      }),
    );

    expect(workerMock.respond).not.toBeNull();
    expect(() =>
      workerMock.respond?.({
        id: 7,
        result: {} as PlaneQueryWorkerResponse['result'],
      }),
    ).not.toThrow();

    expect(onWorkerResponse).toHaveBeenCalledTimes(1);
    const [observed, data] = onWorkerResponse.mock.calls[0];
    expect(data).toBeUndefined();
    expect(observed.result).toBeUndefined();
    expect(observed.error).toMatch(/Invalid packed plane query result/);
    expect(result.current.workerData).toBeNull();
  });
});
