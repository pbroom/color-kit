import { describe, expect, it } from 'vitest';
import {
  fromLinearP3Array,
  fromLinearP3Array4,
  fromLinearSrgbArray,
  fromLinearSrgbArray4,
  fromOklabArray,
  fromOklabArray4,
  fromOklchArray,
  fromOklchArray4,
  fromP3,
  fromP3Array,
  fromP3Array4,
  fromSrgbArray,
  fromSrgbArray4,
  inP3Gamut,
  inSrgbGamut,
  oklabToLinearRgb,
  packColors,
  parse,
  toLinearP3Array,
  toLinearP3Array4,
  toLinearSrgbArray,
  toLinearSrgbArray4,
  toOklab,
  toOklabArray,
  toOklabArray4,
  toOklchArray,
  toOklchArray4,
  toP3,
  toP3Array,
  toP3Array4,
  toP3Gamut,
  toRgb,
  toSrgbArray,
  toSrgbArray4,
  toSrgbGamut,
  unpackColors,
} from '../src/index.js';
import type {
  ArraySpace,
  ArrayWriteOptions,
  Color,
  ColorTuple,
  ColorTuple4,
  WritableArrayLike,
} from '../src/index.js';

type Writer = (
  color: Color,
  out: WritableArrayLike,
  offset?: number,
  options?: ArrayWriteOptions,
) => WritableArrayLike;
type Reader = (array: ArrayLike<number>, offset?: number) => Color;

const SPACES: {
  space: ArraySpace;
  write: Writer;
  write4: Writer;
  read: Reader;
  read4: Reader;
  rgb: boolean;
}[] = [
  {
    space: 'linearSrgb',
    write: toLinearSrgbArray,
    write4: toLinearSrgbArray4,
    read: fromLinearSrgbArray,
    read4: fromLinearSrgbArray4,
    rgb: true,
  },
  {
    space: 'srgb',
    write: toSrgbArray,
    write4: toSrgbArray4,
    read: fromSrgbArray,
    read4: fromSrgbArray4,
    rgb: true,
  },
  {
    space: 'linearP3',
    write: toLinearP3Array,
    write4: toLinearP3Array4,
    read: fromLinearP3Array,
    read4: fromLinearP3Array4,
    rgb: true,
  },
  {
    space: 'p3',
    write: toP3Array,
    write4: toP3Array4,
    read: fromP3Array,
    read4: fromP3Array4,
    rgb: true,
  },
  {
    space: 'oklab',
    write: toOklabArray,
    write4: toOklabArray4,
    read: fromOklabArray,
    read4: fromOklabArray4,
    rgb: false,
  },
  {
    space: 'oklch',
    write: toOklchArray,
    write4: toOklchArray4,
    read: fromOklchArray,
    read4: fromOklchArray4,
    rgb: false,
  },
];

/** Deterministic sample: in-sRGB, P3-only and out-of-P3 colors. */
function sampleColors(count: number): Color[] {
  let state = 0x1234;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const colors: Color[] = [
    { l: 0.5, c: 0, h: 0, alpha: 1 },
    { l: 0.7, c: 0.1, h: 30, alpha: 0.5 },
    { l: 0.6, c: 0.35, h: 145, alpha: 1 }, // outside sRGB and P3
  ];
  for (let i = 0; i < count; i += 1) {
    colors.push({
      l: 0.05 + random() * 0.9,
      c: 0.001 + random() * 0.35,
      h: random() * 360,
      alpha: Math.round(random() * 100) / 100,
    });
  }
  return colors;
}

const COLORS = sampleColors(400);

function expectColorClose(actual: Color, expected: Color, tol: number) {
  expect(Math.abs(actual.l - expected.l)).toBeLessThanOrEqual(tol);
  expect(Math.abs(actual.c - expected.c)).toBeLessThanOrEqual(tol);
  if (expected.c >= 1e-3) {
    const dh = Math.abs(actual.h - expected.h) % 360;
    // Hue error scales with 1 / chroma.
    expect(Math.min(dh, 360 - dh)).toBeLessThanOrEqual(
      (tol / expected.c) * 180,
    );
  }
  expect(actual.alpha).toBe(expected.alpha);
}

/** Euclidean OKLab distance (deltaE OK). */
function deltaEOK(a: Color, b: Color): number {
  const la = toOklab(a);
  const lb = toOklab(b);
  return Math.hypot(la.L - lb.L, la.a - lb.a, la.b - lb.b);
}

