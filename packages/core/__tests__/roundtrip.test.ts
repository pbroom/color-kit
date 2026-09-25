import { describe, expect, it } from 'vitest';
import {
  fromHex,
  fromHsl,
  fromHsv,
  fromOklab,
  fromP3,
  fromRgb,
  inP3Gamut,
  inSrgbGamut,
  linearRgbToOklab,
  oklabToLinearRgb,
  toHex,
  toOklab,
  toP3,
  toRgb,
} from '../src/index.js';
import type { Color } from '../src/index.js';

/**
 * Float round trips are pure float64 matrix / transfer-function math, so they
 * should reproduce the input to ~1e-15; 1e-9 leaves room for accumulated
 * rounding without hiding real precision bugs (the previous 10-digit
 * matrices failed this at ~4e-8).
 */
const FLOAT_TOL = 1e-9;
/** Hue is undefined for greys; only compare it above this chroma. */
const ACHROMATIC_CHROMA = 1e-4;

function hueDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

function expectColorClose(actual: Color, expected: Color, tolerance: number) {
  expect(Math.abs(actual.l - expected.l)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.c - expected.c)).toBeLessThanOrEqual(tolerance);
  if (expected.c >= ACHROMATIC_CHROMA) {
    // Hue error scales as (ab error / chroma).
    expect(hueDelta(actual.h, expected.h)).toBeLessThanOrEqual(
      (tolerance / expected.c) * (180 / Math.PI),
    );
  }
  expect(actual.alpha).toBe(expected.alpha);
}

/** Deterministic grid over OKLCH, including 0/360 hue wrap and greys. */
function oklchGrid(): Color[] {
  const colors: Color[] = [];
  for (const l of [0.05, 0.2, 0.4, 0.58, 0.68, 0.8, 0.95]) {
    for (const c of [0, 0.00005, 0.001, 0.03, 0.08, 0.12, 0.17, 0.21, 0.26]) {
      for (const h of [0, 31, 90, 145, 248, 300, 359.99, 360]) {
        colors.push({ l, c, h, alpha: 0.75 });
      }
    }
  }
  return colors;
}

describe('roundtrip invariants', () => {
  it('roundtrips in-gamut colors through Display P3 at float precision', () => {
    // The previous fixture, oklch(0.68 0.21 248), is actually outside P3
    // (toP3 clamps it), which is why it needed l: 0.01 / c: 0.015 / h: 3
    // tolerances. Assert membership so the fixture stays honest.
    const color: Color = { l: 0.68, c: 0.16, h: 248, alpha: 0.92 };
    expect(inP3Gamut({ l: 0.68, c: 0.21, h: 248, alpha: 1 })).toBe(false);
    expect(inP3Gamut(color)).toBe(true);
    expectColorClose(fromP3(toP3(color)), color, FLOAT_TOL);

    let checked = 0;
    for (const sample of oklchGrid()) {
      // toP3 clamps to [0, 1], so only in-gamut colors round-trip exactly.
      if (!inP3Gamut(sample)) continue;
      checked += 1;
      expectColorClose(fromP3(toP3(sample)), sample, FLOAT_TOL);
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('roundtrips through OKLab and linear sRGB at float precision', () => {
    for (const sample of oklchGrid()) {
      expectColorClose(fromOklab(toOklab(sample)), sample, FLOAT_TOL);

      const linear = oklabToLinearRgb(toOklab(sample));
      const back = fromOklab(linearRgbToOklab(linear));
      expectColorClose(back, sample, FLOAT_TOL);
    }
  });

  it('roundtrips 8-bit sRGB and hex exactly', () => {
    for (let r = 0; r <= 255; r += 15) {
      for (let g = 0; g <= 255; g += 15) {
        for (let b = 0; b <= 255; b += 15) {
          const rgb = { r, g, b, alpha: 1 };
          expect(toRgb(fromRgb(rgb))).toEqual(rgb);
        }
      }
    }
    for (const hex of [
      '#000000',
      '#ffffff',
      '#808080',
      '#ff0000',
      '#12345678',
    ]) {
      expect(toHex(fromHex(hex))).toBe(hex);
    }
  });

  it('roundtrips colors through 8-bit sRGB within quantization error', () => {
    // toRgb returns 8-bit channels by design (Rgb is 0-255 and feeds CSS
    // hex/rgb output), so Color -> Rgb -> Color is lossy. The legitimate
    // error is exactly the rounding: each gamma-encoded channel may move by
    // at most half a step (0.5 / 255). Check that bound in encoded sRGB
    // rather than a loose OKLCH tolerance, which would also hide real bugs.
    const encode = (linear: number) =>
      linear <= 0.0031308
        ? 12.92 * linear
        : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
    const encoded = (color: Color) => {
      const linear = oklabToLinearRgb(toOklab(color));
      return [encode(linear.r), encode(linear.g), encode(linear.b)];
    };

    const samples = [
      { l: 0.58, c: 0.17, h: 31, alpha: 0.75 },
      ...oklchGrid(),
    ].filter(inSrgbGamut);
    expect(samples.length).toBeGreaterThan(150);

    for (const color of samples) {
      const roundtrip = fromRgb(toRgb(color));
      const before = encoded(color);
      const after = encoded(roundtrip);
      for (let channel = 0; channel < 3; channel += 1) {
        expect(Math.abs(after[channel] - before[channel])).toBeLessThanOrEqual(
          0.5 / 255 + FLOAT_TOL,
        );
      }
      expect(roundtrip.alpha).toBe(color.alpha);
    }
  });

  it('roundtrips fractional HSL / HSV at float precision', () => {
    // fromHsl/fromHsv keep full precision (no 8-bit rounding), so the only
    // loss is float noise. Includes hues outside [0, 360).
    for (const h of [0, 12.345, 199.99, 359.999, 360, 725.5, -90]) {
      for (const s of [0, 0.5, 37.25, 100]) {
        for (const lv of [0.2, 33.3, 50, 88.8]) {
          const fromL = fromHsl({ h, s, l: lv, alpha: 0.4 });
          const fromV = fromHsv({ h, s, v: lv, alpha: 0.4 });
          // Same color expressed through OKLab should be stable.
          expectColorClose(fromOklab(toOklab(fromL)), fromL, FLOAT_TOL);
          expectColorClose(fromOklab(toOklab(fromV)), fromV, FLOAT_TOL);
          // Hue periodicity: h and h + 360 are the same color.
          expectColorClose(
            fromHsl({ h: h + 360, s, l: lv, alpha: 0.4 }),
            fromL,
            FLOAT_TOL,
          );
          expectColorClose(
            fromHsv({ h: h - 360, s, v: lv, alpha: 0.4 }),
            fromV,
            FLOAT_TOL,
          );
        }
      }
    }
  });
});
