import { useMemo } from 'react';
import type { HTMLAttributes } from 'react';
import { toP3Gamut, toSrgbGamut } from '@color-kit/core';
import { getColorAreaThumbPosition } from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Point } from './point.js';

export interface FallbackPointsLayerProps extends Omit<LayerProps, 'children'> {
  showSrgb?: boolean;
  showP3?: boolean;
  srgbPointProps?: Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;
  p3PointProps?: Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;
}

/**
 * Precomposed Layer wrapper that renders realized display-p3 and sRGB markers.
 */
export function FallbackPointsLayer({
  showSrgb = true,
  showP3 = true,
  srgbPointProps,
  p3PointProps,
  ...props
}: FallbackPointsLayerProps) {
  const { requested, axes } = useColorAreaContext();

  const srgb = useMemo(() => toSrgbGamut(requested), [requested]);
  const p3 = useMemo(() => toP3Gamut(requested), [requested]);

  const srgbPos = getColorAreaThumbPosition(srgb, axes);
  const p3Pos = getColorAreaThumbPosition(p3, axes);

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'annotation'}
      interactive={props.interactive ?? false}
      data-color-area-fallback-points-layer=""
    >
      {showP3 ? (
        <Point
          {...p3PointProps}
          x={p3Pos.x}
          y={p3Pos.y}
          data-color-area-fallback-point=""
          data-gamut="display-p3"
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: '#40f5d2',
            border: '1px solid rgba(0,0,0,0.6)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.55)',
            pointerEvents: 'none',
            ...p3PointProps?.style,
          }}
        />
      ) : null}
      {showSrgb ? (
        <Point
          {...srgbPointProps}
          x={srgbPos.x}
          y={srgbPos.y}
          data-color-area-fallback-point=""
          data-gamut="srgb"
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: '#ffd447',
            border: '1px solid rgba(0,0,0,0.65)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.55)',
            pointerEvents: 'none',
            ...srgbPointProps?.style,
          }}
        />
      ) : null}
    </Layer>
  );
}
