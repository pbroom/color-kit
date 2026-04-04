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
 *
 * The legacy `display-p3` token remains accepted and resolves to the canonical
 * `p3` model.
 */
export type PlaneModel =
  | 'oklch'
  | 'rgb'
  | 'hsl'
  | 'hsv'
  | 'oklab'
  | 'hct'
  | 'p3'
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
 * Model-relative channel mapping used for type-safe plane inputs.
 */
export interface PlaneModelChannelMap {
  oklch: 'l' | 'c' | 'h';
  rgb: 'r' | 'g' | 'b';
  hsl: 'h' | 's' | 'l';
  hsv: 'h' | 's' | 'v';
  oklab: 'L' | 'a' | 'b';
  hct: 'h' | 'c' | 't';
  p3: 'r' | 'g' | 'b';
  'display-p3': 'r' | 'g' | 'b';
}

type ResolvedPlaneModel<Model extends PlaneModel> = Model extends 'display-p3'
  ? 'p3'
  : Model;

/**
 * Channel identifiers supported by a specific plane model.
 */
export type PlaneChannelFor<Model extends PlaneModel> =
  PlaneModelChannelMap[Model];

/**
 * Partial channel bag used for model-relative fixed values.
 *
 * Channel names must be valid for the selected plane model when passed to
 * `definePlane()`.
 */
export type PlaneFixedInput<Model extends PlaneModel = PlaneModel> = Partial<
  Record<PlaneChannelFor<Model>, number>
> & {
  alpha?: number;
};

/**
 * Resolved model-relative channel bag.
 */
export type PlaneModelColor<Model extends PlaneModel = PlaneModel> = Partial<
  Record<PlaneChannelFor<Model>, number>
> & {
  alpha: number;
};

/**
 * Axis descriptor used in `definePlane()` input.
 */
export interface PlaneAxis<Model extends PlaneModel = PlaneModel> {
  /**
   * Channel projected on this axis.
   */
  channel: PlaneChannelFor<Model>;
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
export interface PlaneDefinition<Model extends PlaneModel = PlaneModel> {
  /**
   * Plane model.
   *
   * Defaults to `'oklch'` when omitted.
   */
  model?: Model;
  /**
   * Horizontal axis. Defaults to `{ channel: 'l' }` when omitted.
   */
  x?: PlaneAxis<Model>;
  /**
   * Vertical axis. Defaults to `{ channel: 'c' }` when omitted.
   */
  y?: PlaneAxis<Model>;
  /**
   * Optional fixed channels for non-axis dimensions.
   *
   * Channels are interpreted relative to `model`, unsupported names throw, and
   * defaults are model-specific.
   */
  fixed?: PlaneFixedInput<Model>;
  /**
   * Optional anchor color converted into the selected model before resolving
   * `fixed`.
   *
   * Useful when switching models: omitted fixed channels are derived from this
   * color, while explicitly provided `fixed` values still win.
   */
  color?: Color;
}

type PlaneDefinitionWithRequiredModel<Model extends PlaneModel> = Omit<
  PlaneDefinition<Model>,
  'model'
> & {
  model: Model;
};

/**
 * Model-aware `definePlane()` input.
 *
 * This is useful for TypeScript callers that want model-specific channel
 * narrowing even when they store the definition in a variable first.
 */
export type PlaneDefinitionFor<Model extends PlaneModel> = Model extends 'oklch'
  ? PlaneDefinition<'oklch'>
  : PlaneDefinitionWithRequiredModel<Model>;

export interface ResolvedPlaneAxis<Model extends PlaneModel = PlaneModel> {
  channel: PlaneChannelFor<Model>;
  range: [number, number];
}

export interface ResolvedPlaneDefinition<
  Model extends PlaneModel = PlaneModel,
> {
  model: ResolvedPlaneModel<Model>;
  x: ResolvedPlaneAxis<Model>;
  y: ResolvedPlaneAxis<Model>;
  fixed: PlaneModelColor<Model>;
}

/**
 * Resolved plane returned by `definePlane()`.
 */
export type Plane<Model extends PlaneModel = PlaneModel> =
  ResolvedPlaneDefinition<Model>;

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
