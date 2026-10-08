import { useCallback, useMemo } from 'react';
import type { SVGAttributes } from 'react';
import type { GamutTarget, PlaneChromaBandResult } from '@color-kit/core';
import { unpackPlaneQueryResults } from '@color-kit/core/compute';
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

/**
 * How a {@link ChromaBandLayer} follows the requested chroma across
 * lightness: `'closest'` keeps the requested chroma where it is in gamut
 * and clamps to the boundary elsewhere; `'percentage'` keeps the requested
 * chroma's fraction of the maximum in-gamut chroma at the requested
 * lightness.
 */
export type ChromaBandLayerMode = 'closest' | 'percentage';

/** Props for {@link ChromaBandLayer}; other {@link LayerProps} are forwarded. */
export interface ChromaBandLayerProps extends LayerProps {
  /**
   * How the band follows the requested chroma across lightness.
   * @defaultValue 'closest'
   */
  mode?: ChromaBandLayerMode;
  /**
   * Gamut the band is kept inside.
   * @defaultValue 'srgb'
   */
  gamut?: GamutTarget;
  /** Hue of the band in degrees. Defaults to the requested hue. */
  hue?: number;
  /**
   * Band samples at `high` quality; lower quality levels scale this down
   * (minimum 8).
   * @defaultValue 48
   */
  steps?: number;
  /**
   * Sampling quality. `'auto'` follows the area's adaptive quality level.
   * @defaultValue 'auto'
   */
  quality?: ColorAreaLayerQuality;
  /** 'uniform' (default) or 'adaptive' band sampling */
  samplingMode?: 'uniform' | 'adaptive';
  /**
   * Adaptive-sampling error tolerance; derived from the area's pixel size
   * when omitted. Only used with `samplingMode: 'adaptive'`.
   */
  adaptiveTolerance?: number;
  /**
   * Adaptive-sampling maximum refinement depth; derived from the area's
   * pixel size when omitted. Only used with `samplingMode: 'adaptive'`.
   */
  adaptiveMaxDepth?: number;
  /** Props for the band `<path>` (stroke, dash, etc.); `fill` defaults to `'none'`. */
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
 * Overlay {@link Layer} that draws the requested chroma as a path across
 * lightness, kept inside the gamut (a tonal strip for the current hue).
 *
 * Draws only when the area's axes are lightness and chroma (in either
 * order); other axis pairs render an empty layer. Computed synchronously
 * while idle and in a shared Web Worker during drags (when workers are
 * available). Must be rendered inside a {@link ColorArea}.
 *
 * @throws {Error} When rendered outside a `<ColorArea>`.
 * @see {@link GamutBoundaryLayer}
 *
 * @example
 * ```tsx
 * import { ChromaBandLayer, Color, ColorArea, ColorPlane } from 'color-kit/react';
 *
 * export const Picker = () => (
 *   <Color defaultColor="#3b82f6">
 *     <ColorArea style={{ width: 240, height: 240 }}>
 *       <ColorPlane />
 *       <ChromaBandLayer
 *         mode="percentage"
 *         gamut="display-p3"
 *         pathProps={{ stroke: '#fff', vectorEffect: 'non-scaling-stroke' }}
 *       />
 *     </ColorArea>
 *   </Color>
 * );
 * ```
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
