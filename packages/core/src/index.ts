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
  tryParse,
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
export type { CssColorFormat } from './conversion/index.js';

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
  ensureContrast,
  tryEnsureContrast,
  contrastRegionPath,
  contrastRegionPaths,
  clampContrastRegionSampling,
} from './contrast/index.js';
export type {
  ContrastApcaPolarity,
  ContrastApcaPreset,
  ContrastApcaRole,
  ContrastMetric,
  ContrastOptions,
  ContrastPrecision,
  ContrastRegionLevel,
  ContrastRegionPoint,
  ContrastRegionPathOptions,
  ContrastRegionSampling,
  ContrastTargetOptions,
  EnsureContrastDirection,
  EnsureContrastOptions,
} from './contrast/index.js';

// Color difference
export { deltaEOK, deltaE2000 } from './difference/index.js';

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
export { ACHROMATIC_CHROMA_THRESHOLD, isAchromatic } from './utils/index.js';
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
export { assertGamutTarget } from './gamut/target.js';
export type {
  GamutTarget,
  GamutMapMethod,
  GamutMapOptions,
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
export {
  normalizeHue,
  linearToSrgbChannel,
  srgbToLinearChannel,
} from './utils/index.js';

// Plane geometry: the essentials. Standalone queries, the query cache, region
// operations, inspection and trace types live in the `plane` entry point.
export {
  colorToPlane,
  definePlane,
  definePlaneFromColor,
  planeToColor,
  sense,
  toSvgCompoundPath,
  toSvgPath,
} from './plane/index.js';
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
  PlaneContrastPointOptions,
  PlaneContrastPointQuery,
  PlaneContrastPointResult,
  PlaneContrastPointStatus,
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
  PlaneModelColor,
  PlaneModel,
  PlanePoint,
  PlaneQuery,
  PlaneQueryResult,
  PlaneSense,
  PlaneRegion,
  PlaneRegionPoint,
  PlaneViewportRelation,
  ResolvedPlaneAxis,
  ResolvedPlaneDefinition,
  SvgPathCompileOptions,
} from './plane/index.js';
