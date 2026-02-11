import type { SVGAttributes } from 'react';
import type { Color, GamutTarget } from '@color-kit/core';
import {
  getColorAreaContrastRegionPaths,
  type ColorAreaContrastRegionOptions,
} from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line } from './line.js';

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
  pathProps?: SVGAttributes<SVGPathElement>;
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
  pathProps,
  ...props
}: ContrastRegionLayerProps) {
  const { requested, axes } = useColorAreaContext();
  const paths = getColorAreaContrastRegionPaths(
    reference ?? requested,
    hue ?? requested.h,
    axes,
    {
      gamut,
      threshold,
      level,
      lightnessSteps,
      chromaSteps,
      maxChroma,
      tolerance,
      maxIterations,
      alpha,
    },
  );

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'overlay'}
      interactive={props.interactive ?? false}
      data-color-area-contrast-region-layer=""
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
