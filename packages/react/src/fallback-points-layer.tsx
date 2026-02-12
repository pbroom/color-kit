import type { HTMLAttributes } from 'react';
import { toHex, toP3Gamut, toSrgbGamut } from '@color-kit/core';
import { getColorDisplayStyles } from './api/color-display.js';
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

  const srgb = toSrgbGamut(requested);
  const p3 = toP3Gamut(requested);

  const srgbPos = getColorAreaThumbPosition(srgb, axes);
  const p3Pos = getColorAreaThumbPosition(p3, axes);
  const p3Styles = getColorDisplayStyles(p3, srgb, 'display-p3');
  const srgbStyles = getColorDisplayStyles(srgb, srgb, 'srgb');

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'annotation'}
      zIndex={props.zIndex ?? 2147483646}
      interactive={props.interactive ?? false}
      data-color-area-fallback-points-layer=""
    >
      {showP3 ? (
        <Point
          {...p3PointProps}
          x={p3Pos.x}
          y={p3Pos.y}
          data-color-area-fallback-point=""
          data-color={toHex(p3)}
          data-gamut="display-p3"
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.6)',
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.55), 0 0 0 2px rgba(64,245,210,0.85)',
            pointerEvents: 'none',
            ...p3Styles,
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
          data-color={toHex(srgb)}
          data-gamut="srgb"
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.65)',
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.55), 0 0 0 2px rgba(255,212,71,0.9)',
            pointerEvents: 'none',
            ...srgbStyles,
            ...srgbPointProps?.style,
          }}
        />
      ) : null}
    </Layer>
  );
}
