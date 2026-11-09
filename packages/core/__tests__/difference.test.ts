/**
 * Color difference: `deltaEOK` and `deltaE2000`.
 *
 * Where the expected values come from:
 * - SHARMA_PAIRS is the CIEDE2000 test dataset published with Sharma, Wu &
 *   Dalal, "The CIEDE2000 Color-Difference Formula: Implementation Notes,
 *   Supplementary Test Data, and Mathematical Observations" (Color Research
 *   & Application 30(1), 2005), Table 1, copied from the authors' data file
 *   (https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt).
 *   Each row is `L1 a1 b1 L2 a2 b2 ΔE00` with ΔE00 given to 4 decimals.
 * - Color-level values are compared against colorjs.io (`deltaE` with the
 *   `'OK'` and `'2000'` methods), the reference `reference-accuracy.test.ts`
 *   uses. Both compute CIEDE2000 in CIE Lab with the D50 white.
 * - A few values follow from the definitions and are derived in a comment
 *   next to the assertion.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import ColorJs from 'colorjs.io';
import { deltaE2000, deltaEOK, isAchromatic, parse } from '../src/index.js';
import type { Color } from '../src/index.js';
import { ciede2000, toLabD50 } from '../src/difference/ciede2000.js';

/** Same bound as `reference-accuracy.test.ts`; observed error is ~1e-13. */
const FLOAT_TOL = 1e-9;
// Against colorjs.io when one color is a gray (see the pairwise test).
const GRAY_REFERENCE_TOL = 1e-5;

type SharmaRow = [
  L1: number,
  a1: number,
  b1: number,
  L2: number,
  a2: number,
  b2: number,
  deltaE: number,
];

