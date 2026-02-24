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
  /**
   * Corner radius in normalized 0-1 space (e.g. 0.008) to round interior vertices.
   * Uses quadratic curves; omit or 0 for sharp corners.
   */
  cornerRadius?: number;
  /**
   * When true and cornerRadius is set, path is treated as closed and the closing vertex is rounded.
   */
  closed?: boolean;
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
 * Build path d with rounded corners using quadratic curves at each interior vertex.
 * Points in 0-1; radius in normalized 0-1 (e.g. 0.008 ≈ 0.8% of viewBox).
 */
function toPathRounded(
  points: LinePoint[],
  radius: number,
  closed: boolean,
): string {
  if (points.length < 2 || radius <= 0) {
    return toPath(points);
  }
  const n = points.length;
  const scale = 100;
  const r = Math.max(0, radius);

  function fmt(p: LinePoint): string {
    return `${(p.x * scale).toFixed(3)} ${(p.y * scale).toFixed(3)}`;
  }
  function norm(dx: number, dy: number): { x: number; y: number } | null {
    const len = Math.hypot(dx, dy);
    if (len < 1e-10) return null;
    return { x: dx / len, y: dy / len };
  }

  if (n === 2) {
    return `M ${fmt(points[0])} L ${fmt(points[1])}`;
  }

  if (closed) {
    const corners: Array<{
      pStart: LinePoint;
      curr: LinePoint;
      pEnd: LinePoint;
    }> = [];
    for (let i = 0; i < n; i += 1) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];
      const dxPrev = curr.x - prev.x;
      const dyPrev = curr.y - prev.y;
      const dxNext = next.x - curr.x;
      const dyNext = next.y - curr.y;
      const dirPrev = norm(dxPrev, dyPrev);
      const dirNext = norm(dxNext, dyNext);
      if (!dirPrev || !dirNext) {
        corners.push({ pStart: curr, curr, pEnd: curr });
        continue;
      }
      const lenPrev = Math.hypot(dxPrev, dyPrev);
      const lenNext = Math.hypot(dxNext, dyNext);
      const rClamp = Math.min(r, lenPrev / 2, lenNext / 2);
      if (rClamp <= 0) {
        corners.push({ pStart: curr, curr, pEnd: curr });
        continue;
      }
      corners.push({
        pStart: {
          x: curr.x - dirPrev.x * rClamp,
          y: curr.y - dirPrev.y * rClamp,
        },
        curr,
        pEnd: {
          x: curr.x + dirNext.x * rClamp,
          y: curr.y + dirNext.y * rClamp,
        },
      });
    }
    const parts = [`M ${fmt(corners[0].pEnd)}`];
    for (let i = 1; i < n; i += 1) {
      const { pStart, curr, pEnd } = corners[i];
      parts.push(`L ${fmt(pStart)} Q ${fmt(curr)} ${fmt(pEnd)}`);
    }
    const { pStart, curr, pEnd } = corners[0];
    parts.push(`L ${fmt(pStart)} Q ${fmt(curr)} ${fmt(pEnd)} Z`);
    return parts.join(' ');
  }

  const parts: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    if (i === 0) {
      parts.push(`M ${fmt(curr)}`);
      continue;
    }
    if (i === n - 1) {
      parts.push(`L ${fmt(curr)}`);
      continue;
    }

    const dxPrev = curr.x - prev.x;
    const dyPrev = curr.y - prev.y;
    const dxNext = next.x - curr.x;
    const dyNext = next.y - curr.y;
    const dirPrev = norm(dxPrev, dyPrev);
    const dirNext = norm(dxNext, dyNext);
    if (!dirPrev || !dirNext) {
      parts.push(`L ${fmt(curr)}`);
      continue;
    }
    const lenPrev = Math.hypot(dxPrev, dyPrev);
    const lenNext = Math.hypot(dxNext, dyNext);
    const rClamp = Math.min(r, lenPrev / 2, lenNext / 2);
    if (rClamp <= 0) {
      parts.push(`L ${fmt(curr)}`);
      continue;
    }
    const pStart: LinePoint = {
      x: curr.x - dirPrev.x * rClamp,
      y: curr.y - dirPrev.y * rClamp,
    };
    const pEnd: LinePoint = {
      x: curr.x + dirNext.x * rClamp,
      y: curr.y + dirNext.y * rClamp,
    };
    parts.push(`L ${fmt(pStart)} Q ${fmt(curr)} ${fmt(pEnd)}`);
  }
  return parts.join(' ');
}

/** Build path d with rounded corners; points in 0-1, radius in 0-1. Exported for use in fill paths. */
export function pathWithRoundedCorners(
  points: LinePoint[],
  radius: number,
  closed: boolean,
): string {
  return toPathRounded(points, radius, closed);
}

/**
 * Vector path primitive anchored to ColorArea normalized coordinates.
 */
export const Line = forwardRef<SVGSVGElement, LineProps>(function Line(
  {
    points,
    d,
    pathProps,
    cornerRadius,
    closed = false,
    viewBox = '0 0 100 100',
    preserveAspectRatio = 'none',
    style,
    ...props
  },
  ref,
) {
  const pathData =
    d ??
    (points && points.length >= 2
      ? cornerRadius != null && cornerRadius > 0
        ? toPathRounded(points, cornerRadius, closed)
        : toPath(points)
      : '');
  const resolvedPathProps: SVGAttributes<SVGPathElement> = {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...pathProps,
  };

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
      <path d={pathData} {...resolvedPathProps} />
    </svg>
  );
});
