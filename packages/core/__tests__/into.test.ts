import { describe, expect, it } from 'vitest';
import {
  fromLinearSrgbInto,
  fromOklab,
  fromOklabInto,
  fromP3,
  fromP3Into,
  fromRgb,
  fromRgbInto,
  interpolate,
  interpolateInto,
  linearP3ToLinearSrgb,
  linearP3ToLinearSrgbInto,
  linearP3ToP3,
  linearP3ToP3Into,
  linearRgbToOklab,
  linearRgbToOklabInto,
  linearSrgbToLinearP3,
  linearSrgbToLinearP3Into,
  linearToSrgb,
  linearToSrgbInto,
  mix,
  mixInto,
  oklabToLinearRgb,
  oklabToLinearRgbInto,
  oklabToOklch,
  oklabToOklchInto,
  oklchToOklab,
  oklchToOklabInto,
  p3ToLinearP3,
  p3ToLinearP3Into,
  srgbToLinear,
  srgbToLinearInto,
  toLinearSrgbInto,
  toOklab,
  toOklabInto,
  toP3,
  toP3Gamut,
  toP3GamutInto,
  toP3Into,
  toRgb,
  toRgbInto,
  toSrgbGamut,
  toSrgbGamutInto,
} from '../src/index.js';
import type {
  Color,
  InterpolationOptions,
  LinearRgb,
  Oklab,
  P3,
  Rgb,
} from '../src/index.js';

/** mulberry32: small, fast, seedable PRNG. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(0x1a70);
const ITERATIONS = 2000;

function randomColor(): Color {
  return {
    // Includes the black/white endpoints and out-of-P3 chroma.
    l: random() < 0.05 ? Math.round(random()) : random(),
    c: random() < 0.05 ? 0 : random() * 0.45,
    h: random() * 720 - 180,
    alpha: random() < 0.5 ? 1 : random(),
  };
}

function randomTriple(scale: number, min = 0): [number, number, number] {
  return [
    min + random() * scale,
    min + random() * scale,
    min + random() * scale,
  ];
}

const COLORS: Color[] = Array.from({ length: ITERATIONS }, randomColor);

const newColor = (): Color => ({ l: 0, c: 0, h: 0, alpha: 1 });
const newLab = (): Oklab => ({ L: 0, a: 0, b: 0, alpha: 1 });
const newRgb = (): Rgb => ({ r: 0, g: 0, b: 0, alpha: 1 });

/** Every key of `expected` matches `actual` bit for bit (Object.is). */
function expectBitIdentical(actual: object, expected: object): void {
  const a = actual as Record<string, number>;
  const e = expected as Record<string, number>;
  expect(Object.keys(a).sort()).toEqual(Object.keys(e).sort());
  for (const key of Object.keys(e)) {
    if (!Object.is(a[key], e[key])) {
      expect.fail(`${key}: ${a[key]} is not bit-identical to ${e[key]}`);
    }
  }
}

/**
 * Calls `into(out, input)` for many inputs with one reused `out`, asserting
 * it returns that same `out`, leaves the input untouched, and matches the
 * allocating function bit for bit.
 */
function checkUnary<I extends object, O extends object>(
  inputs: readonly I[],
  alloc: (input: I) => O,
  into: (out: O, input: I) => O,
  out: O,
): void {
  for (const input of inputs) {
    const before = { ...input };
    expect(into(out, input)).toBe(out);
    expectBitIdentical(input, before);
    expectBitIdentical(out, alloc(input));
  }
}

