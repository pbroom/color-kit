import { describe, expect, it } from 'vitest';
import { toP3Gamut, toSrgbGamut } from '../src/index.js';
import type { Color } from '../src/index.js';

describe('channel persistence in degenerate states', () => {
  it('preserves hue and lightness when chroma is zero', () => {
    const requested: Color = { l: 0.42, c: 0, h: 275, alpha: 1 };
    const srgb = toSrgbGamut(requested);
    const p3 = toP3Gamut(requested);

    expect(srgb.l).toBe(requested.l);
    expect(srgb.h).toBe(requested.h);
    expect(p3.l).toBe(requested.l);
    expect(p3.h).toBe(requested.h);
  });

  it('keeps boundary lightness values stable through gamut mapping', () => {
    const nearBlack: Color = { l: 0, c: 0.25, h: 90, alpha: 1 };
    const nearWhite: Color = { l: 1, c: 0.25, h: 90, alpha: 1 };

    expect(toSrgbGamut(nearBlack).l).toBe(0);
    expect(toP3Gamut(nearBlack).l).toBe(0);
    expect(toSrgbGamut(nearWhite).l).toBe(1);
    expect(toP3Gamut(nearWhite).l).toBe(1);
  });
});
