// Types
export type {
  Color,
  Rgb,
  LinearRgb,
  Hsl,
  Hsv,
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
export { interpolate, generateScale, lightnessScale } from './scale/index.js';

// Manipulation
export {
  lighten,
  darken,
  saturate,
  desaturate,
  adjustHue,
  setAlpha,
  mix,
  invert,
  grayscale,
} from './manipulation/index.js';

// Gamut
export {
  inSrgbGamut,
  inP3Gamut,
  toSrgbGamut,
  toP3Gamut,
  maxChromaAt,
  gamutBoundaryPath,
} from './gamut/index.js';
export type {
  GamutTarget,
  GamutBoundaryPoint,
  MaxChromaAtOptions,
  GamutBoundaryPathOptions,
} from './gamut/index.js';

// Utilities
export { clamp, round, normalizeHue, lerp } from './utils/index.js';
