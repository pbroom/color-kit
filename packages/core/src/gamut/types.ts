import { MAX_CHROMA_SEARCH_TOLERANCE } from './constants.js';

export const DEFAULT_TOLERANCE = MAX_CHROMA_SEARCH_TOLERANCE;
export const DEFAULT_MAX_ITERATIONS = 30;

/**
 * RGB gamut a query targets: `'srgb'`, `'display-p3'` or `'rec2020'` (the
 * CSS `color()` names). The former `'p3'` spelling was removed and throws a
 * `TypeError` wherever a gamut is read.
 *
 * The gamuts are not strictly nested. sRGB lies inside both others, but two
 * thin slivers of Display P3 lie outside Rec. 2020: around the P3 red
 * primary (`color(display-p3 1 0 0)` is `color(rec2020 0.889 0.277 -0.061)`)
 * and, opposite it, around P3 cyan near white. The largest difference is
 * about 0.002 OKLCH chroma.
 *
 * Membership tolerance also differs per gamut (see `GAMUT_EPSILON`): for
 * very dark colors (OKLCH lightness below about 0.05 for sRGB, 0.15 for
 * Display P3) their tolerance covers more chroma than the Rec. 2020 one, so
 * a boundary reported for them can sit outside the Rec. 2020 boundary there.
 */
export type GamutTarget = 'srgb' | 'display-p3' | 'rec2020';

/**
 * Gamut a color is shown in: `'srgb'` or `'display-p3'`. The subset of
 * {@link GamutTarget} that the contrast metrics (which model the display)
 * and the driver / React picker state support. Rec. 2020 is a query target
 * only.
 */
export type DisplayGamut = 'srgb' | 'display-p3';

/**
 * Gamut mapping algorithm for `toSrgbGamut` / `toP3Gamut` /
 * `toRec2020Gamut`:
 *
 * - `'chroma-reduction'`: reduce OKLCH chroma at fixed lightness and hue.
 * - `'css'`: CSS Color 4 gamut mapping (chroma bisection with a 0.02
 *   deltaE OK just-noticeable-difference clip).
 */
export type GamutMapMethod = 'chroma-reduction' | 'css';

/** Options for {@link toSrgbGamut}, {@link toP3Gamut} and their `Into` forms. */
export interface GamutMapOptions {
  /**
   * Gamut mapping algorithm; see {@link GamutMapMethod}.
   * @defaultValue `'chroma-reduction'`
   */
  method?: GamutMapMethod;
}

/**
 * Options for {@link maxChromaAt}; also accepted by
 * {@link gamutBoundaryPath} and {@link chromaBand}.
 */
export interface MaxChromaAtOptions {
  /**
   * Target gamut.
   * @defaultValue `'srgb'`
   */
  gamut?: GamutTarget;
  /**
   * Width of the bisection interval at which the search stops; the result
   * can be up to this much below the true boundary chroma. Lower values
   * increase precision and work per call. Non-positive values use the
   * default.
   * @defaultValue `0.0001`
   */
  tolerance?: number;
  /**
   * Hard cap on bisection iterations. Non-finite or non-positive values use
   * the default.
   * @defaultValue `30`
   */
  maxIterations?: number;
  /**
   * Upper chroma search bound. If a color at this chroma is already in
   * gamut, it is returned as is, so this also acts as a chroma cap. The
   * default clears the gamut's largest chroma: `0.4` for sRGB and Display
   * P3, `0.5` for Rec. 2020 (whose green primary reaches about 0.468).
   * @defaultValue `0.4` (`0.5` for `'rec2020'`)
   */
  maxChroma?: number;
  /**
   * Alpha channel used while sampling.
   * @defaultValue `1`
   */
  alpha?: number;
}

/** A point on a gamut boundary path, in OKLCH lightness/chroma. */
export interface GamutBoundaryPoint {
  /** OKLCH lightness, 0-1. */
  l: number;
  /** Maximum in-gamut OKLCH chroma at that lightness. */
  c: number;
}

/**
 * The cusp of a hue slice: the OKLCH lightness/chroma point with the
 * largest in-gamut chroma for that hue. Returned by {@link maxChromaForHue}.
 */
