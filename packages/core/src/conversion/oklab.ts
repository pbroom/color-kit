import type { Oklab, LinearRgb } from '../types.js';

/**
 * Convert linear sRGB to OKLAB.
 * Based on Björn Ottosson's reference implementation.
 * https://bottosson.github.io/posts/oklab/
 */
export function linearRgbToOklab(rgb: LinearRgb): Oklab {
  // Linear sRGB to LMS (using Ottosson's matrix)
  const l = 0.4122214708 * rgb.r + 0.5363325363 * rgb.g + 0.0514459929 * rgb.b;
  const m = 0.2119034982 * rgb.r + 0.6806995451 * rgb.g + 0.1073969566 * rgb.b;
  const s = 0.0883024619 * rgb.r + 0.2817188376 * rgb.g + 0.6299787005 * rgb.b;

  // Cube root (non-linear response)
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
    alpha: rgb.alpha,
  };
}

/**
 * Convert OKLAB to linear sRGB.
 */
export function oklabToLinearRgb(lab: Oklab): LinearRgb {
  // OKLAB to LMS (cube roots)
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  // Cube (undo non-linearity)
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS to linear sRGB
  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    alpha: lab.alpha,
  };
}
