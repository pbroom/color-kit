import {
  createJsPlaneComputeBackend,
  getPackedPlaneQueryTransferables,
} from '@color-kit/core';
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
const backend = createJsPlaneComputeBackend();

workerScope.onmessage = (event): void => {
  const payload = event.data;

  try {
    const response = backend.run({
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