describe('array writers', () => {
  it('return a new tuple when out is omitted', () => {
    const color = parse('#ff8800');
    for (const { write, write4 } of SPACES) {
      const t3 = (write as (c: Color) => ColorTuple)(color);
      const t4 = (write4 as (c: Color) => ColorTuple4)(color);
      expect(Array.isArray(t3)).toBe(true);
      expect(t3).toHaveLength(3);
      expect(t4).toHaveLength(4);
      expect(t4.slice(0, 3)).toEqual(t3);
      expect(t4[3]).toBe(color.alpha);
    }
  });

  it('write into out at offset and return the same out', () => {
    const color = { l: 0.6, c: 0.12, h: 250, alpha: 0.25 };
    for (const { write, write4 } of SPACES) {
      const out = new Float64Array(8).fill(-9);
      expect(write(color, out, 2)).toBe(out);
      const reference = write(color, [0, 0, 0]);
      expect([out[0], out[1], out[5], out[6], out[7]]).toEqual([
        -9, -9, -9, -9, -9,
      ]);
      expect(Array.from(out.subarray(2, 5))).toEqual(reference);

      const out4 = new Array<number>(6).fill(-9);
      expect(write4(color, out4, 1)).toBe(out4);
      expect(out4).toEqual([-9, ...reference, 0.25, -9]);
    }
  });

  it('ignore offset when allocating a fresh tuple', () => {
    const color = { l: 0.6, c: 0.12, h: 250, alpha: 1 };
    const tuple = toLinearSrgbArray(color, undefined, 5);
    expect(tuple).toHaveLength(3);
    expect(tuple).toEqual(toLinearSrgbArray(color));
  });

  it('agree with the object converters', () => {
    for (const color of COLORS) {
      const linear = oklabToLinearRgb(toOklab(color));
      expect(toLinearSrgbArray(color)).toEqual([linear.r, linear.g, linear.b]);

      const lab = toOklab(color);
      expect(toOklabArray(color)).toEqual([lab.L, lab.a, lab.b]);
      expect(toOklchArray(color)).toEqual([color.l, color.c, color.h]);

      if (inP3Gamut(color)) {
        const p3 = toP3(color);
        const [r, g, b] = toP3Array(color);
        expect(Math.abs(r - p3.r)).toBeLessThan(1e-12);
        expect(Math.abs(g - p3.g)).toBeLessThan(1e-12);
        expect(Math.abs(b - p3.b)).toBeLessThan(1e-12);
      }
      if (inSrgbGamut(color)) {
        const rgb = toRgb(color);
        const srgb = toSrgbArray(color);
        // toRgb rounds to 8-bit.
        expect(Math.abs(srgb[0] * 255 - rgb.r)).toBeLessThanOrEqual(0.5001);
        expect(Math.abs(srgb[1] * 255 - rgb.g)).toBeLessThanOrEqual(0.5001);
        expect(Math.abs(srgb[2] * 255 - rgb.b)).toBeLessThanOrEqual(0.5001);
      }
    }
  });

  it('write unclamped floats by default', () => {
    // Vivid green outside both sRGB and P3.
    const wide = { l: 0.6, c: 0.35, h: 145, alpha: 1 };
    const linear = toLinearSrgbArray(wide);
    expect(Math.min(...linear)).toBeLessThan(0);
    const srgb = toSrgbArray(wide);
    expect(Math.min(...srgb)).toBeLessThan(0);
    // The negative branch mirrors the transfer function, so it inverts.
    expectColorClose(fromSrgbArray(srgb), wide, 1e-9);

    const bright = { l: 1.2, c: 0, h: 0, alpha: 1 };
    const [r] = toLinearSrgbArray(bright);
    expect(r).toBeGreaterThan(1);
  });
});

describe('array readers', () => {
  it('round-trip every space in float64, including out-of-gamut colors', () => {
    for (const { space, write, write4, read, read4 } of SPACES) {
      for (const color of COLORS) {
        const opaque = { ...color, alpha: 1 };
        expectColorClose(read(write(color, [0, 0, 0])), opaque, 1e-9);
        expectColorClose(read4(write4(color, [0, 0, 0, 0])), color, 1e-9);
        if (space === 'oklch') {
          expect(read(write(color, [0, 0, 0]))).toEqual(opaque);
        }
      }
    }
  });

  it('read at an offset', () => {
    const color = { l: 0.4, c: 0.08, h: 30, alpha: 0.75 };
    for (const { write4, read, read4 } of SPACES) {
      const buffer = [7, 7, 7, 0, 0, 0, 0];
      write4(color, buffer, 3);
      expectColorClose(read4(buffer, 3), color, 1e-9);
      expect(read(buffer, 3).alpha).toBe(1);
    }
  });

  it('match fromP3 for gamma-encoded P3 input', () => {
    const p3 = { r: 0.9, g: 0.2, b: 0.4, alpha: 1 };
    expect(fromP3Array([p3.r, p3.g, p3.b])).toEqual(fromP3(p3));
  });

  it('read three.js style Color.toArray() output', () => {
    const color = fromLinearSrgbArray([1, 0, 0]);
    expect(color.l).toBeCloseTo(0.627955, 5);
    expect(color.c).toBeCloseTo(0.257683, 5);
    expect(color.h).toBeCloseTo(29.2339, 3);
  });
});

