import type { Color, LinearRgb, Oklab, P3 } from '../types.js';
import { oklabToOklchInto, oklchToOklabInto } from '../conversion/oklch.js';
import {
  linearRgbToOklabInto,
  oklabToLinearRgbInto,
} from '../conversion/oklab.js';
import {
  linearP3ToLinearSrgbInto,
  linearSrgbToLinearP3Into,
} from '../conversion/p3.js';
import {
  LMS_TO_LINEAR_P3,
  LMS_TO_LINEAR_SRGB,
} from '../conversion/matrices.js';
import { linearChannelsInGamut } from './linear-bounds.js';
import type { GamutMapMethod, GamutMapOptions, GamutTarget } from './types.js';

export { GAMUT_LINEAR_MAX, GAMUT_LINEAR_MIN } from './linear-bounds.js';

const LIGHTNESS_ENDPOINT_EPSILON = 1e-9;

export const OKLAB_TO_LINEAR_SRGB_ROWS = LMS_TO_LINEAR_SRGB;

// Composed matrix: linear-sRGB -> linear-P3 multiplied by OKLab(l,m,s) -> linear-sRGB.
export const OKLAB_TO_LINEAR_P3_ROWS = LMS_TO_LINEAR_P3;

export type TargetRow = readonly [number, number, number];
export type TargetRows = readonly [TargetRow, TargetRow, TargetRow];

// Scratch objects so membership checks and gamut mapping allocate nothing.
// Caller input is read (into locals, or by a kernel that reads all fields
// before writing) before any scratch is written, so an accessor on the input
// that re-enters these functions cannot corrupt an in-flight result.
const LAB: Oklab = { L: 0, a: 0, b: 0, alpha: 1 };
const LINEAR: LinearRgb = { r: 0, g: 0, b: 0, alpha: 1 };
const LINEAR_P3: P3 = { r: 0, g: 0, b: 0, alpha: 1 };
const TRIAL: Color = { l: 0, c: 0, h: 0, alpha: 1 };
const CLIPPED: Oklab = { L: 0, a: 0, b: 0, alpha: 1 };

/** CSS Color 4 gamut mapping: just-noticeable difference in deltaE OK. */
const CSS_JND = 0.02;
/** CSS Color 4 gamut mapping: chroma bisection precision. */
const CSS_EPSILON = 0.0001;

/** Unclamped linear sRGB of `color`, written into the shared scratch. */
function scratchLinearSrgb(color: Color): LinearRgb {
  return oklabToLinearRgbInto(LINEAR, oklchToOklabInto(LAB, color));
}

/** Unclamped linear sRGB (or linear P3) of `color`, in shared scratch. */
function scratchLinearTarget(color: Color, gamut: GamutTarget): LinearRgb {
  const linear = scratchLinearSrgb(color);
  return gamut === 'display-p3'
    ? linearSrgbToLinearP3Into(LINEAR_P3, linear)
    : linear;
}

export function isInTargetGamut(color: Color, gamut: GamutTarget): boolean {
  return gamut === 'display-p3' ? inP3Gamut(color) : inSrgbGamut(color);
}

export function getTargetRows(gamut: GamutTarget): TargetRows {
  return gamut === 'display-p3'
    ? OKLAB_TO_LINEAR_P3_ROWS
    : OKLAB_TO_LINEAR_SRGB_ROWS;
}

/**
 * Returns whether unclamped linear-light RGB channels (linear sRGB or linear
 * Display P3, which share the sRGB transfer function) lie inside the unit
 * cube, allowing {@link GAMUT_EPSILON} of slack on the gamma-encoded
 * channels: each channel must be within
 * [{@link GAMUT_LINEAR_MIN}, {@link GAMUT_LINEAR_MAX}].
 *
 * This is the membership rule behind {@link inSrgbGamut} /
 * {@link inP3Gamut}, exposed for hot loops (e.g. per-pixel canvas rendering)
 * that already hold linear channels and want to avoid re-converting from
 * OKLCH. Allocation-free.
 *
 * @param r - Linear red channel.
 * @param g - Linear green channel.
 * @param b - Linear blue channel.
 *
 * @example
 * ```ts
 * import { isLinearRgbInGamut } from 'color-kit';
 *
 * isLinearRgbInGamut(0, 0.5, 1); // → true
 * isLinearRgbInGamut(1.0001, 0.5, 0.2); // → true (within the epsilon slack)
 * isLinearRgbInGamut(-0.001, 0, 0); // → false
 * ```
 */
