/**
 * Shared floating-point margin for gamut boundary checks.
 *
 * Matrix math through OKLab can produce near-zero negative linear channel
 * values for colors that are in gamut. Every gamut membership or
 * margin classification should use this single tolerance so boundary
 * behavior stays consistent across modules.
 *
 * `inSrgbGamut` / `inP3Gamut` apply it to gamma-encoded channels (matching
 * CSS Color 4 and colorjs.io `inGamut`), i.e. linear bounds of
 * [-GAMUT_EPSILON / 12.92, linearize(1 + GAMUT_EPSILON)].
 *
 * `inRec2020Gamut` applies it to Rec. 2020's own encoded channels, a 2.4
 * power curve, i.e. linear bounds of
 * [-(GAMUT_EPSILON ** 2.4), (1 + GAMUT_EPSILON) ** 2.4]. That curve has no
 * linear toe, so the same encoded tolerance is far smaller in linear light
 * near black (1.3e-10 against 5.8e-6): very dark colors within the sRGB
 * tolerance can be outside the Rec. 2020 one. The bounds for every gamut
 * are defined once, in `linear-bounds.ts`.
 */
export const GAMUT_EPSILON = 0.000075;

/**
 * Width of the final bisection interval in `maxChromaAt()`. The returned
 * chroma is the in-gamut end of that interval, so the true boundary chroma can
 * sit up to this much higher (at most `0.4 / 4096` ≈ 9.77e-5 with defaults).
 * Anything comparing a chroma against `maxChromaAt()` must allow this slack or
 * it will reject colors that `inSrgbGamut` / `inP3Gamut` accept.
 */
export const MAX_CHROMA_SEARCH_TOLERANCE = 0.0001;
