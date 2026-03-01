import type { ContrastRegionLevel } from '../contrast/index.js';
import type { ChromaBandMode, GamutTarget } from '../gamut/index.js';
import type { Color } from '../types.js';

export type PlaneModel = 'oklch';
export type PlaneChannel = 'l' | 'c' | 'h';

export interface PlaneAxis {
  channel: PlaneChannel;
  range?: [number, number];
}

export interface PlaneDefinition {
  model?: PlaneModel;
  x: PlaneAxis;
  y: PlaneAxis;
  fixed?: Partial<Pick<Color, 'l' | 'c' | 'h' | 'alpha'>>;
}

export interface ResolvedPlaneAxis {
  channel: PlaneChannel;
  range: [number, number];
}

export interface ResolvedPlaneDefinition {
  model: PlaneModel;
  x: ResolvedPlaneAxis;
  y: ResolvedPlaneAxis;
  fixed: Pick<Color, 'l' | 'c' | 'h' | 'alpha'>;
}

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
  level?: ContrastRegionLevel;
  threshold?: number;
  lightnessSteps?: number;
  chromaSteps?: number;
  maxChroma?: number;
  tolerance?: number;
  maxIterations?: number;
  alpha?: number;
  edgeInterpolation?: 'linear' | 'midpoint';
  simplifyTolerance?: number;
  samplingMode?: 'uniform' | 'adaptive';
  adaptiveBaseSteps?: number;
  adaptiveMaxDepth?: number;
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
