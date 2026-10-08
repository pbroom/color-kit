import { parse } from 'color-kit';
import { definePlane, sense } from 'color-kit/plane';

// Chroma across, lightness up, at the hue of sRGB blue.
const plane = sense(
  definePlane({
    x: { channel: 'c', range: [0, 0.4] },
    y: { channel: 'l', range: [1, 0] },
    fixed: { h: 264 },
  }),
);

const srgb = plane.gamutRegion({ gamut: 'srgb' });
srgb.viewportRelation; // →
srgb.visibleRegion.paths.length; // →

// Each boundary point carries its OKLCH lightness and chroma.
const p3 = plane.gamutBoundary({ gamut: 'display-p3' });
p3.points.reduce((a, b) => (b.c > a.c ? b : a));
// →

// Where text on white stops passing WCAG AA (4.5:1), along the gray axis.
const aa = plane.contrastRegion({ reference: parse('#fff'), level: 'AA' });
aa.paths[0]![0]!.l; // →
