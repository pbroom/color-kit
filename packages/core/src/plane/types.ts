import type {
  ContrastApcaPolarity,
  ContrastApcaPreset,
  ContrastApcaRole,
  ContrastMetric,
  ContrastRegionLevel,
} from '../contrast/index.js';
import type { ChromaBandMode, GamutTarget } from '../gamut/index.js';
import type { Color } from '../types.js';

/**
 * Color models supported by plane geometry.
 */
export type PlaneModel =
  | 'oklch'
  | 'rgb'
  | 'hsl'
  | 'hsv'
  | 'oklab'
  | 'hct'
  | 'display-p3';

/**
 * Channel identifiers supported by plane axes across all models.
 */
export type PlaneChannel =
  | 'l'
  | 'c'
  | 'h'
  | 'r'
  | 'g'
  | 'b'
  | 's'
  | 'v'
  | 'L'
  | 'a'
  | 't';

/**
 * Partial channel bag used for model-relative fixed values.
 */
export type PlaneFixedInput = Partial<Record<PlaneChannel, number>> & {
  alpha?: number;
};

/**
 * Resolved model-relative channel bag.
 */
export type PlaneModelColor = Partial<Record<PlaneChannel, number>> & {
  alpha: number;
};

/**
 * Axis descriptor used in `definePlane()` input.
 */
export interface PlaneAxis {
  /**
   * Channel projected on this axis.
   */
  channel: PlaneChannel;
  /**
   * Optional channel range for this axis.
   *
   * Defaults to `PLANE_DEFAULT_RANGES[channel]` when omitted.
   */
  range?: [number, number];
}

/**
 * Input shape accepted by `definePlane()`.
 */
export interface PlaneDefinition {
  /**
   * Plane model.
   *
   * Defaults to `'oklch'` when omitted.
   */
  model?: PlaneModel;
  /**
   * Horizontal axis. Defaults to `{ channel: 'l' }` when omitted.
   */
  x?: PlaneAxis;
  /**
   * Vertical axis. Defaults to `{ channel: 'c' }` when omitted.
   */
  y?: PlaneAxis;
  /**
   * Optional fixed channels for non-axis dimensions.
   *
   * Channels are interpreted relative to `model` and defaults are model-specific.
   */
  fixed?: PlaneFixedInput;
}

export interface ResolvedPlaneAxis {
  channel: PlaneChannel;
  range: [number, number];
}

export interface ResolvedPlaneDefinition {
  model: PlaneModel;
  x: ResolvedPlaneAxis;
  y: ResolvedPlaneAxis;
  fixed: PlaneModelColor;
}

/**
 * Resolved plane returned by `definePlane()`.
 */
export type Plane = ResolvedPlaneDefinition;

export interface PlanePoint {
  x: number;
  y: number;
}

export interface PlaneColorPoint extends PlanePoint {
  color: Color;
}

export interface PlaneBoundaryPoint extends PlanePoint {
  l: number;
  c: number;
}

export interface PlaneRegionPoint extends PlanePoint {
  l: number;
  c: number;
}

export interface PlaneRegion {
  paths: PlanePoint[][];
}

export interface PlaneGamutBoundaryQuery {
  kind: 'gamutBoundary';
  gamut?: GamutTarget;
  hue?: number;
  steps?: number;
  simplifyTolerance?: number;
  samplingMode?: 'uniform' | 'adaptive';
  adaptiveTolerance?: number;
  adaptiveMaxDepth?: number;
}

export interface PlaneContrastQueryOptions {
  reference: Color;
  gamut?: GamutTarget;
  hue?: number;
  metric?: ContrastMetric;
  level?: ContrastRegionLevel;
  threshold?: number;
  apcaPreset?: ContrastApcaPreset;
  apcaPolarity?: ContrastApcaPolarity;
  apcaRole?: ContrastApcaRole;
  lightnessSteps?: number;
  chromaSteps?: number;
  maxChroma?: number;
  tolerance?: number;
  maxIterations?: number;
  alpha?: number;
  edgeInterpolation?: 'linear' | 'midpoint';
  simplifyTolerance?: number;
  samplingMode?: 'hybrid' | 'uniform' | 'adaptive';
  adaptiveBaseSteps?: number;
  adaptiveMaxDepth?: number;
  hybridMaxDepth?: number;
  hybridErrorTolerance?: number;
}

export interface PlaneContrastBoundaryQuery extends PlaneContrastQueryOptions {
  kind: 'contrastBoundary';
}

export interface PlaneContrastRegionQuery extends PlaneContrastQueryOptions {
  kind: 'contrastRegion';
}

export interface PlaneChromaBandQuery {
  kind: 'chromaBand';
  requestedChroma?: number;
  gamut?: GamutTarget;
  hue?: number;
  mode?: ChromaBandMode;
  steps?: number;
  samplingMode?: 'uniform' | 'adaptive';
  adaptiveTolerance?: number;
  adaptiveMaxDepth?: number;
  selectedLightness?: number;
  maxChroma?: number;
  tolerance?: number;
  maxIterations?: number;
  alpha?: number;
}

export interface PlaneFallbackPointQuery {
  kind: 'fallbackPoint';
  color: Color;
  gamut: GamutTarget;
}

export interface PlaneGradientQuery {
  kind: 'gradient';
  from: Color;
  to: Color;
  steps?: number;
}

export type PlaneQuery =
  | PlaneGamutBoundaryQuery
  | PlaneContrastBoundaryQuery
  | PlaneContrastRegionQuery
  | PlaneChromaBandQuery
  | PlaneFallbackPointQuery
  | PlaneGradientQuery;

export interface PlaneGamutBoundaryResult {
  kind: 'gamutBoundary';
  gamut: GamutTarget;
  hue: number;
  points: PlaneBoundaryPoint[];
}

export interface PlaneContrastBoundaryResult {
  kind: 'contrastBoundary';
  hue: number;
  points: PlaneRegionPoint[];
}

export interface PlaneContrastRegionResult {
  kind: 'contrastRegion';
  hue: number;
  paths: PlaneRegionPoint[][];
}

export interface PlaneChromaBandResult {
  kind: 'chromaBand';
  hue: number;
  points: PlaneBoundaryPoint[];
}

export interface PlaneFallbackPointResult {
  kind: 'fallbackPoint';
  gamut: GamutTarget;
  point: PlaneColorPoint;
}

export interface PlaneGradientResult {
  kind: 'gradient';
  points: PlaneColorPoint[];
}

export type PlaneQueryResult =
  | PlaneGamutBoundaryResult
  | PlaneContrastBoundaryResult
  | PlaneContrastRegionResult
  | PlaneChromaBandResult
  | PlaneFallbackPointResult
  | PlaneGradientResult;
