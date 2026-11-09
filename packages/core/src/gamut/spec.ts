import {
  LINEAR_P3_TO_LINEAR_SRGB,
  LINEAR_REC2020_TO_LINEAR_SRGB,
  LINEAR_SRGB_TO_LINEAR_P3,
  LINEAR_SRGB_TO_LINEAR_REC2020,
  LMS_TO_LINEAR_P3,
  LMS_TO_LINEAR_REC2020,
  LMS_TO_LINEAR_SRGB,
  type Matrix3,
} from '../conversion/matrices.js';
import {
  GAMUT_LINEAR_MAX,
  GAMUT_LINEAR_MIN,
  REC2020_LINEAR_MAX,
  REC2020_LINEAR_MIN,
} from './linear-bounds.js';
import type { GamutTarget } from './types.js';

/**
 * Everything gamut-specific about one RGB gamut target. Code that takes a
 * `gamut` option looks its descriptor up with {@link gamutSpec} and stays
 * free of per-gamut branches, so a new target is a new descriptor (plus the
 * hand-touched places listed on {@link GAMUT_SPECS}).
 */
export interface GamutSpec {
  /**
   * The {@link GamutTarget} id, which is also the CSS `color()` space name
   * (`color(rec2020 r g b)`).
   */
  readonly id: GamutTarget;
  /**
   * OKLab LMS (cone response, after cubing) -> unclamped linear target RGB.
   * These rows are the coefficients of every analytic solver: the hue-cusp
   * cubic, the plane gamut-region field and the contrast-region rays.
   */
  readonly lmsToLinear: Matrix3;
  /** Linear sRGB -> linear target RGB; `null` for sRGB itself (identity). */
  readonly fromLinearSrgb: Matrix3 | null;
  /** Linear target RGB -> linear sRGB; `null` for sRGB itself (identity). */
  readonly toLinearSrgb: Matrix3 | null;
  /**
   * Lower linear-light membership bound: the gamut's inverse transfer
   * function applied to `-GAMUT_EPSILON`. The transfer function itself is not
   * part of the descriptor (no query needs it, and plane bundles are sized
   * to the byte); it is applied once, in `linear-bounds.ts`, to produce
   * these two bounds. See there for the reasoning.
   */
  readonly linearMin: number;
  /**
   * Upper linear-light membership bound: the inverse transfer function
   * applied to `1 + GAMUT_EPSILON`.
   */
  readonly linearMax: number;
  /**
   * Default upper chroma bound of searches in this gamut (`maxChromaAt`,
   * boundary paths, contrast regions, full-scope plane bounds). Must exceed
   * the gamut's largest OKLCH chroma: about 0.323 for sRGB, 0.366 for
   * Display P3 and 0.468 for Rec. 2020 (its green primary).
   */
  readonly maxChroma: number;
}

/** sRGB. */
export const SRGB_GAMUT: GamutSpec = {
  id: 'srgb',
  lmsToLinear: LMS_TO_LINEAR_SRGB,
  fromLinearSrgb: null,
  toLinearSrgb: null,
  linearMin: GAMUT_LINEAR_MIN,
  linearMax: GAMUT_LINEAR_MAX,
  maxChroma: 0.4,
};

/** Display P3: its own primaries with the sRGB transfer function. */
export const DISPLAY_P3_GAMUT: GamutSpec = {
  id: 'display-p3',
  lmsToLinear: LMS_TO_LINEAR_P3,
  fromLinearSrgb: LINEAR_SRGB_TO_LINEAR_P3,
  toLinearSrgb: LINEAR_P3_TO_LINEAR_SRGB,
  linearMin: GAMUT_LINEAR_MIN,
  linearMax: GAMUT_LINEAR_MAX,
  maxChroma: 0.4,
};

/**
 * Rec. 2020 (ITU-R BT.2020 primaries, D65) with the CSS Color 4 transfer
 * function, a sign-mirrored 2.4 power.
 */
export const REC2020_GAMUT: GamutSpec = {
  id: 'rec2020',
  lmsToLinear: LMS_TO_LINEAR_REC2020,
  fromLinearSrgb: LINEAR_SRGB_TO_LINEAR_REC2020,
  toLinearSrgb: LINEAR_REC2020_TO_LINEAR_SRGB,
  linearMin: REC2020_LINEAR_MIN,
  linearMax: REC2020_LINEAR_MAX,
  maxChroma: 0.5,
};

/**
 * The descriptor of every {@link GamutTarget}, keyed by id.
 *
 * Adding a target: extend the `GamutTarget` union, add its matrices
 * (`conversion/matrices.ts`), its linear bounds (`linear-bounds.ts`) and a
 * descriptor here. `assertGamutTarget`, `maxChromaAt`, `maxChromaForHue`,
 * `gamutBoundaryPath`, `chromaBand`, the plane queries and the contrast
 * regions then accept it. The named `inXGamut` / `toXGamut` functions, the
 * `toCss` format and the packed-ABI gamut list are written by hand.
 *
 * Functions for one named gamut (`inSrgbGamut`, `toP3Gamut`, ...) import
 * their own descriptor instead of this table, so bundles that never take a
 * `gamut` option do not carry every gamut's matrices.
 */
export const GAMUT_SPECS: Readonly<Record<GamutTarget, GamutSpec>> = {
  srgb: SRGB_GAMUT,
  'display-p3': DISPLAY_P3_GAMUT,
  rec2020: REC2020_GAMUT,
};

/**
 * The descriptor of a validated gamut target. Callers validate with
 * `assertGamutTarget` first; an unknown id returns `undefined`.
 */
export function gamutSpec(gamut: GamutTarget): GamutSpec {
  return GAMUT_SPECS[gamut];
}
