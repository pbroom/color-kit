import { useEffect, useMemo, useState } from 'react';
import type { SVGAttributes } from 'react';
import type { GamutTarget } from '@color-kit/core';
import {
  getColorAreaChromaBandPoints,
  type ResolvedColorAreaAxes,
} from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line } from './line.js';
import type { ColorAreaLayerQuality } from './gamut-boundary-layer.js';
import type { LinePoint } from './line.js';

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

function resolveMode(mode: ChromaBandLayerMode): 'clamped' | 'proportional' {
  return mode === 'percentage' ? 'proportional' : 'clamped';
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
  const { areaRef, requested, axes, qualityLevel } = useColorAreaContext();
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

  const computedPoints = useMemo(
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
      samplingMode,
      resolvedAdaptiveTolerance,
      resolvedAdaptiveMaxDepth,
    ],
  );
  const points = pointsProp ?? computedPoints;

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
