/**
 * Adobe RGB (1998), CSS `a98-rgb`, as a gamut descriptor (`a98Rgb`).
 *
 * Reference values are never produced by color-kit itself. They come from:
 *
 * - the Adobe RGB (1998) primaries and D65 white, as CSS Color 4 lists them
 *   (https://www.w3.org/TR/css-color-4/#predefined-a98-rgb);
 * - the CSS Color 4 sample code `lin_a98rgb_to_XYZ` / `XYZ_to_lin_a98rgb`
 *   (https://www.w3.org/TR/css-color-4/#color-conversion-code), copied below
 *   as the rational numbers it is written in;
 * - colorjs.io (`a98rgb`, `a98rgb-linear`), computed at run time.
 */
import ColorJs from 'colorjs.io';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { A98_RGB_GAMMA } from '../src/conversion/a98-rgb.js';
import {
  LINEAR_A98_RGB_TO_LINEAR_SRGB,
  LINEAR_SRGB_TO_LINEAR_A98_RGB,
  LMS_TO_LINEAR_A98_RGB,
  LMS_TO_LINEAR_SRGB,
  type Matrix3,
} from '../src/conversion/matrices.js';
import {
  LINEAR_A98_RGB_TO_XYZ_D65,
  LINEAR_SRGB_TO_XYZ_D65,
  XYZ_D65_TO_LINEAR_SRGB,
} from '../src/conversion/xyz.js';
import {
  A98_RGB_LINEAR_MAX,
  A98_RGB_LINEAR_MIN,
} from '../src/gamut/linear-bounds.js';
import { decodeTransfer, encodeTransfer } from '../src/gamut/transfer.js';
import {
  GAMUT_EPSILON,
  a98Rgb,
  assertGamut,
  contrastRatio,
  definePlane,
  displayP3,
  ensureContrast,
  gamutBoundaryPath,
  inGamut,
  maxChromaAt,
  maxChromaForHue,
  parse,
  planeToColor,
  rec2020,
  relativeLuminance,
  sense,
  srgb,
  toGamut,
  tryEnsureContrast,
  type Color,
  type Gamut,
} from '../src/index.js';
import {
  a98Rgb as planeA98Rgb,
  containsPoint,
  runPlaneQueries,
} from '../src/plane/index.js';

type Vec3 = [number, number, number];

const FLOAT_TOL = 1e-9;
const WHITE = parse('#ffffff');

function apply(m: Matrix3, [x, y, z]: Vec3): Vec3 {
  return [
    m[0][0] * x + m[0][1] * y + m[0][2] * z,
    m[1][0] * x + m[1][1] * y + m[1][2] * z,
    m[2][0] * x + m[2][1] * y + m[2][2] * z,
  ];
}

function multiply(a: Matrix3, b: Matrix3): Matrix3 {
  const column = (index: number): Vec3 => [
    b[0][index],
    b[1][index],
    b[2][index],
  ];
  const columns = [0, 1, 2].map((index) => apply(a, column(index)));
  return [0, 1, 2].map((row) =>
    columns.map((entries) => entries[row]),
  ) as unknown as Matrix3;
}

function expectMatrix(actual: Matrix3, expected: Matrix3, tol: number) {
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      expect(
        Math.abs(actual[row][column] - expected[row][column]),
      ).toBeLessThanOrEqual(tol);
    }
  }
}

function coords(color: ColorJs, space: string): Vec3 {
  const [a, b, c] = color.to(space).coords;
  return [a ?? 0, b ?? 0, c ?? 0];
}

function refOf(color: Color): ColorJs {
  return new ColorJs('oklch', [color.l, color.c, color.h], color.alpha);
}

function oklch(l: number, c: number, h: number): Color {
  return { l, c, h, alpha: 1 };
}

/** OKLCH of encoded a98-rgb channels, by colorjs.io. */
function fromA98(rgb: Vec3): Color {
  const [l, c, h] = coords(new ColorJs('a98rgb', rgb), 'oklch');
  return oklch(l, c, Number.isFinite(h) ? h : 0);
}

/** Deterministic sample of OKLCH colors that straddle every gamut. */
function sampleColors(count: number, maxChroma = 0.5): Color[] {
  let seed = 0xa98;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  return Array.from({ length: count }, () =>
    oklch(0.02 + next() * 0.96, next() * maxChroma, next() * 360),
  );
}

const CORNERS: Array<[string, Vec3]> = [
  ['red', [1, 0, 0]],
  ['green', [0, 1, 0]],
  ['blue', [0, 0, 1]],
  ['yellow', [1, 1, 0]],
  ['cyan', [0, 1, 1]],
  ['magenta', [1, 0, 1]],
  ['white', [1, 1, 1]],
  ['black', [0, 0, 0]],
];

// ─── Descriptor ──────────────────────────────────────────────────────

describe('a98Rgb descriptor', () => {
  it('is plain data named after the CSS color() space', () => {
    expect(a98Rgb.id).toBe('a98-rgb');
    expect(planeA98Rgb).toBe(a98Rgb);
    expect(a98Rgb.lmsToLinear).toBe(LMS_TO_LINEAR_A98_RGB);
    expect(a98Rgb.fromLinearSrgb).toBe(LINEAR_SRGB_TO_LINEAR_A98_RGB);
    expect(a98Rgb.toLinearSrgb).toBe(LINEAR_A98_RGB_TO_LINEAR_SRGB);
    expect(a98Rgb.transfer).toEqual({
      g: 563 / 256,
      a: 1,
      b: 0,
      c: 1,
      d: -1,
      e: -1,
    });
    expect(a98Rgb.transfer.g).toBe(2.19921875);
    expect(a98Rgb.linearMin).toBe(A98_RGB_LINEAR_MIN);
    expect(a98Rgb.linearMax).toBe(A98_RGB_LINEAR_MAX);
    expect(a98Rgb.maxChroma).toBe(0.4);
    expect(JSON.parse(JSON.stringify(a98Rgb))).toEqual(a98Rgb);
    expect(() => assertGamut(a98Rgb, 'test()')).not.toThrow();
    expect(() => maxChromaAt(0.5, 200, { gamut: 'a98-rgb' as never })).toThrow(
      new TypeError(
        'maxChromaAt(): gamut "a98-rgb" is not a Gamut object; import one, such as displayP3',
      ),
    );
  });
});

