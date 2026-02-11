import { forwardRef, type HTMLAttributes } from 'react';

export interface PointProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /** Normalized X coordinate in [0,1]. */
  x: number;
  /** Normalized Y coordinate in [0,1]. */
  y: number;
}

/**
 * Anchored marker primitive positioned within the ColorArea plane.
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
