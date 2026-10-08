import type { HTMLAttributes } from 'react';
import { toHex, type Color } from '@color-kit/core';
import { getColorDisplayStyles } from '@color-kit/driver';
import { getColorAreaFallbackPoint } from '@color-kit/driver';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Point } from './point.js';

/** Props for {@link FallbackPointsLayer}; other {@link LayerProps} are forwarded. */
export interface FallbackPointsLayerProps extends LayerProps {
  /**
   * Show the sRGB fallback marker.
   * @defaultValue true
   */
  showSrgb?: boolean;
  /**
   * Show the Display P3 fallback marker.
   * @defaultValue true
   */
  showP3?: boolean;
  /** Props for the sRGB marker `div` (its `style` is merged over the defaults). */
  srgbPointProps?: Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;
  /** Props for the P3 marker `div` (its `style` is merged over the defaults). */
  p3PointProps?: Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;
  /** Overrides the computed sRGB marker position (normalized, top-left origin) and color. */
  srgbPoint?: { x: number; y: number; color?: Color };
  /** Overrides the computed P3 marker position (normalized, top-left origin) and color. */
  p3Point?: { x: number; y: number; color?: Color };
}

/**
 * Annotation {@link Layer} with two markers showing where the requested
 * color lands after gamut mapping into sRGB and into Display P3.
 *
 * Each 10 px marker sits at the mapped color's position on the area and is
 * filled with that color; for an in-gamut color both coincide with the
 * thumb. The layer stacks just below the thumb by default. Must be rendered
 * inside a {@link ColorArea}.
 *
 * @throws {Error} When rendered outside a `<ColorArea>`.
 *
 * @example
 * ```tsx
 * import { Color, ColorArea, ColorPlane, FallbackPointsLayer } from 'color-kit/react';
 *
 * export const Picker = () => (
 *   <Color defaultColor="oklch(0.7 0.3 150)">
 *     <ColorArea style={{ width: 240, height: 240 }}>
 *       <ColorPlane />
 *       <FallbackPointsLayer showP3={false} />
 *     </ColorArea>
 *   </Color>
 * );
 * ```
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

  const srgb = getColorAreaFallbackPoint(axes, {
    color: requested,
    gamut: 'srgb',
  });
  const p3 = getColorAreaFallbackPoint(axes, {
    color: requested,
    gamut: 'display-p3',
  });

  const srgbColor = srgbPoint?.color ?? srgb.color;
  const p3Color = p3Point?.color ?? p3.color;
  const srgbPos = srgbPoint ?? srgb;
  const p3Pos = p3Point ?? p3;
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
