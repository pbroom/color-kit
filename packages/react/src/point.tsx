import { forwardRef, type HTMLAttributes } from 'react';

/** Props for {@link Point}; other `div` attributes are forwarded. */
export interface PointProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /** Normalized X coordinate in [0,1], from the left edge. */
  x: number;
  /** Normalized Y coordinate in [0,1], from the top edge. */
  y: number;
}

/**
 * Absolutely positioned marker centered on a normalized (x, y) position of
 * its container, typically a {@link Layer} inside a {@link ColorArea}.
 *
 * Coordinates are in [0,1] from the top-left corner (not clamped) and are
 * applied as percentage `left` / `top` with a `translate(-50%, -50%)`
 * transform. The component is unstyled: give it a size and appearance.
 *
 * @example
 * ```tsx
 * import { Color, ColorArea, ColorPlane, Layer, Point } from 'color-kit/react';
 *
 * export const Picker = () => (
 *   <Color defaultColor="#3b82f6">
 *     <ColorArea style={{ width: 240, height: 240 }}>
 *       <ColorPlane />
 *       <Layer kind="annotation">
 *         <Point
 *           x={0.25}
 *           y={0.75}
 *           style={{ width: 8, height: 8, borderRadius: 4, background: '#fff' }}
 *         />
 *       </Layer>
 *     </ColorArea>
 *   </Color>
 * );
 * ```
 */
export const Point = forwardRef<HTMLDivElement, PointProps>(function Point(
  { x, y, style, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      data-color-area-point=""
      data-x={x.toFixed(4)}
      data-y={y.toFixed(4)}
      style={{
        position: 'absolute',
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: 'translate(-50%, -50%)',
        ...style,
      }}
    />
  );
});
