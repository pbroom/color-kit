import type { GamutTarget } from '../gamut/index.js';

/**
 * WCAG contrast-ratio preset for contrast regions: `'AA'` is 4.5:1, `'AAA'`
 * is 7:1 and `'AA-large'` is 3:1.
 */
export type ContrastRegionLevel = 'AA' | 'AAA' | 'AA-large';

/**
 * Contrast metric for contrast regions: `'wcag'` uses
 * {@link contrastRatio}, `'apca'` uses {@link contrastAPCA}.
 */
export type ContrastMetric = 'wcag' | 'apca';

/**
 * Which sign of APCA Lc passes a contrast region:
 *
 * - `'absolute'`: `|Lc| >= threshold` (either polarity).
 * - `'positive'`: `Lc >= threshold` (dark text on a light background).
 * - `'negative'`: `Lc <= -threshold` (light text on a dark background).
 */
export type ContrastApcaPolarity = 'absolute' | 'positive' | 'negative';

/**
 * Which side of the APCA comparison the sampled color plays:
 * `'sample-text'` measures `contrastAPCA(sample, reference)`,
 * `'sample-background'` measures `contrastAPCA(reference, sample)`.
 */
export type ContrastApcaRole = 'sample-text' | 'sample-background';

/**
 * APCA threshold preset, on the normalized scale {@link contrastAPCA}
 * returns: `'body'` is 0.6 (Lc 60), `'large-text'` is 0.45 (Lc 45) and
 * `'ui'` is 0.3 (Lc 30).
 */
export type ContrastApcaPreset = 'body' | 'large-text' | 'ui';

/** A point on a contrast-region contour, in OKLCH lightness/chroma. */
export interface ContrastRegionPoint {
  /** OKLCH lightness, 0-1. */
  l: number;
  /** OKLCH chroma, 0 to the region's `maxChroma`. */
  c: number;
}

/**
 * Options for {@link contrastRegionPaths}, {@link contrastRegionPath} and the
 * plane contrast queries. Each side
 * of a region is traced as a luminance level curve along rays from black;
 * where a piece starts and ends on the gamut edge is solved exactly, and
 * `initialSamples`, `errorTolerance`, and `maxDepth` set how finely the
 * curve in between is sampled.
 */
export interface ContrastRegionPathOptions {
  /**
   * Target gamut. The reference and samples are measured as displayed in it,
   * with channels clipped as `contrastRatio` / `contrastAPCA` clip them (an
   * out-of-gamut reference is not gamut-mapped), and paths stay inside it.
   * @defaultValue `'srgb'`
   */
  gamut?: GamutTarget;
  /**
   * Contrast metric used when evaluating region membership.
   * @defaultValue `'wcag'`
   */
  metric?: ContrastMetric;
  /**
   * Explicit contrast threshold. If provided it overrides `level` /
   * `apcaPreset`. For `metric: 'wcag'` this is a contrast ratio and must be
   * greater than 1. For `metric: 'apca'` it is a normalized Lc magnitude, on
   * the scale {@link contrastAPCA} returns (`0.6` for Lc 60), and must be
   * greater than 0. Other values throw an `Error`.
   */
  threshold?: number;
  /**
   * WCAG threshold preset, used when `metric` is `'wcag'` and `threshold` is
   * omitted.
   * @defaultValue `'AA'` (4.5:1)
   */
  level?: ContrastRegionLevel;
  /**
   * APCA threshold preset used when `metric` is `'apca'` and `threshold` is
   * omitted.
   * @defaultValue `'body'` (Lc 60, normalized 0.6)
   */
  apcaPreset?: ContrastApcaPreset;
  /**
   * APCA polarity test mode used when `metric` is `'apca'`:
   * - `'absolute'`: `|Lc| >= threshold`
   * - `'positive'`: `Lc >= threshold`
   * - `'negative'`: `Lc <= -threshold`
   * @defaultValue `'absolute'`
   */
  apcaPolarity?: ContrastApcaPolarity;
  /**
   * APCA sample/reference role used when `metric` is `'apca'`:
   * - `'sample-text'`: `Lc = contrastAPCA(sample, reference)`
   * - `'sample-background'`: `Lc = contrastAPCA(reference, sample)`
   * @defaultValue `'sample-text'`
   */
  apcaRole?: ContrastApcaRole;
  /**
   * Upper chroma bound of the region: paths end at this chroma.
   * @defaultValue `0.4`
   */
  maxChroma?: number;
  /**
   * Alpha channel used while sampling.
   * @defaultValue `1`
   */
  alpha?: number;
  /**
   * If set, run Ramer-Douglas-Peucker simplification on each contour path.
   * Tolerance is in normalized (l, c) space; e.g. 0.001–0.002. Points are
   * kept wherever a simplified segment would leave the gamut, so every
   * segment stays in gamut as without simplification. Omit or 0 to disable.
   */
  simplifyTolerance?: number;
  /**
   * Initial samples per region side (integer >= 2, clamped to 512), spread
   * evenly over the angles where that side is visible. Refinement adds
   * samples where the contour bends.
   * @defaultValue `32`
   */
  initialSamples?: number;
  /**
   * Largest distance, in l/c units, a sampled midpoint may lie from the
   * chord of its interval before the interval is split (finite and > 0,
   * clamped to at least 1e-6).
   * @defaultValue `0.0015`
   */
  errorTolerance?: number;
  /**
   * Maximum halvings of an initial sample interval to meet `errorTolerance`
   * (integer >= 0, clamped to 12). A few more are allowed while a chord
   * leaves the gamut.
   * @defaultValue `6`
   */
  maxDepth?: number;
  /**
   * Removed with the legacy marching-squares engine. Passing it is a type
   * error and throws a `TypeError`.
   */
  engine?: never;
  /** Removed with the legacy engine; see `engine`. */
  samplingMode?: never;
  /** Removed with the legacy engine; see `engine`. */
  edgeInterpolation?: never;
  /** Removed with the legacy engine; see `engine`. */
  adaptiveBaseSteps?: never;
  /** Removed with the legacy engine; see `engine`. */
  adaptiveMaxDepth?: never;
  /**
   * Removed with the hybrid solver; use `initialSamples`. Passing it is a
   * type error and throws a `TypeError`.
   */
  lightnessSteps?: never;
  /** Removed with the hybrid solver; use `initialSamples`. */
  chromaSteps?: never;
  /** Removed with the hybrid solver; use `maxDepth`. */
  hybridMaxDepth?: never;
  /** Removed with the hybrid solver; use `errorTolerance`. */
  hybridErrorTolerance?: never;
  /** Removed with the hybrid solver, which forwarded it to `maxChromaAt`. */
  tolerance?: never;
  /** Removed with the hybrid solver, which forwarded it to `maxChromaAt`. */
  maxIterations?: never;
}
