import type { HTMLAttributes } from 'react';
import { toHex, toP3Gamut, toSrgbGamut, type Color } from '@color-kit/core';
import { getColorDisplayStyles } from './api/color-display.js';
import { getColorAreaThumbPosition } from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Point } from './point.js';

export interface FallbackPointsLayerProps extends LayerProps {
  showSrgb?: boolean;
  showP3?: boolean;
  srgbPointProps?: Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;
  p3PointProps?: Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;
  srgbPoint?: { x: number; y: number; color?: Color };
  p3Point?: { x: number; y: number; color?: Color };
}

/**
 * Precomposed Layer wrapper that renders realized display-p3 and sRGB markers.
 */
export function FallbackPointsLayer({
  showSrgb = true,
  showP3 = true,
  srgbPointProps,
  p3PointProps,
  srgbPoint,
  p3Point,
  children,
  ...props
}: FallbackPointsLayerProps) {
  const { requested, axes } = useColorAreaContext();

  const srgb = toSrgbGamut(requested);
  const p3 = toP3Gamut(requested);

  const srgbColor = srgbPoint?.color ?? srgb;
  const p3Color = p3Point?.color ?? p3;
  const srgbPos = srgbPoint ?? getColorAreaThumbPosition(srgbColor, axes);
  const p3Pos = p3Point ?? getColorAreaThumbPosition(p3Color, axes);
  const p3Styles = getColorDisplayStyles(p3Color, srgbColor, 'display-p3');
  const srgbStyles = getColorDisplayStyles(srgbColor, srgbColor, 'srgb');

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'annotation'}
      zIndex={props.zIndex ?? 2147483646}
      interactive={props.interactive ?? false}
      data-color-area-fallback-points-layer=""
    >
      {children}
      {showP3 ? (
        <Point
          {...p3PointProps}
          x={p3Pos.x}
          y={p3Pos.y}
          data-color-area-fallback-point=""
          data-color={toHex(p3Color)}
          data-gamut="display-p3"
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            border: '2px solid #ffffff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
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
          data-color={toHex(srgbColor)}
          data-gamut="srgb"
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            border: '2px solid #ffffff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
            ...srgbStyles,
            ...srgbPointProps?.style,
          }}
        />
      ) : null}
    </Layer>
  );
}