describe('*Into conversions match the allocating API bit for bit', () => {
  const labs: Oklab[] = COLORS.map((color) => toOklab(color));
  const linears: LinearRgb[] = Array.from({ length: ITERATIONS }, () => {
    const [r, g, b] = randomTriple(1.4, -0.2);
    return { r, g, b, alpha: random() };
  });
  const rgbs: Rgb[] = Array.from({ length: ITERATIONS }, () => {
    const [r, g, b] = randomTriple(255);
    return { r, g, b, alpha: random() };
  });
  const p3s: P3[] = Array.from({ length: ITERATIONS }, () => {
    const [r, g, b] = randomTriple(1.2, -0.1);
    return { r, g, b, alpha: random() };
  });

  it('toOklabInto / fromOklabInto', () => {
    checkUnary(COLORS, toOklab, toOklabInto, newLab());
    checkUnary(labs, fromOklab, fromOklabInto, newColor());
  });

  it('toLinearSrgbInto / fromLinearSrgbInto', () => {
    checkUnary(
      COLORS,
      (color) => oklabToLinearRgb(toOklab(color)),
      toLinearSrgbInto,
      newRgb(),
    );
    checkUnary(
      linears,
      (linear) => oklabToOklch(linearRgbToOklab(linear)),
      fromLinearSrgbInto,
      newColor(),
    );
  });

  it('toRgbInto / fromRgbInto', () => {
    checkUnary(COLORS, toRgb, toRgbInto, newRgb());
    checkUnary(rgbs, fromRgb, fromRgbInto, newColor());
  });

  it('toP3Into / fromP3Into', () => {
    checkUnary(COLORS, toP3, toP3Into, newRgb());
    checkUnary(p3s, fromP3, fromP3Into, newColor());
  });

  it('low-level converters', () => {
    checkUnary(rgbs, srgbToLinear, srgbToLinearInto, newRgb());
    checkUnary(linears, linearToSrgb, linearToSrgbInto, newRgb());
    checkUnary(linears, linearRgbToOklab, linearRgbToOklabInto, newLab());
    checkUnary(labs, oklabToLinearRgb, oklabToLinearRgbInto, newRgb());
    checkUnary(labs, oklabToOklch, oklabToOklchInto, newColor());
    checkUnary(COLORS, oklchToOklab, oklchToOklabInto, newLab());
    checkUnary(
      linears,
      linearSrgbToLinearP3,
      linearSrgbToLinearP3Into,
      newRgb(),
    );
    checkUnary(p3s, linearP3ToLinearSrgb, linearP3ToLinearSrgbInto, newRgb());
    checkUnary(p3s, linearP3ToP3, linearP3ToP3Into, newRgb());
    checkUnary(p3s, p3ToLinearP3, p3ToLinearP3Into, newRgb());
  });

  it('same-shape converters accept out === input', () => {
    for (const linear of linears) {
      const expected = linearSrgbToLinearP3(linear);
      const alias = { ...linear };
      expect(linearSrgbToLinearP3Into(alias, alias)).toBe(alias);
      expectBitIdentical(alias, expected);
      const back = linearP3ToLinearSrgb(expected);
      expect(linearP3ToLinearSrgbInto(alias, alias)).toBe(alias);
      expectBitIdentical(alias, back);
    }
  });
});

describe('gamut mapping *Into', () => {
  it('toSrgbGamutInto / toP3GamutInto match toSrgbGamut / toP3Gamut', () => {
    checkUnary(COLORS, toSrgbGamut, toSrgbGamutInto, newColor());
    checkUnary(COLORS, toP3Gamut, toP3GamutInto, newColor());
  });

  it('maps in place when out === color', () => {
    for (const color of COLORS) {
      const expected = toSrgbGamut(color);
      const alias = { ...color };
      expect(toSrgbGamutInto(alias, alias)).toBe(alias);
      expectBitIdentical(alias, expected);
    }
  });
});

describe('mixInto / interpolateInto', () => {
  const OPTIONS: (InterpolationOptions | undefined)[] = [
    undefined,
    {},
    { space: 'oklch' },
    { space: 'oklch', hue: 'longer', premultiplied: true },
    { space: 'oklch', hue: 'increasing' },
    { space: 'oklch', hue: 'decreasing' },
    { space: 'oklab' },
    { space: 'srgb' },
    { space: 'linear-srgb' },
    { space: 'linear-srgb', premultiplied: false },
    { space: 'p3' },
    { space: 'linear-p3' },
  ];
  const T_VALUES = [-0.25, 0, 0.3, 0.5, 1, 1.5];

  for (const options of OPTIONS) {
    const label = options ? JSON.stringify(options) : 'no options';
    it(`matches mix() / interpolate() bit for bit (${label})`, () => {
      const out = newColor();
      for (let i = 0; i < 400; i += 1) {
        const a = COLORS[i];
        const b = COLORS[(i * 7 + 3) % COLORS.length];
        const t = T_VALUES[i % T_VALUES.length];
        const aBefore = { ...a };
        const bBefore = { ...b };

        expect(mixInto(out, a, b, t, options)).toBe(out);
        expectBitIdentical(out, mix(a, b, t, options));
        expect(interpolateInto(out, a, b, t, options)).toBe(out);
        expectBitIdentical(out, interpolate(a, b, t, options));
        expectBitIdentical(a, aBefore);
        expectBitIdentical(b, bBefore);
      }
    });

    it(`accepts out === color1 / color2 (${label})`, () => {
      for (let i = 0; i < 200; i += 1) {
        const a = COLORS[i];
        const b = COLORS[(i * 5 + 1) % COLORS.length];
        const t = T_VALUES[i % T_VALUES.length];

        const first = { ...a };
        mixInto(first, first, b, t, options);
        expectBitIdentical(first, mix(a, b, t, options));

        const second = { ...b };
        interpolateInto(second, a, second, t, options);
        expectBitIdentical(second, interpolate(a, b, t, options));
      }
    });
  }

  it('mixInto defaults t to 0.5', () => {
    const [a, b] = COLORS;
    expectBitIdentical(mixInto(newColor(), a, b), mix(a, b));
  });
});

