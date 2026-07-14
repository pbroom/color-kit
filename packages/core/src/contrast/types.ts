import type { GamutTarget } from '../gamut/index.js';

export type ContrastRegionLevel = 'AA' | 'AAA' | 'AA-large';
export type ContrastMetric = 'wcag' | 'apca';
export type ContrastApcaPolarity = 'absolute' | 'positive' | 'negative';
export type ContrastApcaRole = 'sample-text' | 'sample-background';
export type ContrastApcaPreset = 'body' | 'large-text' | 'ui';
/**
 * Reason the hybrid solver declined to produce a result and requested the
 * legacy adaptive fallback.
 */
export type ContrastHybridFallbackReason =
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
   * Number of sampled lightness cells.
   * The lightness axis has `lightnessSteps + 1` points.
   *
   * Legacy fallback hint. Hybrid mode uses this as an initial density guide.
   */
  lightnessSteps?: number;
  /**
   * Number of sampled chroma cells.
   * The chroma axis has `chromaSteps + 1` points.
   *
   * Legacy fallback hint. Hybrid mode uses this for root-bracketing density.
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
   * Edge placement strategy for marching-squares contours.
   * `linear` uses threshold interpolation and improves contour precision.
   * `midpoint` keeps legacy midpoint edge placement.
   * @default 'linear'
   *
   * Legacy fallback option; ignored by the hybrid solver.
   */
  edgeInterpolation?: 'linear' | 'midpoint';
  /**
   * If set, run Ramer-Douglas-Peucker simplification on each contour path.
   * Tolerance is in normalized (l, c) space; e.g. 0.001–0.002.
   * Omit or 0 to disable.
   */
  simplifyTolerance?: number;
  /**
   * Sampling mode selection.
   * - hybrid: direct implicit tracing with adaptive refinement (default)
   * - uniform/adaptive: legacy marching-squares fallback modes
   * @default 'hybrid'
   */
  samplingMode?: 'hybrid' | 'uniform' | 'adaptive';
  /**
   * In adaptive mode, base grid size per axis (subdivided where contour crosses).
   * @default 16
   */
  adaptiveBaseSteps?: number;
  /**
   * In adaptive mode, max subdivision depth.
   * @default 3
   */
  adaptiveMaxDepth?: number;
  /**
   * Hybrid solver: maximum adaptive lightness refinement depth.
   * @default 7
   */
  hybridMaxDepth?: number;
  /**
   * Hybrid solver: maximum midpoint root deviation before splitting.
   * Value is in chroma units.
   * @default 0.0015
   */
  hybridErrorTolerance?: number;
}
