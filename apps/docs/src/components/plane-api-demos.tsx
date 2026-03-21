import { definePlane, sense, toSvgPath } from '@color-kit/core';

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

export function PlaneQuickStartDemo() {
  return (
    <div className="not-prose my-6">
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          border: '1px solid rgba(156, 192, 255, 0.05)',
          borderRadius: '0.75rem',
          background: '#141516',
          color: '#e5ecff',
          padding: '2rem',
        }}
      >
        <div
          style={{
            width: 320,
            height: 320,
            maxWidth: '100%',
            border: '1px solid oklch(50% 0 0 / 0.1)',
            borderRadius: '0.5rem',
            overflow: 'hidden',
          }}
        >
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label="Display P3 gamut boundary projected to a plane"
            style={{ display: 'block', width: '100%', height: '100%' }}
          >
            <rect x="0" y="0" width="100" height="100" fill="#121314" />
            <path
              d={boundaryPath}
              fill="oklch(82.8% 0.111 230.318 / 0.08)"
              stroke="oklch(68.5% 0.169 237.323)"
              strokeWidth="0.5"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
