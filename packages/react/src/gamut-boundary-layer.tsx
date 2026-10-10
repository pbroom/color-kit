import { useCallback, useMemo } from 'react';
import type { SVGAttributes } from 'react';
import type { GamutTarget, PlaneGamutBoundaryResult } from '@color-kit/core';
import { unpackPlaneQueryResults } from '@color-kit/core/compute';
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

/** Props for {@link GamutBoundaryLayer}; other {@link LayerProps} are forwarded. */
export interface GamutBoundaryLayerProps extends LayerProps {
  /**
   * Gamut whose boundary is drawn.
   * @defaultValue 'srgb'
   */
  gamut?: GamutTarget;
  /** Hue of the boundary slice in degrees. Defaults to the requested hue. */
  hue?: number;
  /**
   * Boundary samples at `high` quality; lower quality levels scale this
   * down (minimum 8).
   * @defaultValue 48
   */
  steps?: number;
  /**
   * Sampling quality. `'auto'` follows the area's adaptive quality level.
   * @defaultValue 'auto'
   */
  quality?: ColorAreaLayerQuality;
  /** RDP simplification tolerance in (l,c) space; omit to disable */
  simplifyTolerance?: number;
  /** 'uniform' (default) or 'adaptive' boundary sampling */
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
  /** Props for the boundary `<path>` (stroke, dash, etc.); `fill` defaults to `'none'`. */
  pathProps?: SVGAttributes<SVGPathElement>;
  /**
   * Draw a circle at every path vertex (for debugging sampling).
   * @defaultValue false
   */
  showPathPoints?: boolean;
  /** Props for the vertex circles drawn with `showPathPoints`. */
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
 * Overlay {@link Layer} that draws the gamut boundary (the maximum in-gamut
 * chroma at each lightness) for one hue as an SVG path.
 *
 * Draws only when the area's axes are lightness and chroma (in either
 * order); other axis pairs render an empty layer. The boundary follows the
 * requested hue unless `hue` is set; it is computed synchronously while
 * idle and in a shared Web Worker during drags (when workers are
 * available). Must be rendered inside a {@link ColorArea}.
 *
 * @throws {Error} When rendered outside a `<ColorArea>`.
 * @see {@link ChromaBandLayer}
 *
 * @example
 * ```tsx
 * import { Color, ColorArea, ColorPlane, GamutBoundaryLayer } from 'color-kit/react';
 *
 * export const Picker = () => (
 *   <Color defaultColor="#3b82f6">
 *     <ColorArea style={{ width: 240, height: 240 }}>
 *       <ColorPlane />
 *       <GamutBoundaryLayer
 *         gamut="srgb"
 *         pathProps={{ stroke: '#fff', strokeDasharray: '4 3', vectorEffect: 'non-scaling-stroke' }}
 *       />
 *       <GamutBoundaryLayer
 *         gamut="display-p3"
 *         pathProps={{ stroke: '#fff', vectorEffect: 'non-scaling-stroke' }}
 *       />
 *     </ColorArea>
 *   </Color>
 * );
 * ```
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
