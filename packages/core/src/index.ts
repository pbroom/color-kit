// Types
export type {
  Color,
  Rgb,
  LinearRgb,
  Hsl,
  Hsv,
  Hct,
  Oklab,
  Oklch,
  P3,
  ColorSpace,
  ParsedColor,
} from './types.js';

// Conversion
export {
  // High-level conversions (Color ↔ other formats)
  toRgb,
  fromRgb,
  toHex,
  fromHex,
  toHsl,
  fromHsl,
  toHsv,
  fromHsv,
  toHct,
  fromHct,
  toOklab,
  fromOklab,
  toOklch,
  fromOklch,
  toP3,
  fromP3,
  toCss,
  parse,
  // Low-level converters
  srgbToLinear,
  linearToSrgb,
  rgbToHex,
  hexToRgb,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  linearRgbToOklab,
  oklabToLinearRgb,
  oklabToOklch,
  oklchToOklab,
  oklchToColor,
  colorToOklch,
  linearSrgbToLinearP3,
  linearP3ToLinearSrgb,
  linearP3ToP3,
  p3ToLinearP3,
} from './conversion/index.js';

// Allocation-free (`out`-first) conversions for per-pixel / per-frame loops.
// Each writes into `out`, returns it, and matches the allocating function
// bit for bit.
export {
  toOklabInto,
  fromOklabInto,
  toLinearSrgbInto,
  fromLinearSrgbInto,
  toRgbInto,
  fromRgbInto,
  toP3Into,
  fromP3Into,
  srgbToLinearInto,
  linearToSrgbInto,
  linearRgbToOklabInto,
  oklabToLinearRgbInto,
  oklabToOklchInto,
  oklchToOklabInto,
  linearSrgbToLinearP3Into,
  linearP3ToLinearSrgbInto,
  linearP3ToP3Into,
  p3ToLinearP3Into,
} from './conversion/index.js';

// Contrast
export {
  relativeLuminance,
  contrastRatio,
  contrastAPCA,
  meetsAA,
  meetsAAA,
  contrastRegionPath,
  contrastRegionPaths,
} from './contrast/index.js';
export type {
  ContrastApcaPolarity,
  ContrastApcaPreset,
  ContrastApcaRole,
  ContrastHybridFallbackReason,
  ContrastMetric,
  ContrastRegionLevel,
  ContrastRegionPoint,
  ContrastRegionPathOptions,
} from './contrast/index.js';

// Harmony
export {
  complementary,
  analogous,
  triadic,
  tetradic,
  splitComplementary,
} from './harmony/index.js';

// Scale
export {
  interpolate,
  interpolateInto,
  generateScale,
  lightnessScale,
} from './scale/index.js';
export type {
  HueInterpolationMethod,
  InterpolationOptions,
  InterpolationSpace,
} from './interpolation/index.js';

// Manipulation
export {
  lighten,
  darken,
  saturate,
  desaturate,
  adjustHue,
  setAlpha,
  mix,
  mixInto,
  invert,
  grayscale,
} from './manipulation/index.js';

// Full-precision OKLab / sRGB / Display P3 matrices (CSS Color 4), for
// renderers such as shaders that re-implement the conversion math.
export {
  LINEAR_SRGB_TO_LINEAR_P3,
  LMS_TO_LINEAR_SRGB,
  OKLAB_TO_LMS,
} from './conversion/matrices.js';
export type { Matrix3 } from './conversion/matrices.js';

// Gamut
export {
  GAMUT_EPSILON,
  GAMUT_LINEAR_MAX,
  GAMUT_LINEAR_MIN,
  inSrgbGamut,
  isLinearRgbInGamut,
  inP3Gamut,
  toSrgbGamut,
  toSrgbGamutInto,
  toP3Gamut,
  toP3GamutInto,
  maxChromaForHue,
  maxChromaAt,
  gamutBoundaryPath,
  chromaBand,
} from './gamut/index.js';
export type {
  GamutTarget,
  GamutBoundaryPoint,
  HueCusp,
  MaxChromaForHueMethod,
  MaxChromaForHueOptions,
  MaxChromaAtOptions,
  GamutBoundaryPathOptions,
  ChromaBandMode,
  ChromaBandOptions,
} from './gamut/index.js';

// HCT utilities
export {
  maxHctChromaAtTone,
  maxHctChromaForHue,
  maxHctPeakToneForHue,
} from './hct/index.js';
export type {
  HctHuePeak,
  MaxHctChromaForHueMethod,
  MaxHctChromaForHueOptions,
} from './hct/index.js';

// Utilities
export { clamp, round, normalizeHue, lerp } from './utils/index.js';

