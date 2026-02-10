import { describe, expect, it } from 'vitest';
import { gamutBoundaryPath, inP3Gamut, inSrgbGamut } from '../src/index.js';

describe('gamutBoundaryPath()', () => {
  it('returns deterministic lightness/chroma points with expected shape', () => {
    const points = gamutBoundaryPath(200, { gamut: 'srgb', steps: 16 });

    expect(points).toHaveLength(17);
    expect(points[0]).toEqual({ l: 0, c: 0 });
    expect(points[16]).toEqual({ l: 1, c: 0 });

    for (let index = 1; index < points.length; index += 1) {
      expect(points[index].l).toBeGreaterThan(points[index - 1].l);
    }
  });

  it('returns only in-gamut points for the selected gamut', () => {
    const srgbBoundary = gamutBoundaryPath(145, { gamut: 'srgb', steps: 32 });
    const p3Boundary = gamutBoundaryPath(145, {
      gamut: 'display-p3',
      steps: 32,
    });

    for (const point of srgbBoundary) {
      expect(inSrgbGamut({ l: point.l, c: point.c, h: 145, alpha: 1 })).toBe(
        true,
      );
    }

    for (const point of p3Boundary) {
      expect(inP3Gamut({ l: point.l, c: point.c, h: 145, alpha: 1 })).toBe(
        true,
      );
    }
  });

  it('produces a wider or equal boundary in Display-P3 than sRGB', () => {
    const srgbBoundary = gamutBoundaryPath(145, { gamut: 'srgb', steps: 32 });
    const p3Boundary = gamutBoundaryPath(145, {
      gamut: 'display-p3',
      steps: 32,
    });

    let hasWiderPoint = false;
    for (let index = 0; index < srgbBoundary.length; index += 1) {
      const delta = p3Boundary[index].c - srgbBoundary[index].c;
      expect(delta).toBeGreaterThanOrEqual(-0.0002);
      if (delta > 0.001) {
        hasWiderPoint = true;
      }
    }

    expect(hasWiderPoint).toBe(true);
  });

  it('throws for invalid step counts', () => {
    expect(() => gamutBoundaryPath(200, { steps: 1 })).toThrow(
      'gamutBoundaryPath() requires steps >= 2',
    );
  });

  it('normalizes hue input', () => {
    const a = gamutBoundaryPath(-300, { gamut: 'srgb', steps: 24 });
    const b = gamutBoundaryPath(60, { gamut: 'srgb', steps: 24 });
    expect(a).toEqual(b);
  });
});
