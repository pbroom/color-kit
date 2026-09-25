import type { Color } from '../types.js';
import {
  writeColor,
  writeLinearP3,
  writeLinearSrgb,
  writeOklab,
  writeOklch,
  writeP3,
  writeSrgb,
  type WriteKernel,
} from './kernels.js';
import type {
  ArrayWriteOptions,
  ColorTuple,
  ColorTuple4,
  WritableArrayLike,
} from './types.js';

// Shared body for the public writers. Allocates only when `out` is omitted,
// in which case `offset` is ignored and a fresh tuple is returned.
function write(
  kernel: WriteKernel,
  rgb: boolean,
  size: 3 | 4,
  color: Color,
  out: WritableArrayLike | undefined,
  offset: number,
  options: ArrayWriteOptions | undefined,
): WritableArrayLike {
  const target = out ?? (size === 4 ? [0, 0, 0, 0] : [0, 0, 0]);
  writeColor(kernel, rgb, size === 4, color, target, out ? offset : 0, options);
  return target;
}

/**
 * Write a color as linear-light sRGB
 * `[r, g, b]` (0–1 in gamut). This is three.js's default working
 * color space (`ColorManagement.workingColorSpace === 'srgb-linear'`) and
 * what lighting math in shaders expects.
 *
 * Values are unclamped floats by default, so out-of-gamut colors produce
 * channels outside 0–1 (correct for HDR/linear pipelines, and what three.js
 * does). Pass `{ clamp: true }` to clip, or gamut-map first to reduce
 * chroma instead: `toLinearSrgbArray(toSrgbGamut(color), out)` (or `toP3Gamut`).
 *
 * @param color - Color to convert.
 * @param out - Destination (`number[]`, `Float32Array`, ...). When omitted a
 * new `ColorTuple` is returned.
 * @param offset - Index in `out` of the first component to write.
 * @param options - Out-of-gamut handling (`clamp`).
 * @returns `out`, or a new tuple when `out` is omitted.
 * @example
 * ```ts
 * // three.js stores linear sRGB, so write working-space values directly
 * // instead of round-tripping through an 8-bit CSS string.
 * const threeColor = new THREE.Color().fromArray(toLinearSrgbArray(color));
 *
 * // WebGL: reuse one scratch buffer, no per-frame allocation.
 * const scratch = new Float32Array(3);
 * gl.uniform3fv(loc, toLinearSrgbArray(color, scratch));
 * ```
 */
export function toLinearSrgbArray(
  color: Color,
  out?: undefined,
  offset?: number,
  options?: ArrayWriteOptions,
): ColorTuple;
export function toLinearSrgbArray<T extends WritableArrayLike>(
  color: Color,
  out: T,
  offset?: number,
  options?: ArrayWriteOptions,
): T;
export function toLinearSrgbArray(
  color: Color,
  out?: WritableArrayLike,
  offset = 0,
  options?: ArrayWriteOptions,
): WritableArrayLike {
  return write(writeLinearSrgb, true, 3, color, out, offset, options);
}

/**
 * Write a color as linear-light sRGB
 * `[r, g, b]` (0–1 in gamut). This is three.js's default working
 * color space (`ColorManagement.workingColorSpace === 'srgb-linear'`) and
 * what lighting math in shaders expects.
 *
 * Alpha is written as the fourth component: `[c0, c1, c2, alpha]`.
 *
 * Values are unclamped floats by default, so out-of-gamut colors produce
 * channels outside 0–1 (correct for HDR/linear pipelines, and what three.js
 * does). Pass `{ clamp: true }` to clip, or gamut-map first to reduce
 * chroma instead: `toLinearSrgbArray4(toSrgbGamut(color), out)` (or `toP3Gamut`).
 *
 * @param color - Color to convert.
 * @param out - Destination (`number[]`, `Float32Array`, ...). When omitted a
 * new `ColorTuple4` is returned.
 * @param offset - Index in `out` of the first component to write.
 * @param options - Out-of-gamut handling (`clamp`).
 * @returns `out`, or a new tuple when `out` is omitted.
 * @example
 * ```ts
 * // vec4 uniform: [c0, c1, c2, alpha]
 * const scratch = new Float32Array(4);
 * gl.uniform4fv(loc, toLinearSrgbArray4(color, scratch));
 * ```
 */
