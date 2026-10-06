/**
 * Achromatic (powerless) hue handling and the shared sRGB transfer pair.
 *
 * Every interpolation path (`mix`, `interpolate`, `generateScale`, with and
 * without options) and OKLab -> OKLCH conversion share one threshold,
 * `ACHROMATIC_CHROMA_THRESHOLD`. Gray endpoints are checked against
 * colorjs.io, and the general invariants are property tested with
 * fast-check.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import ColorJs from 'colorjs.io';
import {
  ACHROMATIC_CHROMA_THRESHOLD,
  fromRgb,
  generateScale,
  interpolate,
  isAchromatic,
  mix,
  mixInto,
  parse,
  toOklab,
} from '../src/index.js';
import type { Color, InterpolationSpace } from '../src/index.js';
import {
  linearToSrgbChannel,
  srgbToLinearChannel,
} from '../src/utils/index.js';

const SPACES: InterpolationSpace[] = [
  'oklch',
  'oklab',
  'srgb',
  'linear-srgb',
  'display-p3',
  'linear-p3',
];

/** colorjs.io ids for color-kit interpolation spaces. */
const COLORJS_SPACE: Record<InterpolationSpace, string> = {
  oklch: 'oklch',
  oklab: 'oklab',
  srgb: 'srgb',
  'linear-srgb': 'srgb-linear',
  'display-p3': 'p3',
  'linear-p3': 'p3-linear',
};

function hueDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

function oklabOf(color: Color): [number, number, number] {
  const lab = toOklab(color);
  return [lab.L, lab.a, lab.b];
}

/** colorjs.io OKLab coordinates and (possibly `none`) OKLCH hue. */
function reference(color: ColorJs): {
  lab: [number, number, number];
  h: number;
} {
  const [L, a, b] = color.to('oklab').coords;
  const h = color.to('oklch').coords[2];
  return {
    lab: [L ?? 0, a ?? 0, b ?? 0],
    h: h === null || h === undefined ? Number.NaN : h,
  };
}

// ─── Gray endpoints vs colorjs.io ───────────────────────────────────

const GRAYS = ['#ffffff', '#000000', '#808080', '#3a3a3a'];
const CHROMATIC = ['#0000ff', '#ff0000', '#00ff00', '#3b82f6', '#f59e0b'];

describe('gray endpoints match colorjs.io', () => {
  it('option-less mix(white, blue) keeps the blue hue (issue regression)', () => {
    const white = parse('#ffffff');
    const blue = parse('#0000ff');
    const mixed = mix(white, blue, 0.5);
    const expected = reference(
      new ColorJs('#ffffff').mix('#0000ff', 0.5, { space: 'oklch' }),
    );
    expect(mixed.h).toBeCloseTo(expected.h, 9);
    expect(mixed.h).toBeCloseTo(264.052, 3);
    expect(mixed).toEqual(interpolate(white, blue, 0.5));
  });

  it('mix / interpolate / generateScale agree in every space, with and without options', () => {
    const ts = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    for (const gray of GRAYS) {
      for (const other of [...CHROMATIC, ...GRAYS]) {
        for (const [a, b] of [
          [gray, other],
          [other, gray],
        ]) {
          const ca = parse(a);
          const cb = parse(b);
          const variants: (InterpolationSpace | undefined)[] = [
            undefined,
            ...SPACES,
          ];
          for (const space of variants) {
            const options = space ? { space } : undefined;
            const scale = generateScale(ca, cb, ts.length, {
              ...options,
            });
            // generateScale samples i / (steps - 1); compare on that grid.
            const grid = ts.map((_, i) => i / (ts.length - 1));
            grid.forEach((t, i) => {
              const fromMix = mix(ca, cb, t, options);
              expect(interpolate(ca, cb, t, options)).toEqual(fromMix);
              expect(scale[i]).toEqual(fromMix);
            });

            const refSpace = COLORJS_SPACE[space ?? 'oklch'];
            for (const t of ts) {
              const kit = mix(ca, cb, t, options);
              const ref = reference(
                new ColorJs(a).mix(b, t, { space: refSpace }),
              );
              const lab = oklabOf(kit);
              for (let i = 0; i < 3; i += 1) {
                expect(
                  Math.abs(lab[i] - ref.lab[i]),
                  `${a} -> ${b} in ${refSpace} at ${t}, OKLab[${i}]`,
                ).toBeLessThan(1e-9);
              }
              // An achromatic result's hue is invisible (an exact gray
              // endpoint keeps its own hue 0, the option-less path reports
              // the borrowed one), so only the OKLab match above matters.
              if (!isAchromatic(kit.c)) {
                expect(
                  ref.h,
                  `${a} -> ${b} in ${refSpace} at ${t}: reference hue`,
                ).not.toBeNaN();
                expect(
                  hueDelta(kit.h, ref.h),
                  `${a} -> ${b} in ${refSpace} at ${t}, hue`,
                ).toBeLessThan(1e-6);
              }
            }
          }
        }
      }
    }
  });

  it('a gray endpoint does not rotate the hue in OKLCH', () => {
    for (const gray of GRAYS) {
      for (const hex of CHROMATIC) {
        const color = parse(hex);
        for (const t of [0.25, 0.5, 0.75]) {
          expect(mix(parse(gray), color, t).h).toBeCloseTo(color.h, 9);
          expect(mix(color, parse(gray), t).h).toBeCloseTo(color.h, 9);
        }
      }
    }
  });
});

