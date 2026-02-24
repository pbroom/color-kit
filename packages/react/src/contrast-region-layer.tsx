import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type SVGAttributes,
} from 'react';
import type { Color, GamutTarget } from '@color-kit/core';
import {
  getColorAreaContrastRegionPaths,
  type ColorAreaContrastRegionOptions,
  type ColorAreaContrastRegionPoint,
} from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line, pathWithRoundedCorners } from './line.js';
import { PathPointsOverlay } from './path-points-overlay.js';
import type { ColorAreaLayerQuality } from './gamut-boundary-layer.js';
import type {
  ContrastRegionWorkerRequest,
  ContrastRegionWorkerResponse,
} from './workers/contrast-region.worker.types.js';

export interface ContrastRegionLayerMetrics {
  source: 'sync' | 'worker';
  requestId: number;
  computeTimeMs: number;
  pathCount: number;
  pointCount: number;
  lightnessSteps: number;
  chromaSteps: number;
  quality: 'high' | 'medium' | 'low';
  isDragging: boolean;
}

export interface ContrastRegionLayerProps extends LayerProps {
  reference?: Color;
  hue?: number;
  gamut?: GamutTarget;
  threshold?: number;
  level?: ColorAreaContrastRegionOptions['level'];
  lightnessSteps?: number;
  chromaSteps?: number;
  maxChroma?: number;
  tolerance?: number;
  maxIterations?: number;
  alpha?: number;
  edgeInterpolation?: ColorAreaContrastRegionOptions['edgeInterpolation'];
  quality?: ColorAreaLayerQuality;
  pathProps?: SVGAttributes<SVGPathElement>;
  showPathPoints?: boolean;
  pointProps?: SVGAttributes<SVGCircleElement>;
  onMetrics?: (metrics: ContrastRegionLayerMetrics) => void;
  /** RDP simplification tolerance in (l,c) space; omit to disable */
  simplifyTolerance?: number;
  /** 'uniform' (default) or 'adaptive' grid for contour extraction */
  samplingMode?: 'uniform' | 'adaptive';
  adaptiveBaseSteps?: number;
  adaptiveMaxDepth?: number;
  /** Corner radius in 0-1 for path vertices; omit for sharp corners */
  cornerRadius?: number;
}

interface ContrastRegionPathContextValue {
  paths: ColorAreaContrastRegionPoint[][];
  regionPathData: string;
  cornerRadius?: number;
}

const ContrastRegionPathContext =
  createContext<ContrastRegionPathContextValue | null>(null);

function useContrastRegionPath(): ContrastRegionPathContextValue {
  const value = useContext(ContrastRegionPathContext);
  if (!value) {
    throw new Error(
      'ContrastRegionFill must be used as a child of ContrastRegionLayer.',
    );
  }
  return value;
}

export interface ContrastRegionFillProps {
  /** Fill color for the region. @default '#c0e1ff' */
  fillColor?: string;
  /** Fill opacity 0–1. @default 0.22 */
  fillOpacity?: number;
  /** Dot pattern opacity 0–1; 0 disables dots. @default 0 */
  dotOpacity?: number;
  /** Dot size in px. @default 2 */
  dotSize?: number;
  /** Gap between dots in px. @default 3 */
  dotGap?: number;
  /** Additional path element props (e.g. fill). */
  pathProps?: SVGAttributes<SVGPathElement>;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Renders a filled region (and optional dot pattern) for the computed contrast
 * contour. Must be used as a child of ContrastRegionLayer.
 */
export function ContrastRegionFill({
  fillColor = '#c0e1ff',
  fillOpacity = 0.22,
  dotOpacity = 0,
  dotSize = 2,
  dotGap = 3,
  pathProps,
}: ContrastRegionFillProps) {
  const { regionPathData } = useContrastRegionPath();
  const patternId = useId().replace(/[:]/g, '_');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ width: 100, height: 100 });

  const dotOpacityClamped = clamp01(dotOpacity);
  const dotSizeEffective = Math.max(1, dotSize);
  const dotGapEffective = Math.max(0, dotGap);
  const dotCell = dotSizeEffective + dotGapEffective;
  const dotCellX = (dotCell * 100) / Math.max(1, size.width);
  const dotCellY = (dotCell * 100) / Math.max(1, size.height);
  const dotSizeX = (dotSizeEffective * 100) / Math.max(1, size.width);
  const dotSizeY = (dotSizeEffective * 100) / Math.max(1, size.height);

  useEffect(() => {
    if (dotOpacityClamped <= 0 || typeof window === 'undefined') {
      return;
    }
    const svg = svgRef.current;
    if (!svg) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setSize((current) => {
        if (
          Math.abs(current.width - rect.width) < 0.5 &&
          Math.abs(current.height - rect.height) < 0.5
        ) {
          return current;
        }
        return { width: rect.width, height: rect.height };
      });
    };
    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(measure);
    };
    schedule();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(schedule);
      observer.observe(svg);
      return () => {
        observer.disconnect();
        if (frame !== 0) window.cancelAnimationFrame(frame);
      };
    }
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [dotOpacityClamped, regionPathData]);

  if (!regionPathData) return null;

  return (
    <svg
      ref={svgRef}
      data-color-area-contrast-region-fill=""
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {dotOpacityClamped > 0 ? (
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={dotCellX}
            height={dotCellY}
          >
            <ellipse
              cx={dotSizeX * 0.5}
              cy={dotSizeY * 0.5}
              rx={dotSizeX * 0.5}
              ry={dotSizeY * 0.5}
              fill={`rgba(255,255,255,${dotOpacityClamped})`}
            />
          </pattern>
        </defs>
      ) : null}
      <path
        d={regionPathData}
        fill={fillColor}
        fillOpacity={clamp01(fillOpacity)}
        {...pathProps}
      />
      {dotOpacityClamped > 0 ? (
        <path d={regionPathData} fill={`url(#${patternId})`} stroke="none" />
      ) : null}
    </svg>
  );
}

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
  if (quality === 'medium') return 0.68;
  return 0.45;
}

