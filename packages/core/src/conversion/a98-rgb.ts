/**
 * Exponent of the Adobe RGB (1998) transfer curve: `563 / 256`
 * (2.19921875), as CSS Color 4 and colorjs.io define `a98-rgb`.
 *
 * The `color(a98-rgb ...)` parser (`parse.ts`) writes the same `563 / 256`
 * inline rather than importing this, so bundles that parse do not change;
 * `a98-rgb-gamut.test.ts` checks the descriptor's curve against the
 * parser's formula and against parsed colors.
 */
export const A98_RGB_GAMMA = 563 / 256;

/**
 * Inverse Adobe RGB (1998) transfer function (linearization): gamma-encoded
 * to linear light, for one channel. A pure {@link A98_RGB_GAMMA} power,
 * extended to negative values by mirroring the sign (CSS Color 4).
 */
export function a98RgbToLinearChannel(c: number): number {
  return c < 0 ? -Math.pow(-c, A98_RGB_GAMMA) : Math.pow(c, A98_RGB_GAMMA);
}