// ─── Matrices ────────────────────────────────────────────────────────

describe('Adobe RGB (1998) matrices', () => {
  // CSS Color 4 sample code, conversions.js.
  const CSS_LIN_A98_TO_XYZ: Matrix3 = [
    [573536 / 994567, 263643 / 1420810, 187206 / 994567],
    [591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
    [53769 / 1989134, 351524 / 4972835, 4929758 / 4972835],
  ];
  const CSS_XYZ_TO_LIN_A98: Matrix3 = [
    [1829569 / 896150, -506331 / 896150, -308931 / 896150],
    [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
    [16779 / 1248040, -147721 / 1248040, 1266979 / 1248040],
  ];
  // colorjs.io Oklab.M.LMStoXYZ (the inverse of its XYZtoLMS).
  const LMS_TO_XYZ: Matrix3 = [
    [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
    [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
    [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
  ];

  it('share the parser matrix, which is the CSS Color 4 rational one', () => {
    expectMatrix(LINEAR_A98_RGB_TO_XYZ_D65, CSS_LIN_A98_TO_XYZ, 1e-15);
    expectMatrix(
      multiply(CSS_XYZ_TO_LIN_A98, LINEAR_A98_RGB_TO_XYZ_D65),
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      1e-15,
    );
  });

  it('place the primaries and white at the Adobe RGB (1998) chromaticities', () => {
    // CSS Color 4, "The Predefined A98 RGB Color Space".
    const expected: Array<[number, number]> = [
      [0.64, 0.33],
      [0.21, 0.71],
      [0.15, 0.06],
    ];
    expected.forEach(([x, y], index) => {
      const rgb: Vec3 = [0, 0, 0];
      rgb[index] = 1;
      // Through the descriptor: a98 -> linear sRGB -> XYZ.
      const [X, Y, Z] = apply(
        LINEAR_SRGB_TO_XYZ_D65,
        apply(LINEAR_A98_RGB_TO_LINEAR_SRGB, rgb),
      );
      expect(X / (X + Y + Z)).toBeCloseTo(x, 12);
      expect(Y / (X + Y + Z)).toBeCloseTo(y, 12);
    });
    // White (1, 1, 1) is D65: x = 0.3127, y = 0.3290, Y = 1.
    const [X, Y, Z] = apply(
      LINEAR_SRGB_TO_XYZ_D65,
      apply(LINEAR_A98_RGB_TO_LINEAR_SRGB, [1, 1, 1]),
    );
    expect(Y).toBeCloseTo(1, 14);
    expect(X / (X + Y + Z)).toBeCloseTo(0.3127, 12);
    expect(Y / (X + Y + Z)).toBeCloseTo(0.329, 12);
  });

  it('are the products of the XYZ matrices', () => {
    expectMatrix(
      LINEAR_SRGB_TO_LINEAR_A98_RGB,
      multiply(CSS_XYZ_TO_LIN_A98, LINEAR_SRGB_TO_XYZ_D65),
      1e-15,
    );
    expectMatrix(
      LINEAR_A98_RGB_TO_LINEAR_SRGB,
      multiply(XYZ_D65_TO_LINEAR_SRGB, LINEAR_A98_RGB_TO_XYZ_D65),
      1e-15,
    );
    // The LMS matrix is this float64 product, bit for bit.
    expect(LMS_TO_LINEAR_A98_RGB).toEqual(
      multiply(CSS_XYZ_TO_LIN_A98, LMS_TO_XYZ),
    );
  });

  it('keep the green channel of sRGB, whose red and blue primaries it shares', () => {
    // Exact rational entries, rounded to float64.
    expect(LINEAR_SRGB_TO_LINEAR_A98_RGB).toEqual([
      [47872228 / 66942405, 19070177 / 66942405, 0],
      [0, 1, 0],
      [0, 11512411 / 279685764, 268173353 / 279685764],
    ]);
    expect(LINEAR_A98_RGB_TO_LINEAR_SRGB).toEqual([
      [66942405 / 47872228, -19070177 / 47872228, 0],
      [0, 1, 0],
      [0, -11512411 / 268173353, 279685764 / 268173353],
    ]);
    expectMatrix(
      [LMS_TO_LINEAR_A98_RGB[1], LMS_TO_LINEAR_SRGB[1], [0, 0, 0]],
      [LMS_TO_LINEAR_SRGB[1], LMS_TO_LINEAR_SRGB[1], [0, 0, 0]],
      1e-15,
    );
  });

  it('are inverses of each other and keep white neutral', () => {
    expectMatrix(
      multiply(LINEAR_A98_RGB_TO_LINEAR_SRGB, LINEAR_SRGB_TO_LINEAR_A98_RGB),
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      1e-15,
    );
    for (const matrix of [
      LINEAR_SRGB_TO_LINEAR_A98_RGB,
      LINEAR_A98_RGB_TO_LINEAR_SRGB,
      LMS_TO_LINEAR_A98_RGB,
    ]) {
      for (const row of matrix) {
        expect(row[0] + row[1] + row[2]).toBeCloseTo(1, 13);
      }
    }
  });

  it('convert linear sRGB <-> linear a98-rgb like colorjs.io', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: -0.5, max: 1.5, noNaN: true }),
          fc.double({ min: -0.5, max: 1.5, noNaN: true }),
          fc.double({ min: -0.5, max: 1.5, noNaN: true }),
        ),
        (rgb) => {
          const forward = apply(LINEAR_SRGB_TO_LINEAR_A98_RGB, rgb);
          const expected = coords(
            new ColorJs('srgb-linear', rgb),
            'a98rgb-linear',
          );
          const back = apply(LINEAR_A98_RGB_TO_LINEAR_SRGB, rgb);
          const expectedBack = coords(
            new ColorJs('a98rgb-linear', rgb),
            'srgb-linear',
          );
          for (let index = 0; index < 3; index += 1) {
            expect(Math.abs(forward[index] - expected[index])).toBeLessThan(
              FLOAT_TOL,
            );
            expect(Math.abs(back[index] - expectedBack[index])).toBeLessThan(
              FLOAT_TOL,
            );
          }
        },
      ),
    );
  });

  it('map OKLab LMS to linear a98-rgb like colorjs.io', () => {
    for (const color of sampleColors(200)) {
      const reference = refOf(color);
      // LMS (after cubing) is linear in XYZ: use colorjs.io's XYZ -> LMS.
      const lms = apply(
        [
          [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
          [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
          [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
        ],
        coords(reference, 'xyz-d65'),
      );
      const actual = apply(LMS_TO_LINEAR_A98_RGB, lms);
      const expected = coords(reference, 'a98rgb-linear');
      for (let index = 0; index < 3; index += 1) {
        expect(Math.abs(actual[index] - expected[index])).toBeLessThan(
          FLOAT_TOL,
        );
      }
    }
  });
});

// ─── Transfer curve and bounds ───────────────────────────────────────

describe('Adobe RGB (1998) transfer curve', () => {
  const values = [
    0, 1e-9, 0.000075, 0.001, 0.0031308, 0.04045, 0.18, 0.42, 0.5, 0.999, 1,
    1.000075, 1.5,
  ];

  it('is the 563/256 power the color(a98-rgb ...) parser decodes with', () => {
    expect(A98_RGB_GAMMA).toBe(563 / 256);
    for (const value of values.flatMap((v) => (v === 0 ? [v] : [v, -v]))) {
      // The parser's expression (parse.ts: signedPow(value, 563 / 256)),
      // bit for bit.
      expect(decodeTransfer(a98Rgb.transfer, value)).toBe(
        Math.sign(value) * Math.abs(value) ** (563 / 256),
      );
      // colorjs.io a98rgb.toBase / fromBase, bit for bit.
      expect(decodeTransfer(a98Rgb.transfer, value)).toBe(
        Math.pow(Math.abs(value), 563 / 256) * Math.sign(value),
      );
      expect(encodeTransfer(a98Rgb.transfer, value)).toBe(
        Math.pow(Math.abs(value), 256 / 563) * Math.sign(value),
      );
      expect(
        encodeTransfer(a98Rgb.transfer, decodeTransfer(a98Rgb.transfer, value)),
      ).toBeCloseTo(value, 14);
    }
  });

  it('decodes parsed colors to the same light as the parser', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0, max: 1, noNaN: true }),
        ),
        (rgb) => {
          // Compared in linear light: OKLCH is ill-conditioned next to
          // black, where a cube root amplifies float noise.
          const parsed = refOf(parse(`color(a98-rgb ${rgb.join(' ')})`));
          const viaColorJs = coords(parsed, 'a98rgb-linear');
          const viaDescriptor = apply(
            LINEAR_SRGB_TO_LINEAR_A98_RGB,
            coords(parsed, 'srgb-linear'),
          );
          rgb.forEach((value, index) => {
            const expected = decodeTransfer(a98Rgb.transfer, value);
            expect(Math.abs(viaColorJs[index] - expected)).toBeLessThan(
              FLOAT_TOL,
            );
            expect(Math.abs(viaDescriptor[index] - expected)).toBeLessThan(
              FLOAT_TOL,
            );
          });
        },
      ),
    );
  });

  it('derives the linear bounds from GAMUT_EPSILON through that curve', () => {
    // colorjs.io: inGamut tests encoded coords against [-eps, 1 + eps].
    expect(A98_RGB_LINEAR_MIN).toBe(-(GAMUT_EPSILON ** (563 / 256)));
    expect(A98_RGB_LINEAR_MAX).toBe((1 + GAMUT_EPSILON) ** (563 / 256));
    expect(a98Rgb.linearMin).toBe(
      decodeTransfer(a98Rgb.transfer, -GAMUT_EPSILON),
    );
    expect(a98Rgb.linearMax).toBe(
      decodeTransfer(a98Rgb.transfer, 1 + GAMUT_EPSILON),
    );
    expect(A98_RGB_LINEAR_MIN).toBeCloseTo(-8.479e-10, 13);
    expect(A98_RGB_LINEAR_MAX).toBeCloseTo(1.000164949, 9);
  });
});

