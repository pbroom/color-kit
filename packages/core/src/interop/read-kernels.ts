/**
 * Internal read kernels: turn three channels of one space (plus an alpha
 * value) into a `Color`. They reuse the object converters from
 * `conversion/`, so readers agree exactly with `fromOklab` / `fromP3` / ...
 */
import type { Color } from '../types.js';
import { linearRgbToOklab } from '../conversion/oklab.js';
import { oklabToOklch } from '../conversion/oklch.js';
import { linearP3ToLinearSrgb } from '../conversion/p3.js';
import { decodeChannel } from './kernels.js';

export type ReadKernel = (
  array: ArrayLike<number>,
  offset: number,
  alpha: number,
) => Color;

function fromLinear(r: number, g: number, b: number, alpha: number): Color {
  return oklabToOklch(linearRgbToOklab({ r, g, b, alpha }));
}

function fromLinearP3(r: number, g: number, b: number, alpha: number): Color {
  const linear = linearP3ToLinearSrgb({ r, g, b, alpha });
  return fromLinear(linear.r, linear.g, linear.b, alpha);
}

export const readLinearSrgb: ReadKernel = (array, offset, alpha) =>
  fromLinear(array[offset], array[offset + 1], array[offset + 2], alpha);

export const readSrgb: ReadKernel = (array, offset, alpha) =>
  fromLinear(
    decodeChannel(array[offset]),
    decodeChannel(array[offset + 1]),
    decodeChannel(array[offset + 2]),
    alpha,
  );

export const readLinearP3: ReadKernel = (array, offset, alpha) =>
  fromLinearP3(array[offset], array[offset + 1], array[offset + 2], alpha);

export const readP3: ReadKernel = (array, offset, alpha) =>
  fromLinearP3(
    decodeChannel(array[offset]),
    decodeChannel(array[offset + 1]),
    decodeChannel(array[offset + 2]),
    alpha,
  );

export const readOklab: ReadKernel = (array, offset, alpha) =>
  oklabToOklch({
    L: array[offset],
    a: array[offset + 1],
    b: array[offset + 2],
    alpha,
  });

export const readOklch: ReadKernel = (array, offset, alpha) => ({
  l: array[offset],
  c: array[offset + 1],
  h: array[offset + 2],
  alpha,
});
