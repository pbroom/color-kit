import {
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
import { Line } from './line.js';
import type { ColorAreaLayerQuality } from './gamut-boundary-layer.js';
import type {
  ContrastRegionWorkerRequest,
  ContrastRegionWorkerResponse,
} from './workers/contrast-region.worker.types.js';

export type ContrastRegionRenderMode = 'line' | 'region';

export interface ContrastRegionLayerProps extends Omit<LayerProps, 'children'> {
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
  quality?: ColorAreaLayerQuality;
  renderMode?: ContrastRegionRenderMode;
  regionFillColor?: string;
  regionFillOpacity?: number;
  regionDotOpacity?: number;
  regionDotSize?: number;
  regionDotGap?: number;
  pathProps?: SVGAttributes<SVGPathElement>;
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

function canUseWorkerOffload(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toPath(
  points: ColorAreaContrastRegionPoint[],
  closeLoop: boolean,
): string {
  if (points.length < 2) {
    return '';
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
 * Precomposed Layer wrapper for drawing contrast-safe paths or filled regions.
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
  quality = 'auto',
  renderMode = 'line',
  regionFillColor = '#c0e1ff',
  regionFillOpacity = 0.22,
  regionDotOpacity = 0,
  regionDotSize = 2,
  regionDotGap = 3,
  pathProps,
  ...props
}: ContrastRegionLayerProps) {
  const { requested, axes, qualityLevel, isDragging } = useColorAreaContext();
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
  const options = useMemo<ColorAreaContrastRegionOptions>(
    () => ({
      gamut,
      threshold,
      level,
      lightnessSteps: effectiveLightnessSteps,
      chromaSteps: effectiveChromaSteps,
      maxChroma,
      tolerance,
      maxIterations,
      alpha,
    }),
    [
      alpha,
      effectiveChromaSteps,
      effectiveLightnessSteps,
      gamut,
      level,
      maxChroma,
      maxIterations,
      threshold,
      tolerance,
    ],
  );

  const syncPaths = useMemo(
    () =>
      getColorAreaContrastRegionPaths(
        resolvedReference,
        resolvedHue,
        axes,
        options,
      ),
    [axes, options, resolvedHue, resolvedReference],
  );
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
    paths: typeof syncPaths;
  } | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const regionFillSvgRef = useRef<SVGSVGElement | null>(null);
  const [regionFillSize, setRegionFillSize] = useState({
      width: 100,
      height: 100,
  });
  const paths = useMemo(() => {
    if (
      isDragging &&
      canUseWorkerOffload() &&
      workerPaths &&
      workerPaths.payload === workerPayload
    ) {
      return workerPaths.paths;
    }
    return syncPaths;
  }, [isDragging, syncPaths, workerPaths, workerPayload]);

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
        return;
      }
    }

    const worker = workerRef.current;
    if (!worker) {
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
        return;
      }
      setWorkerPaths({
        payload: workerPayload,
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
  }, [isDragging, workerPayload]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const patternId = useId().replace(/[:]/g, '_');
  const regionPathData = useMemo(
    () =>
      paths
        .map((points) => toPath(points, true))
        .filter((path) => path.length > 0)
        .join(' '),
    [paths],
  );

  const dotOpacity = clamp01(regionDotOpacity);
  const dotSize = Math.max(1, regionDotSize);
  const dotGap = Math.max(0, regionDotGap);
  const dotCell = dotSize + dotGap;
  const dotCellX = (dotCell * 100) / Math.max(1, regionFillSize.width);
  const dotCellY = (dotCell * 100) / Math.max(1, regionFillSize.height);
  const dotSizeX = (dotSize * 100) / Math.max(1, regionFillSize.width);
  const dotSizeY = (dotSize * 100) / Math.max(1, regionFillSize.height);

  useEffect(() => {
    if (
      renderMode !== 'region' ||
      dotOpacity <= 0 ||
      typeof window === 'undefined'
    ) {
      return;
    }

    const svg = regionFillSvgRef.current;
    if (!svg) {
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      setRegionFillSize((current) => {
        if (
          Math.abs(current.width - rect.width) < 0.5 &&
          Math.abs(current.height - rect.height) < 0.5
        ) {
          return current;
        }
        return {
          width: rect.width,
          height: rect.height,
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
      const observer = new ResizeObserver(() => {
        schedule();
      });
      observer.observe(svg);
      return () => {
        observer.disconnect();
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
  }, [dotOpacity, regionPathData, renderMode]);

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'overlay'}
      interactive={props.interactive ?? false}
      data-color-area-contrast-region-layer=""
      data-quality={resolvedQuality}
      data-render-mode={renderMode}
      data-worker={isDragging && canUseWorkerOffload() ? 'async' : 'sync'}
    >
      {renderMode === 'line'
        ? paths.map((points, index) => (
            <Line
              key={index}
              points={points}
              pathProps={{
                fill: 'none',
                ...pathProps,
              }}
            />
          ))
        : null}

      {renderMode === 'region' && regionPathData ? (
        <svg
          ref={regionFillSvgRef}
          data-color-area-contrast-region-fill=""
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
          {dotOpacity > 0 ? (
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
                  fill={`rgba(255,255,255,${dotOpacity})`}
                />
              </pattern>
            </defs>
          ) : null}

          <path
            d={regionPathData}
            fill={regionFillColor}
            fillOpacity={clamp01(regionFillOpacity)}
            {...pathProps}
          />
          {dotOpacity > 0 ? (
            <path
              d={regionPathData}
              fill={`url(#${patternId})`}
              stroke="none"
            />
          ) : null}
        </svg>
      ) : null}
    </Layer>
  );
}
