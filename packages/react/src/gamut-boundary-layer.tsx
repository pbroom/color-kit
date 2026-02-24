import { useMemo } from 'react';
import type { SVGAttributes } from 'react';
import type { GamutTarget } from '@color-kit/core';
import { getColorAreaGamutBoundaryPoints } from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line } from './line.js';
import { PathPointsOverlay } from './path-points-overlay.js';

export type ColorAreaLayerQuality = 'auto' | 'high' | 'medium' | 'low';

export interface GamutBoundaryLayerProps extends Omit<LayerProps, 'children'> {
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
  ...props
}: GamutBoundaryLayerProps) {
  const { requested, axes, qualityLevel } = useColorAreaContext();
  const resolvedQuality = resolveQuality(quality, qualityLevel);
  const effectiveSteps = useMemo(
    () =>
      Math.max(8, Math.round(steps * qualityStepMultiplier(resolvedQuality))),
    [resolvedQuality, steps],
  );
  const points = useMemo(
    () =>
      getColorAreaGamutBoundaryPoints(hue ?? requested.h, axes, {
        gamut,
        steps: effectiveSteps,
        simplifyTolerance,
        samplingMode,
        adaptiveTolerance,
        adaptiveMaxDepth,
      }),
    [
      axes,
      effectiveSteps,
      gamut,
      hue,
      requested.h,
      simplifyTolerance,
      samplingMode,
      adaptiveTolerance,
      adaptiveMaxDepth,
    ],
  );

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'overlay'}
      interactive={props.interactive ?? false}
      data-color-area-gamut-boundary-layer=""
      data-quality={resolvedQuality}
    >
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
