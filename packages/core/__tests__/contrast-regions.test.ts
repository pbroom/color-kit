import { describe, expect, it } from 'vitest';
import {
  contrastRegionPath,
  contrastRegionPaths,
  fromHex,
} from '../src/index.js';

function flattenLightness(paths: Array<Array<{ l: number }>>): number[] {
  return paths.flatMap((path) => path.map((point) => point.l));
}

describe('contrastRegionPaths()', () => {
  it('returns deterministic, bounded contour paths', () => {
    const reference = fromHex('#ffffff');

    const first = contrastRegionPaths(reference, 210, {
      level: 'AA',
      gamut: 'srgb',
      lightnessSteps: 24,
      chromaSteps: 24,
    });
    const second = contrastRegionPaths(reference, 210, {
      level: 'AA',
      gamut: 'srgb',
      lightnessSteps: 24,
      chromaSteps: 24,
    });

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);

    for (const path of first) {
      expect(path.length).toBeGreaterThan(1);
      for (const point of path) {
        expect(point.l).toBeGreaterThanOrEqual(0);
        expect(point.l).toBeLessThanOrEqual(1);
        expect(point.c).toBeGreaterThanOrEqual(0);
        expect(point.c).toBeLessThanOrEqual(0.4);
      }
    }
  });

  it('tightens the region for stricter WCAG levels', () => {
    const reference = fromHex('#ffffff');

    const aa = contrastRegionPaths(reference, 145, {
      level: 'AA',
      lightnessSteps: 28,
      chromaSteps: 28,
    });
    const aaa = contrastRegionPaths(reference, 145, {
      level: 'AAA',
      lightnessSteps: 28,
      chromaSteps: 28,
    });

    expect(aa.length).toBeGreaterThan(0);
    expect(aaa.length).toBeGreaterThan(0);

    const aaMaxL = Math.max(...flattenLightness(aa));
    const aaaMaxL = Math.max(...flattenLightness(aaa));
    expect(aaaMaxL).toBeLessThanOrEqual(aaMaxL + 1e-6);
  });

  it('returns no contours when the threshold is unattainable', () => {
    const reference = fromHex('#ffffff');

    const paths = contrastRegionPaths(reference, 200, {
      threshold: 22,
      lightnessSteps: 16,
      chromaSteps: 16,
    });

    expect(paths).toEqual([]);
  });

  it('exposes a convenience helper for the largest contour path', () => {
    const reference = fromHex('#111827');

    const paths = contrastRegionPaths(reference, 320, {
      level: 'AA',
      lightnessSteps: 22,
      chromaSteps: 22,
    });
    const largest = contrastRegionPath(reference, 320, {
      level: 'AA',
      lightnessSteps: 22,
      chromaSteps: 22,
    });

    expect(largest).toEqual(paths[0] ?? []);
  });

  it('validates threshold and sampling options', () => {
    const reference = fromHex('#ffffff');

    expect(() =>
      contrastRegionPaths(reference, 200, {
        threshold: 1,
      }),
    ).toThrow('contrastRegionPaths() requires threshold > 1');

    expect(() =>
      contrastRegionPaths(reference, 200, {
        lightnessSteps: 1,
      }),
    ).toThrow('contrastRegionPaths() lightnessSteps must be an integer >= 2');
  });
});
