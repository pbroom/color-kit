/**
 * CIE XYZ, CIE Lab (D50) and the CSS Color 4 predefined RGB spaces that are
 * only needed for parsing (`lab()`, `lch()` and `color()`).
 *
 * Matrices are the full float64 values from CSS Color 4 (sample code in
 * https://www.w3.org/TR/css-color-4/#color-conversion-code), which colorjs.io
 * uses too: RGB -> XYZ matrices are derived from each space's primaries and
 * white point, and D50 <-> D65 adaptation is linear Bradford.
 */

import type { Color } from '../types.js';
import { fromLinearSrgbInto } from './into.js';
import type { Matrix3 } from './matrices.js';

export type Vec3 = [number, number, number];

/** CIE XYZ (D65) -> linear sRGB. */
export const XYZ_D65_TO_LINEAR_SRGB: Matrix3 = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];

/** CIE XYZ (D50) -> CIE XYZ (D65), linear Bradford chromatic adaptation. */
export const XYZ_D50_TO_XYZ_D65: Matrix3 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];

/** Linear Rec. 2020 -> CIE XYZ (D65). */
export const LINEAR_REC2020_TO_XYZ_D65: Matrix3 = [
  [0.6369580483012914, 0.14461690358620832, 0.1688809751641721],
  [0.2627002120112671, 0.6779980715188708, 0.05930171646986196],
  [0, 0.028072693049087428, 1.060985057710791],
];

/** Linear A98 RGB -> CIE XYZ (D65). */
export const LINEAR_A98_RGB_TO_XYZ_D65: Matrix3 = [
  [0.5766690429101305, 0.1855582379065463, 0.1882286462349947],
  [0.29734497525053605, 0.6273635662554661, 0.07529145849399788],
  [0.02703136138641234, 0.07068885253582723, 0.9913375368376388],
];

/** Linear ProPhoto RGB -> CIE XYZ (D50). */
export const LINEAR_PROPHOTO_RGB_TO_XYZ_D50: Matrix3 = [
  [0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
  [0.2880748288194013, 0.711835234241873, 0.00008993693872564],
  [0, 0, 0.8251046025104602],
];

/** D50 reference white (CIE XYZ, Y = 1), from its xy chromaticity. */
const D50_X = 0.3457 / 0.3585;
const D50_Z = (1 - 0.3457 - 0.3585) / 0.3585;

/** CIE Lab constants: κ = 29³/3³ and ε = 6³/29³. */
const KAPPA = 24389 / 27;
const EPSILON = 216 / 24389;

/** Multiply a 3x3 matrix by a column vector. */
export function multiplyMatrix3(m: Matrix3, [x, y, z]: Vec3): Vec3 {
  return [
    m[0][0] * x + m[0][1] * y + m[0][2] * z,
    m[1][0] * x + m[1][1] * y + m[1][2] * z,
    m[2][0] * x + m[2][1] * y + m[2][2] * z,
  ];
}

/** Convert CIE Lab (D50; L 0-100) to CIE XYZ (D50). */
export function labToXyzD50(L: number, a: number, b: number): Vec3 {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  // `t > 6 / 29` is `t³ > ε`, written as colorjs.io / CSS Color 4 do.
  const f = (t: number) => (t > 6 / 29 ? t ** 3 : (116 * t - 16) / KAPPA);
  return [
    f(fx) * D50_X,
    L > KAPPA * EPSILON ? fy ** 3 : L / KAPPA,
    f(fz) * D50_Z,
  ];
}

/**
 * Convert CIE XYZ (D65, or D50 when `d50` is set) to a Color, writing into
 * `out`.
 */
export function fromXyzInto(out: Color, xyz: Vec3, d50: boolean): Color {
  const [r, g, b] = multiplyMatrix3(
    XYZ_D65_TO_LINEAR_SRGB,
    d50 ? multiplyMatrix3(XYZ_D50_TO_XYZ_D65, xyz) : xyz,
  );
  return fromLinearSrgbInto(out, { r, g, b, alpha: out.alpha });
}
