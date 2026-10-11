import { inP3Gamut, parse, toP3Into, toRgbInto, type Color } from 'color-kit';
import {
  definePlane,
  sense,
  toSvgCompoundPath,
  toSvgPath,
  type Plane,
  type PlaneBoundaryPoint,
  type PlaneRegionPoint,
} from 'color-kit/plane';

/** One hue of OKLCH: lightness left to right, chroma bottom to top. */
export function hueSlice(hue: number): Plane<'oklch'> {
  return definePlane({
    model: 'oklch',
    x: { channel: 'l', range: [0, 1] },
    y: { channel: 'c', range: [0.4, 0] },
    fixed: { h: hue },
  });
}

const WHITE = parse('#ffffff');
const BLACK = parse('#000000');
// Plane points are normalized; scale 100 fits an SVG `viewBox="0 0 100 100"`.
const svg = { scale: 100, precision: 2 };

/**
 * Ask one hue slice where sRGB ends, where Display P3 ends, and which
 * colors pass WCAG AA (4.5:1) as text on white and on black.
 */
export function queryHue(hue: number) {
  const plane = sense(hueSlice(hue));
  const srgb = plane.gamutRegion({ gamut: 'srgb' });
  const srgbEdge = plane.gamutBoundary({ gamut: 'srgb' });
  const p3Edge = plane.gamutBoundary({ gamut: 'display-p3' });
  const onWhite = plane.contrastRegion({ reference: WHITE, level: 'AA' });
  const onBlack = plane.contrastRegion({ reference: BLACK, level: 'AA' });

  return {
    hue,
    srgb: toSvgCompoundPath(srgb.visibleRegion.paths, {
      ...svg,
      closeLoop: true,
    }),
    p3: toSvgPath(p3Edge.points, svg),
    srgbPeak: peak(srgbEdge.points),
    p3Peak: peak(p3Edge.points),
    onWhite: passingSide(onWhite.paths[0], 'darker'),
    onBlack: passingSide(onBlack.paths[0], 'lighter'),
  };
}

export type HueQuery = ReturnType<typeof queryHue>;

/** The most chromatic point of a gamut edge: its cusp. */
function peak(points: PlaneBoundaryPoint[]) {
  const top = points.reduce((a, b) => (b.c > a.c ? b : a));
  return { l: top.l, c: top.c };
}

/**
 * A contrast contour splits the slice in two. Close it along the plane edge
 * on the passing side; drawn clipped to the sRGB region, that is the area of
 * colors that pass. `grayL` is where the contour meets the gray axis.
 */
function passingSide(
  contour: PlaneRegionPoint[] = [],
  side: 'darker' | 'lighter',
) {
  if (contour.length < 2) return { line: '', area: '', grayL: null };
  const line =
    contour[0]!.y >= contour.at(-1)!.y ? contour : [...contour].reverse();
  const end = line.at(-1)!;
  const edge = side === 'darker' ? 0 : 1; // plane x of black or white
  const area = [
    ...line,
    { x: end.x, y: 0 },
    { x: edge, y: 0 },
    { x: edge, y: 1 },
  ];
  return {
    line: toSvgPath(line, svg),
    area: toSvgPath(area, { ...svg, closeLoop: true }),
    grayL: line[0]!.l,
  };
}

const color: Color = { l: 0, c: 0, h: 0, alpha: 1 };
const channels = { r: 0, g: 0, b: 0, alpha: 1 };

/**
 * Paint a plane into `image`, one pixel per cell, allocation-free. Colors
 * outside Display P3 stay transparent. On a `display-p3` canvas the P3-only
 * colors show as they are; on sRGB they clip.
 */
export function paintPlane(image: ImageData, plane: Plane<'oklch'>): void {
  const { width, height, data } = image;
  const p3 = image.colorSpace === 'display-p3';
  const [l0, l1] = plane.x.range;
  const [c0, c1] = plane.y.range;
  color.h = plane.fixed.h ?? 0;

  for (let row = 0; row < height; row++) {
    color.c = c0 + ((c1 - c0) * (row + 0.5)) / height;
    for (let col = 0; col < width; col++) {
      color.l = l0 + ((l1 - l0) * (col + 0.5)) / width;
      const i = (row * width + col) * 4;
      if (!inP3Gamut(color)) {
        data[i + 3] = 0;
        continue;
      }
      if (p3) {
        toP3Into(channels, color);
        data[i] = channels.r * 255;
        data[i + 1] = channels.g * 255;
        data[i + 2] = channels.b * 255;
      } else {
        toRgbInto(channels, color);
        data[i] = channels.r;
        data[i + 1] = channels.g;
        data[i + 2] = channels.b;
      }
      data[i + 3] = 255;
    }
  }
}
