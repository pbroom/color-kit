import type { Color } from '../types.js';
import {
  readLinearP3,
  readLinearSrgb,
  readOklab,
  readOklch,
  readP3,
  readSrgb,
} from './read-kernels.js';

/**
 * Read a color from linear-light sRGB `[r, g, b]`
 * stored in any array-like (`number[]`, `Float32Array`, ...).
 * Alpha is `1`; use
 * `fromLinearSrgbArray4` to read `[c0, c1, c2, alpha]`.
 *
 * @param array - Source array.
 * @param offset - Index in `array` of the first component.
 * @returns A new `Color` (OKLCH).
 * @example
 * ```ts
 * const color = fromLinearSrgbArray(threeColor.toArray());
 * ```
 */
export function fromLinearSrgbArray(
  array: ArrayLike<number>,
  offset = 0,
): Color {
  return readLinearSrgb(array, offset, 1);
}

/**
 * Read a color from linear-light sRGB `[r, g, b]`
 * stored in any array-like (`number[]`, `Float32Array`, ...).
 * Alpha is read from the fourth
 * component: `[c0, c1, c2, alpha]`.
 *
 * @param array - Source array.
 * @param offset - Index in `array` of the first component.
 * @returns A new `Color` (OKLCH).
 * @example
 * ```ts
 * const color = fromLinearSrgbArray4(buffer, 8);
 * ```
 */
export function fromLinearSrgbArray4(
  array: ArrayLike<number>,
  offset = 0,
): Color {
  return readLinearSrgb(array, offset, array[offset + 3]);
}

/**
 * Read a color from gamma-encoded sRGB `[r, g, b]` (0–1)
 * stored in any array-like (`number[]`, `Float32Array`, ...).
 * Alpha is `1`; use
 * `fromSrgbArray4` to read `[c0, c1, c2, alpha]`.
 *
 * @param array - Source array.
 * @param offset - Index in `array` of the first component.
 * @returns A new `Color` (OKLCH).
 * @example
 * ```ts
 * const color = fromSrgbArray(buffer, 6);
 * ```
 */
export function fromSrgbArray(array: ArrayLike<number>, offset = 0): Color {
  return readSrgb(array, offset, 1);
}

/**
 * Read a color from gamma-encoded sRGB `[r, g, b]` (0–1)
 * stored in any array-like (`number[]`, `Float32Array`, ...).
 * Alpha is read from the fourth
 * component: `[c0, c1, c2, alpha]`.
 *
 * @param array - Source array.
 * @param offset - Index in `array` of the first component.
 * @returns A new `Color` (OKLCH).
 * @example
 * ```ts
 * const color = fromSrgbArray4(buffer, 8);
 * ```
 */
export function fromSrgbArray4(array: ArrayLike<number>, offset = 0): Color {
  return readSrgb(array, offset, array[offset + 3]);
}

/**
 * Read a color from linear-light Display P3 `[r, g, b]`
 * stored in any array-like (`number[]`, `Float32Array`, ...).
 * Alpha is `1`; use
 * `fromLinearP3Array4` to read `[c0, c1, c2, alpha]`.
 *
 * @param array - Source array.
 * @param offset - Index in `array` of the first component.
 * @returns A new `Color` (OKLCH).
 * @example
 * ```ts
 * const color = fromLinearP3Array(buffer, 6);
 * ```
 */
export function fromLinearP3Array(array: ArrayLike<number>, offset = 0): Color {
  return readLinearP3(array, offset, 1);
}

/**
 * Read a color from linear-light Display P3 `[r, g, b]`
 * stored in any array-like (`number[]`, `Float32Array`, ...).
 * Alpha is read from the fourth
 * component: `[c0, c1, c2, alpha]`.
 *
 * @param array - Source array.
 * @param offset - Index in `array` of the first component.
 * @returns A new `Color` (OKLCH).
 * @example
 * ```ts
 * const color = fromLinearP3Array4(buffer, 8);
 * ```
 */
