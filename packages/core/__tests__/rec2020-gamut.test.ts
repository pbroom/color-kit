/**
 * Rec. 2020 as a gamut target.
 *
 * Reference values are never produced by color-kit itself. They come from:
 *
 * - ITU-R BT.2020-2, Table 3 (primaries and D65 white chromaticities) and
 *   Table 4 (luma coefficients 0.2627 / 0.6780 / 0.0593);
 * - the CSS Color 4 sample code `lin_2020_to_XYZ` / `XYZ_to_lin_2020`
 *   (https://www.w3.org/TR/css-color-4/#color-conversion-code), copied below
 *   as the rational numbers it is written in;
 * - colorjs.io (`rec2020`, `rec2020-linear`), computed at run time like the
 *   reference-accuracy suite does. colorjs.io 0.7 defines `rec2020` with the
 *   same 2.4 power transfer function as CSS Color 4.
 */
import ColorJs from 'colorjs.io';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  LINEAR_REC2020_TO_LINEAR_SRGB,
  LINEAR_REC2020_TO_XYZ_D65,
  LINEAR_SRGB_TO_LINEAR_REC2020,
  LMS_TO_LINEAR_REC2020,
  XYZ_D65_TO_LINEAR_REC2020,
  type Matrix3,
} from '../src/conversion/matrices.js';
import {
  REC2020_LINEAR_MAX,
  REC2020_LINEAR_MIN,
} from '../src/gamut/linear-bounds.js';
import { GAMUT_SPECS } from '../src/gamut/spec.js';
import {
  GAMUT_EPSILON,
  assertDisplayGamut,
  assertGamutTarget,
  chromaBand,
  contrastRatio,
  contrastRegionPaths,
  definePlane,
  ensureContrast,
  gamutBoundaryPath,
  inP3Gamut,
  inRec2020Gamut,
  inSrgbGamut,
  maxChromaAt,
  maxChromaForHue,
  parse,
  planeToColor,
  sense,
  toCss,
  toP3Gamut,
  toRec2020Gamut,
  toRec2020GamutInto,
  toSrgbGamut,
  tryEnsureContrast,
  type Color,
  type GamutTarget,
} from '../src/index.js';
import { containsPoint, runPlaneQueries } from '../src/plane/index.js';

type Vec3 = [number, number, number];

const FLOAT_TOL = 1e-9;

function apply(m: Matrix3, [x, y, z]: Vec3): Vec3 {
  return [
    m[0][0] * x + m[0][1] * y + m[0][2] * z,
    m[1][0] * x + m[1][1] * y + m[1][2] * z,
    m[2][0] * x + m[2][1] * y + m[2][2] * z,
  ];
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

/**
 * Whether Display P3 can reach past Rec. 2020 at this lightness and hue.
 * Rec. 2020 does not contain all of Display P3 (colorjs.io agrees, see the
 * nesting tests): its blue channel goes negative around the P3 red primary
 * (measured: hues 28.75-39 above lightness 0.15) and above 1 around P3 cyan
 * near white (hues 193.25-199.5, lightness above 0.876). The windows here
 * are those ranges with a margin.
 */
function p3PokesOut(l: number, h: number): boolean {
  return (h > 26 && h < 42) || (h > 190 && h < 203 && l > 0.85);
}

/** Deterministic sample of OKLCH colors that straddle every gamut. */
function sampleColors(count: number, maxChroma = 0.5): Color[] {
  let seed = 0x2020;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  return Array.from({ length: count }, () =>
    oklch(0.02 + next() * 0.96, next() * maxChroma, next() * 360),
  );
}

// ─── Matrices ────────────────────────────────────────────────────────

describe('Rec. 2020 matrices', () => {
  // CSS Color 4 sample code, conversions.js.
  const CSS_LIN_2020_TO_XYZ: Matrix3 = [
    [63426534 / 99577255, 20160776 / 139408157, 47086771 / 278816314],
    [26158966 / 99577255, 472592308 / 697040785, 8267143 / 139408157],
    [0 / 1, 19567812 / 697040785, 295819943 / 278816314],
  ];
  const CSS_XYZ_TO_LIN_2020: Matrix3 = [
    [30757411 / 17917100, -6372589 / 17917100, -4539589 / 17917100],
    [-19765991 / 29648200, 47925759 / 29648200, 467509 / 29648200],
    [792561 / 44930125, -1921689 / 44930125, 42328811 / 44930125],
  ];

  function expectMatrix(actual: Matrix3, expected: Matrix3, tol: number) {
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        expect(
          Math.abs(actual[row][column] - expected[row][column]),
        ).toBeLessThanOrEqual(tol);
      }
    }
  }

  it('match the CSS Color 4 rational matrices to float64 precision', () => {
    expectMatrix(LINEAR_REC2020_TO_XYZ_D65, CSS_LIN_2020_TO_XYZ, 1e-15);
    expectMatrix(XYZ_D65_TO_LINEAR_REC2020, CSS_XYZ_TO_LIN_2020, 1e-15);
  });

  it('place the primaries and white at the BT.2020 chromaticities', () => {
    // ITU-R BT.2020-2 Table 3.
    const expected: Array<[number, number]> = [
      [0.708, 0.292],
      [0.17, 0.797],
      [0.131, 0.046],
    ];
    const column = (index: number): Vec3 => [
      LINEAR_REC2020_TO_XYZ_D65[0][index],
      LINEAR_REC2020_TO_XYZ_D65[1][index],
      LINEAR_REC2020_TO_XYZ_D65[2][index],
    ];
    expected.forEach(([x, y], index) => {
      const [X, Y, Z] = column(index);
      expect(X / (X + Y + Z)).toBeCloseTo(x, 12);
      expect(Y / (X + Y + Z)).toBeCloseTo(y, 12);
    });
    // White (1, 1, 1) is D65: x = 0.3127, y = 0.3290, Y = 1.
    const [X, Y, Z] = apply(LINEAR_REC2020_TO_XYZ_D65, [1, 1, 1]);
    expect(Y).toBeCloseTo(1, 14);
    expect(X / (X + Y + Z)).toBeCloseTo(0.3127, 12);
    expect(Y / (X + Y + Z)).toBeCloseTo(0.329, 12);
  });

  it('carry the BT.2020 luma coefficients in the Y row', () => {
    // ITU-R BT.2020-2 Table 4: Y' = 0.2627 R' + 0.6780 G' + 0.0593 B'.
    const [r, g, b] = LINEAR_REC2020_TO_XYZ_D65[1];
    expect(r).toBeCloseTo(0.2627, 4);
    expect(g).toBeCloseTo(0.678, 4);
    expect(b).toBeCloseTo(0.0593, 4);
  });

  it('convert linear sRGB <-> linear Rec. 2020 like colorjs.io', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: -0.5, max: 1.5, noNaN: true }),
          fc.double({ min: -0.5, max: 1.5, noNaN: true }),
          fc.double({ min: -0.5, max: 1.5, noNaN: true }),
        ),
        (rgb) => {
          const forward = apply(LINEAR_SRGB_TO_LINEAR_REC2020, rgb);
          const expected = coords(
            new ColorJs('srgb-linear', rgb),
            'rec2020-linear',
          );
          const back = apply(LINEAR_REC2020_TO_LINEAR_SRGB, rgb);
          const expectedBack = coords(
            new ColorJs('rec2020-linear', rgb),
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

  it('are inverses of each other', () => {
    for (const rgb of [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0.2, 0.5, 0.8],
    ] as Vec3[]) {
      const round = apply(
        LINEAR_REC2020_TO_LINEAR_SRGB,
        apply(LINEAR_SRGB_TO_LINEAR_REC2020, rgb),
      );
      const viaXyz = apply(
        XYZ_D65_TO_LINEAR_REC2020,
        apply(LINEAR_REC2020_TO_XYZ_D65, rgb),
      );
      for (let index = 0; index < 3; index += 1) {
        expect(round[index]).toBeCloseTo(rgb[index], 13);
        expect(viaXyz[index]).toBeCloseTo(rgb[index], 13);
      }
    }
  });

  it('keep white on the neutral axis (rows sum to 1)', () => {
    for (const matrix of [
      LINEAR_SRGB_TO_LINEAR_REC2020,
      LINEAR_REC2020_TO_LINEAR_SRGB,
      LMS_TO_LINEAR_REC2020,
    ]) {
      for (const row of matrix) {
        expect(row[0] + row[1] + row[2]).toBeCloseTo(1, 13);
      }
    }
  });

  it('map OKLab LMS to linear Rec. 2020 like colorjs.io', () => {
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
      const actual = apply(LMS_TO_LINEAR_REC2020, lms);
      const expected = coords(reference, 'rec2020-linear');
      for (let index = 0; index < 3; index += 1) {
        expect(Math.abs(actual[index] - expected[index])).toBeLessThan(
          FLOAT_TOL,
        );
      }
    }
  });
});