describe('Float32Array precision', () => {
  it('round-trips within float32 rounding in every space', () => {
    // Restricted to the P3 gamut: far outside it, a cone response (LMS) can
    // approach 0, where the OKLab cube root amplifies float32's absolute
    // rounding error without bound. That is a property of storing such
    // colors as float32 linear RGB, not of the conversion.
    const inGamut = COLORS.filter(inP3Gamut);
    expect(inGamut.length).toBeGreaterThan(100);
    for (const { space, write4, read4 } of SPACES) {
      let worst = 0;
      for (const color of inGamut) {
        const buffer = write4(color, new Float32Array(4));
        const restored = read4(buffer);
        worst = Math.max(worst, deltaEOK(restored, color));
        expect(Math.abs(restored.alpha - color.alpha)).toBeLessThan(1e-7);
      }
      // float32 has a 24-bit mantissa (~6e-8 relative); a deltaE OK of
      // 1e-5 is ~1000x below the ~0.002 just-noticeable difference.
      expect(worst, space).toBeLessThan(1e-5);
    }
  });

  it('stores exactly Math.fround of the float64 channels', () => {
    for (const color of COLORS.slice(0, 50)) {
      const f64 = toLinearSrgbArray(color);
      const f32 = toLinearSrgbArray(color, new Float32Array(3));
      expect(Array.from(f32)).toEqual(f64.map(Math.fround));
    }
  });
});