// ─── Membership ──────────────────────────────────────────────────────

describe('a98Rgb membership', () => {
  it.each(CORNERS)(
    'parses the %s corner to colorjs.io OKLCH and keeps it in gamut',
    (_name, rgb) => {
      const css = `color(a98-rgb ${rgb.join(' ')})`;
      const color = parse(css);
      const [l, c, h] = coords(new ColorJs(css), 'oklch');
      expect(Math.abs(color.l - l)).toBeLessThan(FLOAT_TOL);
      expect(Math.abs(color.c - c)).toBeLessThan(FLOAT_TOL);
      if (c > 1e-6) {
        const delta = Math.abs(color.h - h) % 360;
        expect(Math.min(delta, 360 - delta)).toBeLessThan(1e-7);
      }
      expect(inGamut(color, a98Rgb)).toBe(true);
      // (White and black snap to exactly l = 1 / 0, c = 0.)
      const mapped = toGamut(color, a98Rgb);
      expect(mapped.l).toBeCloseTo(color.l, 12);
      expect(mapped.c).toBeCloseTo(color.c, 12);
    },
  );

  it('matches the published OKLCH of the primaries', () => {
    // colorjs.io: new Color('color(a98-rgb 0 1 0)').to('oklch'), etc.
    const green = parse('color(a98-rgb 0 1 0)');
    expect(green.l).toBeCloseTo(0.81487, 4);
    expect(green.c).toBeCloseTo(0.39473, 4);
    expect(green.h).toBeCloseTo(151.569, 2);
    const red = parse('color(a98-rgb 1 0 0)');
    expect(red.l).toBeCloseTo(0.70221, 4);
    expect(red.c).toBeCloseTo(0.28815, 4);
    expect(red.h).toBeCloseTo(29.234, 2);
    const blue = parse('color(a98-rgb 0 0 1)');
    expect(blue.l).toBeCloseTo(0.45839, 4);
    expect(blue.c).toBeCloseTo(0.31763, 4);
    expect(blue.h).toBeCloseTo(264.052, 2);
  });

  it.each([
    // Just inside and just outside the encoded tolerance, low and high.
    ['color(a98-rgb -0.00007 0.5 0.5)', true],
    ['color(a98-rgb -0.00008 0.5 0.5)', false],
    ['color(a98-rgb 0.5 1.00007 0.5)', true],
    ['color(a98-rgb 0.5 1.00008 0.5)', false],
    ['color(a98-rgb 0.5 0.5 -0.00007)', true],
    ['color(a98-rgb 0.5 0.5 1.00008)', false],
    ['color(a98-rgb 1.00008 0 0)', false],
    ['color(a98-rgb 0 1.00008 0)', false],
    ['color(a98-rgb 0 0 1.00008)', false],
    // -0.003 encoded is -2.8e-6 linear: inside the sRGB linear tolerance
    // (-5.8e-6), so reusing the sRGB bounds would wrongly accept it.
    ['color(a98-rgb -0.003 0.5 0.5)', false],
    ['color(a98-rgb 0.2 -0.003 0.9)', false],
  ] as const)('%s in gamut: %s (as colorjs.io)', (css, expected) => {
    expect(new ColorJs(css).inGamut('a98rgb')).toBe(expected);
    expect(inGamut(parse(css), a98Rgb)).toBe(expected);
  });

  it('agrees with colorjs.io inGamut("a98rgb") across OKLCH', () => {
    let inside = 0;
    let outside = 0;
    let skipped = 0;
    for (const color of sampleColors(4000, 0.45)) {
      const reference = refOf(color);
      const encoded = coords(reference, 'a98rgb');
      // Skip samples that sit on the tolerance itself to within float noise.
      const excursion = Math.min(
        ...encoded.map((value) =>
          Math.min(
            Math.abs(value + GAMUT_EPSILON),
            Math.abs(value - 1 - GAMUT_EPSILON),
          ),
        ),
      );
      if (excursion < 1e-9) {
        skipped += 1;
        continue;
      }
      const expected = reference.inGamut('a98rgb');
      if (expected) inside += 1;
      else outside += 1;
      expect(inGamut(color, a98Rgb)).toBe(expected);
    }
    expect(inside).toBeGreaterThan(300);
    expect(outside).toBeGreaterThan(300);
    expect(skipped).toBeLessThan(5);
  });

  it('accepts the gamut surface and rejects points just beyond it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (face, u, v) => {
          const fixed = face % 2;
          const axis = Math.floor(face / 2);
          const rgb: Vec3 = [u, v, 0];
          rgb.splice(axis, 0, fixed);
          rgb.length = 3;
          expect(inGamut(fromA98(rgb), a98Rgb)).toBe(true);
          // 0.001 encoded past the face is well outside the tolerance.
          const beyond: Vec3 = [...rgb];
          beyond[axis] = fixed === 0 ? -0.001 : 1.001;
          expect(inGamut(fromA98(beyond), a98Rgb)).toBe(false);
        },
      ),
    );
  });

  it('maps out-of-gamut colors onto the boundary', () => {
    for (const color of sampleColors(300, 0.6)) {
      const mapped = toGamut(color, a98Rgb);
      expect(inGamut(mapped, a98Rgb)).toBe(true);
      if (inGamut(color, a98Rgb)) {
        expect(mapped).toEqual(color);
      } else {
        expect(mapped.c).toBeLessThan(color.c);
        expect(refOf(mapped).inGamut('a98rgb')).toBe(true);
      }
    }
  });
});