// ─── Threshold and conversion ───────────────────────────────────────

describe('achromatic threshold', () => {
  it('is the CSS Color 4 OKLCH epsilon', () => {
    expect(ACHROMATIC_CHROMA_THRESHOLD).toBe(0.000004);
    expect(isAchromatic(0)).toBe(true);
    expect(isAchromatic(ACHROMATIC_CHROMA_THRESHOLD)).toBe(true);
    expect(isAchromatic(0.00001)).toBe(false);
    expect(isAchromatic(Number.NaN)).toBe(true);
  });

  it('separates every 8-bit gray from every near-gray 8-bit color', () => {
    for (let v = 0; v <= 255; v += 1) {
      const gray = fromRgb({ r: v, g: v, b: v, alpha: 1 });
      expect(isAchromatic(gray.c)).toBe(true);
      // OKLab -> OKLCH reports the canonical achromatic hue.
      expect(gray.h).toBe(0);
      if (v < 255) {
        const nearGray = fromRgb({ r: v, g: v, b: v + 1, alpha: 1 });
        expect(isAchromatic(nearGray.c)).toBe(false);
      }
    }
  });

  it('treats explicit zero-chroma OKLCH input as powerless in every path', () => {
    const gray: Color = { l: 0.5, c: 0, h: 123, alpha: 1 };
    const blue = parse('#0000ff');
    const expected = mix(gray, blue, 0.5, { space: 'oklch' }).h;
    expect(mix(gray, blue, 0.5).h).toBe(expected);
    expect(interpolate(gray, blue, 0.5).h).toBe(expected);
    expect(expected).toBeCloseTo(blue.h, 12);
  });
});

// ─── Transfer function ──────────────────────────────────────────────

describe('shared sRGB transfer pair', () => {
  it('is odd and invertible over the extended range', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -4, max: 4, noNaN: true, noDefaultInfinity: true }),
        (x) => {
          expect(linearToSrgbChannel(-x)).toBe(-linearToSrgbChannel(x));
          expect(srgbToLinearChannel(-x)).toBe(-srgbToLinearChannel(x));
          expect(srgbToLinearChannel(linearToSrgbChannel(x))).toBeCloseTo(
            x,
            12,
          );
        },
      ),
    );
  });

  it('matches colorjs.io srgb <-> srgb-linear', () => {
    for (const x of [-1.5, -0.5, -0.002, 0, 0.002, 0.04, 0.3, 0.9, 1, 1.4]) {
      const encoded = new ColorJs('srgb-linear', [x, 0, 0]).to('srgb')
        .coords[0];
      expect(linearToSrgbChannel(x)).toBeCloseTo(encoded ?? 0, 14);
      const decoded = new ColorJs('srgb', [x, 0, 0]).to('srgb-linear')
        .coords[0];
      expect(srgbToLinearChannel(x)).toBeCloseTo(decoded ?? 0, 14);
    }
  });
});