// ─── Reference colors ────────────────────────────────────────────────

describe('Rec. 2020 reference colors', () => {
  const corners: Array<[string, Vec3]> = [
    ['red', [1, 0, 0]],
    ['green', [0, 1, 0]],
    ['blue', [0, 0, 1]],
    ['yellow', [1, 1, 0]],
    ['cyan', [0, 1, 1]],
    ['magenta', [1, 0, 1]],
    ['white', [1, 1, 1]],
    ['black', [0, 0, 0]],
  ];

  it.each(corners)(
    'parses the %s corner to colorjs.io OKLCH and keeps it in gamut',
    (_name, rgb) => {
      const css = `color(rec2020 ${rgb.join(' ')})`;
      const color = parse(css);
      const [l, c, h] = coords(new ColorJs(css), 'oklch');
      expect(Math.abs(color.l - l)).toBeLessThan(FLOAT_TOL);
      expect(Math.abs(color.c - c)).toBeLessThan(FLOAT_TOL);
      if (c > 1e-6) {
        const delta = Math.abs(color.h - h) % 360;
        expect(Math.min(delta, 360 - delta)).toBeLessThan(1e-7);
      }
      // Float noise from the round trip through OKLab is far inside the
      // linear tolerance (about 1.3e-10).
      expect(inRec2020Gamut(color)).toBe(true);
      expect(toCss(color, 'rec2020')).toBe(css);
    },
  );

  it('matches the published OKLCH of the primaries', () => {
    // colorjs.io: new Color('color(rec2020 0 1 0)').to('oklch'), etc.
    const green = parse('color(rec2020 0 1 0)');
    expect(green.l).toBeCloseTo(0.82978, 4);
    expect(green.c).toBeCloseTo(0.46833, 4);
    expect(green.h).toBeCloseTo(152.595, 2);
    const red = parse('color(rec2020 1 0 0)');
    expect(red.l).toBeCloseTo(0.68709, 4);
    expect(red.c).toBeCloseTo(0.36475, 4);
    const blue = parse('color(rec2020 0 0 1)');
    expect(blue.l).toBeCloseTo(0.42345, 4);
    expect(blue.c).toBeCloseTo(0.38281, 4);
  });

  it.each([
    '#3b82f6',
    '#ff0000',
    '#00ff00',
    '#777777',
    'color(display-p3 0 1 0)',
    'color(display-p3 0.2 0.4 0.9)',
    'oklch(0.7 0.25 150)',
    'oklch(0.5 0.3 260)',
  ])('serializes %s as color(rec2020 ...) like colorjs.io', (input) => {
    const expected = coords(new ColorJs(input), 'rec2020');
    const match = /^color\(rec2020 (\S+) (\S+) (\S+)\)$/.exec(
      toCss(parse(input), 'rec2020'),
    );
    expect(match).not.toBeNull();
    for (let index = 0; index < 3; index += 1) {
      // 4 decimals, so half a unit in the last place plus float noise.
      expect(
        Math.abs(Number(match![index + 1]) - expected[index]),
      ).toBeLessThanOrEqual(0.00005 + 1e-9);
    }
  });

  it('clips toCss output to the gamut and appends alpha', () => {
    // color(display-p3 1 0 0) has a negative Rec. 2020 blue channel.
    const p3Red = parse('color(display-p3 1 0 0)');
    expect(toCss(p3Red, 'rec2020')).toBe('color(rec2020 0.8889 0.2766 0)');
    expect(toCss({ ...p3Red, alpha: 0.5 }, 'rec2020')).toBe(
      'color(rec2020 0.8889 0.2766 0 / 0.5)',
    );
    expect(toCss(oklch(0.9, 0.6, 150), 'rec2020')).toMatch(
      /^color\(rec2020 0 1 0(\.\d+)?\)$/,
    );
  });

  it('round-trips through its own serialization', () => {
    for (const color of sampleColors(300)) {
      if (!inRec2020Gamut(color)) continue;
      const back = parse(toCss(color, 'rec2020'));
      // 4-decimal channels: up to 5e-5 encoded per channel.
      expect(refOf(back).deltaE(refOf(color), 'OK')).toBeLessThan(0.002);
    }
  });
});

