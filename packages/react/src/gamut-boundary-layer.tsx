import { useCallback, useMemo } from 'react';
import type { SVGAttributes } from 'react';
import {
  unpackPlaneQueryResults,
  type GamutTarget,
  type PlaneGamutBoundaryResult,
} from '@color-kit/core';
import {
  getColorAreaGamutBoundaryPoints,
  toColorAreaPlaneDefinition,
} from '@color-kit/driver';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line } from './line.js';
import { PathPointsOverlay } from './path-points-overlay.js';
import {
  autoAdaptiveLineMaxDepth,
  autoAdaptiveLineTolerance,
  qualityStepMultiplier,
  resolveQuality,
  type ColorAreaLayerQuality,
} from './layer-quality-utils.js';
import { useMeasuredElementSize } from './use-measured-element-size.js';
import {
  usePlaneQueryLayer,
  type PlaneQueryWorkerPayload,
} from './use-plane-query-layer.js';
import type { LinePoint } from './line.js';
import type { PlaneQueryWorkerResponse } from './workers/plane-query-client.js';

export type { ColorAreaLayerQuality } from './layer-quality-utils.js';

export interface GamutBoundaryLayerProps extends LayerProps {
  gamut?: GamutTarget;
  hue?: number;
  steps?: number;
  quality?: ColorAreaLayerQuality;
  /** RDP simplification tolerance in (l,c) space; omit to disable */
  simplifyTolerance?: number;
  /** 'uniform' (default) or 'adaptive' boundary sampling */
  samplingMode?: 'uniform' | 'adaptive';
  adaptiveTolerance?: number;
  adaptiveMaxDepth?: number;
  pathProps?: SVGAttributes<SVGPathElement>;
  showPathPoints?: boolean;
  pointProps?: SVGAttributes<SVGCircleElement>;
  /** Corner radius in 0-1 for path vertices; omit for sharp corners */
  cornerRadius?: number;
  /** Optional precomputed path points (for plane-driven overlays). */
  points?: LinePoint[];
}

function toLinePointsFromBoundary(
  result: PlaneGamutBoundaryResult,
): LinePoint[] {
  return result.points.map((point) => ({
    x: point.x,
    y: 1 - point.y,
  }));
}

/**
 * Precomposed Layer wrapper for drawing a gamut boundary path.
 */