// ─── Properties ─────────────────────────────────────────────────────

/** Chroma biased toward zero and the threshold, plus ordinary values. */
const chroma = fc.oneof(
  fc.constantFrom(0, 1e-9, 3e-6, ACHROMATIC_CHROMA_THRESHOLD, 5e-6, 1e-4),
  fc.double({ min: 0, max: 0.4, noNaN: true }),
);

const unit = fc.double({ min: 0, max: 1, noNaN: true });

function colorArb(hue: fc.Arbitrary<number>): fc.Arbitrary<Color> {
  return fc.record({ l: unit, c: chroma, h: hue, alpha: unit });
}

/** Any finite hue, including negative and wrapped values. */
const wildColor = colorArb(
  fc.double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true }),
);
/** Hue already normalized to [0, 360). */
const normalColor = colorArb(
  fc.double({ min: 0, max: 360, maxExcluded: true, noNaN: true }),
);

const spaceArb = fc.constantFrom<InterpolationSpace | undefined>(
  undefined,
  ...SPACES,
);

function expectEndpoint(actual: Color, expected: Color): void {
  expect(actual.l).toBeCloseTo(expected.l, 12);
  expect(actual.c).toBeCloseTo(expected.c, 12);
  expect(actual.alpha).toBeCloseTo(expected.alpha, 12);
  if (!isAchromatic(expected.c)) {
    expect(hueDelta(actual.h, expected.h)).toBeLessThan(1e-9);
  }
}

describe('interpolation properties', () => {
  it('option-less results keep hue in [0, 360) for any finite input hue', () => {
    fc.assert(
      fc.property(wildColor, wildColor, unit, (a, b, t) => {
        for (const color of [mix(a, b, t), interpolate(a, b, t)]) {
          expect(color.h).toBeGreaterThanOrEqual(0);
          expect(color.h).toBeLessThan(360);
        }
      }),
    );
  });

  it('every space keeps hue in [0, 360) for normalized inputs', () => {
    fc.assert(
      fc.property(normalColor, normalColor, unit, spaceArb, (a, b, t, s) => {
        const color = mix(a, b, t, s ? { space: s } : undefined);
        expect(color.h).toBeGreaterThanOrEqual(0);
        expect(color.h).toBeLessThan(360);
      }),
    );
  });

  it('mix(a, b, 0) ≈ a and mix(a, b, 1) ≈ b', () => {
    fc.assert(
      fc.property(wildColor, wildColor, (a, b) => {
        expectEndpoint(mix(a, b, 0), a);
        expectEndpoint(mix(a, b, 1), b);
      }),
    );
  });

  it('option-less mix, mixInto, interpolate and generateScale agree', () => {
    fc.assert(
      fc.property(
        wildColor,
        wildColor,
        fc.integer({ min: 2, max: 9 }),
        (a, b, steps) => {
          const scale = generateScale(a, b, steps);
          for (let i = 0; i < steps; i += 1) {
            const t = i / (steps - 1);
            const mixed = mix(a, b, t);
            expect(interpolate(a, b, t)).toEqual(mixed);
            expect(mixInto({ l: 0, c: 0, h: 0, alpha: 1 }, a, b, t)).toEqual(
              mixed,
            );
            expect(scale[i]).toEqual(mixed);
          }
        },
      ),
    );
  });

  it('option-less mix matches { space: "oklch" } between the endpoints', () => {
    fc.assert(
      fc.property(
        normalColor,
        normalColor,
        fc.double({
          min: 0,
          max: 1,
          minExcluded: true,
          maxExcluded: true,
          noNaN: true,
        }),
        (a, b, t) => {
          const legacy = mix(a, b, t);
          const css = mix(a, b, t, { space: 'oklch' });
          expect(legacy.l).toBeCloseTo(css.l, 12);
          expect(legacy.c).toBeCloseTo(css.c, 12);
          expect(legacy.alpha).toBeCloseTo(css.alpha, 12);
          expect(hueDelta(legacy.h, css.h)).toBeLessThan(1e-9);
        },
      ),
    );
  });
});