// ─── Linear bounds and membership ────────────────────────────────────

describe('Rec. 2020 membership', () => {
  it('derives its linear bounds through the Rec. 2020 transfer function', () => {
    // colorjs.io: inGamut tests encoded coords against [-eps, 1 + eps], and
    // rec2020's toBase is sign(v) * |v| ** 2.4.
    expect(REC2020_LINEAR_MIN).toBeCloseTo(-(GAMUT_EPSILON ** 2.4), 20);
    expect(REC2020_LINEAR_MAX).toBeCloseTo((1 + GAMUT_EPSILON) ** 2.4, 14);
    expect(REC2020_LINEAR_MIN).toBeLessThan(0);
    expect(REC2020_LINEAR_MIN).toBeGreaterThan(-2e-10);
  });

  it('keeps every gamut descriptor consistent with its transfer function', () => {
    // Inverse transfer functions as CSS Color 4 defines them (sRGB's, which
    // Display P3 shares, and the 2.4 power of rec2020), written out here.
    const srgbDecode = (v: number) =>
      Math.abs(v) <= 0.04045
        ? v / 12.92
        : Math.sign(v) * ((Math.abs(v) + 0.055) / 1.055) ** 2.4;
    const decoders: Record<GamutTarget, (v: number) => number> = {
      srgb: srgbDecode,
      'display-p3': srgbDecode,
      rec2020: (v) => Math.sign(v) * Math.abs(v) ** 2.4,
    };
    for (const [id, spec] of Object.entries(GAMUT_SPECS)) {
      expect(spec.id).toBe(id);
      const decode = decoders[spec.id];
      expect(spec.linearMin).toBeCloseTo(decode(-GAMUT_EPSILON), 18);
      expect(spec.linearMax).toBeCloseTo(decode(1 + GAMUT_EPSILON), 14);
      // The default search bound clears the largest cusp chroma.
      let largest = 0;
      for (let hue = 0; hue < 360; hue += 1) {
        largest = Math.max(
          largest,
          maxChromaForHue(hue, { gamut: spec.id, method: 'direct' }).c,
        );
      }
      expect(spec.maxChroma).toBeGreaterThan(largest);
      expect(spec.fromLinearSrgb === null).toBe(spec.toLinearSrgb === null);
    }
  });

  it.each([
    // Just inside and just outside the encoded tolerance, low and high.
    ['color(rec2020 -0.00007 0.5 0.5)', true],
    ['color(rec2020 -0.00008 0.5 0.5)', false],
    ['color(rec2020 0.5 1.00007 0.5)', true],
    ['color(rec2020 0.5 1.00008 0.5)', false],
    ['color(rec2020 0.5 0.5 -0.00007)', true],
    ['color(rec2020 0.5 0.5 1.00008)', false],
    // -0.003 encoded is -8.8e-7 linear: inside the sRGB linear tolerance
    // (-5.8e-6), so reusing the sRGB bounds would wrongly accept it.
    ['color(rec2020 -0.003 0.5 0.5)', false],
    ['color(rec2020 0.2 -0.003 0.9)', false],
  ] as const)('%s in gamut: %s (as colorjs.io)', (css, expected) => {
    expect(new ColorJs(css).inGamut('rec2020')).toBe(expected);
    expect(inRec2020Gamut(parse(css))).toBe(expected);
  });

  it('agrees with colorjs.io inGamut("rec2020") across OKLCH', () => {
    let inside = 0;
    let outside = 0;
    let skipped = 0;
    for (const color of sampleColors(4000, 0.55)) {
      const reference = refOf(color);
      const encoded = coords(reference, 'rec2020');
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
      const expected = reference.inGamut('rec2020');
      if (expected) inside += 1;
      else outside += 1;
      expect(inRec2020Gamut(color)).toBe(expected);
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
          const [l, c, h] = coords(new ColorJs('rec2020', rgb), 'oklch');
          expect(inRec2020Gamut(oklch(l, c, Number.isFinite(h) ? h : 0))).toBe(
            true,
          );
          // 0.001 encoded past the face is well outside the tolerance.
          const beyond: Vec3 = [...rgb];
          beyond[axis] = fixed === 0 ? -0.001 : 1.001;
          const [bl, bc, bh] = coords(new ColorJs('rec2020', beyond), 'oklch');
          expect(
            inRec2020Gamut(oklch(bl, bc, Number.isFinite(bh) ? bh : 0)),
          ).toBe(false);
        },
      ),
    );
  });

  it('accepts rec2020 where gamut targets are validated', () => {
    expect(() => assertGamutTarget('rec2020', 'test()')).not.toThrow();
    expect(() => assertGamutTarget('a98-rgb', 'test()')).toThrow(
      'test(): unknown gamut "a98-rgb"',
    );
    expect(() => assertGamutTarget('toString', 'test()')).toThrow(TypeError);
  });

  it('rejects rec2020 where only display gamuts are modelled', () => {
    expect(() => assertDisplayGamut('display-p3', 'show()')).not.toThrow();
    expect(() => assertDisplayGamut(undefined, 'show()')).not.toThrow();
    expect(() => assertDisplayGamut('rec2020', 'show()')).toThrow(
      "show(): unknown gamut \"rec2020\". 'rec2020' is a query target, not a display gamut; use 'srgb' or 'display-p3'",
    );
    expect(() => assertDisplayGamut('p3', 'show()')).toThrow(
      /'p3' is not supported; use 'display-p3'$/,
    );
    const white = parse('#fff');
    expect(() =>
      contrastRatio(white, white, { gamut: 'rec2020' as never }),
    ).toThrow(new TypeError('contrast: unknown gamut "rec2020"'));
  });
});

