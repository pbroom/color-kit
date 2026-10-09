import { useCallback, useMemo } from 'react';
import type {
  PlaneChromaBandResult,
  PlaneGamutBoundaryResult,
} from '@color-kit/core';
import { unpackPlaneQueryResults } from '@color-kit/core/compute';
import type { ColorAreaGamutBoundaryPoint } from '@color-kit/driver';
import {
  usePlaneQueryLayer,
  type PlaneQueryWorkerPayload,
} from './use-plane-query-layer.js';
import type { PlaneQueryWorkerResponse } from './workers/plane-query-client.js';

/** One vertex of a plane line: OKLCH `l`/`c` and normalized `x`/`y` (y down). */
export type ColorPlaneLinePoint = ColorAreaGamutBoundaryPoint;

type LineQueryKind = 'gamutBoundary' | 'chromaBand';

function toUiPoints(
  result: PlaneGamutBoundaryResult | PlaneChromaBandResult,
): ColorPlaneLinePoint[] {
  return result.points.map((point) => ({
    l: point.l,
    c: point.c,
    x: point.x,
    y: 1 - point.y,
  }));
}

/**
 * Sync-at-rest, worker-while-dragging line query shared by
 * `useGamutBoundary` and `useChromaBand`. During a drag the sync result keeps
 * the line on screen until the first worker response lands.
 */
export function usePlaneLineQuery(options: {
  kind: LineQueryKind;
  isDragging: boolean;
  computeSync: () => ColorPlaneLinePoint[];
  workerPayload: PlaneQueryWorkerPayload;
}): ColorPlaneLinePoint[] {
  const { kind, isDragging, computeSync, workerPayload } = options;

  const extractResult = useCallback(
    (response: PlaneQueryWorkerResponse): ColorPlaneLinePoint[] | undefined => {
      if (response.error || !response.result) {
        return undefined;
      }
      const entry = unpackPlaneQueryResults(response.result).find(
        (
          candidate,
        ): candidate is PlaneGamutBoundaryResult | PlaneChromaBandResult =>
          candidate.kind === kind,
      );
      return entry ? toUiPoints(entry) : [];
    },
    [kind],
  );

  const { sync, workerData, hasCurrentWorkerResponse, usingWorkerPath } =
    usePlaneQueryLayer<ColorPlaneLinePoint[]>({
      external: false,
      isDragging,
      computeSync,
      syncWhileDragging: 'until-worker-response',
      workerPayload,
      extractResult,
    });

  return useMemo(() => {
    if (!usingWorkerPath) {
      return sync?.data ?? [];
    }
    if (hasCurrentWorkerResponse && workerData != null) {
      return workerData.data;
    }
    return workerData?.data ?? sync?.data ?? [];
  }, [hasCurrentWorkerResponse, sync, usingWorkerPath, workerData]);
}
