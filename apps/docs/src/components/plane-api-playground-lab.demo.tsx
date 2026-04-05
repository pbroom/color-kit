import { parse, definePlaneFromColor, sense, toSvgPath } from 'color-kit';

const color = parse('#3b82f6');

const plane = definePlaneFromColor(color);

const p3Boundary = sense(plane).gamutBoundary();

const boundaryPath = toSvgPath(p3Boundary.points);

export default function PlaneLabDemo() {
  return (
    <svg viewBox="0 0 100 100" role="img">
      <path d={boundaryPath} />
    </svg>
  );
}
