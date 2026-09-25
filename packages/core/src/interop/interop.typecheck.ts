import type { Color } from '../types.js';
import { packColors } from './pack.js';
import type { ColorTuple, ColorTuple4 } from './types.js';
import { toLinearSrgbArray, toOklchArray4 } from './writers.js';

const color: Color = { l: 0.6, c: 0.1, h: 250, alpha: 1 };

// Omitting `out` returns an exact tuple type.
const tuple: ColorTuple = toLinearSrgbArray(color);
const tuple4: ColorTuple4 = toOklchArray4(color);
const clamped: ColorTuple = toLinearSrgbArray(color, undefined, 0, {
  clamp: true,
});

// Passing `out` returns the same array type.
const f32: Float32Array = toLinearSrgbArray(color, new Float32Array(3));
const numbers: number[] = toLinearSrgbArray(color, [0, 0, 0], 0);

// packColors defaults to Float32Array and preserves a supplied array type.
const packed: Float32Array = packColors([color], 'linearSrgb');
const packed64: Float64Array = packColors(
  [color],
  'oklab',
  new Float64Array(4),
  { stride: 4 },
);

// @ts-expect-error: a 3-tuple is not a ColorTuple4.
const wrong: ColorTuple4 = toLinearSrgbArray(color);

// @ts-expect-error: unknown space.
packColors([color], 'rgb');

// @ts-expect-error: gamut mapping is composed (toSrgbGamut), not an option.
toLinearSrgbArray(color, undefined, 0, { gamutMap: 'srgb' });

export const typecheck = [
  tuple,
  tuple4,
  clamped,
  f32,
  numbers,
  packed,
  packed64,
  wrong,
];
