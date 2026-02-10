import { describe, expect, it } from 'vitest';
import { fromP3, fromRgb, toP3, toRgb } from '../src/index.js';
import type { Color } from '../src/index.js';

function expectColorClose(
  a: Color,
  b: Color,
  tolerance: { l: number; c: number; h: number; alpha: number },
): void {
  expect(Math.abs(a.l - b.l)).toBeLessThanOrEqual(tolerance.l);
  expect(Math.abs(a.c - b.c)).toBeLessThanOrEqual(tolerance.c);
  expect(Math.abs(a.h - b.h)).toBeLessThanOrEqual(tolerance.h);
  expect(Math.abs(a.alpha - b.alpha)).toBeLessThanOrEqual(tolerance.alpha);
}

describe('roundtrip invariants', () => {
  it('roundtrips in-gamut colors through Display P3 with tight tolerance', () => {
    const color: Color = { l: 0.68, c: 0.21, h: 248, alpha: 0.92 };
    const roundtrip = fromP3(toP3(color));

    expectColorClose(roundtrip, color, {
      l: 0.01,
      c: 0.015,
      h: 3,
      alpha: 0.01,
    });
  });

  it('roundtrips colors through sRGB conversion functions', () => {
    const color: Color = { l: 0.58, c: 0.17, h: 31, alpha: 0.75 };
    const roundtrip = fromRgb(toRgb(color));

    expectColorClose(roundtrip, color, {
      l: 0.02,
      c: 0.02,
      h: 2,
      alpha: 0.01,
    });
  });
});
