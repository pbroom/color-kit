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
 * The Rec. 2020 matrices have the same provenance: `XYZ_to_lin_2020` is the
 * rational matrix of the CSS Color 4 sample code
 * (https://www.w3.org/TR/css-color-4/#color-conversion-code) evaluated in
 * float64, `lin_2020_to_XYZ` is the value colorjs.io ships for the same
 * rationals, and the linear-sRGB <-> linear-Rec2020 and LMS -> linear-Rec2020
 * matrices are the float64 products `XYZ_to_lin_2020 · lin_sRGB_to_XYZ`,
 * `XYZ_to_lin_sRGB · lin_2020_to_XYZ` and `XYZ_to_lin_2020 · LMStoXYZ`.
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

/** Linear Rec. 2020 -> CIE XYZ (D65). */
export const LINEAR_REC2020_TO_XYZ_D65: Matrix3 = [
  [0.6369580483012914, 0.14461690358620832, 0.1688809751641721],
  [0.2627002120112671, 0.6779980715188708, 0.05930171646986196],
  [0, 0.028072693049087428, 1.060985057710791],
];

/** CIE XYZ (D65) -> linear Rec. 2020. */
export const XYZ_D65_TO_LINEAR_REC2020: Matrix3 = [
  [1.7166511879712676, -0.3556707837763924, -0.2533662813736598],
  [-0.666684351832489, 1.616481236634939, 0.01576854581391113],
  [0.017639857445310915, -0.042770613257808655, 0.942103121235474],
];

/** Linear sRGB -> linear Rec. 2020 (`XYZ_to_lin_2020 · lin_sRGB_to_XYZ`). */
export const LINEAR_SRGB_TO_LINEAR_REC2020: Matrix3 = [
  [0.627403895934699, 0.3292830383778836, 0.043313065687417246],
  [0.06909728935823205, 0.9195403950754587, 0.011362315566309173],
  [0.01639143887515028, 0.08801330787722576, 0.895595253247624],
];

/** Linear Rec. 2020 -> linear sRGB (`XYZ_to_lin_sRGB · lin_2020_to_XYZ`). */
export const LINEAR_REC2020_TO_LINEAR_SRGB: Matrix3 = [
  [1.6604910021084343, -0.5876411387885496, -0.0728498633198848],
  [-0.12455047452159085, 1.1328998971259603, -0.008349422604369473],
  [-0.018150763354905307, -0.10057889800800737, 1.1187296613629127],
];

/** LMS -> linear Rec. 2020 (`XYZ_to_lin_2020 · LMStoXYZ`). */
export const LMS_TO_LINEAR_REC2020: Matrix3 = [
  [2.1399067304346513, -1.2463894937606177, 0.10648276332596673],
  [-0.8847358357577673, 2.1632309383612003, -0.2784951026034336],
  [-0.04857374640044399, -0.45450314971409633, 1.5030768961145402],
];
