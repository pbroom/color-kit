import { useCallback, useMemo } from 'react';
import type { SVGAttributes } from 'react';
import {
  unpackPlaneQueryResults,
  type GamutTarget,
  type PlaneChromaBandResult,
} from '@color-kit/core';
import {
  getColorAreaChromaBandPoints,
  toColorAreaPlaneDefinition,
} from '@color-kit/driver';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line } from './line.js';
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

export type ChromaBandLayerMode = 'closest' | 'percentage';

export interface ChromaBandLayerProps extends LayerProps {
  mode?: ChromaBandLayerMode;
  gamut?: GamutTarget;
  hue?: number;
  steps?: number;
  quality?: ColorAreaLayerQuality;
  /** 'uniform' (default) or 'adaptive' band sampling */
  samplingMode?: 'uniform' | 'adaptive';
  adaptiveTolerance?: number;
  adaptiveMaxDepth?: number;
  pathProps?: SVGAttributes<SVGPathElement>;
  /** Optional precomputed path points (for plane-driven overlays). */
  points?: LinePoint[];
}

function resolveMode(mode: ChromaBandLayerMode): 'clamped' | 'proportional' {
  return mode === 'percentage' ? 'proportional' : 'clamped';
}

function toLinePointsFromBand(result: PlaneChromaBandResult): LinePoint[] {
  return result.points.map((point) => ({
    x: point.x,
    y: 1 - point.y,
  }));
}

/**
 * Precomposed Layer wrapper for drawing an in-gamut chroma band path.
 */
export function ChromaBandLayer({
  mode = 'closest',
  gamut = 'srgb',
  hue,
  steps = 48,
  quality = 'auto',
  samplingMode,
  adaptiveTolerance,
  adaptiveMaxDepth,
  pathProps,
  points: pointsProp,
  children,
  ...props
}: ChromaBandLayerProps) {
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
      getColorAreaChromaBandPoints(requested, hue ?? requested.h, axes, {
        gamut,
        mode: resolveMode(mode),
        steps: effectiveSteps,
        samplingMode,
        adaptiveTolerance: resolvedAdaptiveTolerance,
        adaptiveMaxDepth: resolvedAdaptiveMaxDepth,
        selectedLightness: requested.l,
        alpha: requested.alpha,
      }),
    [
      axes,
      effectiveSteps,
      gamut,
      hue,
      mode,
      requested,
      resolvedAdaptiveMaxDepth,
      resolvedAdaptiveTolerance,
      samplingMode,
    ],
  );

  const workerPayload = useMemo<PlaneQueryWorkerPayload>(
    () => ({
      plane: toColorAreaPlaneDefinition(axes, requested),
      queries: [
        {
          kind: 'chromaBand',
          requestedChroma: requested.c,
          gamut,
          hue: hue ?? requested.h,
          mode: resolveMode(mode),
          steps: effectiveSteps,
          samplingMode,
          adaptiveTolerance: resolvedAdaptiveTolerance,
          adaptiveMaxDepth: resolvedAdaptiveMaxDepth,
          selectedLightness: requested.l,
          alpha: requested.alpha,
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
      mode,
      performanceProfile,
      requested,
      resolvedAdaptiveMaxDepth,
      resolvedAdaptiveTolerance,
      resolvedQuality,
      samplingMode,
    ],
  );

  const extractResult = useCallback(
    (response: PlaneQueryWorkerResponse): LinePoint[] | undefined => {
      if (response.error || !response.result) {
        return undefined;
      }
      const unpacked = unpackPlaneQueryResults(response.result);
      const bandResult = unpacked.find(
        (entry): entry is PlaneChromaBandResult => entry.kind === 'chromaBand',
      );
      return bandResult ? toLinePointsFromBand(bandResult) : [];
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
      data-color-area-chroma-band-layer=""
      data-quality={resolvedQuality}
      data-mode={mode}
    >
      {children}
      <Line
        points={points}
        pathProps={{
          fill: 'none',
          ...pathProps,
        }}
      />
    </Layer>
  );
}
