/**
 * Full double-precision conversion matrices shared by the conversion and
 * gamut modules.
 *
 * These follow CSS Color 4 / colorjs.io: sRGB and Display P3 matrices are
 * derived directly from the primaries and D65 white chromaticities, and the
 * OKLab matrices are the "recalculated for consistent reference white"
 * versions (https://github.com/w3c/csswg-drafts/issues/6642). The linear-sRGB
 * <-> LMS and linear-P3 <-> LMS matrices are the products
 * `XYZtoLMS · RGBtoXYZ` / `XYZtoRGB · LMStoXYZ`, evaluated in float64.
 *
 * The previous 10-significant-digit values (Ottosson's original blog post and
 * an 8-digit-derived sRGB -> P3 matrix) disagreed with the reference by up to
 * ~2e-7 per matrix entry, which put white at L = 0.99999999, C = 3.7e-8 and
 * produced up to ~3.4e-6 error in gamma-encoded Display P3 channels.
 */

export type Matrix3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

/** Linear sRGB -> LMS (cone response, before the cube root). */
export const LINEAR_SRGB_TO_LMS: Matrix3 = [
  [0.41222146947076294, 0.5363325372617349, 0.051445993267502196],
  [0.21190349581782517, 0.6806995506452345, 0.10739695353694056],
  [0.08830245919005639, 0.2817188391361215, 0.6299787016738223],
];

/** LMS -> linear sRGB. */
export const LMS_TO_LINEAR_SRGB: Matrix3 = [
  [4.07674163607596, -3.307711539258063, 0.23096990318210486],
  [-1.2684379732850315, 2.609757349287688, -0.34131937600265727],
  [-0.004196076138675495, -0.7034186179359363, 1.7076146940746117],
];

/** Non-linear LMS' -> OKLab. */
export const LMS_TO_OKLAB: Matrix3 = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.42859224204858, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];

/** OKLab -> non-linear LMS'. The first column is exactly 1. */
export const OKLAB_TO_LMS: Matrix3 = [
  [1, 0.3963377773761749, 0.2158037573099136],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
];

/** Linear sRGB -> linear Display P3. */
export const LINEAR_SRGB_TO_LINEAR_P3: Matrix3 = [
  [0.8224619687143621, 0.1775380312856376, 0],
  [0.033194198850961636, 0.9668058011490382, 0],
  [0.017082630721120033, 0.07239744066396339, 0.9105199286149166],
];

/** Linear Display P3 -> linear sRGB. */
export const LINEAR_P3_TO_LINEAR_SRGB: Matrix3 = [
  [1.22494017628056, -0.22494017628055996, 0],
  [-0.04205695470968818, 1.0420569547096883, 0],
  [-0.01963755459033439, -0.07863604555063182, 1.0982736001409665],
];

/** LMS -> linear Display P3 (`P3fromXYZ · LMStoXYZ`). */
export const LMS_TO_LINEAR_P3: Matrix3 = [
  [3.127768971361874, -2.257135762591639, 0.12936679122976524],
  [-1.0910090184377974, 2.413331710306921, -0.32232269186912466],
  [-0.026010801938570305, -0.508041331704167, 1.534052133642737],
];
