import { inP3Gamut, inSrgbGamut } from '@color-kit/core';
import { describe, expect, it } from 'vitest';
import {
  inP3Linear,
  inSrgbLinear,
  mapToGamutLinear,
  oklchToLinearSrgb,
} from '../src/color-plane-gamut-utils.js';

describe('color-plane gamut utils', () => {
  it('classifies gamut membership exactly like core', () => {
    let mismatches = 0;
    for (let l = 0; l <= 1.0001; l += 0.05) {
      for (let c = 0; c <= 0.4; c += 0.01) {
        for (let h = 0; h < 360; h += 15) {
          const color = { l, c, h, alpha: 1 };
          const linear = oklchToLinearSrgb(l, c, h);
          if (inSrgbLinear(linear) !== inSrgbGamut(color)) mismatches += 1;
          if (inP3Linear(linear) !== inP3Gamut(color)) mismatches += 1;
        }
      }
    }
    expect(mismatches).toBe(0);
  });

  it('rejects near-black colors that only pass a linear-light epsilon', () => {
    // Channels dip to ~-3e-5 linear: inside a linear-light 7.5e-5 epsilon,
    // but ~4e-4 below zero once encoded, so it is out of sRGB.
    const linear = oklchToLinearSrgb(0.028, 0.05, 131);
    expect(inSrgbLinear(linear)).toBe(false);
  });

  it('maps out-of-gamut colors into the target gamut', () => {
    for (const [l, c, h] of [
      [0.7, 0.35, 150],
      [0.03, 0.2, 131],
      [0.95, 0.3, 260],
    ]) {
      const mapped = mapToGamutLinear(l, c, h, 'srgb');
      // Like core toSrgbGamut, the bisection settles strictly inside.
      for (const channel of [mapped.r, mapped.g, mapped.b]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });
});
