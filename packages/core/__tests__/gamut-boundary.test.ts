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

  it('simplifyTolerance reduces point count while preserving endpoints', () => {
    const dense = gamutBoundaryPath(100, { gamut: 'srgb', steps: 64 });
    const simplified = gamutBoundaryPath(100, {
      gamut: 'srgb',
      steps: 64,
      simplifyTolerance: 0.002,
    });

    expect(simplified.length).toBeLessThanOrEqual(dense.length);
    expect(simplified.length).toBeGreaterThanOrEqual(2);
    expect(simplified[0].l).toBe(0);
    expect(simplified[simplified.length - 1].l).toBe(1);
    expect(simplified[0].c).toBe(dense[0].c);
    expect(simplified[simplified.length - 1].c).toBe(dense[dense.length - 1].c);
  });

  it('adaptive sampling returns deterministic, in-gamut boundary', () => {
    const a = gamutBoundaryPath(180, {
      gamut: 'srgb',
      samplingMode: 'adaptive',
      adaptiveTolerance: 0.001,
    });
    const b = gamutBoundaryPath(180, {
      gamut: 'srgb',
      samplingMode: 'adaptive',
      adaptiveTolerance: 0.001,
    });
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(2);
    expect(a[0]).toEqual({ l: 0, c: 0 });
    expect(a[a.length - 1].l).toBe(1);
    expect(a[a.length - 1].c).toBe(0);
    for (const point of a) {
      expect(inSrgbGamut({ l: point.l, c: point.c, h: 180, alpha: 1 })).toBe(
        true,
      );
    }
    for (let i = 1; i < a.length; i += 1) {
      expect(a[i].l).toBeGreaterThan(a[i - 1].l);
    }
  });

  it('adaptive boundary stays within max geometric error of dense reference', () => {
    const reference = gamutBoundaryPath(90, { gamut: 'srgb', steps: 128 });
    const adaptive = gamutBoundaryPath(90, {
      gamut: 'srgb',
      samplingMode: 'adaptive',
      adaptiveTolerance: 0.001,
      adaptiveMaxDepth: 10,
    });
    const maxError = 0.006;
    for (const p of adaptive) {
      let i = 0;
      while (i < reference.length - 1 && reference[i + 1].l < p.l) i += 1;
      if (i >= reference.length - 1) continue;
      const a = reference[i];
      const b = reference[i + 1];
      const t = (p.l - a.l) / (b.l - a.l);
      const expectedC = a.c + t * (b.c - a.c);
      expect(Math.abs(p.c - expectedC)).toBeLessThanOrEqual(maxError);
    }
  });
});
