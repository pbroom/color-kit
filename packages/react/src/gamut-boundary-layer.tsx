import { useEffect, useMemo, useRef, useState } from 'react';
import type { SVGAttributes } from 'react';
import {
  unpackPlaneQueryResults,
  type GamutTarget,
  type PlaneGamutBoundaryResult,
} from '@color-kit/core';
import {
  getColorAreaGamutBoundaryPoints,
  type ResolvedColorAreaAxes,
} from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line } from './line.js';
import { PathPointsOverlay } from './path-points-overlay.js';
import type { LinePoint } from './line.js';
import type {
  PlaneQueryWorkerRequest,
  PlaneQueryWorkerResponse,
} from './workers/plane-query.worker.types.js';

export type ColorAreaLayerQuality = 'auto' | 'high' | 'medium' | 'low';

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

type PlaneQueryWorkerPayload = Omit<PlaneQueryWorkerRequest, 'id'>;

function resolveQuality(
  quality: ColorAreaLayerQuality,
  contextQuality: 'high' | 'medium' | 'low',
): 'high' | 'medium' | 'low' {
  if (quality === 'auto') {
    return contextQuality;
  }
  return quality;
}

function qualityStepMultiplier(quality: 'high' | 'medium' | 'low'): number {
  if (quality === 'high') return 1;
  if (quality === 'medium') return 0.72;
  return 0.5;
}

const MIN_AUTO_ADAPTIVE_TOLERANCE = 0.00005;
const MAX_AUTO_ADAPTIVE_TOLERANCE = 0.003;
const MIN_AUTO_ADAPTIVE_DEPTH = 8;
const MAX_AUTO_ADAPTIVE_DEPTH = 18;

function rangeSpan(range: [number, number]): number {
  return Math.abs(range[1] - range[0]);
}

function unitsPerPixelForChannel(
  axes: ResolvedColorAreaAxes,
  channel: 'l' | 'c',
  widthPx: number,
  heightPx: number,
): number {
  const xUnits =
    axes.x.channel === channel
      ? rangeSpan(axes.x.range) / Math.max(1, widthPx)
      : Number.POSITIVE_INFINITY;
  const yUnits =
    axes.y.channel === channel
      ? rangeSpan(axes.y.range) / Math.max(1, heightPx)
      : Number.POSITIVE_INFINITY;
  const best = Math.min(xUnits, yUnits);
  if (Number.isFinite(best) && best > 0) {
    return best;
  }
  return 1 / Math.max(1, Math.max(widthPx, heightPx));
}

function autoAdaptiveTolerance(
  axes: ResolvedColorAreaAxes,
  quality: 'high' | 'medium' | 'low',
  widthPx: number,
  heightPx: number,
): number {
  const lUnitsPerPixel = unitsPerPixelForChannel(axes, 'l', widthPx, heightPx);
  const cUnitsPerPixel = unitsPerPixelForChannel(axes, 'c', widthPx, heightPx);
  const pixelError =
    quality === 'high' ? 0.35 : quality === 'medium' ? 0.55 : 0.8;
  const tolerance = pixelError * Math.min(lUnitsPerPixel, cUnitsPerPixel);
  return Math.min(
    MAX_AUTO_ADAPTIVE_TOLERANCE,
    Math.max(MIN_AUTO_ADAPTIVE_TOLERANCE, tolerance),
  );
}

function autoAdaptiveMaxDepth(
  quality: 'high' | 'medium' | 'low',
  widthPx: number,
  heightPx: number,
): number {
  const longestEdge = Math.max(1, Math.max(widthPx, heightPx));
  const qualityBias = quality === 'high' ? 4 : quality === 'medium' ? 3 : 2;
  const computed = Math.ceil(Math.log2(longestEdge)) + qualityBias;
  return Math.min(
    MAX_AUTO_ADAPTIVE_DEPTH,
    Math.max(MIN_AUTO_ADAPTIVE_DEPTH, computed),
  );
}