export function isLinearRgbInGamut(r: number, g: number, b: number): boolean {
  return linearChannelsInGamut(r, g, b);
}

/**
 * Returns whether an OKLCH color is inside the sRGB gamut.
 *
 * Tests the unclamped linear sRGB channels with {@link isLinearRgbInGamut}
 * (so clamping in `toRgb` cannot produce a false positive), allowing
 * {@link GAMUT_EPSILON} of slack on the encoded channels. Allocation-free.
 *
 * @see {@link inP3Gamut}
 * @see {@link toSrgbGamut}
 *
 * @example
 * ```ts
 * import { inSrgbGamut } from 'color-kit';
 *
 * inSrgbGamut({ l: 0.7, c: 0.1, h: 150, alpha: 1 }); // → true
 * inSrgbGamut({ l: 0.7, c: 0.2, h: 150, alpha: 1 }); // → false
 * ```
 */
export function inSrgbGamut(color: Color): boolean {
  const linear = scratchLinearSrgb(color);
  return isLinearRgbInGamut(linear.r, linear.g, linear.b);
}

/**
 * Returns whether an OKLCH color is inside the Display P3 gamut.
 *
 * Tests the unclamped linear Display P3 channels with
 * {@link isLinearRgbInGamut} (so clamping in `toP3` cannot produce a false
 * positive), allowing {@link GAMUT_EPSILON} of slack on the encoded
 * channels. Allocation-free.
 *
 * @see {@link inSrgbGamut}
 * @see {@link toP3Gamut}
 *
 * @example
 * ```ts
 * import { inP3Gamut, inSrgbGamut } from 'color-kit';
 *
 * const green = { l: 0.7, c: 0.2, h: 150, alpha: 1 };
 * inP3Gamut(green); // → true
 * inSrgbGamut(green); // → false
 * ```
 */
export function inP3Gamut(color: Color): boolean {
  const linearP3 = scratchLinearTarget(color, 'display-p3');
  return isLinearRgbInGamut(linearP3.r, linearP3.g, linearP3.b);
}

function strictlyInTargetGamut(color: Color, gamut: GamutTarget): boolean {
  const target = scratchLinearTarget(color, gamut);
  return (
    target.r >= 0 &&
    target.r <= 1 &&
    target.g >= 0 &&
    target.g <= 1 &&
    target.b >= 0 &&
    target.b <= 1
  );
}

/**
 * Clip `color` to `gamut` (clamping linear channels to `[0, 1]`), writing
 * the clipped color's OKLab into `out`, and return the deltaE OK between
 * `color` and the clipped color.
 */