// ─── Gamut mapping ───────────────────────────────────────────────────

describe('toRec2020Gamut', () => {
  const samples = sampleColors(1500, 0.6);

  it('returns in-gamut colors unchanged', () => {
    for (const color of samples) {
      if (!inRec2020Gamut(color)) continue;
      expect(toRec2020Gamut(color)).toEqual(color);
      expect(toRec2020Gamut(color, { method: 'css' })).toEqual(color);
    }
  });

  it('reduces chroma at fixed lightness and hue like colorjs.io "oklch.c"', () => {
    let mapped = 0;
    for (const color of samples) {
      const reference = refOf(color);
      if (reference.inGamut('rec2020', { epsilon: 0 }) || inRec2020Gamut(color))
        continue;
      mapped += 1;
      const result = toRec2020Gamut(color);
      expect(result.l).toBe(color.l);
      expect(result.h).toBe(color.h);
      expect(result.alpha).toBe(color.alpha);
      // Strictly inside per the reference (no tolerance).
      expect(refOf(result).inGamut('rec2020', { epsilon: 0 })).toBe(true);
      const expected = coords(
        reference.clone().toGamut({
          space: 'rec2020',
          method: 'oklch.c',
          deltaEMethod: 'OK',
          jnd: 0,
        }),
        'oklch',
      );
      // color-kit's bisection bracket (1e-4), plus what colorjs.io accepts:
      // it stops within 1e-6 deltaE of the gamut and clips, which is a few
      // 1e-6 of chroma where the boundary runs at a shallow angle to the
      // chroma axis (observed 5.7e-6, for a dark blue).
      expect(Math.abs(result.c - expected[1])).toBeLessThan(1.1e-4);
      // Mapping is idempotent: the result is already in gamut.
      expect(toRec2020Gamut(result)).toEqual(result);
    }
    expect(mapped).toBeGreaterThan(200);
  });

  it('matches colorjs.io toGamut({ method: "css" })', () => {
    let mapped = 0;
    for (const color of samples) {
      const reference = refOf(color);
      if (reference.inGamut('rec2020', { epsilon: 0 }) || inRec2020Gamut(color))
        continue;
      mapped += 1;
      const expected = reference
        .clone()
        .toGamut({ space: 'rec2020', method: 'css' });
      const result = toRec2020Gamut(color, { method: 'css' });
      expect(refOf(result).inGamut('rec2020')).toBe(true);
      expect(refOf(result).deltaE(expected, 'OK')).toBeLessThan(FLOAT_TOL);
    }
    expect(mapped).toBeGreaterThan(200);
  });

  it('writes the same result allocation-free, also in place', () => {
    for (const color of samples.slice(0, 200)) {
      for (const options of [undefined, { method: 'css' as const }]) {
        const expected = toRec2020Gamut(color, options);
        const out = oklch(0, 0, 0);
        expect(toRec2020GamutInto(out, color, options)).toBe(out);
        expect(out).toEqual(expected);
        const inPlace = { ...color };
        toRec2020GamutInto(inPlace, inPlace, options);
        expect(inPlace).toEqual(expected);
      }
    }
  });

  it('snaps the lightness endpoints and ignores a map() index argument', () => {
    expect(toRec2020Gamut(oklch(0, 0.3, 40))).toEqual(oklch(0, 0, 40));
    expect(toRec2020Gamut(oklch(1, 0.3, 40))).toEqual(oklch(1, 0, 40));
    const colors = [oklch(0.7, 0.6, 150), oklch(0.5, 0.6, 30)];
    expect(colors.map(toRec2020Gamut as (color: Color) => Color)).toEqual(
      colors.map((color) => toRec2020Gamut(color)),
    );
  });

  it('survives a round trip through color(rec2020 ...)', () => {
    for (const color of samples.slice(0, 300)) {
      const mapped = toRec2020Gamut(color);
      const back = parse(toCss(mapped, 'rec2020'));
      expect(refOf(back).deltaE(refOf(mapped), 'OK')).toBeLessThan(0.002);
    }
  });
});

// ─── Nesting ─────────────────────────────────────────────────────────

describe('gamut nesting', () => {
  const unit = fc.double({ min: 0, max: 1, noNaN: true });

  it('contains every sRGB color in Display P3 and Rec. 2020', () => {
    fc.assert(
      fc.property(unit, unit, unit, (r, g, b) => {
        const color = parse(`color(srgb ${r} ${g} ${b})`);
        expect(inSrgbGamut(color)).toBe(true);
        expect(inP3Gamut(color)).toBe(true);
        expect(inRec2020Gamut(color)).toBe(true);
      }),
    );
  });

  it('contains Display P3 colors in Rec. 2020 exactly where colorjs.io does', () => {
    let outside = 0;
    let total = 0;
    fc.assert(
      fc.property(unit, unit, unit, (r, g, b) => {
        const css = `color(display-p3 ${r} ${g} ${b})`;
        const reference = new ColorJs(css);
        const encoded = coords(reference, 'rec2020');
        fc.pre(
          encoded.every(
            (value) =>
              Math.abs(value + GAMUT_EPSILON) > 1e-9 &&
              Math.abs(value - 1 - GAMUT_EPSILON) > 1e-9,
          ),
        );
        const expected = reference.inGamut('rec2020');
        total += 1;
        if (!expected) outside += 1;
        expect(inP3Gamut(parse(css))).toBe(true);
        expect(inRec2020Gamut(parse(css))).toBe(expected);
      }),
      { numRuns: 2000 },
    );
    // Rec. 2020 holds nearly all of Display P3, but not all of it.
    expect(outside / total).toBeLessThan(0.1);
  });

  it('leaves two slivers of Display P3 outside Rec. 2020', () => {
    // P3 red has a negative Rec. 2020 blue channel; P3 cyan one above 1.
    for (const css of ['color(display-p3 1 0 0)', 'color(display-p3 0 1 1)']) {
      expect(new ColorJs(css).inGamut('rec2020')).toBe(false);
      expect(inP3Gamut(parse(css))).toBe(true);
      expect(inRec2020Gamut(parse(css))).toBe(false);
    }
    const [, , blue] = coords(
      new ColorJs('color(display-p3 1 0 0)'),
      'rec2020-linear',
    );
    expect(blue).toBeCloseTo(-0.00121, 5);
    // The other P3 corners are inside.
    for (const rgb of ['0 1 0', '0 0 1', '1 1 0', '1 0 1', '1 1 1']) {
      expect(inRec2020Gamut(parse(`color(display-p3 ${rgb})`))).toBe(true);
    }
  });

  it('maps monotonically: sRGB chroma <= P3 chroma <= Rec. 2020 chroma', () => {
    for (const color of sampleColors(500, 0.6)) {
      // Away from near-black tolerance bands and the P3 red sliver.
      if (color.l < 0.15 || p3PokesOut(color.l, color.h)) continue;
      const srgb = toSrgbGamut(color).c;
      const p3 = toP3Gamut(color).c;
      const rec2020 = toRec2020Gamut(color).c;
      expect(srgb).toBeLessThanOrEqual(p3 + 1.01e-4);
      expect(p3).toBeLessThanOrEqual(rec2020 + 1.01e-4);
    }
  });
});

