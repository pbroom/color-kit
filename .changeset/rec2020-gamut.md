---
'@pbroom/color-kit': minor
---

Add Rec. 2020 as a gamut target.

- `GamutTarget` is now `'srgb' | 'display-p3' | 'rec2020'`. `maxChromaAt`, `maxChromaForHue`, `gamutBoundaryPath`, `chromaBand`, `contrastRegionPaths` and every plane query (`gamutBoundary`, `gamutRegion`, `fallbackPoint`, `chromaBand`, `contrastRegion`, `contrastBoundary`, `contrastPoint`) accept `gamut: 'rec2020'`.
- New `inRec2020Gamut(color)`, `toRec2020Gamut(color, options?)` and `toRec2020GamutInto(out, color, options?)`, with the same options and allocation-free behavior as the sRGB and Display P3 functions.
- `toCss(color, 'rec2020')` writes `color(rec2020 r g b)`.
- New `LINEAR_SRGB_TO_LINEAR_REC2020` matrix export.
- For `gamut: 'rec2020'` the default `maxChroma` of chroma searches and contrast regions is `0.5` instead of `0.4`, because Rec. 2020 reaches about 0.47 OKLCH chroma. sRGB and Display P3 results are unchanged.
- Rec. 2020 membership allows `GAMUT_EPSILON` on Rec. 2020's own encoded channels (a 2.4 power curve, as in CSS Color 4 and colorjs.io), so its tolerance near black is much tighter than the sRGB and Display P3 one.

New `DisplayGamut` type (`'srgb' | 'display-p3'`) and `assertDisplayGamut()` for code that models the gamut a color is shown in. The contrast metrics (`contrastRatio`, `contrastAPCA`, `relativeLuminance`, `meetsAA`, `meetsAAA`), `ensureContrast` / `tryEnsureContrast` and the driver and React picker state take a `DisplayGamut` and throw a `TypeError` for `'rec2020'`. To find a contrast-safe color in Rec. 2020, use the plane `contrastPoint` query.

Breaking: `@pbroom/color-kit/driver` and `@pbroom/color-kit/react` no longer export a `GamutTarget` type. Import `DisplayGamut` from `@pbroom/color-kit` instead (same values: `'srgb' | 'display-p3'`). `ContrastOptions['gamut']` and `EnsureContrastOptions['gamut']` are typed `DisplayGamut`.

Note that Rec. 2020 does not contain all of Display P3: two thin slivers of P3, around its red primary and around its cyan near white, are outside it by up to about 0.002 OKLCH chroma.
