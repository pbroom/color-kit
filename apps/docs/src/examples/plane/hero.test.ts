import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  inP3Gamut,
  inSrgbGamut,
  parse,
  toP3,
  toRgb,
} from 'color-kit';
import { hueSlice, paintPlane, queryHue } from './hero';

type Point = { x: number; y: number };

function vertices(path: string): Point[] {
  return [...path.matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].map((match) => ({
    x: Number(match[1]) / 100,
    y: Number(match[2]) / 100,
  }));
}

function contains(polygon: Point[], point: Point): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

describe('home hero axes', () => {
  it('defines lightness horizontally and increasing chroma upwards', () => {
    const plane = hueSlice(264);
    expect(plane.x).toEqual({ channel: 'l', range: [0, 1] });
    expect(plane.y).toEqual({ channel: 'c', range: [0.4, 0] });
    expect(plane.fixed.h).toBe(264);
  });

  it.each([30, 145, 264])(
    'projects gamut cusps and hatches the passing AA side at hue %s',
    (hue) => {
      const frame = queryHue(hue);
      const p3Top = vertices(frame.p3).reduce((a, b) => (b.y < a.y ? b : a));
      expect(p3Top.x).toBeCloseTo(frame.p3Peak.l, 3);
      expect(p3Top.y).toBeCloseTo(1 - frame.p3Peak.c / 0.4, 3);

      const srgb = vertices(frame.srgb);
      for (const l of [0.2, 0.4, 0.6, 0.8]) {
        for (const c of [0.01, 0.06, 0.12, 0.2, 0.3]) {
          const color = { l, c, h: hue, alpha: 1 };
          // Adaptive region geometry and cusp sampling use different grids;
          // compare membership away from the boundary rather than their peaks.
          if (
            inSrgbGamut({ ...color, c: c - 0.005 }) !==
            inSrgbGamut({ ...color, c: c + 0.005 })
          )
            continue;
          expect(contains(srgb, { x: l, y: 1 - c / 0.4 })).toBe(
            inSrgbGamut(color),
          );
        }
      }

      for (const [region, reference] of [
        [frame.onWhite, parse('#ffffff')],
        [frame.onBlack, parse('#000000')],
      ] as const) {
        const contour = vertices(region.line);
        expect(contour[0]!.y).toBe(1);
        expect(contour[0]!.x).toBeCloseTo(region.grayL!, 3);
        const polygon = vertices(region.area);
        // Check the clipped hatch against the color's measured contrast,
        // independent of the contour's ordering and closure algorithm.
        for (const l of [0.2, 0.4, 0.6, 0.8]) {
          for (const c of [0.01, 0.06, 0.12, 0.2]) {
            const color = { l, c, h: hue, alpha: 1 };
            if (!inSrgbGamut(color)) continue;
            const ratio = contrastRatio(color, reference);
            if (Math.abs(ratio - 4.5) < 0.1) continue;
            expect(contains(polygon, { x: l, y: 1 - c / 0.4 })).toBe(
              ratio >= 4.5,
            );
          }
        }
      }
    },
  );

  it.each(['srgb', 'display-p3'] as const)(
    'paints %s pixels at the same lightness/chroma coordinates as the SVG',
    (colorSpace) => {
      const width = 7;
      const height = 9;
      const hue = 264;
      const image: ImageData = {
        width,
        height,
        colorSpace,
        data: new Uint8ClampedArray(width * height * 4),
      };
      paintPlane(image, hueSlice(hue));
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const color = {
            l: (col + 0.5) / width,
            c: 0.4 * (1 - (row + 0.5) / height),
            h: hue,
            alpha: 1,
          };
          const offset = (row * width + col) * 4;
          if (!inP3Gamut(color)) {
            expect(image.data[offset + 3]).toBe(0);
            continue;
          }
          const channels =
            colorSpace === 'display-p3' ? toP3(color) : toRgb(color);
          const scale = colorSpace === 'display-p3' ? 255 : 1;
          const expected = new Uint8ClampedArray([
            channels.r * scale,
            channels.g * scale,
            channels.b * scale,
            255,
          ]);
          expect(image.data.slice(offset, offset + 4)).toEqual(expected);
        }
      }
    },
  );
});
