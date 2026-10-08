export { assertGamutTarget } from '../gamut/target.js';

export {
  colorToPlane,
  definePlane,
  definePlaneFromColor,
  planeHue,
  planeModelChannels,
  planeModelDefaultRange,
  planeToColor,
  PLANE_MODEL_CHANNELS,
  PLANE_MODEL_DEFAULT_AXES,
  PLANE_MODEL_DEFAULT_RANGES,
  resolvePlaneDefinition,
  usesLightnessAndChroma,
} from './plane.js';

export {
  colorAtPlanePoint,
  getPlaneChromaBand,
  getPlaneContrastBoundary,
  getPlaneContrastRegion,
  getPlaneFallbackPoint,
  getPlaneGamutBoundary,
  getPlaneGamutRegion,
  inspectPlaneQueries,
  inspectPlaneQuery,
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
export type {
  PlaneQueryCacheOptions,
  SvgPathCompileOptions,
} from './compile.js';

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
export type { PlaneSense } from './query.js';

export type {
  Plane,
  PlaneAxis,
  PlaneBoundaryPoint,
  PlaneChannelFor,
  PlaneChromaBandQuery,
  PlaneChromaBandResult,
  PlaneColorPoint,
  PlaneContrastBoundaryQuery,
  PlaneContrastBoundaryResult,
  PlaneContrastRegionQuery,
  PlaneContrastRegionResult,
  PlaneDefinition,
  PlaneDefinitionFor,
  PlaneFixedInput,
  PlaneFallbackPointQuery,
  PlaneFallbackPointResult,
  PlaneGamutBoundaryQuery,
  PlaneGamutBoundaryResult,
  PlaneGamutRegionQuery,
  PlaneGamutRegionResult,
  PlaneGamutRegionScope,
  PlaneContrastSolver,
  PlaneGamutSolver,
  PlaneGradientQuery,
  PlaneGradientResult,
  PlaneQueryInspection,
  PlaneModelColor,
  PlaneModel,
  PlanePoint,
  PlaneQuery,
  PlaneQueryResult,
  PlaneQueryTrace,
  PlaneQueryTraceCellEvent,
  PlaneQueryTraceLevel,
  PlaneQueryTraceMarchingSquaresStage,
  PlaneQueryTraceMetricsStage,
  PlaneQueryTraceOptions,
  PlaneQueryTracePathStage,
  PlaneQueryTraceScalarGridStage,
  PlaneQueryTraceSolverStage,
  PlaneQueryTraceStage,
  PlaneQueryTraceSummary,
  PlaneQueryTraceViewportStage,
  PlaneRegion,
  PlaneRegionPoint,
  PlaneTraceBounds,
  PlaneViewportRelation,
  ResolvedPlaneAxis,
  ResolvedPlaneDefinition,
} from './types.js';
