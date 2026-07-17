/**
 * Shared floating-point margin for gamut boundary checks.
 *
 * Matrix math through OKLab can produce near-zero negative linear channel
 * values for colors that are actually in gamut. Every gamut membership or
 * margin classification should use this single tolerance so boundary
 * behavior stays consistent across modules.
 */
export const GAMUT_EPSILON = 0.000075;
