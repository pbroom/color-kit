import { MAX_CHROMA_SEARCH_TOLERANCE } from './constants.js';

export const DEFAULT_MAX_CHROMA = 0.4;
export const DEFAULT_TOLERANCE = MAX_CHROMA_SEARCH_TOLERANCE;
export const DEFAULT_MAX_ITERATIONS = 30;

export type GamutTarget = 'srgb' | 'display-p3';

export interface MaxChromaAtOptions {
  gamut?: GamutTarget;
  /**
   * Absolute precision for binary search stop condition.
   * Lower values increase precision and work per call.
   */
  tolerance?: number;
  /**
   * Hard cap for binary search iterations.
   */
  maxIterations?: number;
  /**
   * Upper chroma search bound.
   */
  maxChroma?: number;
  /**
   * Alpha channel used while sampling.
   */
  alpha?: number;
}

export interface GamutBoundaryPoint {
  l: number;
  c: number;
}

export interface HueCusp {
  l: number;
  c: number;
}

export type MaxChromaForHueMethod = 'direct' | 'lut';

export interface MaxChromaForHueOptions {
  gamut?: GamutTarget;
  /**
   * `lut` uses a cached hue lookup table with interpolation for maximum
   * throughput across repeated calls. `direct` computes the cusp exactly
   * for the requested hue without a lightness sweep.
   * @default 'lut'
   */
  method?: MaxChromaForHueMethod;
  /**
   * Number of evenly spaced hue samples in the cached LUT.
   * Higher values increase warm-up cost and reduce interpolation error.
   * @default 4096
   */
  lutSize?: number;
}

export interface GamutBoundaryPathOptions extends MaxChromaAtOptions {
  /**
   * Number of equal lightness segments to sample.
   * The returned path has `steps + 1` points.
   * Ignored when samplingMode is 'adaptive'.
   */
  steps?: number;
  /**
   * If set, run Ramer-Douglas-Peucker simplification after sampling.
   * Tolerance is in normalized (l, c) space; e.g. 0.001–0.002.
   * Omit or 0 to disable.
   */
  simplifyTolerance?: number;
  /**
   * `uniform`: fixed steps over lightness (default).
   * `adaptive`: recursive midpoint refinement where curvature exceeds tolerance.
   * @default 'uniform'
   */
  samplingMode?: 'uniform' | 'adaptive';
  /**
   * Max perpendicular error in (l, c) before subdividing in adaptive mode.
   * @default 0.001
   */
  adaptiveTolerance?: number;
  /**
   * Max recursion depth in adaptive mode to avoid runaway.
   * @default 12
   */
  adaptiveMaxDepth?: number;
}

export type ChromaBandMode = 'clamped' | 'proportional';

export interface ChromaBandOptions extends MaxChromaAtOptions {
  /**
   * Chroma distribution strategy across the lightness sweep.
   * @default 'clamped'
   */
  mode?: ChromaBandMode;
  /**
   * Number of equal lightness segments to sample.
   * The returned band has `steps + 1` colors.
   * Ignored when samplingMode is 'adaptive'.
   */
  steps?: number;
  /**
   * `uniform`: fixed lightness steps.
   * `adaptive`: reuse adaptive boundary sampling and project to chroma mode.
   * @default 'uniform'
   */
  samplingMode?: 'adaptive' | 'uniform';
  /**
   * Max perpendicular error in (l, c) before subdividing in adaptive mode.
   * @default 0.001
   */
  adaptiveTolerance?: number;
  /**
   * Max recursion depth in adaptive mode to avoid runaway.
   * @default 12
   */
  adaptiveMaxDepth?: number;
  /**
   * Lightness anchor for proportional mode.
   * Used to resolve the requested/max chroma ratio.
   * @default 0.5
   */
  selectedLightness?: number;
}
