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

/** Options shared by both contrast-region engines. */
export interface ContrastRegionBaseOptions {
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
   * Lightness sampling density (integer >= 2).
   * - hybrid: initial density, clamped to 12–320; adaptive refinement adds
   *   samples where the contour bends. Default 72.
   * - legacy: number of lightness grid cells. Default 64.
   */
  lightnessSteps?: number;
  /**
   * Chroma sampling density (integer >= 2).
   * - hybrid: root-bracketing density per lightness sample, clamped to
   *   16–768. Default 96.
   * - legacy: number of chroma grid cells. Default 64.
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
}

/** Contrast-region solver. */
export type ContrastRegionEngine = 'hybrid' | 'legacy';

/**
 * Options for the default hybrid engine: direct chroma-root tracing with
 * adaptive lightness refinement. Legacy-only options are type errors here
 * and throw a `TypeError` at runtime.
 */
export interface ContrastRegionHybridOptions extends ContrastRegionBaseOptions {
  /** @default 'hybrid' */
  engine?: 'hybrid';
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
  samplingMode?: never;
  edgeInterpolation?: never;
  adaptiveBaseSteps?: never;
  adaptiveMaxDepth?: never;
}

/**
 * Options for the legacy marching-squares engine. Select it explicitly with
 * `engine: 'legacy'`; hybrid-only options are type errors here and throw a
 * `TypeError` at runtime.
 */
export interface ContrastRegionLegacyOptions extends ContrastRegionBaseOptions {
  engine: 'legacy';
  /**
   * Grid strategy. `adaptive` subdivides cells the contour crosses and only
   * applies to the `wcag` metric; APCA always uses the `uniform` grid.
   * @default 'adaptive' when `adaptiveBaseSteps` or `adaptiveMaxDepth` is
   * set, otherwise 'uniform'
   */
  samplingMode?: 'uniform' | 'adaptive';
  /**
   * Edge placement for marching-squares contours: `linear` interpolates the
   * threshold crossing, `midpoint` uses cell-edge midpoints.
   * @default 'linear'
   */
  edgeInterpolation?: 'linear' | 'midpoint';
  /**
   * Adaptive mode: base grid size per axis, subdivided where the contour
   * crosses.
   * @default 16
   */
  adaptiveBaseSteps?: number;
  /**
   * Adaptive mode: maximum subdivision depth.
   * @default 3
   */
  adaptiveMaxDepth?: number;
  hybridMaxDepth?: never;
  hybridErrorTolerance?: never;
}

/**
 * Options for `contrastRegionPaths` and the plane contrast queries,
 * discriminated by `engine`.
 */
export type ContrastRegionPathOptions =
  | ContrastRegionHybridOptions
  | ContrastRegionLegacyOptions;
