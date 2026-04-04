import { definePlane, sense, toSvgPath } from 'color-kit';

const plane = definePlane({
  model: 'oklch',
  x: { channel: 'l', range: [0, 1] },
  y: { channel: 'c', range: [0.4, 0] },
  fixed: { l: 0.5, c: 0, h: 0, alpha: 1 },
});

const p3Boundary = sense(plane).gamutBoundary();

const boundaryPath = toSvgPath(p3Boundary.points);
const svgStyle = {
  display: 'block',
  width: 300,
  height: 300,
  background: '#0d0d0d',
  border: '0.5px solid #222222',
  overflow: 'hidden',
} as const;
const pathStyle = {
  fill: 'oklch(82.8% 0.111 230.318 / 0.08)',
  stroke: 'oklch(68.5% 0.169 237.323)',
  strokeWidth: 0.5,
} as const;

export default function PlaneDemo() {
  return (
    <svg viewBox="0 0 100 100" role="img" style={svgStyle}>
      <path d={boundaryPath} style={pathStyle} />
    </svg>
  );
}
