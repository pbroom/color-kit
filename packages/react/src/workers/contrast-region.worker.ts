import { getColorAreaContrastRegionPaths } from '../api/color-area.js';
import type {
  ContrastRegionWorkerRequest,
  ContrastRegionWorkerResponse,
} from './contrast-region.worker.types.js';

interface MinimalWorkerScope {
  onmessage:
    | ((event: MessageEvent<ContrastRegionWorkerRequest>) => void)
    | null;
  postMessage: (message: ContrastRegionWorkerResponse) => void;
}

const workerScope = self as unknown as MinimalWorkerScope;

workerScope.onmessage = (event): void => {
  const payload = event.data;

  try {
    const start =
      typeof performance === 'undefined' ? Date.now() : performance.now();
    const paths = getColorAreaContrastRegionPaths(
      payload.reference,
      payload.hue,
      payload.axes,
      payload.options,
    );
    const end = typeof performance === 'undefined' ? Date.now() : performance.now();

    const response: ContrastRegionWorkerResponse = {
      id: payload.id,
      paths,
      computeTimeMs: end - start,
    };
    workerScope.postMessage(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const response: ContrastRegionWorkerResponse = {
      id: payload.id,
      paths: [],
      error: message,
    };
    workerScope.postMessage(response);
  }
};

export {};
