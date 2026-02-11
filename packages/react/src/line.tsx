import { forwardRef, type SVGAttributes } from 'react';

export interface LinePoint {
  x: number;
  y: number;
}

export interface LineProps extends Omit<
  SVGAttributes<SVGSVGElement>,
  'children' | 'points'
> {
  /** A normalized point list used to build a path when `d` is omitted. */
  points?: LinePoint[];
  /** Explicit SVG path data. */
  d?: string;
  /** Optional path element props. */
  pathProps?: SVGAttributes<SVGPathElement>;
}

function toPath(points: LinePoint[]): string {
  if (points.length < 2) {
    return '';
  }

  return points
    .map((point, index) => {
      const x = (point.x * 100).toFixed(3);
      const y = (point.y * 100).toFixed(3);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

/**
 * Vector path primitive anchored to ColorArea normalized coordinates.
 */
export const Line = forwardRef<SVGSVGElement, LineProps>(function Line(
  {
    points,
    d,
    pathProps,
    viewBox = '0 0 100 100',
    preserveAspectRatio = 'none',
    style,
    ...props
  },
  ref,
) {
  const pathData = d ?? (points ? toPath(points) : '');

  if (!pathData) {
    return null;
  }

  return (
    <svg
      {...props}
      ref={ref}
      data-color-area-line=""
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <path d={pathData} {...pathProps} />
    </svg>
  );
});
