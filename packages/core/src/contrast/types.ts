import type { GamutTarget } from '../gamut/index.js';

export type ContrastRegionLevel = 'AA' | 'AAA' | 'AA-large';
export type ContrastMetric = 'wcag' | 'apca';
export type ContrastApcaPolarity = 'absolute' | 'positive' | 'negative';
export type ContrastApcaRole = 'sample-text' | 'sample-background';
export type ContrastApcaPreset = 'body' | 'large-text' | 'ui';

export interface ContrastRegionPoint {
  l: number;
  c: number;
}

/**
 * Options for `contrastRegionPaths` and the plane contrast queries. Each side
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
   * @default 'srgb'
   */
  gamut?: GamutTarget;
  /**
   * Contrast metric used when evaluating region membership.
   * @default 'wcag'
   */
  metric?: ContrastMetric;
  /**
   * Explicit contrast threshold. If provided it overrides `level`.
   * For metric='wcag' this is ratio threshold (>= 1).
   * For metric='apca' this is Lc threshold (>= 0).
   */
  threshold?: number;
  /**
   * WCAG threshold preset.
   * @default 'AA' (4.5:1)
   */
  level?: ContrastRegionLevel;
  /**
   * APCA threshold preset used when metric='apca' and threshold is omitted.
   * @default 'body' (Lc 60)
   */
  apcaPreset?: ContrastApcaPreset;
  /**
   * APCA polarity test mode used when metric='apca':
   * - absolute: abs(Lc) >= threshold
   * - positive: Lc >= threshold
   * - negative: Lc <= -threshold
   * @default 'absolute'
   */
  apcaPolarity?: ContrastApcaPolarity;
  /**
   * APCA sample/reference role used when metric='apca':
   * - sample-text: Lc = APCA(sample, reference)
   * - sample-background: Lc = APCA(reference, sample)
   * @default 'sample-text'
   */
  apcaRole?: ContrastApcaRole;
  /**
   * Upper chroma bound of the region: paths end at this chroma.
   * @default 0.4
   */
  maxChroma?: number;
  /**
   * Alpha channel used while sampling.
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
   * @default 32
   */
  initialSamples?: number;
  /**
   * Largest distance, in l/c units, a sampled midpoint may lie from the
   * chord of its interval before the interval is split (finite and > 0,
   * clamped to at least 1e-6).
   * @default 0.0015
   */
  errorTolerance?: number;
  /**
   * Maximum halvings of an initial sample interval to meet `errorTolerance`
   * (integer >= 0, clamped to 12). A few more are allowed while a chord
   * leaves the gamut.
   * @default 6
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