export interface HueCusp {
  /** OKLCH lightness of the cusp, 0-1. */
  l: number;
  /** Maximum in-gamut OKLCH chroma for the hue. */
  c: number;
}

/**
 * How {@link maxChromaForHue} resolves the cusp: `'direct'` solves it per
 * call, `'lut'` interpolates a cached hue lookup table.
 */
export type MaxChromaForHueMethod = 'direct' | 'lut';

/** Options for {@link maxChromaForHue}. */
export interface MaxChromaForHueOptions {
  /**
   * Target gamut.
   * @defaultValue `'srgb'`
   */
  gamut?: GamutTarget;
  /**
   * `lut` interpolates a cached hue lookup table, which is faster across
   * repeated calls. `direct` computes the cusp exactly for the requested hue
   * without a lightness sweep.
   * @defaultValue `'lut'`
   */
  method?: MaxChromaForHueMethod;
  /**
   * Number of evenly spaced hue samples in the cached LUT.
   * Higher values increase warm-up cost and reduce interpolation error.
   * Values below 16 or non-finite use the default.
   * @defaultValue `4096`
   */
  lutSize?: number;
}

/**
 * Options for {@link gamutBoundaryPath}: the {@link MaxChromaAtOptions}
 * search settings plus sampling controls.
 */
export interface GamutBoundaryPathOptions extends MaxChromaAtOptions {
  /**
   * Number of equal lightness segments to sample (integer >= 2).
   * The returned path has `steps + 1` points.
   * Ignored when `samplingMode` is `'adaptive'`.
   * @defaultValue `100`
   */
  steps?: number;
  /**
   * If set, run Ramer-Douglas-Peucker simplification after sampling.
   * Tolerance is in normalized (l, c) space; e.g. 0.001–0.002.
   * Omit or 0 to disable.
   */
  simplifyTolerance?: number;
  /**
   * `'uniform'`: fixed steps over lightness.
   * `'adaptive'`: anchors at the hue cusp and recursive midpoint refinement
   * where curvature exceeds `adaptiveTolerance`.
   * @defaultValue `'uniform'`
   */
  samplingMode?: 'uniform' | 'adaptive';
  /**
   * Max perpendicular error in (l, c) before subdividing in adaptive mode.
   * Non-positive values use the default.
   * @defaultValue `0.001`
   */
  adaptiveTolerance?: number;
  /**
   * Max recursion depth in adaptive mode to avoid runaway (integer, capped
   * at 20). Non-integer or non-positive values use the default.
   * @defaultValue `12`
   */
  adaptiveMaxDepth?: number;
}

/**
 * How {@link chromaBand} distributes chroma across lightness: `'clamped'`
 * keeps the requested chroma and clamps it to the boundary, `'proportional'`
 * scales the boundary chroma by a fixed ratio.
 */
export type ChromaBandMode = 'clamped' | 'proportional';

/**
 * Options for {@link chromaBand}: the {@link MaxChromaAtOptions} search
 * settings plus mode and sampling controls.
 */
export interface ChromaBandOptions extends MaxChromaAtOptions {
  /**
   * Chroma distribution strategy across the lightness sweep.
   * @defaultValue `'clamped'`
   */
  mode?: ChromaBandMode;
  /**
   * Number of equal lightness segments to sample (integer >= 2).
   * The returned band has `steps + 1` colors.
   * Ignored when `samplingMode` is `'adaptive'`.
   * @defaultValue `12`
   */
  steps?: number;
  /**
   * `'uniform'`: fixed lightness steps.
   * `'adaptive'`: reuse adaptive boundary sampling and project to chroma mode.
   * @defaultValue `'uniform'`
   */
  samplingMode?: 'adaptive' | 'uniform';
  /**
   * Max perpendicular error in (l, c) before subdividing in adaptive mode.
   * @defaultValue `0.001`
   */
  adaptiveTolerance?: number;
  /**
   * Max recursion depth in adaptive mode to avoid runaway.
   * @defaultValue `12`
   */
  adaptiveMaxDepth?: number;
  /**
   * Lightness anchor for proportional mode, clamped to 0-1.
   * Used to resolve the requested/max chroma ratio.
   * @defaultValue `0.5`
   */
  selectedLightness?: number;
}
