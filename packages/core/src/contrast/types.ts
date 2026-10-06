import type { GamutTarget } from '../gamut/index.js';

export type ContrastRegionLevel = 'AA' | 'AAA' | 'AA-large';
export type ContrastMetric = 'wcag' | 'apca';
export type ContrastApcaPolarity = 'absolute' | 'positive' | 'negative';
export type ContrastApcaRole = 'sample-text' | 'sample-background';
export type ContrastApcaPreset = 'body' | 'large-text' | 'ui';
/**
 * Reason the hybrid contrast solver could not fully resolve a region. The
 * solver still returns its best-effort paths (possibly none) and records
 * the reason in the query trace summary as `degradedReason`.
 */
export type ContrastHybridDegradedReason =
  /** More simultaneous chroma roots than the branch tracker can join reliably. */
  | 'complex-topology'
  /** Roots were found but no branch could be reconstructed into a path. */
  | 'branch-reconstruction-empty'
  /** No roots traced, yet probing detected a sign change in the field. */
  | 'unresolved-sign-change';

export interface ContrastRegionPoint {
  l: number;
  c: number;
}

/**
 * Options for `contrastRegionPaths` and the plane contrast queries. Regions
 * are traced by direct chroma-root tracing with adaptive lightness
 * refinement.
 */
export interface ContrastRegionPathOptions {
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
   * Initial lightness sampling density (integer >= 2), clamped to 12–320.
   * Adaptive refinement adds samples where the contour bends.
   * @default 72
   */
  lightnessSteps?: number;
  /**
   * Chroma root-bracketing density per lightness sample (integer >= 2),
   * clamped to 16–768.
   * @default 96
   */
  chromaSteps?: number;
  /**
   * Upper chroma bound used for sampling.
   */
  maxChroma?: number;
  /**
   * Shared search precision forwarded to `maxChromaAt`.
   */
  tolerance?: number;
  /**
   * Shared search iteration cap forwarded to `maxChromaAt`.
   */
  maxIterations?: number;
  /**
   * Alpha channel used while sampling.
   */
  alpha?: number;
  /**
   * If set, run Ramer-Douglas-Peucker simplification on each contour path.
   * Tolerance is in normalized (l, c) space; e.g. 0.001–0.002.
   * Omit or 0 to disable.
   */
  simplifyTolerance?: number;
  /**
   * Maximum adaptive lightness refinement depth.
   * @default 7
   */
  hybridMaxDepth?: number;
  /**
   * Maximum midpoint root deviation before splitting. Value is in chroma
   * units.
   * @default 0.0015
   */
  hybridErrorTolerance?: number;
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
}
