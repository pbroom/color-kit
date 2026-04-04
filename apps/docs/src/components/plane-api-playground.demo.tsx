import { definePlane, sense, toSvgPath } from 'color-kit';

const plane = definePlane({
  model: 'oklch',
  x: { channel: 'l', range: [0, 1] },
  y: { channel: 'c', range: [0.4, 0] },
  fixed: { l: 0.5, c: 0, h: 0, alpha: 1 },
});

const p3Boundary = sense(plane).gamutBoundary();

const boundaryPath = toSvgPath(p3Boundary.points);

export default function PlaneDemo() {
  return (
    <svg viewBox="0 0 100 100" role="img">
      <path d={boundaryPath} />
    </svg>
  );
}
