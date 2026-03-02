import {
  createPlaneQuery,
  resolvePlaneDefinition,
  toSvgPath,
} from '@color-kit/core';

const plane = resolvePlaneDefinition({
  model: 'oklch',
  x: { channel: 'l', range: [0, 1] },
  y: { channel: 'c', range: [0, 0.4] },
  fixed: { h: 250, alpha: 1 },
});

const query = createPlaneQuery(plane);
const p3Boundary = query.gamutBoundary({
  gamut: 'display-p3',
  samplingMode: 'adaptive',
});
const boundaryPath = toSvgPath(p3Boundary.points, {
  closeLoop: true,
  precision: 2,
});

function round(value: number, places = 3): number {
  return Number(value.toFixed(places));
}

const quickStartResult = {
  kind: p3Boundary.kind,
  gamut: p3Boundary.gamut,
  hue: round(p3Boundary.hue, 2),
  pointCount: p3Boundary.points.length,
  firstPoints: p3Boundary.points.slice(0, 4).map((point) => ({
    l: round(point.l),
    c: round(point.c),
    x: round(point.x),
    y: round(point.y),
  })),
};

export function PlaneQuickStartDemo() {
  return (
    <div
      style={{
        marginTop: '1rem',
        border: '1px solid rgba(156, 192, 255, 0.35)',
        borderRadius: '0.75rem',
        background:
          'linear-gradient(140deg, rgba(17,24,39,0.96), rgba(11,17,32,0.96))',
        color: '#e5ecff',
        padding: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '0.75rem',
          fontSize: '0.8rem',
        }}
      >
        <strong style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Quick Start Runtime Output
        </strong>
        <code style={{ color: '#9cc0ff' }}>createPlaneQuery + toSvgPath</code>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <svg
          viewBox="0 0 100 100"
          aria-label="Display P3 boundary projected to a plane"
          role="img"
          style={{
            width: '100%',
            borderRadius: '0.5rem',
            border: '1px solid rgba(156, 192, 255, 0.35)',
            background: '#090f1f',
          }}
        >
          <rect x="0" y="0" width="100" height="100" fill="transparent" />
          <path
            d={boundaryPath}
            fill="rgba(68,241,213,0.24)"
            stroke="#44f1d5"
            strokeWidth="0.9"
          />
        </svg>
        <pre
          style={{
            margin: 0,
            borderRadius: '0.5rem',
            border: '1px solid rgba(156, 192, 255, 0.25)',
            background: 'rgba(9, 15, 31, 0.88)',
            color: '#dbe7ff',
            fontSize: '0.75rem',
            lineHeight: 1.5,
            overflowX: 'auto',
            padding: '0.75rem',
            whiteSpace: 'pre',
          }}
        >
          {JSON.stringify(quickStartResult, null, 2)}
        </pre>
      </div>
    </div>
  );
}
