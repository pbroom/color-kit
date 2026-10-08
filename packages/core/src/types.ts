/**
 * The color value every color-kit API takes and returns: an OKLCH color.
 *
 * OKLCH is the polar form of OKLab, a perceptually uniform space, so equal
 * steps in `l`, `c` or `h` look like roughly equal visual changes. A Color
 * is not tied to a gamut: it can describe colors outside sRGB or Display P3
 * (see `inSrgbGamut` / `toSrgbGamut`). Create one with `parse`, `fromRgb`,
 * `fromHex` and friends, or as a plain object literal.
 */
export interface Color {
  /** OKLCH lightness: `0` (black) to `1` (white). */
  l: number;
  /**
   * OKLCH chroma: `0` (gray) upward. sRGB colors peak around `0.32` and
   * Display P3 around `0.37`; there is no hard upper bound.
   */
  c: number;
  /**
   * OKLCH hue in degrees, normally `[0, 360)`. Meaningless (powerless) when
   * the color is achromatic; see `isAchromatic`.
   */
  h: number;
  /** Opacity: `0` (transparent) to `1` (opaque). */
  alpha: number;
}

/**
 * Gamma-encoded sRGB color with `0-255` channels. Values returned by
 * `toRgb` are integers; inputs may be fractional.
 */
export interface Rgb {
  /** Red: `0-255`. */
  r: number;
  /** Green: `0-255`. */
  g: number;
  /** Blue: `0-255`. */
  b: number;
  /** Opacity: `0-1`. */
  alpha: number;
}

/**
 * Linear-light sRGB color with nominal `0-1` channels. Channels may fall
 * outside `[0, 1]` for out-of-gamut colors.
 */
export interface LinearRgb {
  /** Red, linear light (nominally `0-1`). */
  r: number;
  /** Green, linear light (nominally `0-1`). */
  g: number;
  /** Blue, linear light (nominally `0-1`). */
  b: number;
  /** Opacity: `0-1`. */
  alpha: number;
}

/** HSL color in the sRGB space. */
export interface Hsl {
  /** Hue in degrees: `0-360`. */
  h: number;
  /** Saturation: `0-100`. */
  s: number;
  /** Lightness: `0-100`. */
  l: number;
  /** Opacity: `0-1`. */
  alpha: number;
}

/** HSV/HSB color in the sRGB space. */
export interface Hsv {
  /** Hue in degrees: `0-360`. */
  h: number;
  /** Saturation: `0-100`. */
  s: number;
  /** Value (brightness): `0-100`. */
  v: number;
  /** Opacity: `0-1`. */
  alpha: number;
}

/** Material Design HCT color (CAM16 hue and chroma, CIE L* tone). */
export interface Hct {
  /** CAM16 hue in degrees: `0-360`. */
  h: number;
  /** CAM16 chroma: `>= 0` (Material HCT units, not OKLCH chroma). */
  c: number;
  /** Tone (CIE L*): `0` (black) to `100` (white). */
  t: number;
  /** Opacity: `0-1`. */
  alpha: number;
}

/** OKLab color, the rectangular form of OKLCH (perceptually uniform). */
export interface Oklab {
  /** Lightness: `0-1`. */
  L: number;
  /** Green (negative) to red (positive) axis: about `-0.4` to `0.4`. */
  a: number;
  /** Blue (negative) to yellow (positive) axis: about `-0.4` to `0.4`. */
  b: number;
  /** Opacity: `0-1`. */
  alpha: number;
}

/**
 * OKLCH color, the cylindrical form of OKLab. Structurally identical to
 * {@link Color}.
 */
export interface Oklch {
  /** Lightness: `0-1`. */
  l: number;
  /** Chroma: `0` to about `0.4`. */
  c: number;
  /** Hue in degrees: `0-360`. */
  h: number;
  /** Opacity: `0-1`. */
  alpha: number;
}

/**
 * Display P3 color (a wider gamut than sRGB) with `0-1` channels. Holds
 * gamma-encoded values (as from `toP3`) or linear-light values (as from
 * `linearSrgbToLinearP3`), depending on the producer.
 */
export interface P3 {
  /** Red: `0-1`. */
  r: number;
  /** Green: `0-1`. */
  g: number;
  /** Blue: `0-1`. */
  b: number;
  /** Opacity: `0-1`. */
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

/** A parsed color with its original format preserved. */
export interface ParsedColor {
  /** The parsed color. */
  color: Color;
  /** The format the color was written in. */
  originalFormat: string;
}