export function toLinearSrgbArray4(
  color: Color,
  out?: undefined,
  offset?: number,
  options?: ArrayWriteOptions,
): ColorTuple4;
export function toLinearSrgbArray4<T extends WritableArrayLike>(
  color: Color,
  out: T,
  offset?: number,
  options?: ArrayWriteOptions,
): T;
export function toLinearSrgbArray4(
  color: Color,
  out?: WritableArrayLike,
  offset = 0,
  options?: ArrayWriteOptions,
): WritableArrayLike {
  return write(writeLinearSrgb, true, 4, color, out, offset, options);
}

/**
 * Write a color as gamma-encoded sRGB
 * `[r, g, b]`, 0–1 in gamut (not 0–255).
 * Use this for sRGB-encoded render targets and for three.js
 * `Color.setRGB(r, g, b, SRGBColorSpace)`.
 *
 * Values are unclamped floats by default, so out-of-gamut colors produce
 * channels outside 0–1 (correct for HDR/linear pipelines, and what three.js
 * does). Pass `{ clamp: true }` to clip, or gamut-map first to reduce
 * chroma instead: `toSrgbArray(toSrgbGamut(color), out)` (or `toP3Gamut`).
 *
 * @param color - Color to convert.
 * @param out - Destination (`number[]`, `Float32Array`, ...). When omitted a
 * new `ColorTuple` is returned.
 * @param offset - Index in `out` of the first component to write.
 * @param options - Out-of-gamut handling (`clamp`).
 * @returns `out`, or a new tuple when `out` is omitted.
 * @example
 * ```ts
 * toSrgbArray(parse('#ff8800')); // => [c0, c1, c2]
 *
 * // Write into an existing buffer, starting at element 6.
 * toSrgbArray(color, buffer, 6);
 * ```
 */
export function toSrgbArray(
  color: Color,
  out?: undefined,
  offset?: number,
  options?: ArrayWriteOptions,
): ColorTuple;
export function toSrgbArray<T extends WritableArrayLike>(
  color: Color,
  out: T,
  offset?: number,
  options?: ArrayWriteOptions,
): T;
export function toSrgbArray(
  color: Color,
  out?: WritableArrayLike,
  offset = 0,
  options?: ArrayWriteOptions,
): WritableArrayLike {
  return write(writeSrgb, true, 3, color, out, offset, options);
}

/**
 * Write a color as gamma-encoded sRGB
 * `[r, g, b]`, 0–1 in gamut (not 0–255).
 * Use this for sRGB-encoded render targets and for three.js
 * `Color.setRGB(r, g, b, SRGBColorSpace)`.
 *
 * Alpha is written as the fourth component: `[c0, c1, c2, alpha]`.
 *
 * Values are unclamped floats by default, so out-of-gamut colors produce
 * channels outside 0–1 (correct for HDR/linear pipelines, and what three.js
 * does). Pass `{ clamp: true }` to clip, or gamut-map first to reduce
 * chroma instead: `toSrgbArray4(toSrgbGamut(color), out)` (or `toP3Gamut`).
 *
 * @param color - Color to convert.
 * @param out - Destination (`number[]`, `Float32Array`, ...). When omitted a
 * new `ColorTuple4` is returned.
 * @param offset - Index in `out` of the first component to write.
 * @param options - Out-of-gamut handling (`clamp`).
 * @returns `out`, or a new tuple when `out` is omitted.
 * @example
 * ```ts
 * // vec4 uniform: [c0, c1, c2, alpha]
 * const scratch = new Float32Array(4);
 * gl.uniform4fv(loc, toSrgbArray4(color, scratch));
 * ```
 */
export function toSrgbArray4(
  color: Color,
  out?: undefined,
  offset?: number,
  options?: ArrayWriteOptions,
): ColorTuple4;
export function toSrgbArray4<T extends WritableArrayLike>(
  color: Color,
  out: T,
  offset?: number,
  options?: ArrayWriteOptions,
): T;
export function toSrgbArray4(
  color: Color,
  out?: WritableArrayLike,
  offset = 0,
  options?: ArrayWriteOptions,
): WritableArrayLike {
  return write(writeSrgb, true, 4, color, out, offset, options);
}

