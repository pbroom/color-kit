---
'@pbroom/color-kit': minor
---

Adobe RGB (1998) is a built-in gamut.

- New export `a98Rgb` from `@pbroom/color-kit` and `@pbroom/color-kit/plane`: a `Gamut` descriptor with `id: 'a98-rgb'`, the CSS `color()` name. Pass it wherever a `gamut` option is accepted (`maxChromaAt`, `maxChromaForHue`, `gamutBoundaryPath`, the contrast metrics, `ensureContrast` and every plane query) and to the generic `inGamut(color, a98Rgb)` and `toGamut(color, a98Rgb)`. There are no named helpers and no `toCss` format for it.
- Primaries and D65 white per CSS Color 4, with its transfer curve, a sign-mirrored `563 / 256` power. Membership allows `GAMUT_EPSILON` on those encoded channels, so, as for Rec. 2020, its tolerance near black is much tighter than the sRGB and Display P3 one.
- Its default `maxChroma` is `0.4`: Adobe RGB (1998) reaches about 0.395 OKLCH chroma, at its green primary.
- Adobe RGB (1998) contains sRGB and lies inside Rec. 2020. It and Display P3 each hold colors the other lacks: P3 reaches more red chroma, Adobe RGB more green and cyan.
- A bundle that does not import `a98Rgb` carries none of its data.
