import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  canUseWorkerOffload,
  postPlaneQueryRequest,
  type PlaneQueryWorkerPayload,
} from './workers/plane-query-client.js';
import type { PlaneQueryWorkerResponse } from './workers/plane-query-client.js';

export type { PlaneQueryWorkerPayload } from './workers/plane-query-client.js';
export { canUseWorkerOffload } from './workers/plane-query-client.js';

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export interface UsePlaneQueryLayerOptions<T> {
  /**
   * True when precomputed data is supplied externally; disables both sync
   * compute and worker offload.
   */
  external: boolean;
  isDragging: boolean;
  /**
   * Sync computation for the current inputs. Must be referentially stable
   * (useCallback) so recomputes track input changes.
   */
  computeSync: () => T;
  /**
   * Whether sync compute keeps running during a drag: line layers compute
   * sync until the first worker response lands, region layers rely on their
   * own stable-path fallback instead.
   */
  syncWhileDragging: 'until-worker-response' | 'never';
  /** Worker request payload for the current inputs (memoized by the caller). */
  workerPayload: PlaneQueryWorkerPayload;
  /**
   * Maps a worker response to layer data. Return undefined to ignore the
   * response (e.g. errors) and keep the previous worker data.
   */
  extractResult: (response: PlaneQueryWorkerResponse) => T | undefined;
  /** Observes every worker response (metrics/telemetry). */
  onWorkerResponse?: (
    response: PlaneQueryWorkerResponse,
    data: T | undefined,
  ) => void;
  /** Called when a worker could not be created for a drag request. */
  onWorkerUnavailable?: () => void;
}

export interface PlaneQueryLayerState<T> {
  /** Latest sync computation, or null while the worker path owns the data. */
  sync: { data: T; computeTimeMs: number } | null;
  /** Latest accepted worker response data. */
  workerData: { requestId: number; data: T } | null;
  /** True when workerData answers the most recent request. */
  hasCurrentWorkerResponse: boolean;
  /** True when the layer is currently offloading to the worker (dragging). */
  usingWorkerPath: boolean;
  /**
   * Most recently issued worker request id (0 before the first request).
   * Read `.current` in effects/callbacks only, never during render.
   */
  requestIdRef: RefObject<number>;
}

/**
 * Shared sync/worker/drag state machine for plane-query-backed color area
 * layers. While idle the layer computes synchronously; during a drag it
 * offloads to the shared plane-query worker and keeps the last usable data
 * until a current response arrives.
 */
export function usePlaneQueryLayer<T>(
  options: UsePlaneQueryLayerOptions<T>,
): PlaneQueryLayerState<T> {
  const {
    external,
    isDragging,
    computeSync,
    syncWhileDragging,
    workerPayload,
    extractResult,
    onWorkerResponse,
    onWorkerUnavailable,
  } = options;

  const [workerData, setWorkerData] = useState<{
    requestId: number;
    data: T;
  } | null>(null);
  const [activeWorkerRequestId, setActiveWorkerRequestId] = useState<
    number | null
  >(null);
  const requestIdRef = useRef(0);

  const workerUsable = canUseWorkerOffload();
  const usingWorkerPath = !external && isDragging && workerUsable;

  const sync = useMemo(() => {
    if (external) {
      return null;
    }
    if (isDragging && workerUsable) {
      if (syncWhileDragging === 'never') {
        return null;
      }
      if (workerData != null) {
        return null;
      }
    }
    const start = nowMs();
    const data = computeSync();
    return {
      data,
      computeTimeMs: nowMs() - start,
    };
  }, [
    computeSync,
    external,
    isDragging,
    syncWhileDragging,
    workerData,
    workerUsable,
  ]);

  useEffect(() => {
    if (external || !canUseWorkerOffload() || !isDragging) {
      queueMicrotask(() => setActiveWorkerRequestId(null));
      return;
    }

    const handle = postPlaneQueryRequest(workerPayload, (response) => {
      const data = extractResult(response);
      if (data !== undefined) {
        setWorkerData({
          requestId: response.id,
          data,
        });
      }
      onWorkerResponse?.(response, data);
    });

    if (!handle) {
      onWorkerUnavailable?.();
      queueMicrotask(() => setActiveWorkerRequestId(null));
      return;
    }

    requestIdRef.current = handle.id;
    queueMicrotask(() => setActiveWorkerRequestId(handle.id));

    return () => {
      handle.cancel();
    };
  }, [
    external,
    extractResult,
    isDragging,
    onWorkerResponse,
    onWorkerUnavailable,
    workerPayload,
  ]);

  const hasCurrentWorkerResponse = useMemo(
    () =>
      activeWorkerRequestId != null &&
      workerData != null &&
      workerData.requestId === activeWorkerRequestId,
    [activeWorkerRequestId, workerData],
  );

  return {
    sync,
    workerData,
    hasCurrentWorkerResponse,
    usingWorkerPath,
    requestIdRef,
  };
}
