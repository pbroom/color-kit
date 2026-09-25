/**
 * Internal, allocation-free conversion kernels shared by the array writers
 * and `packColors`. Each kernel writes three channels of one space into
 * `out[offset..offset + 2]`.
 *
 * The math mirrors `conversion/oklch.ts` + `conversion/oklab.ts` operation
 * for operation (same matrices, same evaluation order), so linear-sRGB and
 * OKLab values are bit-identical to the object-returning converters, just
 * without the intermediate objects. Display P3 uses the composed
 * `LMS_TO_LINEAR_P3` matrix (as the gamut code does), which agrees with the
 * two-step `toP3` path to ~1e-16.
 */
import type { Color } from '../types.js';
import {
  LMS_TO_LINEAR_P3,
  LMS_TO_LINEAR_SRGB,
  OKLAB_TO_LMS,
  type Matrix3,
} from '../conversion/matrices.js';
import { toP3Gamut, toSrgbGamut } from '../gamut/membership.js';
import {
  degToRad,
  linearToSrgbChannel,
  srgbToLinearChannel,
} from '../utils/index.js';
import type { ArrayWriteOptions, WritableArrayLike } from './types.js';

export type WriteKernel = (
  color: Color,
  out: WritableArrayLike,
  offset: number,
) => void;

// OKLAB_TO_LMS has an all-ones first column, so only the a/b terms are needed.
const [[, LA, LB], [, MA, MB], [, SA, SB]] = OKLAB_TO_LMS;

/**
 * sRGB / Display P3 transfer function, extended to negative values by
 * mirroring (CSS Color 4 / colorjs.io), so out-of-gamut linear values stay
 * invertible instead of being folded or clipped.
 */
export function encodeChannel(value: number): number {
  return value < 0 ? -linearToSrgbChannel(-value) : linearToSrgbChannel(value);
}

/** Inverse of {@link encodeChannel}. */
export function decodeChannel(value: number): number {
  return value < 0 ? -srgbToLinearChannel(-value) : srgbToLinearChannel(value);
}

function writeLinearRgb(
  color: Color,
  rows: Matrix3,
  encode: boolean,
  out: WritableArrayLike,
  offset: number,
): void {
  // OKLCH -> OKLab (same as oklchToOklab).
  const hRad = degToRad(color.h);
  const a = color.c * Math.cos(hRad);
  const b = color.c * Math.sin(hRad);

  // OKLab -> LMS (same as oklabToLinearRgb).
  const l_ = color.l + LA * a + LB * b;
  const m_ = color.l + MA * a + MB * b;
  const s_ = color.l + SA * a + SB * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  for (let i = 0; i < 3; i += 1) {
    const row = rows[i];
    const value = row[0] * l + row[1] * m + row[2] * s;
    out[offset + i] = encode ? encodeChannel(value) : value;
  }
}

export const writeLinearSrgb: WriteKernel = (color, out, offset) =>
  writeLinearRgb(color, LMS_TO_LINEAR_SRGB, false, out, offset);

export const writeSrgb: WriteKernel = (color, out, offset) =>
  writeLinearRgb(color, LMS_TO_LINEAR_SRGB, true, out, offset);

export const writeLinearP3: WriteKernel = (color, out, offset) =>
  writeLinearRgb(color, LMS_TO_LINEAR_P3, false, out, offset);

export const writeP3: WriteKernel = (color, out, offset) =>
  writeLinearRgb(color, LMS_TO_LINEAR_P3, true, out, offset);

export const writeOklab: WriteKernel = (color, out, offset) => {
  const hRad = degToRad(color.h);
  out[offset] = color.l;
  out[offset + 1] = color.c * Math.cos(hRad);
  out[offset + 2] = color.c * Math.sin(hRad);
};

export const writeOklch: WriteKernel = (color, out, offset) => {
  out[offset] = color.l;
  out[offset + 1] = color.c;
  out[offset + 2] = color.h;
};

/**
 * Shared driver for every writer: applies `gamutMap`, runs the kernel,
 * applies `clamp` (RGB kernels only) and optionally writes alpha.
 */
export function writeColor(
  kernel: WriteKernel,
  rgb: boolean,
  withAlpha: boolean,
  color: Color,
  out: WritableArrayLike,
  offset: number,
  options: ArrayWriteOptions | undefined,
): void {
  const gamutMap = options?.gamutMap;
  const source =
    gamutMap === undefined
      ? color
      : gamutMap === 'display-p3'
        ? toP3Gamut(color)
        : toSrgbGamut(color);

  kernel(source, out, offset);

  if (rgb && options?.clamp) {
    for (let i = offset; i < offset + 3; i += 1) {
      const value = out[i];
      out[i] = value < 0 ? 0 : value > 1 ? 1 : value;
    }
  }

  if (withAlpha) {
    out[offset + 3] = source.alpha;
  }
}