describe('clamp and gamutMap options', () => {
  const wide = { l: 0.6, c: 0.35, h: 145, alpha: 0.5 };

  it('clamp clips RGB channels to [0, 1] and leaves alpha alone', () => {
    for (const { write4, rgb } of SPACES) {
      if (!rgb) continue;
      const out = write4(wide, [0, 0, 0, 0], 0, { clamp: true });
      for (let i = 0; i < 3; i += 1) {
        expect(out[i]).toBeGreaterThanOrEqual(0);
        expect(out[i]).toBeLessThanOrEqual(1);
      }
      expect(out[3]).toBe(0.5);
    }
    expect(
      toSrgbArray({ l: 1.3, c: 0, h: 0, alpha: 1 }, [0, 0, 0], 0, {
        clamp: true,
      }),
    ).toEqual([1, 1, 1]);
  });

  it('clamp does not touch in-gamut values', () => {
    for (const color of COLORS) {
      if (!inSrgbGamut(color)) continue;
      const clamped = toSrgbArray(color, [0, 0, 0], 0, { clamp: true });
      const raw = toSrgbArray(color);
      for (let i = 0; i < 3; i += 1) {
        expect(Math.abs(clamped[i] - raw[i])).toBeLessThan(1e-4);
      }
    }
  });

  it('clamp is a no-op for oklab and oklch', () => {
    expect(toOklabArray(wide, [0, 0, 0], 0, { clamp: true })).toEqual(
      toOklabArray(wide),
    );
    expect(toOklchArray(wide, [0, 0, 0], 0, { clamp: true })).toEqual(
      toOklchArray(wide),
    );
  });

  it('gamutMap reuses toSrgbGamut / toP3Gamut', () => {
    for (const { write4 } of SPACES) {
      expect(write4(wide, [0, 0, 0, 0], 0, { gamutMap: 'srgb' })).toEqual(
        write4(toSrgbGamut(wide), [0, 0, 0, 0]),
      );
      expect(write4(wide, [0, 0, 0, 0], 0, { gamutMap: 'display-p3' })).toEqual(
        write4(toP3Gamut(wide), [0, 0, 0, 0]),
      );
    }
  });

  it('gamutMap lands inside the target gamut', () => {
    for (const color of COLORS) {
      const srgb = toSrgbArray(color, [0, 0, 0], 0, { gamutMap: 'srgb' });
      const p3 = toP3Array(color, [0, 0, 0], 0, { gamutMap: 'display-p3' });
      for (let i = 0; i < 3; i += 1) {
        expect(srgb[i]).toBeGreaterThanOrEqual(-1e-9);
        expect(srgb[i]).toBeLessThanOrEqual(1 + 1e-9);
        expect(p3[i]).toBeGreaterThanOrEqual(-1e-9);
        expect(p3[i]).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});

describe('packColors / unpackColors', () => {
  const colors = COLORS.slice(0, 5);

  it('packs tightly into a new Float32Array by default', () => {
    const packed = packColors(colors, 'linearSrgb');
    expect(packed).toBeInstanceOf(Float32Array);
    expect(packed).toHaveLength(15);
    colors.forEach((color, i) => {
      expect(Array.from(packed.subarray(i * 3, i * 3 + 3))).toEqual(
        toLinearSrgbArray(color).map(Math.fround),
      );
    });
  });

  it('writes alpha with stride 4', () => {
    const packed = packColors(colors, 'srgb', undefined, { alpha: true });
    expect(packed).toHaveLength(20);
    colors.forEach((color, i) => {
      expect(packed[i * 4 + 3]).toBe(Math.fround(color.alpha));
    });
  });

  it('leaves padding lanes untouched for padded vec3 layouts', () => {
    const out = new Float32Array(20).fill(42);
    packColors(colors, 'oklab', out, { stride: 4 });
    colors.forEach((color, i) => {
      expect(out[i * 4 + 3]).toBe(42);
      expect(Array.from(out.subarray(i * 4, i * 4 + 3))).toEqual(
        toOklabArray(color).map(Math.fround),
      );
    });
  });

  it('honors offset and interleaved strides', () => {
    // [x, y, z, r, g, b] per vertex, colors start at element 3, after a
    // 2-element header.
    const header = 2;
    const out = new Array<number>(header + colors.length * 6).fill(-1);
    expect(
      packColors(colors, 'p3', out, { stride: 6, offset: header + 3 }),
    ).toBe(out);
    colors.forEach((color, i) => {
      const base = header + i * 6;
      expect(out.slice(base, base + 3)).toEqual([-1, -1, -1]);
      expect(out.slice(base + 3, base + 6)).toEqual(toP3Array(color));
    });
    expect(out.slice(0, header)).toEqual([-1, -1]);

    const restored = unpackColors(out, 'p3', {
      stride: 6,
      offset: header + 3,
    });
    expect(restored).toHaveLength(colors.length);
    restored.forEach((color, i) =>
      expectColorClose(color, { ...colors[i], alpha: 1 }, 1e-9),
    );
  });

  it('allocates offset + count * stride when out is omitted', () => {
    const packed = packColors(colors, 'oklch', undefined, {
      stride: 4,
      offset: 2,
    });
    expect(packed).toHaveLength(2 + colors.length * 4);
  });

  it('forwards clamp and gamutMap', () => {
    const wide = [{ l: 0.6, c: 0.35, h: 145, alpha: 1 }];
    const clamped = packColors(wide, 'linearSrgb', undefined, {
      clamp: true,
    });
    expect(Math.min(...clamped)).toBeGreaterThanOrEqual(0);
    expect(
      Array.from(packColors(wide, 'srgb', [0, 0, 0], { gamutMap: 'srgb' })),
    ).toEqual(toSrgbArray(toSrgbGamut(wide[0])));
  });

  it('round-trips every space through pack/unpack', () => {
    for (const { space } of SPACES) {
      const packed = packColors(
        COLORS,
        space,
        new Float64Array(COLORS.length * 4),
        {
          alpha: true,
        },
      );
      const restored = unpackColors(packed, space, { alpha: true });
      expect(restored).toHaveLength(COLORS.length);
      restored.forEach((color, i) => expectColorClose(color, COLORS[i], 1e-9));
    }
  });

  it('infers count from the array length and accepts an explicit count', () => {
    const packed = packColors(colors, 'oklab', undefined, { stride: 4 });
    // The last color needs only 3 of its 4 lanes.
    expect(
      unpackColors(packed.subarray(0, 19), 'oklab', { stride: 4 }),
    ).toHaveLength(5);
    expect(
      unpackColors(packed.subarray(0, 18), 'oklab', { stride: 4 }),
    ).toHaveLength(4);
    expect(unpackColors(packed, 'oklab', { stride: 4, count: 2 })).toHaveLength(
      2,
    );
    expect(unpackColors([], 'oklab')).toEqual([]);
  });

  it('handles an empty color list', () => {
    expect(packColors([], 'srgb')).toHaveLength(0);
    expect(packColors([], 'srgb', [])).toEqual([]);
  });

  it('rejects invalid layouts', () => {
    expect(() => packColors(colors, 'srgb', new Float32Array(14))).toThrow(
      RangeError,
    );
    expect(() =>
      packColors(colors, 'srgb', undefined, { alpha: true, stride: 3 }),
    ).toThrow(RangeError);
    expect(() => packColors(colors, 'srgb', undefined, { stride: 2 })).toThrow(
      RangeError,
    );
    expect(() => packColors(colors, 'srgb', undefined, { offset: -1 })).toThrow(
      RangeError,
    );
    expect(() => packColors(colors, 'rgb' as ArraySpace, undefined)).toThrow(
      RangeError,
    );
    expect(() =>
      unpackColors(new Float32Array(6), 'srgb', { count: 3 }),
    ).toThrow(RangeError);
    expect(() =>
      unpackColors(new Float32Array(6), 'toString' as ArraySpace),
    ).toThrow(RangeError);
  });
});
