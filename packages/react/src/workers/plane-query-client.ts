import type {
  PlaneQueryWorkerRequest,
  PlaneQueryWorkerResponse,
} from './plane-query.worker.types.js';

export type {
  PlaneQueryWorkerRequest,
  PlaneQueryWorkerResponse,
} from './plane-query.worker.types.js';

export type PlaneQueryWorkerPayload = Omit<PlaneQueryWorkerRequest, 'id'>;

export type PlaneQueryResponseHandler = (
  response: PlaneQueryWorkerResponse,
) => void;

export interface PlaneQueryRequestHandle {
  id: number;
  /** Stop caring about this request; a late response is dropped. */
  cancel: () => void;
}

export function canUseWorkerOffload(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

// One shared worker serves every mounted query layer, multiplexed by request
// id. The instance is keyed to the active Worker constructor so environments
// that swap the global (e.g. test stubs) transparently get a fresh worker and
// a fresh request-id space.
let workerInstance: Worker | null = null;
let workerConstructor: typeof Worker | null = null;
let nextRequestId = 0;
const responseHandlers = new Map<number, PlaneQueryResponseHandler>();

function dispatchResponse(event: MessageEvent<PlaneQueryWorkerResponse>) {
  const payload = event.data;
  if (!payload || typeof payload.id !== 'number') {
    return;
  }
  const handler = responseHandlers.get(payload.id);
  if (!handler) {
    return;
  }
  responseHandlers.delete(payload.id);
  handler(payload);
}

function ensureWorker(): Worker | null {
  if (!canUseWorkerOffload()) {
    return null;
  }
  if (workerInstance && workerConstructor === Worker) {
    return workerInstance;
  }
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    responseHandlers.clear();
    nextRequestId = 0;
  }
  try {
    workerInstance = new Worker(
      new URL('./plane-query.worker.js', import.meta.url),
      {
        type: 'module',
      },
    );
  } catch {
    workerInstance = null;
    return null;
  }
  workerConstructor = Worker;
  workerInstance.addEventListener('message', dispatchResponse);
  return workerInstance;
}

/**
 * Posts a plane query to the shared worker. Returns null when workers are
 * unavailable or construction fails; callers should fall back to sync compute.
 */
export function postPlaneQueryRequest(
  payload: PlaneQueryWorkerPayload,
  onResponse: PlaneQueryResponseHandler,
): PlaneQueryRequestHandle | null {
  const worker = ensureWorker();
  if (!worker) {
    return null;
  }

  nextRequestId += 1;
  const id = nextRequestId;
  responseHandlers.set(id, onResponse);

  const message: PlaneQueryWorkerRequest = {
    id,
    ...payload,
  };
  worker.postMessage(message);

  return {
    id,
    cancel: () => {
      responseHandlers.delete(id);
    },
  };
}
