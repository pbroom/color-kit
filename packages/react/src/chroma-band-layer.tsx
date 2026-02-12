import { useMemo } from 'react';
import type { SVGAttributes } from 'react';
import type { GamutTarget } from '@color-kit/core';
import { getColorAreaChromaBandPoints } from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line } from './line.js';
import type { ColorAreaLayerQuality } from './gamut-boundary-layer.js';

export type ChromaBandLayerMode = 'closest' | 'percentage';

export interface ChromaBandLayerProps extends Omit<LayerProps, 'children'> {
  mode?: ChromaBandLayerMode;
  gamut?: GamutTarget;
  hue?: number;
  steps?: number;
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
  if (quality === 'medium') return 0.72;
  return 0.5;
}

function resolveMode(mode: ChromaBandLayerMode): 'clamped' | 'proportional' {
  return mode === 'percentage' ? 'proportional' : 'clamped';
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
  pathProps,
  ...props
}: ChromaBandLayerProps) {
  const { requested, axes, qualityLevel } = useColorAreaContext();
  const resolvedQuality = resolveQuality(quality, qualityLevel);
  const effectiveSteps = useMemo(
    () =>
      Math.max(8, Math.round(steps * qualityStepMultiplier(resolvedQuality))),
    [resolvedQuality, steps],
  );

  const points = useMemo(
    () =>
      getColorAreaChromaBandPoints(requested, hue ?? requested.h, axes, {
        gamut,
        mode: resolveMode(mode),
        steps: effectiveSteps,
        selectedLightness: requested.l,
        alpha: requested.alpha,
      }),
    [axes, effectiveSteps, gamut, hue, mode, requested],
  );

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'overlay'}
      interactive={props.interactive ?? false}
      data-color-area-chroma-band-layer=""
      data-quality={resolvedQuality}
      data-mode={mode}
    >
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