export function fromLinearP3Array4(
  array: ArrayLike<number>,
  offset = 0,
): Color {
  return readLinearP3(array, offset, array[offset + 3]);
}

/**
 * Read a color from gamma-encoded Display P3 `[r, g, b]` (0–1)
 * stored in any array-like (`number[]`, `Float32Array`, ...).
 * Alpha is `1`; use
 * `fromP3Array4` to read `[c0, c1, c2, alpha]`.
 *
 * @param array - Source array.
 * @param offset - Index in `array` of the first component.
 * @returns A new `Color` (OKLCH).
 * @example
 * ```ts
 * const color = fromP3Array(buffer, 6);
 * ```
 */
export function fromP3Array(array: ArrayLike<number>, offset = 0): Color {
  return readP3(array, offset, 1);
}

/**
 * Read a color from gamma-encoded Display P3 `[r, g, b]` (0–1)
 * stored in any array-like (`number[]`, `Float32Array`, ...).
 * Alpha is read from the fourth
 * component: `[c0, c1, c2, alpha]`.
 *
 * @param array - Source array.
 * @param offset - Index in `array` of the first component.
 * @returns A new `Color` (OKLCH).
 * @example
 * ```ts
 * const color = fromP3Array4(buffer, 8);
 * ```
 */
export function fromP3Array4(array: ArrayLike<number>, offset = 0): Color {
  return readP3(array, offset, array[offset + 3]);
}

/**
 * Read a color from OKLab `[L, a, b]`
 * stored in any array-like (`number[]`, `Float32Array`, ...).
 * Alpha is `1`; use
 * `fromOklabArray4` to read `[c0, c1, c2, alpha]`.
 *
 * @param array - Source array.
 * @param offset - Index in `array` of the first component.
 * @returns A new `Color` (OKLCH).
 * @example
 * ```ts
 * const color = fromOklabArray(buffer, 6);
 * ```
 */
export function fromOklabArray(array: ArrayLike<number>, offset = 0): Color {
  return readOklab(array, offset, 1);
}

/**
 * Read a color from OKLab `[L, a, b]`
 * stored in any array-like (`number[]`, `Float32Array`, ...).
 * Alpha is read from the fourth
 * component: `[c0, c1, c2, alpha]`.
 *
 * @param array - Source array.
 * @param offset - Index in `array` of the first component.
 * @returns A new `Color` (OKLCH).
 * @example
 * ```ts
 * const color = fromOklabArray4(buffer, 8);
 * ```
 */
export function fromOklabArray4(array: ArrayLike<number>, offset = 0): Color {
  return readOklab(array, offset, array[offset + 3]);
}

/**
 * Read a color from OKLCH `[l, c, h]`
 * stored in any array-like (`number[]`, `Float32Array`, ...).
 * Alpha is `1`; use
 * `fromOklchArray4` to read `[c0, c1, c2, alpha]`.
 *
 * @param array - Source array.
 * @param offset - Index in `array` of the first component.
 * @returns A new `Color` (OKLCH).
 * @example
 * ```ts
 * const color = fromOklchArray(buffer, 6);
 * ```
 */
export function fromOklchArray(array: ArrayLike<number>, offset = 0): Color {
  return readOklch(array, offset, 1);
}

/**
 * Read a color from OKLCH `[l, c, h]`
 * stored in any array-like (`number[]`, `Float32Array`, ...).
 * Alpha is read from the fourth
 * component: `[c0, c1, c2, alpha]`.
 *
 * @param array - Source array.
 * @param offset - Index in `array` of the first component.
 * @returns A new `Color` (OKLCH).
 * @example
 * ```ts
 * const color = fromOklchArray4(buffer, 8);
 * ```
 */
export function fromOklchArray4(array: ArrayLike<number>, offset = 0): Color {
  return readOklch(array, offset, array[offset + 3]);
}
