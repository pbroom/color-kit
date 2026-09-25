import { srgbToLinearChannel } from '../utils/index.js';
import { GAMUT_EPSILON } from './constants.js';

/**
 * Linear-light bounds equivalent to allowing GAMUT_EPSILON of slack on the
 * gamma-encoded channels (the CSS Color 4 / colorjs.io convention). Both sRGB
 * and Display P3 share the sRGB transfer function.
 *
 * Applying the epsilon directly in linear light (as earlier versions did)
 * is far too permissive near black: -7.5e-5 linear is -9.7e-4 encoded, which
 * let e.g. `oklch(0.028 0.066 131)` pass as in gamut when the true boundary
 * chroma is ~0.008.
 *
 * Every gamut membership test on unclamped linear channels (`inSrgbGamut`,
 * `inP3Gamut`, the plane gamut-region field) must use these bounds so the
 * APIs classify boundary colors identically.
 */
export const GAMUT_LINEAR_MIN = -GAMUT_EPSILON / 12.92;
export const GAMUT_LINEAR_MAX = /* @__PURE__ */ srgbToLinearChannel(
  1 + GAMUT_EPSILON,
);

/**
 * Signed distance (in linear light) from unclamped linear RGB channels to the
 * nearest gamut bound. Non-negative exactly when the channels are in gamut.
 */
export function linearChannelGamutMargin(
  r: number,
  g: number,
  b: number,
): number {
  return Math.min(
    r - GAMUT_LINEAR_MIN,
    g - GAMUT_LINEAR_MIN,
    b - GAMUT_LINEAR_MIN,
    GAMUT_LINEAR_MAX - r,
    GAMUT_LINEAR_MAX - g,
    GAMUT_LINEAR_MAX - b,
  );
}

/** Whether unclamped linear RGB channels fall within the shared gamut bounds. */
export function linearChannelsInGamut(
  r: number,
  g: number,
  b: number,
): boolean {
  return (
    r >= GAMUT_LINEAR_MIN &&
    r <= GAMUT_LINEAR_MAX &&
    g >= GAMUT_LINEAR_MIN &&
    g <= GAMUT_LINEAR_MAX &&
    b >= GAMUT_LINEAR_MIN &&
    b <= GAMUT_LINEAR_MAX
  );
}
