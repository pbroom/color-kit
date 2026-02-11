import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type SVGAttributes,
} from 'react';
import type { Color, GamutTarget } from '@color-kit/core';
import {
  getColorAreaContrastRegionPaths,
  type ColorAreaContrastRegionOptions,
} from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line } from './line.js';
import type { ColorAreaLayerQuality } from './gamut-boundary-layer.js';
import type {
  ContrastRegionWorkerRequest,
  ContrastRegionWorkerResponse,
} from './workers/contrast-region.worker.types.js';

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

/**
 * Precomposed Layer wrapper for drawing contrast-safe region paths.
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

  const syncPaths = useMemo(() => {
    if (isDragging && canUseWorkerOffload()) {
      return null;
    }
    return getColorAreaContrastRegionPaths(
      resolvedReference,
      resolvedHue,
      axes,
      options,
    );
  }, [axes, isDragging, options, resolvedHue, resolvedReference]);

  const [paths, setPaths] = useState(() => syncPaths ?? []);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!canUseWorkerOffload()) {
      if (syncPaths) {
        setPaths(syncPaths);
      }
      return;
    }

    if (!isDragging) {
      if (syncPaths) {
        setPaths(syncPaths);
      }
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
        if (syncPaths) {
          setPaths(syncPaths);
        }
        return;
      }
    }

    const worker = workerRef.current;
    if (!worker) {
      if (syncPaths) {
        setPaths(syncPaths);
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
        if (syncPaths) {
          setPaths(syncPaths);
        }
        return;
      }
      setPaths(payload.paths);
    };

    worker.addEventListener('message', onMessage);

    const message: ContrastRegionWorkerRequest = {
      id: nextRequestId,
      reference: resolvedReference,
      hue: resolvedHue,
      axes,
      options,
    };
    worker.postMessage(message);

    return () => {
      worker.removeEventListener('message', onMessage);
    };
  }, [axes, isDragging, options, resolvedHue, resolvedReference, syncPaths]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'overlay'}
      interactive={props.interactive ?? false}
      data-color-area-contrast-region-layer=""
      data-quality={resolvedQuality}
      data-worker={isDragging && canUseWorkerOffload() ? 'async' : 'sync'}
    >
      {paths.map((points, index) => (
        <Line
          key={index}
          points={points}
          pathProps={{
            fill: 'none',
            ...pathProps,
          }}
        />
      ))}
    </Layer>
  );
}
