export {
  colorToPlane,
  definePlane,
  planeHue,
  planeModelChannels,
  planeModelDefaultRange,
  planeToColor,
  PLANE_DEFAULT_RANGES,
  PLANE_MODEL_CHANNELS,
  PLANE_MODEL_DEFAULT_AXES,
  PLANE_MODEL_DEFAULT_RANGES,
  usesLightnessAndChroma,
} from './plane.js';

export {
  colorAtPlanePoint,
  getPlaneChromaBand,
  getPlaneContrastBoundary,
  getPlaneContrastRegion,
  getPlaneFallbackPoint,
  getPlaneGamutBoundary,
  runPlaneQueries,
  runPlaneQuery,
  samplePlaneGradient,
  sense,
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
export type { PlaneSense, PlaneSenseApi, PlaneWithSense } from './query.js';

export type {
  Plane,
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
  PlaneFixedInput,
  PlaneFallbackPointQuery,
  PlaneFallbackPointResult,
  PlaneGamutBoundaryQuery,
  PlaneGamutBoundaryResult,
  PlaneGradientQuery,
  PlaneGradientResult,
  PlaneModelColor,
  PlaneModel,
  PlanePoint,
  PlaneQuery,
  PlaneQueryResult,
  PlaneRegion,
  PlaneRegionPoint,
  ResolvedPlaneAxis,
  ResolvedPlaneDefinition,
} from './types.js';