describe('re-entrant accessors', () => {
  // Inputs whose getters run other conversions (which rewrite the shared
  // module scratch) mid-call must still produce the plain-object result.
  const OTHER: Color = { l: 0.31, c: 0.37, h: 301, alpha: 0.2 };
  const OTHER_2: Color = { l: 0.83, c: 0.05, h: 12, alpha: 1 };
  let nestedCalls = 0;

  function runNestedConversions(): void {
    nestedCalls += 1;
    toRgb(OTHER);
    toP3(OTHER);
    fromRgb({ r: 3, g: 250, b: 90, alpha: 0.5 });
    fromP3({ r: 0.1, g: 0.9, b: 0.4, alpha: 0.5 });
    toSrgbGamut(OTHER);
    toP3Gamut(OTHER);
    mix(OTHER, OTHER_2, 0.3, { space: 'p3' });
    mix(OTHER, OTHER_2, 0.6, { space: 'oklch', hue: 'longer' });
  }

  /**
   * Same fields as `plain`, but reading `alpha` (or, with `allFields`, any
   * field) first runs other conversions.
   */
  function reentrant<T extends object>(plain: T, allFields = false): T {
    const target = {} as T;
    for (const key of Object.keys(plain) as (keyof T)[]) {
      if (key === 'alpha' || allFields) {
        Object.defineProperty(target, key, {
          enumerable: true,
          get() {
            runNestedConversions();
            return plain[key];
          },
        });
      } else {
        target[key] = plain[key];
      }
    }
    return target;
  }

  const colors = COLORS.slice(0, 200);

  for (const allFields of [false, true]) {
    const label = allFields ? 'every field' : 'alpha';

    it(`conversions ignore nested calls from a re-entrant ${label} getter`, () => {
      nestedCalls = 0;
      for (const color of colors) {
        const input = reentrant(color, allFields);
        expectBitIdentical(toOklabInto(newLab(), input), toOklab(color));
        expectBitIdentical(
          toLinearSrgbInto(newRgb(), input),
          oklabToLinearRgb(toOklab(color)),
        );
        expectBitIdentical(toRgbInto(newRgb(), input), toRgb(color));
        expectBitIdentical(toP3Into(newRgb(), input), toP3(color));
        expectBitIdentical(toRgb(input), toRgb(color));

        const rgb = toRgb(color);
        expectBitIdentical(
          fromRgbInto(newColor(), reentrant(rgb, allFields)),
          fromRgb(rgb),
        );
        const p3 = toP3(color);
        expectBitIdentical(
          fromP3Into(newColor(), reentrant(p3, allFields)),
          fromP3(p3),
        );
        const linear = oklabToLinearRgb(toOklab(color));
        expectBitIdentical(
          fromLinearSrgbInto(newColor(), reentrant(linear, allFields)),
          oklabToOklch(linearRgbToOklab(linear)),
        );
      }
      expect(nestedCalls).toBeGreaterThan(0);
    });

    it(`gamut mapping ignores nested calls from a re-entrant ${label} getter`, () => {
      nestedCalls = 0;
      for (const color of colors) {
        const input = reentrant(color, allFields);
        expectBitIdentical(
          toSrgbGamutInto(newColor(), input),
          toSrgbGamut(color),
        );
        expectBitIdentical(toP3GamutInto(newColor(), input), toP3Gamut(color));
      }
      expect(nestedCalls).toBeGreaterThan(0);
    });

    it(`mixInto / interpolateInto ignore nested calls from a re-entrant ${label} getter`, () => {
      nestedCalls = 0;
      const optionSets: (InterpolationOptions | undefined)[] = [
        undefined,
        { space: 'oklch', hue: 'longer', premultiplied: true },
        { space: 'oklab' },
        { space: 'srgb' },
        { space: 'linear-p3' },
      ];
      for (let i = 0; i < colors.length; i += 1) {
        const a = colors[i];
        const b = colors[(i * 7 + 3) % colors.length];
        const options = optionSets[i % optionSets.length];
        const t = 0.35;
        expectBitIdentical(
          mixInto(
            newColor(),
            reentrant(a, allFields),
            reentrant(b),
            t,
            options,
          ),
          mix(a, b, t, options),
        );
        expectBitIdentical(
          interpolateInto(
            newColor(),
            reentrant(a),
            reentrant(b, allFields),
            t,
            options,
          ),
          interpolate(a, b, t, options),
        );
      }
      expect(nestedCalls).toBeGreaterThan(0);
    });
  }
});
