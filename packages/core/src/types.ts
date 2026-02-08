/**
 * Internal color representation using OKLCH color space.
 * OKLCH is perceptually uniform, making it ideal for
 * manipulation, interpolation, and scale generation.
 */
export interface Color {
  /** Lightness: 0 (black) to 1 (white) */
  l: number;
  /** Chroma: 0 (gray) to ~0.4 (most saturated) */
  c: number;
  /** Hue: 0 to 360 (degrees) */
  h: number;
  /** Alpha/opacity: 0 (transparent) to 1 (opaque) */
  alpha: number;
}

/** Standard RGB color (0-255 per channel) */
export interface Rgb {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

/** Linear RGB color (0-1 per channel, linear light) */
export interface LinearRgb {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

/** HSL color */
export interface Hsl {
  /** Hue: 0-360 */
  h: number;
  /** Saturation: 0-100 */
  s: number;
  /** Lightness: 0-100 */
  l: number;
  alpha: number;
}

/** HSV/HSB color */
export interface Hsv {
  /** Hue: 0-360 */
  h: number;
  /** Saturation: 0-100 */
  s: number;
  /** Value/Brightness: 0-100 */
  v: number;
  alpha: number;
}

/** OKLAB color (perceptually uniform) */
export interface Oklab {
  /** Lightness: 0-1 */
  L: number;
  /** Green-red axis: ~-0.4 to ~0.4 */
  a: number;
  /** Blue-yellow axis: ~-0.4 to ~0.4 */
  b: number;
  alpha: number;
}

/** OKLCH color (cylindrical form of OKLAB) */
export interface Oklch {
  /** Lightness: 0-1 */
  l: number;
  /** Chroma: 0 to ~0.4 */
  c: number;
  /** Hue: 0-360 */
  h: number;
  alpha: number;
}

/** Display P3 color (wider gamut than sRGB) */
export interface P3 {
  /** Red: 0-1 */
  r: number;
  /** Green: 0-1 */
  g: number;
  /** Blue: 0-1 */
  b: number;
  alpha: number;
}

/** Supported color space identifiers */
export type ColorSpace =
  | 'srgb'
  | 'linear-srgb'
  | 'hsl'
  | 'hsv'
  | 'oklab'
  | 'oklch'
  | 'display-p3';

/** A parsed color with its original format preserved */
export interface ParsedColor {
  color: Color;
  originalFormat: string;
}