// ─── Chroma geometry ─────────────────────────────────────────────────

describe('a98Rgb max chroma', () => {
  const TOL = 1e-6;
  const options = (gamut: Gamut) => ({ gamut, tolerance: TOL });

  it('returns a chroma on the boundary: in gamut, out just above', () => {
    for (let h = 5; h < 360; h += 25) {
      for (const l of [0.2, 0.5, 0.8]) {
        const c = maxChromaAt(l, h, options(a98Rgb));
        expect(inGamut(oklch(l, c, h), a98Rgb)).toBe(true);
        expect(inGamut(oklch(l, c + 2 * TOL, h), a98Rgb)).toBe(false);
        // The same boundary as colorjs.io's exact gamut, within tolerance.
        expect(refOf(oklch(l, c - 1e-4, h)).inGamut('a98rgb')).toBe(true);
        expect(refOf(oklch(l, c + 1e-4, h)).inGamut('a98rgb')).toBe(false);
      }
    }
  });

  it('peaks at the green primary, below the default search bound', () => {
    // colorjs.io: oklch(0.8149 0.3947 151.57) is the largest chroma on the
    // edges of the a98-rgb cube.
    let largest = 0;
    let at: Vec3 = [0, 0, 0];
    const steps = 200;
    for (const [i, j] of [
      [0, 1],
      [1, 0],
      [0, 2],
      [2, 0],
      [1, 2],
      [2, 1],
    ]) {
      for (const fixed of [0, 1]) {
        for (let step = 0; step <= steps; step += 1) {
          const rgb: Vec3 = [fixed, fixed, fixed];
          rgb[i] = 1;
          rgb[j] = step / steps;
          const c = fromA98(rgb).c;
          if (c > largest) {
            largest = c;
            at = rgb;
          }
        }
      }
    }
    expect(at).toEqual([0, 1, 0]);
    expect(largest).toBeCloseTo(0.39473, 4);
    expect(a98Rgb.maxChroma).toBeGreaterThan(largest);

    // The tolerance band adds almost nothing: a search with room to spare
    // finds the same peak, so the default bound of 0.4 never truncates.
    let peak = 0;
    for (let h = 0; h < 360; h += 0.25) {
      peak = Math.max(
        peak,
        maxChromaForHue(h, { gamut: a98Rgb, method: 'direct' }).c,
      );
    }
    expect(peak).toBeGreaterThan(0.39);
    expect(peak).toBeLessThan(0.3951);
    const green = parse('color(a98-rgb 0 1 0)');
    const wide = maxChromaAt(green.l, green.h, {
      gamut: a98Rgb,
      maxChroma: 0.8,
      tolerance: TOL,
    });
    expect(wide).toBeLessThan(0.3951);
    expect(
      Math.abs(wide - maxChromaAt(green.l, green.h, options(a98Rgb))),
    ).toBeLessThan(2 * TOL);
    expect(inGamut(oklch(green.l, 0.4, green.h), a98Rgb)).toBe(false);
    // An explicit maxChroma still caps the result.
    expect(
      maxChromaAt(green.l, green.h, { gamut: a98Rgb, maxChroma: 0.3 }),
    ).toBe(0.3);
  });

  it('solves the hue cusp, matching a lightness scan', () => {
    for (let h = 0; h < 360; h += 15) {
      const direct = maxChromaForHue(h, { gamut: a98Rgb, method: 'direct' });
      let best = 0;
      let bestL = 0;
      for (let index = 1; index < 500; index += 1) {
        const l = index / 500;
        const c = maxChromaAt(l, h, options(a98Rgb));
        if (c > best) {
          best = c;
          bestL = l;
        }
      }
      expect(Math.abs(direct.c - best)).toBeLessThan(1e-3);
      expect(Math.abs(direct.l - bestL)).toBeLessThan(0.01);
      const lut = maxChromaForHue(h, { gamut: a98Rgb });
      expect(Math.abs(lut.c - direct.c)).toBeLessThan(2e-3);
    }
  });

  it('puts the a98-rgb primaries and secondaries on the boundary', () => {
    for (const [, rgb] of CORNERS.slice(0, 6)) {
      const corner = fromA98(rgb);
      const c = maxChromaAt(corner.l, corner.h, options(a98Rgb));
      expect(Math.abs(c - corner.c)).toBeLessThan(2e-4);
      const cusp = maxChromaForHue(corner.h, {
        gamut: a98Rgb,
        method: 'direct',
      });
      expect(Math.abs(cusp.c - corner.c)).toBeLessThan(1e-3);
      expect(Math.abs(cusp.l - corner.l)).toBeLessThan(1e-3);
    }
  });

  it('traces boundary paths inside the gamut', () => {
    for (const samplingMode of ['uniform', 'adaptive'] as const) {
      for (const hue of [29, 150, 264]) {
        const path = gamutBoundaryPath(hue, { gamut: a98Rgb, samplingMode });
        expect(path[0]).toEqual({ l: 0, c: 0 });
        expect(path[path.length - 1]).toEqual({ l: 1, c: 0 });
        for (const point of path) {
          expect(point.c).toBe(
            maxChromaAt(point.l, hue, { gamut: a98Rgb }) || 0,
          );
          expect(inGamut(oklch(point.l, point.c, hue), a98Rgb)).toBe(true);
          if (point.l > 0 && point.l < 1) {
            expect(inGamut(oklch(point.l, point.c + 2e-4, hue), a98Rgb)).toBe(
              false,
            );
          }
        }
      }
      const green = gamutBoundaryPath(151.5, { gamut: a98Rgb, samplingMode });
      const peak = Math.max(...green.map((point) => point.c));
      expect(peak).toBeGreaterThan(0.38);
      expect(peak).toBeLessThan(0.4);
    }
  });
});

