/**
 * Shared floating-point margin for gamut boundary checks.
 *
 * Matrix math through OKLab can produce near-zero negative linear channel
 * values for colors that are actually in gamut. Every gamut membership or
 * margin classification should use this single tolerance so boundary
 * behavior stays consistent across modules.
 *
 * `inSrgbGamut` / `inP3Gamut` apply it to gamma-encoded channels (matching
 * CSS Color 4 and colorjs.io `inGamut`), i.e. linear bounds of
 * [-GAMUT_EPSILON / 12.92, linearize(1 + GAMUT_EPSILON)].
 */
export const GAMUT_EPSILON = 0.000075;