// Compute backends
export {
  createJsPlaneComputeBackend,
  createPlaneComputeScheduler,
  getDefaultPlaneComputeTelemetrySnapshot,
  getPackedPlaneQueryTransferables,
  packPlaneQueryResults,
  runPackedPlaneQueries,
  runPlaneCompute,
  runScheduledPlaneCompute,
  resetDefaultPlaneComputeTelemetry,
  unpackPlaneQueryResults,
} from './compute/index.js';
export type {
  PackedPlaneQueryDescriptor,
  PackedPlaneQueryResult,
  PlaneComputeBackend,
  PlaneComputeBackendKind,
  PlaneComputeDebugTrace,
  PlaneComputeCircuitBreakerState,
  PlaneComputePerformanceProfile,
  PlaneComputePriority,
  PlaneComputeQuality,
  PlaneComputeRequest,
  PlaneComputeResponse,
  PlaneComputeScheduleTrace,
  PlaneComputeScheduler,
  PlaneComputeSchedulerOptions,
  PlaneComputeTelemetryBackendStats,
  PlaneComputeTelemetryBucket,
  PlaneComputeTelemetrySnapshot,
} from './compute/index.js';

// Contour utilities
export {
  buildContourPaths,
  canonicalizeContourPoint,
  cellMaskFromBooleans,
  cellMaskFromValues,
  contourEdgeKey,
  contourPointKey,
  contourPointsEqual,
  extractAdaptiveContourSegments,
  extractGridContourSegments,
  interpolateCellEdge,
  interpolateZero,
  pointOnCellEdge,
  segmentEdgesForCell,
} from './contour/index.js';
export type {
  AdaptiveContourCell,
  AdaptiveContourExtraction,
  AdaptiveContourOptions,
  AdaptiveContourRefineContext,
  BuildContourPathOptions,
  ContourCell,
  ContourCellBounds,
  ContourCellEvent,
  ContourCellValues,
  ContourEdge,
  ContourEdgePair,
  ContourInterpolation,
  ContourPoint,
  ContourSegment,
  ContourSegmentExtraction,
  GridContourOptions,
  ScalarContourGrid,
} from './contour/index.js';

// Plane geometry
export {
  colorAtPlanePoint,
  colorToPlane,
  createPlaneQueryKey,
  definePlane,
  definePlaneFromColor,
  getPlaneChromaBand,
  getPlaneContrastBoundary,
  getPlaneContrastRegion,
  getPlaneFallbackPoint,
  getPlaneGamutBoundary,
  getPlaneGamutRegion,
  inspectPlaneQueries,
  inspectPlaneQuery,
  PlaneQueryCache,
  planeHue,
  planeModelChannels,
  planeModelDefaultRange,
  planeToColor,
  PLANE_DEFAULT_RANGES,
  PLANE_MODEL_CHANNELS,
  PLANE_MODEL_DEFAULT_AXES,
  PLANE_MODEL_DEFAULT_RANGES,
  resolvePlaneDefinition,
  runCachedPlaneQuery,
  runPlaneQueries,
  runPlaneQuery,
  samplePlaneGradient,
  sense,
  toSvgCompoundPath,
  toSvgPath,
  unionRegions,
  intersectRegions,
  differenceRegions,
  nearestPointOnPath,
  pointDistance,
  containsPoint,
  translateRegion,
  scaleRegion,
  rotateRegion,
  projectRegionBetweenPlanes,
  usesLightnessAndChroma,
} from './plane/index.js';
export type {
  Plane,
  PlaneAxis,
  PlaneBooleanOptions,
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
  PlaneGamutSolver,
  PlaneGradientQuery,
  PlaneGradientResult,
  PlaneQueryInspection,
  PlaneModelColor,
  PlaneModel,
  PlanePoint,
  PlaneQuery,
  PlaneQueryCacheOptions,
  PlaneQueryResult,
  PlaneQueryTrace,
  PlaneQueryTraceBranchingStage,
  PlaneQueryTraceCellEvent,
  PlaneQueryTraceCuspStage,
  PlaneQueryTraceHybridSample,
  PlaneQueryTraceHybridSamplesStage,
  PlaneQueryTraceLevel,
  PlaneQueryTraceMarchingSquaresStage,
  PlaneQueryTraceMetricsStage,
  PlaneQueryTraceOptions,
  PlaneQueryTracePathStage,
  PlaneQueryTraceRefinementDecision,
  PlaneQueryTraceRefinementStage,
  PlaneQueryTraceRootIteration,
  PlaneQueryTraceRootStage,
  PlaneQueryTraceScalarGridStage,
  PlaneQueryTraceSolverStage,
  PlaneQueryTraceStage,
  PlaneQueryTraceSummary,
  PlaneQueryTraceViewportStage,
  PlaneSense,
  PlaneSenseApi,
  PlaneWithSense,
  PlaneRegion,
  PlaneRegionPoint,
  PlaneTraceBounds,
  PlaneViewportRelation,
  ResolvedPlaneAxis,
  ResolvedPlaneDefinition,
  SvgPathCompileOptions,
} from './plane/index.js';