// ─── Relation to the other gamuts ────────────────────────────────────

describe('a98Rgb and the other gamuts', () => {
  const TOL = 1e-6;
  const options = (gamut: Gamut) => ({ gamut, tolerance: TOL });

  it('contains sRGB', () => {
    // Every encoded sRGB color has a98-rgb channels in [0, 1]: the rows of
    // the linear matrix are non-negative and sum to 1.
    for (const row of LINEAR_SRGB_TO_LINEAR_A98_RGB) {
      expect(Math.min(...row)).toBeGreaterThanOrEqual(0);
    }
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0, max: 1, noNaN: true }),
        ),
        (rgb) => {
          const reference = new ColorJs('srgb', rgb);
          const [l, c, h] = coords(reference, 'oklch');
          const color = oklch(l, c, Number.isFinite(h) ? h : 0);
          expect(reference.inGamut('a98rgb')).toBe(true);
          expect(inGamut(color, a98Rgb)).toBe(true);
        },
      ),
    );
    for (const [, rgb] of CORNERS) {
      expect(inGamut(parse(`color(srgb ${rgb.join(' ')})`), a98Rgb)).toBe(true);
    }
  });

  it('reaches at least as much chroma as sRGB, and more in the greens', () => {
    let wider = 0;
    for (let h = 0; h < 360; h += 3) {
      for (let l = 0.2; l < 1; l += 0.05) {
        const inner = maxChromaAt(l, h, options(srgb));
        const outer = maxChromaAt(l, h, options(a98Rgb));
        // sRGB's membership tolerance is the wider one in linear light
        // (5.8e-6 against 8.5e-10 at 0), so its reported boundary sits a
        // hair outside the a98-rgb one where the two gamuts share a face
        // (measured: at most 6e-5 chroma from l = 0.2 up).
        expect(inner).toBeLessThanOrEqual(outer + 1e-4);
        if (outer > inner + 0.01) wider += 1;
      }
    }
    expect(wider).toBeGreaterThan(300);
    // Next to black that tolerance band is most of the sRGB "gamut", as it
    // is against Rec. 2020: 0.018 chroma at l = 0.02.
    const dark = maxChromaAt(0.02, 83.5, options(srgb));
    expect(dark - maxChromaAt(0.02, 83.5, options(a98Rgb))).toBeGreaterThan(
      0.01,
    );
    expect(refOf(oklch(0.02, dark - 1e-4, 83.5)).inGamut('srgb')).toBe(true);
    expect(refOf(oklch(0.02, dark - 1e-4, 83.5)).inGamut('a98rgb')).toBe(false);
    const srgbGreen = maxChromaForHue(150, { gamut: srgb, method: 'direct' });
    const a98Green = maxChromaForHue(150, { gamut: a98Rgb, method: 'direct' });
    expect(a98Green.c - srgbGreen.c).toBeGreaterThan(0.08);
  });

  it('neither contains Display P3 nor is contained in it', () => {
    // colorjs.io: color(display-p3 1 0 0) is
    // color(a98-rgb 0.936 -0.237 -0.171); color(a98-rgb 0 1 0) is
    // color(display-p3 -0.424 0.979 0.177).
    const p3Only = ['color(display-p3 1 0 0)', 'color(display-p3 1 0.2 0.1)'];
    for (const css of p3Only) {
      const color = parse(css);
      expect(new ColorJs(css).inGamut('a98rgb')).toBe(false);
      expect(inGamut(color, displayP3)).toBe(true);
      expect(inGamut(color, a98Rgb)).toBe(false);
    }
    // The a98-rgb red primary has the sRGB red chromaticity, which Display
    // P3 covers, but more light than P3 can give it there:
    // color(display-p3 1.063 0.239 0.168).
    const a98Only = [
      'color(a98-rgb 1 0 0)',
      'color(a98-rgb 0 1 0)',
      'color(a98-rgb 0 1 1)',
      'color(a98-rgb 0 0.8 0.6)',
    ];
    for (const css of a98Only) {
      const color = parse(css);
      expect(new ColorJs(css).inGamut('p3')).toBe(false);
      expect(inGamut(color, a98Rgb)).toBe(true);
      expect(inGamut(color, displayP3)).toBe(false);
    }
    const p3RedChannels = coords(
      new ColorJs('color(display-p3 1 0 0)'),
      'a98rgb',
    );
    expect(p3RedChannels[1]).toBeLessThan(-0.2);
    expect(p3RedChannels[2]).toBeLessThan(-0.1);
    const a98GreenChannels = coords(new ColorJs('color(a98-rgb 0 1 0)'), 'p3');
    expect(a98GreenChannels[0]).toBeLessThan(-0.4);
  });

  it('has less red chroma than Display P3 and more green and cyan', () => {
    const cusp = (gamut: Gamut, hue: number) =>
      maxChromaForHue(hue, { gamut, method: 'direct' }).c;
    // Red: the P3 primary sits at hue 28.96.
    const p3Red = parse('color(display-p3 1 0 0)');
    expect(cusp(displayP3, p3Red.h) - cusp(a98Rgb, p3Red.h)).toBeGreaterThan(
      0.005,
    );
    expect(
      maxChromaAt(p3Red.l, p3Red.h, options(displayP3)) -
        maxChromaAt(p3Red.l, p3Red.h, options(a98Rgb)),
    ).toBeGreaterThan(0.03);
    // Green and cyan: the a98-rgb primary at hue 151.57 and its cyan at
    // 193.45.
    for (const css of ['color(a98-rgb 0 1 0)', 'color(a98-rgb 0 1 1)']) {
      const corner = parse(css);
      expect(
        cusp(a98Rgb, corner.h) - cusp(displayP3, corner.h),
      ).toBeGreaterThan(0.02);
      expect(
        maxChromaAt(corner.l, corner.h, options(a98Rgb)) -
          maxChromaAt(corner.l, corner.h, options(displayP3)),
      ).toBeGreaterThan(0.02);
    }
  });

  it('lies inside Rec. 2020', () => {
    for (const [, rgb] of CORNERS) {
      const css = `color(a98-rgb ${rgb.join(' ')})`;
      expect(new ColorJs(css).inGamut('rec2020')).toBe(true);
      expect(inGamut(parse(css), rec2020)).toBe(true);
    }
  });
});