const MIN_AUTO_ADAPTIVE_BASE_STEPS = 8;
const MAX_AUTO_ADAPTIVE_BASE_STEPS = 48;
const MIN_AUTO_ADAPTIVE_DEPTH = 1;
const MAX_AUTO_ADAPTIVE_DEPTH = 6;

function autoAdaptiveBaseSteps(
  quality: 'high' | 'medium' | 'low',
  widthPx: number,
  heightPx: number,
): number {
  const targetCellPx = quality === 'high' ? 28 : quality === 'medium' ? 36 : 48;
  const longestEdge = Math.max(1, Math.max(widthPx, heightPx));
  const baseSteps = Math.round(longestEdge / targetCellPx);
  return Math.min(
    MAX_AUTO_ADAPTIVE_BASE_STEPS,
    Math.max(MIN_AUTO_ADAPTIVE_BASE_STEPS, baseSteps),
  );
}

function autoAdaptiveMaxDepth(
  quality: 'high' | 'medium' | 'low',
  widthPx: number,
  heightPx: number,
  baseSteps: number,
): number {
  const longestEdge = Math.max(1, Math.max(widthPx, heightPx));
  const baseCellPx = longestEdge / Math.max(1, baseSteps);
  const targetLeafPx = quality === 'high' ? 7 : quality === 'medium' ? 9 : 12;
  const depth = Math.ceil(Math.log2(Math.max(1, baseCellPx / targetLeafPx)));
  return Math.min(
    MAX_AUTO_ADAPTIVE_DEPTH,
    Math.max(MIN_AUTO_ADAPTIVE_DEPTH, depth),
  );
}