function canUseWorkerOffload(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
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
  const [areaSize, setAreaSize] = useState({
    width: 0,
    height: 0,
    dpr: 1,
  });
  const resolvedQuality = resolveQuality(quality, qualityLevel);
  const effectiveSteps = useMemo(
    () =>
      Math.max(8, Math.round(steps * qualityStepMultiplier(resolvedQuality))),
    [resolvedQuality, steps],
  );
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const areaNode = areaRef.current;
    if (!areaNode) {
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = areaNode.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      const nextDpr = window.devicePixelRatio || 1;
      setAreaSize((current) => {
        if (
          Math.abs(current.width - rect.width) < 0.5 &&
          Math.abs(current.height - rect.height) < 0.5 &&
          Math.abs(current.dpr - nextDpr) < 0.01
        ) {
          return current;
        }
        return {
          width: rect.width,
          height: rect.height,
          dpr: nextDpr,
        };
      });
    };
    const schedule = () => {
      if (frame !== 0) {
        return;
      }
      frame = window.requestAnimationFrame(measure);
    };

    schedule();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(schedule);
      observer.observe(areaNode);
      window.addEventListener('resize', schedule);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', schedule);
        if (frame !== 0) {
          window.cancelAnimationFrame(frame);
        }
      };
    }

    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('resize', schedule);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [areaRef]);

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
    return autoAdaptiveTolerance(axes, resolvedQuality, widthPx, heightPx);
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
    return autoAdaptiveMaxDepth(resolvedQuality, widthPx, heightPx);
  }, [
    adaptiveMaxDepth,
    areaSize.dpr,
    areaSize.height,
    areaSize.width,
    resolvedQuality,
    samplingMode,
  ]);

  const [workerPoints, setWorkerPoints] = useState<{
    requestId: number;
    points: LinePoint[];
  } | null>(null);
  const [activeWorkerRequestId, setActiveWorkerRequestId] = useState<
    number | null
  >(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const syncComputation = useMemo(() => {
    if (pointsProp) {
      return {
        points: pointsProp,
      };
    }
    if (isDragging && canUseWorkerOffload() && workerPoints != null) {
      return null;
    }
    return {
      points: getColorAreaGamutBoundaryPoints(hue ?? requested.h, axes, {
        gamut,
        steps: effectiveSteps,
        simplifyTolerance,
        samplingMode,
        adaptiveTolerance: resolvedAdaptiveTolerance,
        adaptiveMaxDepth: resolvedAdaptiveMaxDepth,
      }),
    };
  }, [
    axes,
    effectiveSteps,
    gamut,
    hue,
    isDragging,
    pointsProp,
    requested.h,
    workerPoints,
    simplifyTolerance,
    samplingMode,
    resolvedAdaptiveTolerance,
    resolvedAdaptiveMaxDepth,
  ]);

  const workerPayload = useMemo<PlaneQueryWorkerPayload>(
    () => ({
      plane: {
        model: 'oklch',
        x: {
          channel: axes.x.channel,
          range: axes.x.range,
        },
        y: {
          channel: axes.y.channel,
          range: axes.y.range,
        },
        fixed: {
          l: requested.l,
          c: requested.c,
          h: requested.h,
          alpha: requested.alpha,
        },
      },
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
      axes.x.channel,
      axes.x.range,
      axes.y.channel,
      axes.y.range,
      effectiveSteps,
      gamut,
      hue,
      isDragging,
      performanceProfile,
      requested.alpha,
      requested.c,
      requested.h,
      requested.l,
      resolvedAdaptiveMaxDepth,
      resolvedAdaptiveTolerance,
      resolvedQuality,
      samplingMode,
      simplifyTolerance,
    ],
  );

  const hasCurrentWorkerResponse = useMemo(
    () =>
      activeWorkerRequestId != null &&
      workerPoints != null &&
      workerPoints.requestId === activeWorkerRequestId,
    [activeWorkerRequestId, workerPoints],
  );

  useEffect(() => {
    if (pointsProp || !canUseWorkerOffload() || !isDragging) {
      queueMicrotask(() => setActiveWorkerRequestId(null));
      return;
    }

    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(
          new URL('./workers/plane-query.worker.js', import.meta.url),
          {
            type: 'module',
          },
        );
      } catch {
        queueMicrotask(() => setActiveWorkerRequestId(null));
        return;
      }
    }

    const worker = workerRef.current;
    if (!worker) {
      return;
    }

    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;
    queueMicrotask(() => setActiveWorkerRequestId(nextRequestId));

    const onMessage = (event: MessageEvent<PlaneQueryWorkerResponse>) => {
      const payload = event.data;
      if (!payload || payload.id !== nextRequestId) {
        return;
      }
      if (payload.error || !payload.result) {
        return;
      }

      const unpacked = unpackPlaneQueryResults(payload.result);
      const boundaryResult = unpacked.find(
        (entry): entry is PlaneGamutBoundaryResult =>
          entry.kind === 'gamutBoundary',
      );
      const nextPoints = boundaryResult
        ? toLinePointsFromBoundary(boundaryResult)
        : [];

      setWorkerPoints({
        requestId: payload.id,
        points: nextPoints,
      });
    };

    worker.addEventListener('message', onMessage);

    const message: PlaneQueryWorkerRequest = {
      id: nextRequestId,
      ...workerPayload,
    };
    worker.postMessage(message);

    return () => {
      worker.removeEventListener('message', onMessage);
    };
  }, [isDragging, pointsProp, workerPayload]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const points = useMemo(() => {
    if (pointsProp) {
      return pointsProp;
    }
    if (!(isDragging && canUseWorkerOffload())) {
      return syncComputation?.points ?? [];
    }
    if (hasCurrentWorkerResponse && workerPoints != null) {
      return workerPoints.points;
    }
    return workerPoints?.points ?? syncComputation?.points ?? [];
  }, [
    hasCurrentWorkerResponse,
    isDragging,
    pointsProp,
    syncComputation,
    workerPoints,
  ]);

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