// ─── Plane queries ───────────────────────────────────────────────────

describe('a98Rgb plane queries', () => {
  const lcPlane = (hue: number) =>
    definePlane({
      model: 'oklch',
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, 0.5] },
      fixed: { h: hue },
    });

  it.each([29, 150, 193, 264])(
    'draws a boundary on the gamut surface at h%i',
    (hue) => {
      const plane = sense(lcPlane(hue));
      const boundary = plane.gamutBoundary({
        hue,
        steps: 100,
        samplingMode: 'uniform',
        gamut: a98Rgb,
      });
      expect(boundary.gamut).toBe(a98Rgb);
      expect(boundary.points.length).toBeGreaterThan(50);
      for (const point of boundary.points) {
        expect(point.c).toBe(maxChromaAt(point.l, hue, { gamut: a98Rgb }) || 0);
        // Plane y is chroma / 0.5.
        expect(point.y).toBeCloseTo(point.c / 0.5, 12);
        expect(inGamut(oklch(point.l, point.c, hue), a98Rgb)).toBe(true);
        if (point.l > 0 && point.l < 1) {
          expect(inGamut(oklch(point.l, point.c + 2e-4, hue), a98Rgb)).toBe(
            false,
          );
        }
      }
    },
  );

  const regionPlanes = [
    ['oklch l/c', lcPlane(150), 'analytic-lc'],
    [
      'oklch h/c',
      definePlane({
        model: 'oklch',
        x: { channel: 'h' },
        y: { channel: 'c', range: [0, 0.5] },
        fixed: { l: 0.7 },
      }),
      'analytic-hc',
    ],
    [
      'oklab a/b',
      definePlane({
        model: 'oklab',
        x: { channel: 'a', range: [-0.5, 0.5] },
        y: { channel: 'b', range: [0.5, -0.5] },
        fixed: { L: 0.7 },
      }),
      'implicit-contour',
    ],
    ['rgb', definePlane({ model: 'rgb' }), 'domain-edge'],
    [
      // Display P3 is not inside a98-rgb, so this plane needs the contour
      // solver rather than its domain edge.
      'display-p3 r/g at b = 0.5',
      definePlane({ model: 'display-p3', fixed: { b: 0.5 } }),
      'implicit-contour',
    ],
  ] as const;

  it.each(regionPlanes)(
    'fills the a98-rgb region of a %s plane like inGamut',
    (_label, plane, solver) => {
      for (const scope of ['viewport', 'full'] as const) {
        const region = sense(plane).gamutRegion({ gamut: a98Rgb, scope });
        expect(region.gamut).toBe(a98Rgb);
        expect(region.solver).toBe(solver);
        if (scope === 'full') continue;
        let inside = 0;
        let compared = 0;
        let disagreements = 0;
        const steps = 60;
        for (let row = 0; row < steps; row += 1) {
          for (let column = 0; column < steps; column += 1) {
            const point = {
              x: (column + 0.5) / steps,
              y: (row + 0.5) / steps,
            };
            const expected = inGamut(planeToColor(plane, point), a98Rgb);
            const actual = containsPoint(region.visibleRegion, point);
            compared += 1;
            if (expected) inside += 1;
            if (actual !== expected) disagreements += 1;
          }
        }
        // Region outlines are polylines: only cells the boundary passes
        // through may differ.
        expect(disagreements / compared).toBeLessThan(0.02);
        if (region.viewportRelation === 'inside') {
          expect(inside).toBe(compared);
        } else {
          expect(region.viewportRelation).toBe('intersects');
          expect(inside).toBeGreaterThan(0);
          expect(inside).toBeLessThan(compared);
        }
      }
    },
  );

  it('fits the default full-scope chroma range around the green peak', () => {
    // A plane whose chroma axis stops at the default bound (0.4) still
    // holds the whole gamut at the hue of the green primary.
    const plane = definePlane({
      model: 'oklch',
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, a98Rgb.maxChroma] },
      fixed: { h: 151.57 },
    });
    const region = sense(plane).gamutRegion({ gamut: a98Rgb });
    expect(region.viewportRelation).toBe('intersects');
    // The green primary: l = 0.8149, c = 0.3947 (y = 0.987).
    expect(containsPoint(region.visibleRegion, { x: 0.81, y: 0.95 })).toBe(
      true,
    );
    expect(containsPoint(region.visibleRegion, { x: 0.7, y: 0.95 })).toBe(
      false,
    );
    const boundary = sense(plane).gamutBoundary({ gamut: a98Rgb, steps: 400 });
    const top = Math.max(...boundary.points.map((point) => point.y));
    expect(top).toBeGreaterThan(0.97);
    expect(top).toBeLessThan(1);
  });

  it('survives the packed query ABI', () => {
    const plane = lcPlane(150);
    const queries = [
      { kind: 'gamutBoundary', gamut: a98Rgb },
      { kind: 'gamutRegion', gamut: a98Rgb },
      { kind: 'fallbackPoint', gamut: a98Rgb, color: oklch(0.7, 0.6, 150) },
    ] as const;
    const results = runPlaneQueries(plane, [...queries]);
    expect(results.map((result) => result.kind)).toEqual(
      queries.map((query) => query.kind),
    );
    for (const result of results) {
      expect((result as { gamut: Gamut }).gamut).toBe(a98Rgb);
    }
  });
});