// prettier-ignore
const SHARMA_PAIRS: SharmaRow[] = [
  [50.0000, 2.6772, -79.7751, 50.0000, 0.0000, -82.7485, 2.0425],
  [50.0000, 3.1571, -77.2803, 50.0000, 0.0000, -82.7485, 2.8615],
  [50.0000, 2.8361, -74.0200, 50.0000, 0.0000, -82.7485, 3.4412],
  [50.0000, -1.3802, -84.2814, 50.0000, 0.0000, -82.7485, 1.0000],
  [50.0000, -1.1848, -84.8006, 50.0000, 0.0000, -82.7485, 1.0000],
  [50.0000, -0.9009, -85.5211, 50.0000, 0.0000, -82.7485, 1.0000],
  [50.0000, 0.0000, 0.0000, 50.0000, -1.0000, 2.0000, 2.3669],
  [50.0000, -1.0000, 2.0000, 50.0000, 0.0000, 0.0000, 2.3669],
  [50.0000, 2.4900, -0.0010, 50.0000, -2.4900, 0.0009, 7.1792],
  [50.0000, 2.4900, -0.0010, 50.0000, -2.4900, 0.0010, 7.1792],
  [50.0000, 2.4900, -0.0010, 50.0000, -2.4900, 0.0011, 7.2195],
  [50.0000, 2.4900, -0.0010, 50.0000, -2.4900, 0.0012, 7.2195],
  [50.0000, -0.0010, 2.4900, 50.0000, 0.0009, -2.4900, 4.8045],
  [50.0000, -0.0010, 2.4900, 50.0000, 0.0010, -2.4900, 4.8045],
  [50.0000, -0.0010, 2.4900, 50.0000, 0.0011, -2.4900, 4.7461],
  [50.0000, 2.5000, 0.0000, 50.0000, 0.0000, -2.5000, 4.3065],
  [50.0000, 2.5000, 0.0000, 73.0000, 25.0000, -18.0000, 27.1492],
  [50.0000, 2.5000, 0.0000, 61.0000, -5.0000, 29.0000, 22.8977],
  [50.0000, 2.5000, 0.0000, 56.0000, -27.0000, -3.0000, 31.9030],
  [50.0000, 2.5000, 0.0000, 58.0000, 24.0000, 15.0000, 19.4535],
  [50.0000, 2.5000, 0.0000, 50.0000, 3.1736, 0.5854, 1.0000],
  [50.0000, 2.5000, 0.0000, 50.0000, 3.2972, 0.0000, 1.0000],
  [50.0000, 2.5000, 0.0000, 50.0000, 1.8634, 0.5757, 1.0000],
  [50.0000, 2.5000, 0.0000, 50.0000, 3.2592, 0.3350, 1.0000],
  [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
  [63.0109, -31.0961, -5.8663, 62.8187, -29.7946, -4.0864, 1.2630],
  [61.2901, 3.7196, -5.3901, 61.4292, 2.2480, -4.9620, 1.8731],
  [35.0831, -44.1164, 3.7933, 35.0232, -40.0716, 1.5901, 1.8645],
  [22.7233, 20.0904, -46.6940, 23.0331, 14.9730, -42.5619, 2.0373],
  [36.4612, 47.8580, 18.3852, 36.2715, 50.5065, 21.2231, 1.4146],
  [90.8027, -2.0831, 1.4410, 91.1528, -1.6435, 0.0447, 1.4441],
  [90.9257, -0.5406, -0.9208, 88.6381, -0.8985, -0.7239, 1.5381],
  [6.7747, -0.2908, -2.4247, 5.8714, -0.0985, -2.2286, 0.6377],
  [2.0776, 0.0795, -1.1350, 0.9033, -0.0636, -0.5514, 0.9082],
];

/** The published values are rounded to 4 decimals. */
const SHARMA_TOL = 0.5e-4;

/**
 * Colors for the colorjs.io comparison, as CSS strings both libraries parse:
 * sRGB primaries and neutrals, near-identical pairs, and colors outside sRGB
 * (Display P3, Rec. 2020, ProPhoto, and OKLCH / Lab values no display has).
 */
const SAMPLES = [
  '#000',
  '#fff',
  '#777',
  '#808080',
  '#010101',
  '#f00',
  '#0f0',
  '#00f',
  '#ff0',
  '#0ff',
  '#f0f',
  '#3b82f6',
  '#2563eb',
  '#3b82f7',
  'rebeccapurple',
  'hsl(30 80% 40%)',
  'color(display-p3 1 0 0)',
  'color(display-p3 0 1 0)',
  'color(display-p3 0.2 0.4 0.95)',
  'color(rec2020 0 1 0)',
  'color(rec2020 1 0 0.1)',
  'color(prophoto-rgb 0.1 0.9 0.2)',
  'oklch(0.7 0.35 150)',
  'oklch(0.3 0.3 265)',
  'oklch(0.95 0.2 100)',
  'lab(50 2.6772 -79.7751)',
  'lab(80 -120 90)',
];

function colorJsDeltaE(a: string, b: string, method: 'OK' | '2000'): number {
  return new ColorJs(a).deltaE(new ColorJs(b), { method });
}

const colorArb: fc.Arbitrary<Color> = fc.record({
  l: fc.double({ min: 0, max: 1, noNaN: true }),
  // Past every RGB gamut: differences must not depend on being displayable.
  c: fc.double({ min: 0, max: 0.5, noNaN: true }),
  h: fc.double({ min: 0, max: 360, noNaN: true }),
  alpha: fc.double({ min: 0, max: 1, noNaN: true }),
});

describe('ciede2000 (Lab kernel)', () => {
  it('has all 34 pairs of the Sharma, Wu & Dalal dataset', () => {
    expect(SHARMA_PAIRS).toHaveLength(34);
  });

  it.each(SHARMA_PAIRS)(
    'lab(%f %f %f) vs lab(%f %f %f) → %f',
    (L1, a1, b1, L2, a2, b2, expected) => {
      expect(
        Math.abs(ciede2000(L1, a1, b1, L2, a2, b2) - expected),
      ).toBeLessThan(SHARMA_TOL);
      // The dataset lists each pair once; the formula is symmetric.
      expect(
        Math.abs(ciede2000(L2, a2, b2, L1, a1, b1) - expected),
      ).toBeLessThan(SHARMA_TOL);
    },
  );

  it('is 0 for identical inputs, neutral or not', () => {
    expect(ciede2000(50, 0, 0, 50, 0, 0)).toBe(0);
    expect(ciede2000(0, 0, 0, 0, 0, 0)).toBe(0);
    expect(ciede2000(61.2901, 3.7196, -5.3901, 61.2901, 3.7196, -5.3901)).toBe(
      0,
    );
  });

  it('reduces to ΔL / SL for two neutrals', () => {
    // With a = b = 0 on both sides, C′ = 0, so ΔC′ = ΔH′ = 0 and
    // ΔE00 = |ΔL| / SL, SL = 1 + 0.015·(L̄ − 50)² / √(20 + (L̄ − 50)²).
    // L 50 → 60: L̄ = 55, SL = 1 + 0.375 / √45.
    expect(ciede2000(50, 0, 0, 60, 0, 0)).toBeCloseTo(
      10 / (1 + 0.375 / Math.sqrt(45)),
      12,
    );
    // L 0 → 100: L̄ = 50, SL = 1, so black to white is exactly 100.
    expect(ciede2000(0, 0, 0, 100, 0, 0)).toBe(100);
  });

  it('ignores hue when one side is neutral', () => {
    // Sharma pairs 7 and 8 cover this against published values; here the
    // chromatic side is rotated to check the result stays finite everywhere.
    for (let deg = 0; deg < 360; deg += 15) {
      const a = 20 * Math.cos((deg * Math.PI) / 180);
      const b = 20 * Math.sin((deg * Math.PI) / 180);
      const forward = ciede2000(50, 0, 0, 50, a, b);
      expect(Number.isFinite(forward)).toBe(true);
      expect(forward).toBeGreaterThan(0);
      expect(ciede2000(50, a, b, 50, 0, 0)).toBeCloseTo(forward, 12);
    }
  });
});

describe('toLabD50 (internal)', () => {
  it.each(SAMPLES)('matches colorjs.io lab for %s', (css) => {
    const [L, a, b] = toLabD50(parse(css));
    const [refL, refA, refB] = new ColorJs(css).to('lab').coords;
    expect(Math.abs(L - refL!)).toBeLessThan(FLOAT_TOL);
    expect(Math.abs(a - refA!)).toBeLessThan(FLOAT_TOL);
    expect(Math.abs(b - refB!)).toBeLessThan(FLOAT_TOL);
  });
});

describe('deltaE2000', () => {
  // The two antipodal pairs (a2 = -a1, b2 = -b1) have a hue difference of exactly
  // 180°, the branch point of the formula's hue-difference rule. Through a
  // Lab → Color → Lab round trip, float noise (which differs between
  // JavaScript engine versions) decides the branch, and the two branches are
  // 0.04 apart. The kernel test above covers those pairs exactly.
  const ROUND_TRIP_PAIRS = SHARMA_PAIRS.filter(
    ([, a1, b1, , a2, b2]) => !(a1 === -a2 && b1 === -b2),
  );

  it('keeps all but the two antipodal Sharma pairs for the round trip', () => {
    expect(ROUND_TRIP_PAIRS).toHaveLength(SHARMA_PAIRS.length - 2);
  });

  it.each(ROUND_TRIP_PAIRS)(
    'reproduces the Sharma value from parsed lab(%f %f %f) / lab(%f %f %f)',
    (L1, a1, b1, L2, a2, b2, expected) => {
      // Lab → Color (OKLCH) → Lab round trip, including the pairs outside
      // sRGB (the first six are far past the blue primary).
      const color1 = parse(`lab(${L1} ${a1} ${b1})`);
      const color2 = parse(`lab(${L2} ${a2} ${b2})`);
      expect(Math.abs(deltaE2000(color1, color2) - expected)).toBeLessThan(
        SHARMA_TOL,
      );
    },
  );

  it('matches colorjs.io for every sample pair', () => {
    // Pairs with a gray get a looser tolerance, because the reference is the
    // noisy side there: colorjs.io leaves float noise in a gray's Lab a and b
    // (how much depends on the JavaScript engine version), and CIEDE2000
    // takes the square root of the chroma product and reads a hue from it,
    // moving the result by up to ~5e-6. color-kit converts grays to an
    // exactly neutral Lab color instead.
    for (const a of SAMPLES) {
      for (const b of SAMPLES) {
        const colorA = parse(a);
        const colorB = parse(b);
        const hasGray = isAchromatic(colorA.c) || isAchromatic(colorB.c);
        const actual = deltaE2000(colorA, colorB);
        const error = Math.abs(actual - colorJsDeltaE(a, b, '2000'));
        expect(error, `${a} vs ${b}`).toBeLessThan(
          hasGray ? GRAY_REFERENCE_TOL : FLOAT_TOL,
        );
      }
    }
  });

  it('converts grays to an exactly neutral Lab color', () => {
    for (const css of ['#fff', '#777', '#808080', 'hsl(0 0% 33%)']) {
      const [, a, b] = toLabD50(parse(css));
      expect(a).toBe(0);
      expect(b).toBe(0);
    }
    // Chroma above the library's achromatic threshold is kept.
    const [, a, b] = toLabD50({ l: 0.6, c: 1e-5, h: 40, alpha: 1 });
    expect(Math.hypot(a, b)).toBeGreaterThan(1e-4);
  });

  it('is 100 from black to white', () => {
    // Both are neutral (see the kernel test): ΔE00 = ΔL = 100.
    expect(deltaE2000(parse('#000'), parse('#fff'))).toBeCloseTo(100, 9);
  });

  it('ignores the stored hue of a zero-chroma color', () => {
    const gray: Color = { l: 0.6, c: 0, h: 0, alpha: 1 };
    const red = parse('#f00');
    for (const h of [0, 90, 200, 359.9]) {
      expect(deltaE2000({ ...gray, h }, gray)).toBe(0);
      expect(deltaE2000({ ...gray, h }, red)).toBe(deltaE2000(gray, red));
    }
  });

  it('is 0 for identical colors', () => {
    fc.assert(
      fc.property(colorArb, (color) => {
        expect(deltaE2000(color, { ...color })).toBe(0);
      }),
    );
  });

  it('is symmetric, finite and non-negative', () => {
    fc.assert(
      fc.property(colorArb, colorArb, (a, b) => {
        const forward = deltaE2000(a, b);
        expect(Number.isFinite(forward)).toBe(true);
        expect(forward).toBeGreaterThanOrEqual(0);
        expect(Math.abs(deltaE2000(b, a) - forward)).toBeLessThan(FLOAT_TOL);
      }),
    );
  });

  it('ignores alpha', () => {
    fc.assert(
      fc.property(colorArb, colorArb, (a, b) => {
        expect(deltaE2000({ ...a, alpha: 1 }, { ...b, alpha: 0 })).toBe(
          deltaE2000(a, b),
        );
      }),
    );
  });
});

describe('deltaEOK', () => {
  it('matches colorjs.io for every sample pair', () => {
    for (const a of SAMPLES) {
      for (const b of SAMPLES) {
        const actual = deltaEOK(parse(a), parse(b));
        const error = Math.abs(actual - colorJsDeltaE(a, b, 'OK'));
        expect(error, `${a} vs ${b}`).toBeLessThan(FLOAT_TOL);
      }
    }
  });

  it('is the Euclidean OKLab distance, with no scaling', () => {
    // OKLab L is 0 for black and 1 for white, both with a = b = 0.
    expect(deltaEOK(parse('#000'), parse('#fff'))).toBeCloseTo(1, 9);
    // Same hue: (ΔL, ΔC) = (0.3, 0.4), a 3-4-5 triangle.
    expect(
      deltaEOK(
        { l: 0.5, c: 0.1, h: 30, alpha: 1 },
        { l: 0.8, c: 0.5, h: 30, alpha: 1 },
      ),
    ).toBeCloseTo(0.5, 12);
    // Opposite hues at one lightness: the chromas add.
    expect(
      deltaEOK(
        { l: 0.6, c: 0.1, h: 80, alpha: 1 },
        { l: 0.6, c: 0.15, h: 260, alpha: 1 },
      ),
    ).toBeCloseTo(0.25, 12);
    // A quarter turn apart: √(0.03² + 0.04²).
    expect(
      deltaEOK(
        { l: 0.6, c: 0.03, h: 10, alpha: 1 },
        { l: 0.6, c: 0.04, h: 100, alpha: 1 },
      ),
    ).toBeCloseTo(0.05, 12);
  });

  it('ignores the stored hue of a zero-chroma color', () => {
    const gray: Color = { l: 0.6, c: 0, h: 0, alpha: 1 };
    for (const h of [0, 90, 200, 359.9]) {
      expect(deltaEOK({ ...gray, h }, gray)).toBe(0);
      // Two neutrals differ by lightness only.
      expect(deltaEOK({ ...gray, h }, { ...gray, l: 0.25 })).toBeCloseTo(
        0.35,
        12,
      );
    }
  });

  it('does not write to its arguments', () => {
    const a: Color = { l: 0.5, c: 0.1, h: 30, alpha: 0.5 };
    const b: Color = { l: 0.8, c: 0.2, h: 200, alpha: 1 };
    deltaEOK(a, b);
    deltaE2000(a, b);
    expect(a).toEqual({ l: 0.5, c: 0.1, h: 30, alpha: 0.5 });
    expect(b).toEqual({ l: 0.8, c: 0.2, h: 200, alpha: 1 });
  });

  it('is 0 for identical colors', () => {
    fc.assert(
      fc.property(colorArb, (color) => {
        expect(deltaEOK(color, { ...color })).toBe(0);
        // Same object on both sides: the scratch values must not alias.
        expect(deltaEOK(color, color)).toBe(0);
      }),
    );
  });

  it('is symmetric and ignores alpha', () => {
    fc.assert(
      fc.property(colorArb, colorArb, (a, b) => {
        const forward = deltaEOK(a, b);
        expect(forward).toBeGreaterThanOrEqual(0);
        expect(deltaEOK(b, a)).toBe(forward);
        expect(deltaEOK({ ...a, alpha: 1 }, { ...b, alpha: 0 })).toBe(forward);
      }),
    );
  });

  it('satisfies the triangle inequality', () => {
    fc.assert(
      fc.property(colorArb, colorArb, colorArb, (a, b, c) => {
        expect(deltaEOK(a, c)).toBeLessThanOrEqual(
          deltaEOK(a, b) + deltaEOK(b, c) + 1e-12,
        );
      }),
    );
  });
});
