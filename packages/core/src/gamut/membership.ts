import type { Color, LinearRgb, Oklab, P3 } from '../types.js';
import { oklchToOklabInto } from '../conversion/oklch.js';
import { oklabToLinearRgbInto } from '../conversion/oklab.js';
import { linearSrgbToLinearP3Into } from '../conversion/p3.js';
import {
  LMS_TO_LINEAR_P3,
  LMS_TO_LINEAR_SRGB,
} from '../conversion/matrices.js';
import { linearChannelsInGamut } from './linear-bounds.js';
import type { GamutTarget } from './types.js';

export { GAMUT_LINEAR_MAX, GAMUT_LINEAR_MIN } from './linear-bounds.js';

const LIGHTNESS_ENDPOINT_EPSILON = 1e-9;

export const OKLAB_TO_LINEAR_SRGB_ROWS = LMS_TO_LINEAR_SRGB;

// Composed matrix: linear-sRGB -> linear-P3 multiplied by OKLab(l,m,s) -> linear-sRGB.
export const OKLAB_TO_LINEAR_P3_ROWS = LMS_TO_LINEAR_P3;

export type TargetRow = readonly [number, number, number];
export type TargetRows = readonly [TargetRow, TargetRow, TargetRow];

// Scratch objects so membership checks and gamut mapping allocate nothing.
// JS is single-threaded and nothing here calls back into user code.
const LAB: Oklab = { L: 0, a: 0, b: 0, alpha: 1 };
const LINEAR: LinearRgb = { r: 0, g: 0, b: 0, alpha: 1 };
const LINEAR_P3: P3 = { r: 0, g: 0, b: 0, alpha: 1 };
const TRIAL: Color = { l: 0, c: 0, h: 0, alpha: 1 };

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
 * Checks linear-light RGB channels (linear sRGB or linear Display P3, which
 * share the sRGB transfer function) against the unit cube, allowing
 * `GAMUT_EPSILON` of slack on the gamma-encoded channels (linear bounds
 * `[-GAMUT_EPSILON / 12.92, linearize(1 + GAMUT_EPSILON)]`, shared with the
 * plane gamut-region solver via `linear-bounds.ts`).
 *
 * This is the membership rule behind `inSrgbGamut` / `inP3Gamut`, exposed for
 * hot loops (e.g. per-pixel canvas rendering) that already hold linear
 * channels and want to avoid re-converting from OKLCH.
 */
export function isLinearRgbInGamut(r: number, g: number, b: number): boolean {
  return linearChannelsInGamut(r, g, b);
}

/**
 * Check if a Color is within the sRGB gamut.
 *
 * Uses unclamped linear sRGB values to avoid the false-positive
 * caused by the clamping in `linearToSrgb` / `toRgb`.
 */
export function inSrgbGamut(color: Color): boolean {
  const linear = scratchLinearSrgb(color);
  return isLinearRgbInGamut(linear.r, linear.g, linear.b);
}

/**
 * Check if a Color is within the Display P3 gamut.
 *
 * Uses unclamped linear P3 values to avoid the false-positive
 * caused by the clamping in `linearP3ToP3` / `toP3`.
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
 * Map `color` into `gamut`, writing l/c/h/alpha into `out`. `out` may be the
 * same object as `color`.
 *
 * Out-of-gamut colors bisect OKLCH chroma (at fixed L and h) down to the
 * target gamut boundary. Candidates are accepted only when *strictly* inside
 * the gamut. The GAMUT_EPSILON slack used by membership checks is meant to
 * absorb float noise on colors that are already in gamut; letting the search
 * settle inside that slack would return out-of-gamut colors, and near black
 * the slack spans a large chroma range.
 */
function mapToGamutInto(out: Color, color: Color, gamut: GamutTarget): Color {
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

  let mappedC = c;
  if (!isInTargetGamut(color, gamut)) {
    const trial = TRIAL;
    trial.l = l;
    trial.c = 0;
    trial.h = h;
    trial.alpha = alpha;

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

/**
 * Map a Color to the sRGB gamut, writing the result into `out`
 * (allocation-free). Same algorithm and bit-identical result as
 * `toSrgbGamut`; `out` may be the same object as `color`.
 *
 * @example
 * ```ts
 * import { toSrgbGamutInto } from 'color-kit';
 *
 * const mapped = { l: 0, c: 0, h: 0, alpha: 1 };
 * toSrgbGamutInto(mapped, { l: 0.7, c: 0.35, h: 150, alpha: 1 });
 * ```
 */
export function toSrgbGamutInto(out: Color, color: Color): Color {
  return mapToGamutInto(out, color, 'srgb');
}

/**
 * Map a Color to the Display P3 gamut, writing the result into `out`
 * (allocation-free). Same algorithm and bit-identical result as
 * `toP3Gamut`; `out` may be the same object as `color`.
 *
 * @example
 * ```ts
 * import { toP3GamutInto } from 'color-kit';
 *
 * const mapped = { l: 0, c: 0, h: 0, alpha: 1 };
 * toP3GamutInto(mapped, { l: 0.7, c: 0.4, h: 150, alpha: 1 });
 * ```
 */
export function toP3GamutInto(out: Color, color: Color): Color {
  return mapToGamutInto(out, color, 'display-p3');
}

/**
 * Map a Color to the sRGB gamut by progressively reducing chroma.
 * Uses a binary search to find the maximum chroma that stays in gamut.
 *
 * This preserves lightness and hue while only reducing saturation,
 * which produces the most visually similar in-gamut color.
 */
export function toSrgbGamut(color: Color): Color {
  return toSrgbGamutInto({ ...color }, color);
}

/**
 * Map a Color to the Display P3 gamut by progressively reducing chroma.
 */
export function toP3Gamut(color: Color): Color {
  return toP3GamutInto({ ...color }, color);
}
