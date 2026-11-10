import {
  definePlane,
  displayP3,
  sense,
  srgb,
  toSvgPath,
} from '@pbroom/color-kit/plane';

// The default OKLCH plane: lightness across, chroma up, at one hue.
const plane = sense(definePlane({ fixed: { h: 264 } }));

// Ask where each gamut ends. Points come back in normalized plane
// coordinates, ready for an SVG with a 0–100 viewBox.
const srgbEdge = plane.gamutBoundary({ gamut: srgb });
const p3Edge = plane.gamutBoundary({ gamut: displayP3 });

export default function PlaneQuickStart() {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="sRGB and Display P3 gamut boundaries at hue 264°"
      style={{ width: '100%', maxWidth: 360, overflow: 'visible' }}
    >
      <path
        d={toSvgPath(p3Edge.points)}
        fill="none"
        stroke="currentColor"
        strokeDasharray="2 1.5"
        strokeWidth={0.6}
      />
      <path
        d={toSvgPath(srgbEdge.points)}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.6}
      />
    </svg>
  );
}