/**
 * Write a color as linear-light Display P3
 * `[r, g, b]` (0–1 in the P3 gamut).
 *
 * Values are unclamped floats by default, so out-of-gamut colors produce
 * channels outside 0–1 (correct for HDR/linear pipelines, and what three.js
 * does). Pass `{ clamp: true }` to clip, or gamut-map first to reduce
 * chroma instead: `toLinearP3Array(toSrgbGamut(color), out)` (or `toP3Gamut`).
 *
 * @param color - Color to convert.
 * @param out - Destination (`number[]`, `Float32Array`, ...). When omitted a
 * new `ColorTuple` is returned.
 * @param offset - Index in `out` of the first component to write.
 * @param options - Out-of-gamut handling (`clamp`).
 * @returns `out`, or a new tuple when `out` is omitted.
 * @example
 * ```ts
 * toLinearP3Array(parse('#ff8800')); // => [c0, c1, c2]
 *
 * // Write into an existing buffer, starting at element 6.
 * toLinearP3Array(color, buffer, 6);
 * ```
 */
export function toLinearP3Array(
  color: Color,
  out?: undefined,
  offset?: number,
  options?: ArrayWriteOptions,
): ColorTuple;
export function toLinearP3Array<T extends WritableArrayLike>(
  color: Color,
  out: T,
  offset?: number,
  options?: ArrayWriteOptions,
): T;
export function toLinearP3Array(
  color: Color,
  out?: WritableArrayLike,
  offset = 0,
  options?: ArrayWriteOptions,
): WritableArrayLike {
  return write(writeLinearP3, true, 3, color, out, offset, options);
}

/**
 * Write a color as linear-light Display P3
 * `[r, g, b]` (0–1 in the P3 gamut).
 *
 * Alpha is written as the fourth component: `[c0, c1, c2, alpha]`.
 *
 * Values are unclamped floats by default, so out-of-gamut colors produce
 * channels outside 0–1 (correct for HDR/linear pipelines, and what three.js
 * does). Pass `{ clamp: true }` to clip, or gamut-map first to reduce
 * chroma instead: `toLinearP3Array4(toSrgbGamut(color), out)` (or `toP3Gamut`).
 *
 * @param color - Color to convert.
 * @param out - Destination (`number[]`, `Float32Array`, ...). When omitted a
 * new `ColorTuple4` is returned.
 * @param offset - Index in `out` of the first component to write.
 * @param options - Out-of-gamut handling (`clamp`).
 * @returns `out`, or a new tuple when `out` is omitted.
 * @example
 * ```ts
 * // vec4 uniform: [c0, c1, c2, alpha]
 * const scratch = new Float32Array(4);
 * gl.uniform4fv(loc, toLinearP3Array4(color, scratch));
 * ```
 */
export function toLinearP3Array4(
  color: Color,
  out?: undefined,
  offset?: number,
  options?: ArrayWriteOptions,
): ColorTuple4;
export function toLinearP3Array4<T extends WritableArrayLike>(
  color: Color,
  out: T,
  offset?: number,
  options?: ArrayWriteOptions,
): T;
export function toLinearP3Array4(
  color: Color,
  out?: WritableArrayLike,
  offset = 0,
  options?: ArrayWriteOptions,
): WritableArrayLike {
  return write(writeLinearP3, true, 4, color, out, offset, options);
}