export function GamutBoundaryLayer({
  gamut = 'srgb',
  hue,
  steps = 48,
  quality = 'auto',
  simplifyTolerance,
  samplingMode,
  adaptiveTolerance,
  adaptiveMaxDepth,
  pathProps,
  showPathPoints = false,
  pointProps,
  cornerRadius,
  points: pointsProp,
  children,
  ...props
}: GamutBoundaryLayerProps) {
  const {
    areaRef,
    requested,
    axes,
    performanceProfile,
    qualityLevel,
    isDragging,
  } = useColorAreaContext();
  const areaSize = useMeasuredElementSize(areaRef);
  const resolvedQuality = resolveQuality(quality, qualityLevel);
  const effectiveSteps = useMemo(
    () =>
      Math.max(8, Math.round(steps * qualityStepMultiplier(resolvedQuality))),
    [resolvedQuality, steps],
  );

  const resolvedAdaptiveTolerance = useMemo(() => {
    if (samplingMode !== 'adaptive') {
      return adaptiveTolerance;
    }
    if (adaptiveTolerance != null) {
      return adaptiveTolerance;
    }
    if (areaSize.width <= 0 || areaSize.height <= 0) {
      return undefined;
    }
    const widthPx = areaSize.width * areaSize.dpr;
    const heightPx = areaSize.height * areaSize.dpr;
    return autoAdaptiveLineTolerance(axes, resolvedQuality, widthPx, heightPx);
  }, [
    adaptiveTolerance,
    areaSize.dpr,
    areaSize.height,
    areaSize.width,
    axes,
    resolvedQuality,
    samplingMode,
  ]);

  const resolvedAdaptiveMaxDepth = useMemo(() => {
    if (samplingMode !== 'adaptive') {
      return adaptiveMaxDepth;
    }
    if (adaptiveMaxDepth != null) {
      return adaptiveMaxDepth;
    }
    if (areaSize.width <= 0 || areaSize.height <= 0) {
      return undefined;
    }
    const widthPx = areaSize.width * areaSize.dpr;
    const heightPx = areaSize.height * areaSize.dpr;
    return autoAdaptiveLineMaxDepth(resolvedQuality, widthPx, heightPx);
  }, [
    adaptiveMaxDepth,
    areaSize.dpr,
    areaSize.height,
    areaSize.width,
    resolvedQuality,
    samplingMode,
  ]);

  const computeSync = useCallback(
    () =>
      getColorAreaGamutBoundaryPoints(hue ?? requested.h, axes, {
        gamut,
        steps: effectiveSteps,
        simplifyTolerance,
        samplingMode,
        adaptiveTolerance: resolvedAdaptiveTolerance,
        adaptiveMaxDepth: resolvedAdaptiveMaxDepth,
      }),
    [
      axes,
      effectiveSteps,
      gamut,
      hue,
      requested.h,
      resolvedAdaptiveMaxDepth,
      resolvedAdaptiveTolerance,
      samplingMode,
      simplifyTolerance,
    ],
  );

  const workerPayload = useMemo<PlaneQueryWorkerPayload>(
    () => ({
      plane: toColorAreaPlaneDefinition(axes, requested),
      queries: [
        {
          kind: 'gamutBoundary',
          gamut,
          hue: hue ?? requested.h,
          steps: effectiveSteps,
          simplifyTolerance,
          samplingMode,
          adaptiveTolerance: resolvedAdaptiveTolerance,
          adaptiveMaxDepth: resolvedAdaptiveMaxDepth,
        },
      ],
      priority: isDragging ? 'drag' : 'idle',
      quality: resolvedQuality,
      performanceProfile,
    }),
    [
      axes,
      effectiveSteps,
      gamut,
      hue,
      isDragging,
      performanceProfile,
      requested,
      resolvedAdaptiveMaxDepth,
      resolvedAdaptiveTolerance,
      resolvedQuality,
      samplingMode,
      simplifyTolerance,
    ],
  );

  const extractResult = useCallback(
    (response: PlaneQueryWorkerResponse): LinePoint[] | undefined => {
      if (response.error || !response.result) {
        return undefined;
      }
      const unpacked = unpackPlaneQueryResults(response.result);
      const boundaryResult = unpacked.find(
        (entry): entry is PlaneGamutBoundaryResult =>
          entry.kind === 'gamutBoundary',
      );
      return boundaryResult ? toLinePointsFromBoundary(boundaryResult) : [];
    },
    [],
  );

  const { sync, workerData, hasCurrentWorkerResponse, usingWorkerPath } =
    usePlaneQueryLayer<LinePoint[]>({
      external: pointsProp != null,
      isDragging,
      computeSync,
      syncWhileDragging: 'until-worker-response',
      workerPayload,
      extractResult,
    });

  const points = useMemo(() => {
    if (pointsProp) {
      return pointsProp;
    }
    if (!usingWorkerPath) {
      return sync?.data ?? [];
    }
    if (hasCurrentWorkerResponse && workerData != null) {
      return workerData.data;
    }
    return workerData?.data ?? sync?.data ?? [];
  }, [hasCurrentWorkerResponse, pointsProp, sync, usingWorkerPath, workerData]);

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'overlay'}
      interactive={props.interactive ?? false}
      data-color-area-gamut-boundary-layer=""
      data-quality={resolvedQuality}
    >
      {children}
      <Line
        points={points}
        cornerRadius={cornerRadius}
        pathProps={{
          fill: 'none',
          ...pathProps,
        }}
      />
      {showPathPoints ? (
        <PathPointsOverlay
          paths={[points]}
          pointProps={pointProps}
          data-color-area-gamut-boundary-points=""
        />
      ) : null}
    </Layer>
  );
}
