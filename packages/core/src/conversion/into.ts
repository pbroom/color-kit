/**
 * Allocation-free (`out`-first) conversions between the internal Color
 * (OKLCH) and OKLab, linear sRGB, sRGB and Display P3.
 *
 * Every function writes its result into the caller-supplied `out` object and
 * returns it. No result or intermediate objects are created: intermediate
 * stages go through module-level scratch objects that never escape. (Engines
 * may still box the numbers written into object fields in code they do not
 * fully optimize, so measure at the call site.) Results
 * are bit-identical to the allocating counterparts (`toRgb`, `fromRgb`, ...),
 * which are thin wrappers over these kernels.
 *
 * Use these in per-pixel or per-frame loops; everywhere else the allocating
 * API is simpler and just as correct.
 */

import type { Color, LinearRgb, Oklab, P3, Rgb } from '../types.js';
import { linearRgbToOklabInto, oklabToLinearRgbInto } from './oklab.js';
import { oklabToOklchInto, oklchToOklabInto } from './oklch.js';
import {
  linearP3ToLinearSrgbInto,
  linearP3ToP3Into,
  linearSrgbToLinearP3Into,
  p3ToLinearP3Into,
} from './p3.js';
import { linearToSrgbInto, srgbToLinearInto } from './srgb.js';

// Scratch objects for intermediate pipeline stages, shared by every function
// here. Re-entrancy: a caller's input may be an object with accessors whose
// getters run another conversion (which rewrites this scratch). Every kernel
// therefore reads all of its input fields into locals before it writes any
// output, and only the first stage of a pipeline reads caller input, so a
// nested call can only run before this call's scratch is written.
const LAB: Oklab = { L: 0, a: 0, b: 0, alpha: 1 };
const LINEAR: LinearRgb = { r: 0, g: 0, b: 0, alpha: 1 };
const LINEAR_P3: P3 = { r: 0, g: 0, b: 0, alpha: 1 };

/**
 * Convert a Color to OKLab, writing into `out` (allocation-free).
 * Bit-identical to {@link toOklab}.
 *
 * @param out - Object to write the result into
 * @param color - Color to convert
 * @returns `out`
 *
 * @example
 * ```ts
 * import { parse, toOklabInto } from 'color-kit';
 *
 * const lab = { L: 0, a: 0, b: 0, alpha: 1 };
 * toOklabInto(lab, parse('#3b82f6'));
 * lab.L; // → ≈ 0.6231
 * ```
 */
export function toOklabInto(out: Oklab, color: Color): Oklab {
  return oklchToOklabInto(out, color);
}

/**
 * Convert OKLab to a Color (OKLCH), writing into `out` (allocation-free).
 * Bit-identical to {@link fromOklab}.
 *
 * @param out - Color to write the result into
 * @param lab - OKLab color
 * @returns `out`
 *
 * @example
 * ```ts
 * import { fromOklabInto } from 'color-kit';
 *
 * const color = { l: 0, c: 0, h: 0, alpha: 1 };
 * fromOklabInto(color, { L: 0.7, a: 0, b: 0.1, alpha: 1 });
 * color; // → { l: 0.7, c: 0.1, h: 90, alpha: 1 }
 * ```
 */
export function fromOklabInto(out: Color, lab: Oklab): Color {
  return oklabToOklchInto(out, lab);
}

/**
 * Convert a Color to unclamped linear-light sRGB (0-1, may fall outside that
 * range for out-of-gamut colors), writing into `out` (allocation-free).
 *
 * @param out - Object to write the result into
 * @param color - Color to convert
 * @returns `out`
 * @see {@link isLinearRgbInGamut}
 *
 * @example
 * ```ts
 * import { parse, toLinearSrgbInto } from 'color-kit';
 *
 * const linear = { r: 0, g: 0, b: 0, alpha: 1 };
 * toLinearSrgbInto(linear, parse('color(display-p3 1 0 0)'));
 * linear.r; // → ≈ 1.2249 (outside sRGB, not clipped)
 * ```
 */
export function toLinearSrgbInto(out: LinearRgb, color: Color): LinearRgb {
  return oklabToLinearRgbInto(out, oklchToOklabInto(LAB, color));
}

