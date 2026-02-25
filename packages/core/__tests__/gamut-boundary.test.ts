import { describe, expect, it } from 'vitest';
import {
  gamutBoundaryPath,
  inP3Gamut,
  inSrgbGamut,
  maxChromaForHue,
  maxChromaAt,
} from '../src/index.js';

function interpolateChromaAt(
  points: Array<{ l: number; c: number }>,
  lightness: number,
): number {
  if (points.length === 0) {
    return 0;
  }
  if (lightness <= points[0].l) {
    return points[0].c;
  }
  if (lightness >= points[points.length - 1].l) {
    return points[points.length - 1].c;
  }

  let index = 0;
  while (index < points.length - 1 && points[index + 1].l < lightness) {
    index += 1;
  }
  const a = points[index];
  const b = points[index + 1];
  const span = b.l - a.l;
  if (span <= 1e-12) {
    return b.c;
  }
  const t = (lightness - a.l) / span;
  return a.c + (b.c - a.c) * t;
}

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

  it('adaptive mode includes the resolved hue cusp point', () => {
    const hue = 252;
    const cusp = maxChromaForHue(hue, {
      gamut: 'display-p3',
      method: 'direct',
    });
    const adaptive = gamutBoundaryPath(hue, {
      gamut: 'display-p3',
      samplingMode: 'adaptive',
      adaptiveTolerance: 0.001,
      adaptiveMaxDepth: 12,
    });
    const cuspPoint = adaptive.find(
      (point) => Math.abs(point.l - cusp.l) <= 1e-12,
    );
    const expectedCuspChroma = maxChromaAt(cusp.l, hue, {
      gamut: 'display-p3',
    });

    expect(cuspPoint).toBeDefined();
    expect(cuspPoint?.c ?? 0).toBeCloseTo(expectedCuspChroma, 10);
  });

  it('adaptive cusp anchor respects maxChromaAt search options', () => {
    const hue = 252;
    const searchOptions = {
      gamut: 'display-p3' as const,
      tolerance: 0.01,
      maxIterations: 1,
      maxChroma: 0.4,
    };
    const cusp = maxChromaForHue(hue, {
      gamut: searchOptions.gamut,
      method: 'direct',
    });
    const adaptive = gamutBoundaryPath(hue, {
      ...searchOptions,
      samplingMode: 'adaptive',
      adaptiveTolerance: 0.001,
      adaptiveMaxDepth: 12,
    });
    const cuspPoint = adaptive.find(
      (point) => Math.abs(point.l - cusp.l) <= 1e-9,
    );
    expect(cuspPoint).toBeDefined();
    const expectedCuspChroma = maxChromaAt(cusp.l, hue, searchOptions);
    expect(cuspPoint?.c ?? 0).toBeCloseTo(expectedCuspChroma, 10);
  });

  it('adaptive boundary interpolation stays close to maxChromaAt samples', () => {
    const hue = 90;
    const adaptive = gamutBoundaryPath(hue, {
      gamut: 'srgb',
      samplingMode: 'adaptive',
      adaptiveTolerance: 0.001,
      adaptiveMaxDepth: 10,
    });
    const maxError = 0.01;
    const probes = 1024;

    for (let index = 0; index <= probes; index += 1) {
      const l = index / probes;
      const expected = maxChromaAt(l, hue, { gamut: 'srgb' });
      const approximated = interpolateChromaAt(adaptive, l);
      expect(Math.abs(expected - approximated)).toBeLessThanOrEqual(maxError);
    }
  });

  it('adaptive sampled points stay on the maxChromaAt boundary', () => {
    const hue = 252;
    const adaptive = gamutBoundaryPath(hue, {
      gamut: 'display-p3',
      samplingMode: 'adaptive',
      adaptiveTolerance: 0.001,
      adaptiveMaxDepth: 12,
    });
    const maxBoundaryError = 0.006;
    for (const point of adaptive) {
      const expected = maxChromaAt(point.l, hue, { gamut: 'display-p3' });
      expect(Math.abs(point.c - expected)).toBeLessThanOrEqual(
        maxBoundaryError,
      );
    }
  });
});