function canUseWorkerOffload(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function countPathPoints(paths: ColorAreaContrastRegionPoint[][]): number {
  return paths.reduce((total, path) => total + path.length, 0);
}

function toPath(
  points: ColorAreaContrastRegionPoint[],
  closeLoop: boolean,
  cornerRadius?: number,
): string {
  if (points.length < 2) {
    return '';
  }
  if (cornerRadius != null && cornerRadius > 0) {
    return pathWithRoundedCorners(
      points.map((p) => ({ x: p.x, y: p.y })),
      cornerRadius,
      closeLoop,
    );
  }
  const commands = points.map((point, index) => {
    const x = (point.x * 100).toFixed(3);
    const y = (point.y * 100).toFixed(3);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  });

  if (closeLoop) {
    commands.push('Z');
  }

  return commands.join(' ');
}

/**
 * Precomposed Layer wrapper for drawing contrast-safe paths. Compose
 * ContrastRegionFill as a child for filled region + dot pattern.
 */
export function ContrastRegionLayer({
  reference,
  hue,
  gamut = 'srgb',
  threshold,
  level,
  lightnessSteps,
  chromaSteps,
  maxChroma,
  tolerance,
  maxIterations,
  alpha,
  edgeInterpolation = 'linear',
  quality = 'auto',
  pathProps,
  showPathPoints = false,
  pointProps,
  onMetrics,
  simplifyTolerance,
  samplingMode,
  adaptiveBaseSteps,
  adaptiveMaxDepth,
  cornerRadius,
  children,
  ...props
}: ContrastRegionLayerProps) {
  const { areaRef, requested, axes, qualityLevel, isDragging } =
    useColorAreaContext();
  const [areaSize, setAreaSize] = useState({
    width: 0,
    height: 0,
    dpr: 1,
  });
  const resolvedQuality = resolveQuality(quality, qualityLevel);
  const multiplier = qualityStepMultiplier(resolvedQuality);
  const effectiveLightnessSteps = Math.max(
    12,
    Math.round((lightnessSteps ?? 64) * multiplier),
  );
  const effectiveChromaSteps = Math.max(
    12,
    Math.round((chromaSteps ?? 64) * multiplier),
  );

  const resolvedReference = reference ?? requested;
  const resolvedHue = hue ?? requested.h;

  const [frozenSteps, setFrozenSteps] = useState<{
    lightness: number;
    chroma: number;
  } | null>(null);
  const prevDraggingRef = useRef(false);
  useEffect(() => {
    if (isDragging && !prevDraggingRef.current) {
      const steps = {
        lightness: effectiveLightnessSteps,
        chroma: effectiveChromaSteps,
      };
      queueMicrotask(() => setFrozenSteps(steps));
    }
    if (!isDragging) {
      queueMicrotask(() => setFrozenSteps(null));
    }
    prevDraggingRef.current = isDragging;
  }, [isDragging, effectiveLightnessSteps, effectiveChromaSteps]);

  const stepsForOptions =
    isDragging && frozenSteps
      ? frozenSteps
      : {
          lightness: effectiveLightnessSteps,
          chroma: effectiveChromaSteps,
        };

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

  const resolvedAdaptiveBaseSteps = useMemo(() => {
    if (samplingMode !== 'adaptive') {
      return adaptiveBaseSteps;
    }
    if (adaptiveBaseSteps != null) {
      return adaptiveBaseSteps;
    }
    if (areaSize.width <= 0 || areaSize.height <= 0) {
      return undefined;
    }
    const widthPx = areaSize.width * areaSize.dpr;
    const heightPx = areaSize.height * areaSize.dpr;
    return autoAdaptiveBaseSteps(resolvedQuality, widthPx, heightPx);
  }, [
    adaptiveBaseSteps,
    areaSize.dpr,
    areaSize.height,
    areaSize.width,
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
    const baseSteps =
      resolvedAdaptiveBaseSteps ??
      autoAdaptiveBaseSteps(resolvedQuality, widthPx, heightPx);
    return autoAdaptiveMaxDepth(resolvedQuality, widthPx, heightPx, baseSteps);
  }, [
    adaptiveMaxDepth,
    areaSize.dpr,
    areaSize.height,
    areaSize.width,
    resolvedAdaptiveBaseSteps,
    resolvedQuality,
    samplingMode,
  ]);

  const options = useMemo<ColorAreaContrastRegionOptions>(
    () => ({
      gamut,
      threshold,
      level,
      lightnessSteps: stepsForOptions.lightness,
      chromaSteps: stepsForOptions.chroma,
      maxChroma,
      tolerance,
      maxIterations,
      alpha,
      edgeInterpolation,
      simplifyTolerance,
      samplingMode,
      adaptiveBaseSteps: resolvedAdaptiveBaseSteps,
      adaptiveMaxDepth: resolvedAdaptiveMaxDepth,
    }),
    [
      alpha,
      edgeInterpolation,
      stepsForOptions.lightness,
      stepsForOptions.chroma,
      gamut,
      level,
      maxChroma,
      maxIterations,
      simplifyTolerance,
      samplingMode,
      resolvedAdaptiveBaseSteps,
      resolvedAdaptiveMaxDepth,
      threshold,
      tolerance,
    ],
  );

  const syncComputation = useMemo(() => {
    if (isDragging && canUseWorkerOffload()) {
      return null;
    }
    const start = nowMs();
    const paths = getColorAreaContrastRegionPaths(
      resolvedReference,
      resolvedHue,
      axes,
      options,
    );
    return {
      paths,
      computeTimeMs: nowMs() - start,
    };
  }, [axes, isDragging, options, resolvedHue, resolvedReference]);
  const workerPayload = useMemo(
    () => ({
      reference: resolvedReference,
      hue: resolvedHue,
      axes,
      options,
    }),
    [axes, options, resolvedHue, resolvedReference],
  );

  const [workerPaths, setWorkerPaths] = useState<{
    payload: typeof workerPayload;
    paths: ColorAreaContrastRegionPoint[][];
  } | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const paths = useMemo(() => {
    if (isDragging && canUseWorkerOffload()) {
      return workerPaths?.paths ?? [];
    }
    return syncComputation?.paths ?? [];
  }, [isDragging, syncComputation, workerPaths]);

  const emitMetrics = useCallback(
    (payload: {
      source: 'sync' | 'worker';
      requestId: number;
      computeTimeMs: number;
      paths: ColorAreaContrastRegionPoint[][];
    }) => {
      onMetrics?.({
        source: payload.source,
        requestId: payload.requestId,
        computeTimeMs: payload.computeTimeMs,
        pathCount: payload.paths.length,
        pointCount: countPathPoints(payload.paths),
        lightnessSteps: effectiveLightnessSteps,
        chromaSteps: effectiveChromaSteps,
        quality: resolvedQuality,
        isDragging,
      });
    },
    [
      effectiveChromaSteps,
      effectiveLightnessSteps,
      isDragging,
      onMetrics,
      resolvedQuality,
    ],
  );

  useEffect(() => {
    if (!syncComputation) {
      return;
    }
    emitMetrics({
      source: 'sync',
      requestId: requestIdRef.current,
      computeTimeMs: syncComputation.computeTimeMs,
      paths: syncComputation.paths,
    });
  }, [emitMetrics, syncComputation]);

  useEffect(() => {
    if (!canUseWorkerOffload() || !isDragging) {
      return;
    }

    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(
          new URL('./workers/contrast-region.worker.js', import.meta.url),
          {
            type: 'module',
          },
        );
      } catch {
        if (syncComputation) {
          emitMetrics({
            source: 'sync',
            requestId: requestIdRef.current,
            computeTimeMs: syncComputation.computeTimeMs,
            paths: syncComputation.paths,
          });
        }
        return;
      }
    }

    const worker = workerRef.current;
    if (!worker) {
      if (syncComputation) {
        emitMetrics({
          source: 'sync',
          requestId: requestIdRef.current,
          computeTimeMs: syncComputation.computeTimeMs,
          paths: syncComputation.paths,
        });
      }
      return;
    }

    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;

    const onMessage = (event: MessageEvent<ContrastRegionWorkerResponse>) => {
      const payload = event.data;
      if (!payload || payload.id !== nextRequestId) {
        return;
      }
      if (payload.error) {
        if (syncComputation) {
          emitMetrics({
            source: 'sync',
            requestId: requestIdRef.current,
            computeTimeMs: syncComputation.computeTimeMs,
            paths: syncComputation.paths,
          });
        }
        return;
      }
      setWorkerPaths({
        payload: workerPayload,
        paths: payload.paths,
      });
      emitMetrics({
        source: 'worker',
        requestId: payload.id,
        computeTimeMs: payload.computeTimeMs ?? 0,
        paths: payload.paths,
      });
    };

    worker.addEventListener('message', onMessage);

    const message: ContrastRegionWorkerRequest = {
      id: nextRequestId,
      ...workerPayload,
    };
    worker.postMessage(message);

    return () => {
      worker.removeEventListener('message', onMessage);
    };
  }, [axes, emitMetrics, isDragging, syncComputation, workerPayload]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const regionPathData = useMemo(
    () =>
      paths
        .map((points) => toPath(points, true, cornerRadius))
        .filter((path) => path.length > 0)
        .join(' '),
    [paths, cornerRadius],
  );

  const pathContextValue: ContrastRegionPathContextValue = useMemo(
    () => ({
      paths,
      regionPathData,
      cornerRadius,
    }),
    [paths, regionPathData, cornerRadius],
  );

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'overlay'}
      interactive={props.interactive ?? false}
      data-color-area-contrast-region-layer=""
      data-quality={resolvedQuality}
      data-worker={isDragging && canUseWorkerOffload() ? 'async' : 'sync'}
    >
      <ContrastRegionPathContext.Provider value={pathContextValue}>
        {children}
      </ContrastRegionPathContext.Provider>
      {paths.map((points, index) => (
        <Line
          key={index}
          points={points}
          cornerRadius={cornerRadius}
          closed
          pathProps={{
            fill: 'none',
            ...pathProps,
          }}
        />
      ))}
      {showPathPoints ? (
        <PathPointsOverlay
          paths={paths}
          pointProps={pointProps}
          data-color-area-contrast-region-points=""
        />
      ) : null}
    </Layer>
  );
}