// ─── Contrast ────────────────────────────────────────────────────────

describe('a98Rgb contrast', () => {
  it('measures contrast as displayed in a98-rgb', () => {
    expect(contrastRatio(WHITE, WHITE, { gamut: a98Rgb })).toBe(1);
    // Inside sRGB no clipping applies, so the gamut does not matter.
    const gray = parse('#777');
    expect(contrastRatio(gray, WHITE, { gamut: a98Rgb })).toBeCloseTo(
      contrastRatio(gray, WHITE),
      12,
    );
    // Between sRGB and a98-rgb: measured unclipped in a98-rgb, clipped in
    // sRGB.
    const vivid = oklch(0.8, 0.3, 150);
    expect(inGamut(vivid, a98Rgb)).toBe(true);
    expect(inGamut(vivid, srgb)).toBe(false);
    const [r, g, b] = coords(refOf(vivid), 'srgb-linear');
    expect(relativeLuminance(vivid, { gamut: a98Rgb })).toBeCloseTo(
      0.2126 * r + 0.7152 * g + 0.0722 * b,
      9,
    );
    expect(
      Math.abs(
        relativeLuminance(vivid, { gamut: a98Rgb }) - relativeLuminance(vivid),
      ),
    ).toBeGreaterThan(1e-4);
  });

  it("quantizes '8bit' in the a98-rgb encoding", () => {
    // An a98-rgb gray: equal channels, so the display model reduces to one
    // channel quantized with the 563/256 power curve.
    const gray = parse('color(a98-rgb 0.42 0.42 0.42)');
    const byte = Math.round(0.42 * 255) / 255;
    const expected = byte ** (563 / 256);
    expect(
      relativeLuminance(gray, { gamut: a98Rgb, precision: '8bit' }),
    ).toBeCloseTo(expected, 6);
    expect(
      contrastRatio(gray, WHITE, { gamut: a98Rgb, precision: '8bit' }),
    ).toBeCloseTo(1.05 / (expected + 0.05), 5);
    // A 2.4 power (the Rec. 2020 curve) would quantize the same light to a
    // different level.
    const viaOtherCurve =
      (Math.round((0.42 ** (563 / 256)) ** (1 / 2.4) * 255) / 255) ** 2.4;
    expect(Math.abs(expected - viaOtherCurve)).toBeGreaterThan(1e-4);
    // Every channel of an 8-bit a98-rgb color is already on the grid.
    const onGrid = parse(
      `color(a98-rgb ${[40, 200, 120].map((v) => v / 255).join(' ')})`,
    );
    expect(
      contrastRatio(onGrid, WHITE, { gamut: a98Rgb, precision: '8bit' }),
    ).toBeCloseTo(contrastRatio(onGrid, WHITE, { gamut: a98Rgb }), 9);
  });

  it('ensures contrast with an in-gamut passing color', () => {
    // Out of every gamut: chroma is reduced only as far as a98-rgb needs.
    const vivid = oklch(0.85, 0.45, 150);
    for (const run of [ensureContrast, tryEnsureContrast]) {
      const result = run(vivid, WHITE, { gamut: a98Rgb })!;
      expect(inGamut(result, a98Rgb)).toBe(true);
      expect(inGamut(result, srgb)).toBe(false);
      const ratio = contrastRatio(result, WHITE, { gamut: a98Rgb });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(ratio).toBeLessThan(4.5 + 1e-6);
      expect(result.h).toBe(vivid.h);
    }
    expect(
      tryEnsureContrast(vivid, WHITE, { gamut: a98Rgb, threshold: 22 }),
    ).toBeNull();
    expect(() =>
      ensureContrast(vivid, WHITE, { gamut: 'a98-rgb' as never }),
    ).toThrow(/ensureContrast\(\): gamut "a98-rgb" is not a Gamut object/);
  });
});