/**
 * Write a color as gamma-encoded Display P3
 * `[r, g, b]`, 0–1 in gamut, for
 * `display-p3` canvases and WebGPU contexts configured with
 * `colorSpace: 'display-p3'`.
 *
 * Values are unclamped floats by default, so out-of-gamut colors produce
 * channels outside 0–1 (correct for HDR/linear pipelines, and what three.js
 * does). Pass `{ clamp: true }` to clip, or gamut-map first to reduce
 * chroma instead: `toP3Array(toSrgbGamut(color), out)` (or `toP3Gamut`).
 *
 * @param color - Color to convert.
 * @param out - Destination (`number[]`, `Float32Array`, ...). When omitted a
 * new `ColorTuple` is returned.
 * @param offset - Index in `out` of the first component to write.
 * @param options - Out-of-gamut handling (`clamp`).
 * @returns `out`, or a new tuple when `out` is omitted.
 * @example
 * ```ts
 * toP3Array(parse('#ff8800')); // => [c0, c1, c2]
 *
 * // Write into an existing buffer, starting at element 6.
 * toP3Array(color, buffer, 6);
 * ```
 */
export function toP3Array(
  color: Color,
  out?: undefined,
  offset?: number,
  options?: ArrayWriteOptions,
): ColorTuple;
export function toP3Array<T extends WritableArrayLike>(
  color: Color,
  out: T,
  offset?: number,
  options?: ArrayWriteOptions,
): T;
export function toP3Array(
  color: Color,
  out?: WritableArrayLike,
  offset = 0,
  options?: ArrayWriteOptions,
): WritableArrayLike {
  return write(writeP3, true, 3, color, out, offset, options);
}

/**
 * Write a color as gamma-encoded Display P3
 * `[r, g, b]`, 0–1 in gamut, for
 * `display-p3` canvases and WebGPU contexts configured with
 * `colorSpace: 'display-p3'`.
 *
 * Alpha is written as the fourth component: `[c0, c1, c2, alpha]`.
 *
 * Values are unclamped floats by default, so out-of-gamut colors produce
 * channels outside 0–1 (correct for HDR/linear pipelines, and what three.js
 * does). Pass `{ clamp: true }` to clip, or gamut-map first to reduce
 * chroma instead: `toP3Array4(toSrgbGamut(color), out)` (or `toP3Gamut`).
 *
 * @param color - Color to convert.
 * @param out - Destination (`number[]`, `Float32Array`, ...). When omitted a
 * new `ColorTuple4` is returned.
 * @param offset - Index in `out` of the first component to write.
 * @param options - Out-of-gamut handling (`clamp`).
 * @returns `out`, or a new tuple when `out` is omitted.
 * @example
 * ```ts
 * // vec4 uniform: [c0, c1, c2, alpha]
 * const scratch = new Float32Array(4);
 * gl.uniform4fv(loc, toP3Array4(color, scratch));
 * ```
 */
export function toP3Array4(
  color: Color,
  out?: undefined,
  offset?: number,
  options?: ArrayWriteOptions,
): ColorTuple4;
export function toP3Array4<T extends WritableArrayLike>(
  color: Color,
  out: T,
  offset?: number,
  options?: ArrayWriteOptions,
): T;
export function toP3Array4(
  color: Color,
  out?: WritableArrayLike,
  offset = 0,
  options?: ArrayWriteOptions,
): WritableArrayLike {
  return write(writeP3, true, 4, color, out, offset, options);
}

/**
 * Write a color as OKLab
 * `[L, a, b]`.
 *
 * `clamp` is a no-op for this space.
 *
 * @param color - Color to convert.
 * @param out - Destination (`number[]`, `Float32Array`, ...). When omitted a
 * new `ColorTuple` is returned.
 * @param offset - Index in `out` of the first component to write.
 * @param options - Out-of-gamut handling (`clamp`).
 * @returns `out`, or a new tuple when `out` is omitted.
 * @example
 * ```ts
 * toOklabArray(parse('#ff8800')); // => [c0, c1, c2]
 *
 * // Write into an existing buffer, starting at element 6.
 * toOklabArray(color, buffer, 6);
 * ```
 */
export function toOklabArray(
  color: Color,
  out?: undefined,
  offset?: number,
  options?: ArrayWriteOptions,
): ColorTuple;
export function toOklabArray<T extends WritableArrayLike>(
  color: Color,
  out: T,
  offset?: number,
  options?: ArrayWriteOptions,
): T;
export function toOklabArray(
  color: Color,
  out?: WritableArrayLike,
  offset = 0,
  options?: ArrayWriteOptions,
): WritableArrayLike {
  return write(writeOklab, false, 3, color, out, offset, options);
}

