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
// These are inferred (not contextually typed) so the overloads are locked:
// omitting `out` or passing `undefined` must yield Float32Array methods.
const packed = packColors([color], 'linearSrgb').subarray(0, 3);
const packedWithOptions = packColors([color], 'srgb', undefined, {
  alpha: true,
}).subarray(0, 4);
const packedNumbers = packColors([color], 'oklch', [0, 0, 0]).slice(0, 3);
const packed64: Float64Array = packColors(
  [color],
  'oklab',
  new Float64Array(4),
  { stride: 4 },
);

// Optional reusable buffers (`T | undefined`) are accepted, and the result
// is exactly "the buffer or a fresh default", not a widened array-like.
type Equal<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2
    ? true
    : false;
declare const maybeF32: Float32Array | undefined;
declare const maybeF64: Float64Array | undefined;
declare const maybeNumbers: number[] | undefined;

const maybeTuple = toLinearSrgbArray(color, maybeF32);
const maybeTupleIsExact: Equal<typeof maybeTuple, Float32Array | ColorTuple> =
  true;
const maybeTuple4 = toOklchArray4(color, maybeNumbers, 0, { clamp: true });
const maybeTuple4IsExact: Equal<typeof maybeTuple4, number[] | ColorTuple4> =
  true;
const maybePacked = packColors([color], 'srgb', maybeF64, { alpha: true });
const maybePackedIsExact: Equal<
  typeof maybePacked,
  Float64Array | Float32Array
> = true;
const maybePackedF32 = packColors([color], 'srgb', maybeF32).subarray(0, 3);
// The overloads still resolve precisely when `out` is definitely absent or
// definitely present.
declare const definiteF64: Float64Array;
const absent = packColors([color], 'srgb', undefined, { stride: 4 });
const absentIsExact: Equal<typeof absent, Float32Array> = true;
const present = toLinearSrgbArray(color, definiteF64, 3);
const presentIsExact: Equal<typeof present, Float64Array> = true;
const absentTuple = toLinearSrgbArray(color, undefined, 0, { clamp: true });
const absentTupleIsExact: Equal<typeof absentTuple, ColorTuple> = true;

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
  packedWithOptions,
  packedNumbers,
  packed64,
  maybeTuple,
  maybeTuple4,
  maybePacked,
  absent,
  present,
  absentTuple,
  maybeTupleIsExact,
  maybeTuple4IsExact,
  maybePackedIsExact,
  maybePackedF32,
  absentIsExact,
  presentIsExact,
  absentTupleIsExact,
  wrong,
];