// ─── Structured clone ────────────────────────────────────────────────

describe('a structured clone of a98Rgb', () => {
  const clone = structuredClone(a98Rgb);

  it('is an equal, separate object', () => {
    expect(clone).not.toBe(a98Rgb);
    expect(clone).toEqual(a98Rgb);
    expect(clone.lmsToLinear).not.toBe(a98Rgb.lmsToLinear);
  });

  it('behaves identically everywhere a gamut is accepted', () => {
    for (const color of sampleColors(200, 0.5)) {
      expect(inGamut(color, clone)).toBe(inGamut(color, a98Rgb));
      expect(toGamut(color, clone)).toEqual(toGamut(color, a98Rgb));
    }
    for (const hue of [29, 150, 264]) {
      expect(maxChromaAt(0.6, hue, { gamut: clone })).toBe(
        maxChromaAt(0.6, hue, { gamut: a98Rgb }),
      );
      for (const method of ['direct', 'lut'] as const) {
        expect(maxChromaForHue(hue, { gamut: clone, method })).toEqual(
          maxChromaForHue(hue, { gamut: a98Rgb, method }),
        );
      }
      expect(gamutBoundaryPath(hue, { gamut: clone, steps: 16 })).toEqual(
        gamutBoundaryPath(hue, { gamut: a98Rgb, steps: 16 }),
      );
      const plane = sense(
        definePlane({
          model: 'oklch',
          x: { channel: 'l', range: [0, 1] },
          y: { channel: 'c', range: [0, 0.5] },
          fixed: { h: hue },
        }),
      );
      const boundary = plane.gamutBoundary({ gamut: clone });
      expect(boundary.gamut).toBe(clone);
      expect(boundary.points).toEqual(
        plane.gamutBoundary({ gamut: a98Rgb }).points,
      );
      const region = plane.gamutRegion({ gamut: clone });
      expect(region.gamut).toBe(clone);
      expect(region.visibleRegion).toEqual(
        plane.gamutRegion({ gamut: a98Rgb }).visibleRegion,
      );
    }
    const vivid = oklch(0.85, 0.45, 150);
    expect(ensureContrast(vivid, WHITE, { gamut: clone })).toEqual(
      ensureContrast(vivid, WHITE, { gamut: a98Rgb }),
    );
    for (const precision of ['exact', '8bit'] as const) {
      expect(contrastRatio(vivid, WHITE, { gamut: clone, precision })).toBe(
        contrastRatio(vivid, WHITE, { gamut: a98Rgb, precision }),
      );
    }
  });
});
