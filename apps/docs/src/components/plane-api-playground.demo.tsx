import { definePlane, sense, toSvgPath } from 'color-kit';

// @ck-snippet-start
const plane = definePlane({ fixed: { h: 250, alpha: 1 } });

const query = sense(plane);
const p3Boundary = query.gamutBoundary({
  gamut: 'display-p3',
  samplingMode: 'adaptive',
});
const boundaryPath = toSvgPath(p3Boundary.points, {
  closeLoop: true,
  precision: 2,
});
// @ck-snippet-end

export default function PlaneApiPlaygroundDemo() {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="Display P3 gamut boundary projected to a plane"
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <rect x="0" y="0" width="100" height="100" fill="#121314" />
      <path
        d={boundaryPath}
        fill="oklch(82.8% 0.111 230.318 / 0.08)"
        stroke="oklch(68.5% 0.169 237.323)"
        strokeWidth="0.5"
      />
    </svg>
  );
}