/**
 * Write a color as OKLab
 * `[L, a, b]`.
 *
 * Alpha is written as the fourth component: `[c0, c1, c2, alpha]`.
 *
 * `clamp` is a no-op for this space.
 *
 * @param color - Color to convert.
 * @param out - Destination (`number[]`, `Float32Array`, ...). When omitted a
 * new `ColorTuple4` is returned.
 * @param offset - Index in `out` of the first component to write.
 * @param options - Out-of-gamut handling (`clamp`).
 * @returns `out`, or a new tuple when `out` is omitted.
 * @example
 * ```ts
 * // vec4 uniform: [c0, c1, c2, alpha]
 * const scratch = new Float32Array(4);
 * gl.uniform4fv(loc, toOklabArray4(color, scratch));
 * ```
 */
export function toOklabArray4(
  color: Color,
  out?: undefined,
  offset?: number,
  options?: ArrayWriteOptions,
): ColorTuple4;
export function toOklabArray4<T extends WritableArrayLike>(
  color: Color,
  out: T,
  offset?: number,
  options?: ArrayWriteOptions,
): T;
export function toOklabArray4(
  color: Color,
  out?: WritableArrayLike,
  offset = 0,
  options?: ArrayWriteOptions,
): WritableArrayLike {
  return write(writeOklab, false, 4, color, out, offset, options);
}

/**
 * Write a color as OKLCH
 * `[l, c, h]`, with hue in degrees
 * copied from the color as-is.
 *
 * `clamp` is a no-op for this space.
 *
 * @param color - Color to convert.
 * @param out - Destination (`number[]`, `Float32Array`, ...). When omitted a
 * new `ColorTuple` is returned.
 * @param offset - Index in `out` of the first component to write.
 * @param options - Out-of-gamut handling (`clamp`).
 * @returns `out`, or a new tuple when `out` is omitted.
 * @example
 * ```ts
 * toOklchArray(parse('#ff8800')); // => [c0, c1, c2]
 *
 * // Write into an existing buffer, starting at element 6.
 * toOklchArray(color, buffer, 6);
 * ```
 */
export function toOklchArray(
  color: Color,
  out?: undefined,
  offset?: number,
  options?: ArrayWriteOptions,
): ColorTuple;
export function toOklchArray<T extends WritableArrayLike>(
  color: Color,
  out: T,
  offset?: number,
  options?: ArrayWriteOptions,
): T;
export function toOklchArray(
  color: Color,
  out?: WritableArrayLike,
  offset = 0,
  options?: ArrayWriteOptions,
): WritableArrayLike {
  return write(writeOklch, false, 3, color, out, offset, options);
}

/**
 * Write a color as OKLCH
 * `[l, c, h]`, with hue in degrees
 * copied from the color as-is.
 *
 * Alpha is written as the fourth component: `[c0, c1, c2, alpha]`.
 *
 * `clamp` is a no-op for this space.
 *
 * @param color - Color to convert.
 * @param out - Destination (`number[]`, `Float32Array`, ...). When omitted a
 * new `ColorTuple4` is returned.
 * @param offset - Index in `out` of the first component to write.
 * @param options - Out-of-gamut handling (`clamp`).
 * @returns `out`, or a new tuple when `out` is omitted.
 * @example
 * ```ts
 * // vec4 uniform: [c0, c1, c2, alpha]
 * const scratch = new Float32Array(4);
 * gl.uniform4fv(loc, toOklchArray4(color, scratch));
 * ```
 */
export function toOklchArray4(
  color: Color,
  out?: undefined,
  offset?: number,
  options?: ArrayWriteOptions,
): ColorTuple4;
export function toOklchArray4<T extends WritableArrayLike>(
  color: Color,
  out: T,
  offset?: number,
  options?: ArrayWriteOptions,
): T;
export function toOklchArray4(
  color: Color,
  out?: WritableArrayLike,
  offset = 0,
  options?: ArrayWriteOptions,
): WritableArrayLike {
  return write(writeOklch, false, 4, color, out, offset, options);
}