// ─── Max chroma, cusps, boundary paths ───────────────────────────────

describe('Rec. 2020 max chroma', () => {
  const TOL = 1e-6;
  const options = (gamut: GamutTarget) => ({ gamut, tolerance: TOL });

  it('grows monotonically from sRGB to Display P3 to Rec. 2020', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.15, max: 0.85, noNaN: true }),
        fc.double({ min: 0, max: 360, noNaN: true }),
        (l, h) => {
          const srgb = maxChromaAt(l, h, options('srgb'));
          const p3 = maxChromaAt(l, h, options('display-p3'));
          const rec2020 = maxChromaAt(l, h, options('rec2020'));
          expect(srgb).toBeLessThanOrEqual(p3 + 2 * TOL);
          expect(srgb).toBeLessThanOrEqual(rec2020 + 2 * TOL);
          // Display P3 pokes out of Rec. 2020 around its red primary.
          if (!p3PokesOut(l, h)) {
            expect(p3).toBeLessThanOrEqual(rec2020 + 2 * TOL);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('keeps sRGB inside Rec. 2020 at every hue above the near-black band', () => {
    for (let h = 0; h < 360; h += 3) {
      for (let l = 0.05; l < 1; l += 0.05) {
        expect(maxChromaAt(l, h, options('srgb'))).toBeLessThanOrEqual(
          maxChromaAt(l, h, options('rec2020')) + 2 * TOL,
        );
      }
    }
  });

  it('exceeds Display P3 by at most 0.0025 chroma in the red sliver', () => {
    let largest = 0;
    for (let h = 26; h <= 42; h += 0.5) {
      for (let l = 0.15; l < 0.9; l += 0.01) {
        largest = Math.max(
          largest,
          maxChromaAt(l, h, options('display-p3')) -
            maxChromaAt(l, h, options('rec2020')),
        );
      }
    }
    expect(largest).toBeGreaterThan(0.001);
    expect(largest).toBeLessThan(0.0025);
  });

  it('returns a chroma on the boundary: in gamut, out just above', () => {
    for (let h = 5; h < 360; h += 25) {
      for (const l of [0.2, 0.5, 0.8]) {
        const c = maxChromaAt(l, h, options('rec2020'));
        expect(inRec2020Gamut(oklch(l, c, h))).toBe(true);
        expect(inRec2020Gamut(oklch(l, c + 2 * TOL, h))).toBe(false);
        // The same boundary as colorjs.io's exact gamut, within tolerance.
        expect(refOf(oklch(l, c - 1e-4, h)).inGamut('rec2020')).toBe(true);
        expect(refOf(oklch(l, c + 1e-4, h)).inGamut('rec2020')).toBe(false);
      }
    }
  });

  it('reaches past the sRGB / P3 default search bound of 0.4', () => {
    // The green primary: colorjs.io gives oklch(0.8298 0.4683 152.6).
    const green = parse('color(rec2020 0 1 0)');
    const c = maxChromaAt(green.l, green.h, { gamut: 'rec2020' });
    expect(c).toBeGreaterThan(0.4);
    expect(green.c - c).toBeGreaterThanOrEqual(0);
    expect(green.c - c).toBeLessThan(2e-4);
    // An explicit maxChroma still caps the result.
    expect(
      maxChromaAt(green.l, green.h, { gamut: 'rec2020', maxChroma: 0.3 }),
    ).toBe(0.3);
  });

  it('solves the hue cusp analytically, matching a lightness scan', () => {
    for (let h = 0; h < 360; h += 7.5) {
      const direct = maxChromaForHue(h, { gamut: 'rec2020', method: 'direct' });
      let best = 0;
      let bestL = 0;
      for (let index = 1; index < 1000; index += 1) {
        const l = index / 1000;
        const c = maxChromaAt(l, h, options('rec2020'));
        if (c > best) {
          best = c;
          bestL = l;
        }
      }
      // The scan steps lightness by 0.001; chroma changes by at most about
      // 1.6x that along the boundary.
      expect(Math.abs(direct.c - best)).toBeLessThan(0.002);
      expect(Math.abs(direct.l - bestL)).toBeLessThan(0.002);
      expect(inRec2020Gamut(oklch(direct.l, direct.c, h))).toBe(true);

      const lut = maxChromaForHue(h, { gamut: 'rec2020' });
      expect(Math.abs(lut.c - direct.c)).toBeLessThan(1e-3);
      expect(inRec2020Gamut(oklch(lut.l, lut.c, h))).toBe(true);
    }
  });

  it('puts the Rec. 2020 primaries and secondaries on the boundary', () => {
    // Blue is left out: the black-to-blue edge has a constant OKLCH hue, so
    // at exactly that hue it lies in the slice as a line with no area, past
    // where the constant-lightness ray leaves the gamut (chroma 0.331, where
    // red goes negative). The boundary and the cusp describe the slice's
    // area. sRGB blue does the same at h264.
    for (const rgb of ['1 0 0', '0 1 0', '1 1 0', '0 1 1', '1 0 1']) {
      const [l, c, h] = coords(new ColorJs(`color(rec2020 ${rgb})`), 'oklch');
      // The cusp of a corner's hue is at least as saturated as the corner.
      const cusp = maxChromaForHue(h, { gamut: 'rec2020', method: 'direct' });
      expect(cusp.c).toBeGreaterThanOrEqual(c - 1e-6);
      const boundary = maxChromaAt(l, h, { gamut: 'rec2020', tolerance: 1e-9 });
      expect(boundary).toBeCloseTo(c, 6);
    }
    const [l, c, h] = coords(new ColorJs('color(rec2020 0 1 0)'), 'oklch');
    const green = maxChromaForHue(h, { gamut: 'rec2020', method: 'direct' });
    expect(green.l).toBeCloseTo(l, 6);
    expect(green.c).toBeCloseTo(c, 6);
  });

  it('orders the cusp chroma across gamuts outside the P3 red sliver', () => {
    for (let h = 0; h < 360; h += 2) {
      const cusp = (gamut: GamutTarget) =>
        maxChromaForHue(h, { gamut, method: 'direct' }).c;
      expect(cusp('srgb')).toBeLessThanOrEqual(cusp('display-p3') + 1e-9);
      if (!p3PokesOut(0.5, h)) {
        expect(cusp('display-p3')).toBeLessThanOrEqual(cusp('rec2020') + 1e-9);
      }
    }
  });

  it('traces boundary paths and chroma bands inside the gamut', () => {
    for (const samplingMode of ['uniform', 'adaptive'] as const) {
      const path = gamutBoundaryPath(150, { gamut: 'rec2020', samplingMode });
      expect(path[0]).toEqual({ l: 0, c: 0 });
      expect(path[path.length - 1]).toEqual({ l: 1, c: 0 });
      expect(Math.max(...path.map((point) => point.c))).toBeGreaterThan(0.4);
      for (const point of path) {
        expect(point.c).toBe(
          maxChromaAt(point.l, 150, { gamut: 'rec2020' }) || 0,
        );
        expect(inRec2020Gamut(oklch(point.l, point.c, 150))).toBe(true);
      }
      const band = chromaBand(150, 0.3, { gamut: 'rec2020', samplingMode });
      expect(band.some((color) => color.c === 0.3)).toBe(true);
      for (const color of band) {
        expect(color.c).toBeLessThanOrEqual(0.3);
        expect(inRec2020Gamut(color)).toBe(true);
      }
    }
  });
});

// ─── Plane queries ───────────────────────────────────────────────────

describe('Rec. 2020 plane queries', () => {
  const lcPlane = (hue: number) =>
    definePlane({
      model: 'oklch',
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, 0.5] },
      fixed: { h: hue },
    });

  it.each([90, 150, 230, 250, 320])(
    'draws a Rec. 2020 boundary that encloses the Display P3 one at h%i',
    (hue) => {
      const plane = sense(lcPlane(hue));
      const query = { hue, steps: 100, samplingMode: 'uniform' } as const;
      const p3 = plane.gamutBoundary({ ...query, gamut: 'display-p3' });
      const rec2020 = plane.gamutBoundary({ ...query, gamut: 'rec2020' });
      expect(rec2020.gamut).toBe('rec2020');
      expect(rec2020.points).toHaveLength(p3.points.length);
      let wider = 0;
      rec2020.points.forEach((point, index) => {
        const inner = p3.points[index];
        expect(point.l).toBe(inner.l);
        // Below l = 0.15 the wider sRGB / P3 tolerance band dominates.
        if (point.l < 0.15) return;
        expect(point.c).toBeGreaterThanOrEqual(inner.c - 1e-4);
        // Plane y is chroma / 0.5.
        expect(point.y).toBeGreaterThanOrEqual(inner.y - 1e-3);
        if (point.c > inner.c + 0.01) wider += 1;
      });
      expect(wider).toBeGreaterThan(5);

      // The P3 region is a subset of the Rec. 2020 region.
      const p3Region = plane.gamutRegion({ gamut: 'display-p3' });
      const recRegion = plane.gamutRegion({ gamut: 'rec2020' });
      expect(recRegion.solver).toBe('analytic-lc');
      for (let x = 0.16; x < 1; x += 0.04) {
        for (let y = 0.02; y < 1; y += 0.04) {
          if (containsPoint(p3Region.visibleRegion, { x, y })) {
            expect(containsPoint(recRegion.visibleRegion, { x, y })).toBe(true);
          }
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
      'oklch l/h',
      definePlane({
        model: 'oklch',
        x: { channel: 'l' },
        y: { channel: 'h' },
        fixed: { c: 0.3 },
      }),
      'implicit-contour',
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
    ['hsl', definePlane({ model: 'hsl' }), 'domain-edge'],
    ['hsv', definePlane({ model: 'hsv' }), 'domain-edge'],
    ['hct', definePlane({ model: 'hct' }), 'implicit-contour'],
    [
      // Display P3 is not inside Rec. 2020 (see the nesting tests), so this
      // plane needs the contour solver rather than its domain edge.
      'display-p3 r/g at b = 0',
      definePlane({ model: 'display-p3', fixed: { b: 0 } }),
      'implicit-contour',
    ],
  ] as const;

  it.each(regionPlanes)(
    'fills the Rec. 2020 region of a %s plane like inRec2020Gamut',
    (_label, plane, solver) => {
      for (const scope of ['viewport', 'full'] as const) {
        const region = sense(plane).gamutRegion({ gamut: 'rec2020', scope });
        expect(region.gamut).toBe('rec2020');
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
            const expected = inRec2020Gamut(planeToColor(plane, point));
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

  it('finds the sliver of a Display P3 plane that is outside Rec. 2020', () => {
    const plane = definePlane({ model: 'display-p3', fixed: { b: 0 } });
    const region = sense(plane).gamutRegion({ gamut: 'rec2020' });
    expect(region.viewportRelation).toBe('intersects');
    // Default axes: x is red and y is green, both 0 to 1.
    const red = { x: 0.99, y: 0.01 };
    expect(inRec2020Gamut(planeToColor(plane, red))).toBe(false);
    expect(containsPoint(region.visibleRegion, red)).toBe(false);
    expect(containsPoint(region.visibleRegion, { x: 0.5, y: 0.5 })).toBe(true);
    // The same plane is entirely inside its own gamut.
    expect(sense(plane).gamutRegion({ gamut: 'display-p3' }).solver).toBe(
      'domain-edge',
    );
  });

  it('maps a fallback point with toRec2020Gamut', () => {
    const color = oklch(0.7, 0.6, 150);
    const result = sense(lcPlane(150)).fallbackPoint({
      gamut: 'rec2020',
      color,
    });
    expect(result.gamut).toBe('rec2020');
    expect(result.point.color).toEqual(toRec2020Gamut(color));
    expect(result.point.x).toBeCloseTo(0.7, 12);
    expect(result.point.y).toBeCloseTo(result.point.color.c / 0.5, 12);
  });

  it('projects a chroma band clamped to the Rec. 2020 edge', () => {
    const band = sense(lcPlane(150)).chromaBand({
      gamut: 'rec2020',
      requestedChroma: 0.35,
    });
    expect(Math.max(...band.points.map((point) => point.c))).toBe(0.35);
    for (const point of band.points) {
      expect(inRec2020Gamut(oklch(point.l, point.c, 150))).toBe(true);
    }
    const p3 = sense(lcPlane(150)).chromaBand({
      gamut: 'display-p3',
      requestedChroma: 0.35,
    });
    expect(Math.max(...p3.points.map((point) => point.c))).toBeLessThan(0.35);
  });

  it('survives the packed query ABI', () => {
    const plane = lcPlane(150);
    const queries = [
      { kind: 'gamutBoundary', gamut: 'rec2020' },
      { kind: 'gamutRegion', gamut: 'rec2020' },
      {
        kind: 'fallbackPoint',
        gamut: 'rec2020',
        color: oklch(0.7, 0.6, 150),
      },
    ] as const;
    const results = runPlaneQueries(plane, [...queries]);
    expect(results.map((result) => result.kind)).toEqual(
      queries.map((query) => query.kind),
    );
    for (const result of results) {
      expect((result as { gamut: GamutTarget }).gamut).toBe('rec2020');
    }
  });
});

// ─── Contrast regions ────────────────────────────────────────────────

describe('Rec. 2020 contrast regions', () => {
  /**
   * WCAG relative luminance of a color shown on a Rec. 2020 display, from
   * colorjs.io: clip the linear Rec. 2020 channels, convert to linear sRGB
   * and weight with the WCAG coefficients.
   */
  function referenceLuminance(color: Color): number {
    const clipped = coords(refOf(color), 'rec2020-linear').map((value) =>
      Math.min(1, Math.max(0, value)),
    ) as Vec3;
    const [r, g, b] = coords(
      new ColorJs('rec2020-linear', clipped),
      'srgb-linear',
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function referenceRatio(a: Color, b: Color): number {
    const ya = referenceLuminance(a);
    const yb = referenceLuminance(b);
    return (Math.max(ya, yb) + 0.05) / (Math.min(ya, yb) + 0.05);
  }

  it.each([
    ['#ffffff', 150],
    ['#000000', 150],
    ['#ffffff', 30],
    ['#000000', 264],
    ['color(rec2020 0 1 0)', 320],
  ] as const)('traces WCAG AA against %s at h%i', (referenceCss, hue) => {
    const reference = parse(referenceCss);
    const paths = contrastRegionPaths(reference, hue, {
      level: 'AA',
      gamut: 'rec2020',
    });
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      for (const point of path) {
        const color = oklch(point.l, point.c, hue);
        expect(inRec2020Gamut(color)).toBe(true);
        const ratio = referenceRatio(color, reference);
        // On the threshold, on its passing side, by independent arithmetic.
        expect(ratio).toBeGreaterThan(4.5 - 1e-6);
        expect(ratio).toBeLessThan(4.5 + 1e-6);
      }
    }
    // Some of the contour lies beyond the Display P3 gamut.
    if (hue === 150) {
      expect(
        paths.flat().some((point) => !inP3Gamut(oklch(point.l, point.c, hue))),
      ).toBe(true);
    }
  });

  it('separates passing from failing colors on a brute-force grid', () => {
    const hue = 150;
    const reference = parse('#ffffff');
    const [path] = contrastRegionPaths(reference, hue, {
      level: 'AA',
      gamut: 'rec2020',
    });
    // The contour is a graph over chroma for this query: at each chroma the
    // passing colors are the ones darker than the contour.
    const contourLightness = (c: number): number | null => {
      for (let index = 1; index < path.length; index += 1) {
        const a = path[index - 1];
        const b = path[index];
        if ((a.c - c) * (b.c - c) <= 0 && a.c !== b.c) {
          return a.l + ((c - a.c) / (b.c - a.c)) * (b.l - a.l);
        }
      }
      return null;
    };
    let checked = 0;
    for (let c = 0.005; c < 0.45; c += 0.01) {
      const edge = contourLightness(c);
      if (edge == null) continue;
      for (let l = 0.02; l < 1; l += 0.02) {
        if (Math.abs(l - edge) < 0.004) continue;
        const color = oklch(l, c, hue);
        if (!refOf(color).inGamut('rec2020')) continue;
        checked += 1;
        expect(referenceRatio(color, reference) >= 4.5).toBe(l < edge);
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('agrees with the display-gamut metric where no clipping applies', () => {
    // A gray reference and in-sRGB samples are displayed identically in
    // every gamut, so contrastRatio (sRGB) is a second reference there.
    const reference = parse('#767676');
    for (const metric of ['wcag', 'apca'] as const) {
      const options = { metric, threshold: metric === 'wcag' ? 3 : 0.45 };
      const rec2020 = contrastRegionPaths(reference, 150, {
        ...options,
        gamut: 'rec2020',
      });
      const srgb = contrastRegionPaths(reference, 150, {
        ...options,
        gamut: 'srgb',
      });
      expect(rec2020).toHaveLength(srgb.length);
      const axisEnds = (paths: typeof srgb) =>
        paths
          .flat()
          .filter((point) => point.c === 0)
          .map((point) => point.l)
          .sort();
      const expected = axisEnds(srgb);
      const actual = axisEnds(rec2020);
      expect(actual).toHaveLength(expected.length);
      actual.forEach((l, index) => expect(l).toBeCloseTo(expected[index], 9));
      // And the Rec. 2020 region reaches further out in chroma.
      const reach = (paths: typeof srgb) =>
        Math.max(...paths.flat().map((point) => point.c));
      expect(reach(rec2020)).toBeGreaterThan(reach(srgb));
    }
  });

  it('runs the plane contrast queries with a Rec. 2020 gamut', () => {
    const plane = sense(
      definePlane({
        model: 'oklch',
        x: { channel: 'l' },
        y: { channel: 'c', range: [0, 0.5] },
        fixed: { h: 150 },
      }),
    );
    const reference = parse('#ffffff');
    const region = plane.contrastRegion({ gamut: 'rec2020', reference });
    const boundary = plane.contrastBoundary({ gamut: 'rec2020', reference });
    expect(region.paths.length).toBeGreaterThan(0);
    expect(boundary.points.length).toBeGreaterThan(10);
    for (const point of boundary.points) {
      expect(inRec2020Gamut(oklch(point.l, point.c, 150))).toBe(true);
      expect(point.x).toBeCloseTo(point.l, 12);
      expect(point.y).toBeCloseTo(point.c / 0.5, 12);
    }
  });

  describe('contrastPoint', () => {
    const definition = definePlane({
      model: 'oklch',
      x: { channel: 'l' },
      y: { channel: 'c', range: [0, 0.5] },
      fixed: { h: 150 },
    });
    const plane = sense(definition);
    const white = parse('#ffffff');

    it('finds the nearest passing Rec. 2020 point, by independent arithmetic', () => {
      for (const start of [
        oklch(0.8, 0.3, 150),
        oklch(0.9, 0.05, 150),
        oklch(0.75, 0.42, 150),
      ]) {
        const result = plane.contrastPoint({
          color: start,
          reference: white,
          gamut: 'rec2020',
        });
        expect(result.status).toBe('adjusted');
        const { x, y, color } = result.point!;
        expect(inRec2020Gamut(color)).toBe(true);
        // On the threshold: it passes, and the reported contrast is the
        // Rec. 2020 display contrast colorjs.io arithmetic gives.
        const ratio = referenceRatio(color, white);
        expect(ratio).toBeGreaterThan(4.5 - 1e-6);
        expect(result.contrast!).toBeCloseTo(ratio, 6);
        expect(result.contrast!).toBeGreaterThanOrEqual(4.5);
        // A step back toward the start fails the contrast check or leaves
        // the gamut.
        const from = { x: start.l, y: start.c / 0.5 };
        const back = 1e-4 / result.distance!;
        const nearer = planeToColor(definition, {
          x: x + (from.x - x) * back,
          y: y + (from.y - y) * back,
        });
        expect(
          referenceRatio(nearer, white) >= 4.5 &&
            refOf(nearer).inGamut('rec2020'),
        ).toBe(false);
        // No sampled passing point of the plane is nearer.
        for (let row = 0; row <= 50; row += 1) {
          for (let column = 0; column <= 50; column += 1) {
            const point = { x: column / 50, y: row / 50 };
            const candidate = planeToColor(definition, point);
            if (
              refOf(candidate).inGamut('rec2020') &&
              referenceRatio(candidate, white) >= 4.5 + 1e-6
            ) {
              expect(
                Math.hypot(point.x - from.x, point.y - from.y),
              ).toBeGreaterThan(result.distance! - 1e-6);
            }
          }
        }
      }
    });

    it('accepts a start that only Rec. 2020 can show', () => {
      // Passes AA on white, inside Rec. 2020, outside Display P3.
      const start = oklch(0.5, 0.2, 150);
      expect(inRec2020Gamut(start)).toBe(true);
      expect(inP3Gamut(start)).toBe(false);
      expect(referenceRatio(start, white)).toBeGreaterThan(4.5);
      const query = { color: start, reference: white } as const;
      const rec2020 = plane.contrastPoint({ ...query, gamut: 'rec2020' });
      expect(rec2020.status).toBe('satisfied');
      expect(rec2020.distance).toBe(0);
      expect(rec2020.contrast!).toBeCloseTo(referenceRatio(start, white), 6);
      const p3 = plane.contrastPoint({ ...query, gamut: 'display-p3' });
      expect(p3.status).toBe('adjusted');
      expect(inP3Gamut(p3.point!.color)).toBe(true);
    });

    it('lands on the Rec. 2020 contrast region boundary', () => {
      const start = oklch(0.8, 0.3, 150);
      const result = plane.contrastPoint({
        color: start,
        reference: white,
        gamut: 'rec2020',
      });
      const boundary = plane.contrastBoundary({
        gamut: 'rec2020',
        reference: white,
      });
      const nearest = Math.min(
        ...boundary.points.map((point) =>
          Math.hypot(point.x - result.point!.x, point.y - result.point!.y),
        ),
      );
      // Boundary vertices are sampled; the point lies on the curve between.
      expect(nearest).toBeLessThan(0.02);
    });

    it('measures APCA in Rec. 2020 and survives the packed ABI', () => {
      const query = {
        kind: 'contrastPoint',
        color: oklch(0.8, 0.3, 150),
        reference: white,
        gamut: 'rec2020',
        metric: 'apca',
        threshold: 0.6,
      } as const;
      const [result] = runPlaneQueries(definition, [query]);
      expect(result.kind).toBe('contrastPoint');
      if (result.kind !== 'contrastPoint') return;
      expect(result.status).toBe('adjusted');
      expect(inRec2020Gamut(result.point!.color)).toBe(true);
      expect(Math.abs(result.contrast!)).toBeGreaterThanOrEqual(0.6);
      expect(Math.abs(result.contrast!)).toBeLessThan(0.6 + 1e-6);
      expect(() =>
        plane.contrastPoint({
          color: white,
          reference: white,
          gamut: 'a98-rgb' as never,
        }),
      ).toThrow('contrastPoint(): unknown gamut "a98-rgb"');
    });
  });

  it('keeps ensureContrast to display gamuts, like the scalar metrics', () => {
    const blue = parse('#3b82f6');
    const white = parse('#ffffff');
    for (const run of [ensureContrast, tryEnsureContrast]) {
      expect(() => run(blue, white, { gamut: 'rec2020' as never })).toThrow(
        new TypeError('ensureContrast(): unknown gamut "rec2020"'),
      );
    }
    expect(
      inP3Gamut(ensureContrast(blue, white, { gamut: 'display-p3' })),
    ).toBe(true);
  });
});
