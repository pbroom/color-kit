export {
  colorToPlane,
  planeToColor,
  PLANE_DEFAULT_RANGES,
  resolvePlaneDefinition,
  resolvePlaneHue,
  usesLightnessAndChroma,
} from './plane.js';

export {
  colorAtPlanePoint,
  createPlaneQuery,
  getPlaneChromaBand,
  getPlaneContrastBoundary,
  getPlaneContrastRegion,
  getPlaneFallbackPoint,
  getPlaneGamutBoundary,
  runPlaneQueries,
  runPlaneQuery,
  samplePlaneGradient,
} from './query.js';

export {
  createPlaneQueryKey,
  PlaneQueryCache,
  runCachedPlaneQuery,
  toSvgCompoundPath,
  toSvgPath,
} from './compile.js';
export type { SvgPathCompileOptions } from './compile.js';

export {
  containsPoint,
  differenceRegions,
  intersectRegions,
  nearestPointOnPath,
  pointDistance,
  unionRegions,
} from './operations.js';
export type { PlaneBooleanOptions } from './operations.js';

export {
  projectRegionBetweenPlanes,
  rotateRegion,
  scaleRegion,
  translateRegion,
} from './transforms.js';
export type { PlaneQueryApi } from './query.js';

export type {
  PlaneAxis,
  PlaneBoundaryPoint,
  PlaneChromaBandQuery,
  PlaneChromaBandResult,
  PlaneColorPoint,
  PlaneContrastBoundaryQuery,
  PlaneContrastBoundaryResult,
  PlaneContrastRegionQuery,
  PlaneContrastRegionResult,
  PlaneDefinition,
  PlaneFallbackPointQuery,
  PlaneFallbackPointResult,
  PlaneGamutBoundaryQuery,
  PlaneGamutBoundaryResult,
  PlaneGradientQuery,
  PlaneGradientResult,
  PlaneModel,
  PlanePoint,
  PlaneQuery,
  PlaneQueryResult,
  PlaneRegion,
  PlaneRegionPoint,
  ResolvedPlaneAxis,
  ResolvedPlaneDefinition,
} from './types.js';