/**
 * Convert linear-light sRGB to a Color, writing into `out`
 * (allocation-free). Inputs are not clamped.
 *
 * @param out - Color to write the result into
 * @param linear - Linear-light sRGB color
 * @returns `out`
 *
 * @example
 * ```ts
 * import { fromLinearSrgbInto, toHex } from 'color-kit';
 *
 * const color = { l: 0, c: 0, h: 0, alpha: 1 };
 * fromLinearSrgbInto(color, { r: 1, g: 0.2, b: 0, alpha: 1 });
 * toHex(color); // → '#ff7c00'
 * ```
 */
export function fromLinearSrgbInto(out: Color, linear: LinearRgb): Color {
  return oklabToOklchInto(out, linearRgbToOklabInto(LAB, linear));
}

/**
 * Convert a Color to sRGB (0-255, rounded and clamped like {@link toRgb}),
 * writing into `out` (allocation-free).
 *
 * @param out - Object to write the result into
 * @param color - Color to convert
 * @returns `out`
 *
 * @example
 * ```ts
 * import { parse, toRgbInto } from 'color-kit';
 *
 * const rgb = { r: 0, g: 0, b: 0, alpha: 1 };
 * toRgbInto(rgb, parse('oklch(0.7 0.15 30)'));
 * rgb; // → { r: 237, g: 118, b: 101, alpha: 1 }
 * ```
 */
export function toRgbInto(out: Rgb, color: Color): Rgb {
  return linearToSrgbInto(out, toLinearSrgbInto(LINEAR, color));
}

/**
 * Convert sRGB (0-255) to a Color, writing into `out` (allocation-free).
 * Bit-identical to {@link fromRgb}.
 *
 * @param out - Color to write the result into
 * @param rgb - sRGB color
 * @returns `out`
 *
 * @example
 * ```ts
 * import { fromRgbInto, toCss } from 'color-kit';
 *
 * const color = { l: 0, c: 0, h: 0, alpha: 1 };
 * fromRgbInto(color, { r: 59, g: 130, b: 246, alpha: 1 });
 * toCss(color, 'oklch'); // → 'oklch(0.6231 0.188 259.81)'
 * ```
 */
export function fromRgbInto(out: Color, rgb: Rgb): Color {
  return fromLinearSrgbInto(out, srgbToLinearInto(LINEAR, rgb));
}

/**
 * Convert a Color to Display P3 (gamma-encoded, clamped to 0-1 like
 * {@link toP3}), writing into `out` (allocation-free).
 *
 * @param out - Object to write the result into
 * @param color - Color to convert
 * @returns `out`
 *
 * @example
 * ```ts
 * import { parse, toP3Into } from 'color-kit';
 *
 * const p3 = { r: 0, g: 0, b: 0, alpha: 1 };
 * toP3Into(p3, parse('#ff0000'));
 * p3; // → ≈ { r: 0.9175, g: 0.2003, b: 0.1386, alpha: 1 }
 * ```
 */
export function toP3Into(out: P3, color: Color): P3 {
  return linearP3ToP3Into(
    out,
    linearSrgbToLinearP3Into(LINEAR_P3, toLinearSrgbInto(LINEAR, color)),
  );
}

/**
 * Convert Display P3 (gamma-encoded, 0-1) to a Color, writing into `out`
 * (allocation-free). Bit-identical to {@link fromP3}.
 *
 * @param out - Color to write the result into
 * @param p3 - Gamma-encoded Display P3 color
 * @returns `out`
 *
 * @example
 * ```ts
 * import { fromP3Into, toCss } from 'color-kit';
 *
 * const color = { l: 0, c: 0, h: 0, alpha: 1 };
 * fromP3Into(color, { r: 1, g: 0, b: 0, alpha: 1 });
 * toCss(color, 'oklch'); // → 'oklch(0.6486 0.2995 28.96)'
 * ```
 */
export function fromP3Into(out: Color, p3: P3): Color {
  return fromLinearSrgbInto(
    out,
    linearP3ToLinearSrgbInto(LINEAR, p3ToLinearP3Into(LINEAR_P3, p3)),
  );
}
