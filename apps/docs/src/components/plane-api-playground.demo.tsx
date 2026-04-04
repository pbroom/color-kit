import { definePlane, sense, toSvgPath } from 'color-kit';

const plane = definePlane();

const p3Boundary = sense(plane).gamutBoundary();

const boundaryPath = toSvgPath(p3Boundary.points);

export default function PlaneDemo() {
  return (
    <svg viewBox="0 0 100 100" role="img">
      <path d={boundaryPath} />
    </svg>
  );
}
