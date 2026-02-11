import type { SVGAttributes } from 'react';
import type { GamutTarget } from '@color-kit/core';
import { getColorAreaGamutBoundaryPoints } from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line } from './line.js';

export interface GamutBoundaryLayerProps extends Omit<LayerProps, 'children'> {
  gamut?: GamutTarget;
  hue?: number;
  steps?: number;
  pathProps?: SVGAttributes<SVGPathElement>;
}

/**
 * Precomposed Layer wrapper for drawing a gamut boundary path.
 */
export function GamutBoundaryLayer({
  gamut = 'srgb',
  hue,
  steps = 48,
  pathProps,
  ...props
}: GamutBoundaryLayerProps) {
  const { requested, axes } = useColorAreaContext();
  const points = getColorAreaGamutBoundaryPoints(hue ?? requested.h, axes, {
    gamut,
    steps,
  });

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'overlay'}
      interactive={props.interactive ?? false}
      data-color-area-gamut-boundary-layer=""
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
