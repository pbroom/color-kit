import type { SVGAttributes } from 'react';
import type { LinePoint } from './line.js';

export interface PathPointsOverlayProps extends Omit<
  SVGAttributes<SVGSVGElement>,
  'children'
> {
  paths: LinePoint[][];
  pointProps?: SVGAttributes<SVGCircleElement>;
}

/**
 * Renders normalized point markers for one or more path vertex lists.
 */
export function PathPointsOverlay({
  paths,
  pointProps,
  style,
  ...props
}: PathPointsOverlayProps) {
  const hasPoints = paths.some((path) => path.length > 0);
  if (!hasPoints) {
    return null;
  }

  const resolvedPointProps: SVGAttributes<SVGCircleElement> = {
    r: 0.7,
    fill: '#ffffff',
    stroke: 'rgba(0,0,0,0.55)',
    strokeWidth: 0.18,
    ...pointProps,
  };

  return (
    <svg
      {...props}
      data-color-area-path-points=""
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...style,
      }}
    >
      {paths.map((path, pathIndex) =>
        path.map((point, pointIndex) => (
          <circle
            key={`${pathIndex}:${pointIndex}`}
            {...resolvedPointProps}
            cx={point.x * 100}
            cy={point.y * 100}
            data-color-area-path-point=""
          />
        )),
      )}
    </svg>
  );
}