function clipToGamutLab(out: Oklab, color: Color, gamut: GamutTarget): number {
  const lab = oklchToOklabInto(LAB, color);
  const L = lab.L;
  const a = lab.a;
  const b = lab.b;
  const target = scratchLinearTarget(color, gamut);
  target.r = Math.min(Math.max(target.r, 0), 1);
  target.g = Math.min(Math.max(target.g, 0), 1);
  target.b = Math.min(Math.max(target.b, 0), 1);
  const linear =
    gamut === 'display-p3' ? linearP3ToLinearSrgbInto(LINEAR, target) : target;
  linearRgbToOklabInto(out, linear);
  const dL = out.L - L;
  const da = out.a - a;
  const db = out.b - b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * CSS Color 4 gamut mapping (binary search with local MINDE), on `trial`
 * which is out of gamut and holds the input. Writes the result into `out`.
 *
 * Bisects OKLCH chroma at fixed L and h, but accepts a chroma as soon as
 * clipping it into the gamut moves the color by less than the JND (0.02
 * deltaE OK), and returns that clipped color. The result keeps more chroma
 * than pure chroma reduction, at the cost of small L and h shifts.
 *
 * @see https://www.w3.org/TR/css-color-4/#binsearch
 */
function cssMapToGamutInto(
  out: Color,
  trial: Color,
  gamut: GamutTarget,
): Color {
  const alpha = trial.alpha;
  let deltaE = clipToGamutLab(CLIPPED, trial, gamut);
  if (deltaE >= CSS_JND) {
    let min = 0;
    let max = trial.c;
    let minInGamut = true;
    while (max - min > CSS_EPSILON) {
      const chroma = (min + max) / 2;
      trial.c = chroma;
      if (minInGamut && strictlyInTargetGamut(trial, gamut)) {
        min = chroma;
        continue;
      }
      deltaE = clipToGamutLab(CLIPPED, trial, gamut);
      if (deltaE < CSS_JND) {
        if (CSS_JND - deltaE < CSS_EPSILON) break;
        minInGamut = false;
        min = chroma;
      } else {
        max = chroma;
      }
    }
  }
  oklabToOklchInto(out, CLIPPED);
  out.alpha = alpha;
  return out;
}

/**
 * Map `color` into `gamut`, writing l/c/h/alpha into `out`. `out` may be the
 * same object as `color`.
 *
 * Colors that pass the membership check (`inSrgbGamut` / `inP3Gamut`,
 * including its GAMUT_EPSILON slack) are returned unchanged by every method,
 * as are the lightness endpoints (snapped to black / white).
 *
 * `'chroma-reduction'` bisects OKLCH chroma (at fixed L and h) down to the
 * target gamut boundary. Candidates are accepted only when *strictly* inside
 * the gamut. The GAMUT_EPSILON slack used by membership checks is meant to
 * absorb float noise on colors that are already in gamut; letting the search
 * settle inside that slack would return out-of-gamut colors, and near black
 * the slack spans a large chroma range.
 *
 * `'css'` runs the CSS Color 4 algorithm (see `cssMapToGamutInto`).
 */
function mapToGamutInto(
  out: Color,
  color: Color,
  gamut: GamutTarget,
  method: GamutMapMethod,
): Color {
  const l = color.l;
  const c = color.c;
  const h = color.h;
  const alpha = color.alpha;

  if (l <= LIGHTNESS_ENDPOINT_EPSILON || l >= 1 - LIGHTNESS_ENDPOINT_EPSILON) {
    out.l = l <= LIGHTNESS_ENDPOINT_EPSILON ? 0 : 1;
    out.c = 0;
    out.h = h;
    out.alpha = alpha;
    return out;
  }

  // From here on work only from the snapshot above, never `color` again.
  const trial = TRIAL;
  trial.l = l;
  trial.c = c;
  trial.h = h;
  trial.alpha = alpha;

  let mappedC = c;
  if (!isInTargetGamut(trial, gamut)) {
    if (method === 'css') {
      return cssMapToGamutInto(out, trial, gamut);
    }

    trial.c = 0;

    let lo = 0;
    let hi = c;
    mappedC = strictlyInTargetGamut(trial, gamut) ? 0 : c;

    const epsilon = 0.0001;
    while (hi - lo > epsilon) {
      const mid = (lo + hi) / 2;
      trial.c = mid;
      if (strictlyInTargetGamut(trial, gamut)) {
        lo = mid;
        mappedC = mid;
      } else {
        hi = mid;
      }
    }
  }

  out.l = l;
  out.c = mappedC;
  out.h = h;
  out.alpha = alpha;
  return out;
}

function resolveMethod(options: GamutMapOptions | undefined): GamutMapMethod {
  // `options` may be a non-object when the function is passed straight to
  // `Array.prototype.map` (which supplies the index); treat that as unset.
  return options?.method === 'css' ? 'css' : 'chroma-reduction';
}

/**
 * Map a Color to the sRGB gamut, writing the result into `out`
 * (allocation-free). Same algorithm and bit-identical result as
 * `toSrgbGamut`; `out` may be the same object as `color`.
 *
 * @param options.method - `'chroma-reduction'` (default) or `'css'`; see
 *   `toSrgbGamut()`
 *
 * @example
 * ```ts
 * import { toSrgbGamutInto } from 'color-kit';
 *
 * const mapped = { l: 0, c: 0, h: 0, alpha: 1 };
 * toSrgbGamutInto(mapped, { l: 0.7, c: 0.35, h: 150, alpha: 1 });
 * mapped; // → { l: 0.7, c: ≈ 0.1928, h: 150, alpha: 1 }
 * ```
 */
export function toSrgbGamutInto(
  out: Color,
  color: Color,
  options?: GamutMapOptions,
): Color {
  return mapToGamutInto(out, color, 'srgb', resolveMethod(options));
}

/**
 * Map a Color to the Display P3 gamut, writing the result into `out`
 * (allocation-free). Same algorithm and bit-identical result as
 * `toP3Gamut`; `out` may be the same object as `color`.
 *
 * @param options.method - `'chroma-reduction'` (default) or `'css'`; see
 *   `toSrgbGamut()`
 *
 * @example
 * ```ts
 * import { toP3GamutInto } from 'color-kit';
 *
 * const mapped = { l: 0, c: 0, h: 0, alpha: 1 };
 * toP3GamutInto(mapped, { l: 0.7, c: 0.4, h: 150, alpha: 1 });
 * mapped; // → { l: 0.7, c: ≈ 0.2689, h: 150, alpha: 1 }
 * ```
 */
export function toP3GamutInto(
  out: Color,
  color: Color,
  options?: GamutMapOptions,
): Color {
  return mapToGamutInto(out, color, 'display-p3', resolveMethod(options));
}

/**
 * Map a Color to the sRGB gamut.
 *
 * Colors already in gamut (per `inSrgbGamut`, with its GAMUT_EPSILON slack)
 * are returned unchanged. Otherwise `options.method` picks the algorithm:
 *
 * - `'chroma-reduction'` (default): binary search for the largest in-gamut
 *   OKLCH chroma at the same lightness and hue. Lightness and hue are
 *   preserved exactly, which plane geometry, contrast regions and slider
 *   tracks rely on.
 * - `'css'`: the CSS Color 4 gamut mapping algorithm (chroma bisection with
 *   a 0.02 deltaE OK just-noticeable-difference clip), as browsers and
 *   colorjs.io `toGamut({ method: 'css' })` define it. Keeps more chroma
 *   (e.g. `oklch(0.7 0.35 150)` maps to chroma ~0.210 instead of ~0.193),
 *   at the cost of small lightness and hue shifts. Matches colorjs.io
 *   outside the GAMUT_EPSILON tolerance band; colors inside the band are
 *   returned unchanged, while colorjs.io (epsilon 0) still maps them, so
 *   results can differ slightly there (up to ~0.014 deltaE OK near black).
 *
 * @example
 * ```ts
 * import { toSrgbGamut } from 'color-kit';
 *
 * const vivid = { l: 0.7, c: 0.35, h: 150, alpha: 1 };
 * toSrgbGamut(vivid); // → { l: 0.7, c: ≈ 0.1928, h: 150, alpha: 1 }
 * toSrgbGamut(vivid, { method: 'css' }).c; // → ≈ 0.2104 (l, h shift slightly)
 * ```
 */
export function toSrgbGamut(color: Color): Color;
export function toSrgbGamut(
  color: Color,
  options: GamutMapOptions | undefined,
): Color;
export function toSrgbGamut(color: Color, options?: GamutMapOptions): Color {
  return toSrgbGamutInto({ ...color }, color, options);
}

/**
 * Map a Color to the Display P3 gamut. Same methods and options as
 * {@link toSrgbGamut}; the default reduces OKLCH chroma at fixed L and h.
 *
 * Colors already in gamut (per {@link inP3Gamut}) are returned unchanged.
 * Returns a new object.
 *
 * @see {@link toP3GamutInto}
 *
 * @example
 * ```ts
 * import { toP3Gamut } from 'color-kit';
 *
 * toP3Gamut({ l: 0.7, c: 0.35, h: 150, alpha: 1 });
 * // → { l: 0.7, c: ≈ 0.2689, h: 150, alpha: 1 }
 * ```
 */
export function toP3Gamut(color: Color): Color;
export function toP3Gamut(
  color: Color,
  options: GamutMapOptions | undefined,
): Color;
export function toP3Gamut(color: Color, options?: GamutMapOptions): Color {
  return toP3GamutInto({ ...color }, color, options);
}
