import { definePlane, sense, toSvgPath } from 'color-kit/plane';

// The default OKLCH plane: lightness across, chroma up, at one hue.
const plane = sense(definePlane({ fixed: { h: 264 } }));

// Ask where each gamut ends. Points come back in normalized plane
// coordinates, ready for an SVG with a 0–100 viewBox.
const srgb = plane.gamutBoundary({ gamut: 'srgb' });
const p3 = plane.gamutBoundary({ gamut: 'display-p3' });

export default function PlaneQuickStart() {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="sRGB and Display P3 gamut boundaries at hue 264°"
      style={{ width: '100%', maxWidth: 360, overflow: 'visible' }}
    >
      <path
        d={toSvgPath(p3.points)}
        fill="none"
        stroke="currentColor"
        strokeDasharray="2 1.5"
        strokeWidth={0.6}
      />
      <path
        d={toSvgPath(srgb.points)}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.6}
      />
    </svg>
  );
}
