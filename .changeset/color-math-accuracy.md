---
'color-kit': minor
---

More accurate contrast, achromatic hue handling, and gamut mapping.

- **Contrast from unrounded values:** `relativeLuminance`, `contrastRatio`, `contrastAPCA`, `meetsAA`, and `meetsAAA` measure unrounded sRGB channels clipped to the display gamut instead of 8-bit rounded values, matching colorjs.io for in-gamut colors. New `ContrastOptions` take `gamut` (`'srgb'` default, or `'display-p3'`) and `precision` (`'exact'` default, or `'8bit'` to reproduce 0.1 results exactly). Contrast regions evaluate the same public checks, so points inside an AA region pass `contrastRatio() >= 4.5`. `toHsl`, `toHsv`, and `toHct` no longer round to 8-bit first. For 8-bit inputs, pass/fail decisions are unchanged.
- **Achromatic hues:** one shared threshold, exported as `ACHROMATIC_CHROMA_THRESHOLD` with an `isAchromatic()` helper. Option-less `mix()`/`mixInto()` now use the same OKLCH default as `interpolate()` and `generateScale()`: a gray endpoint borrows the other endpoint's hue, so `mix('white', '#0000ff')` matches colorjs.io. `linearToSrgbChannel`/`srgbToLinearChannel` are exported as the single sign-preserving, extended-range sRGB transfer pair.
- **Selectable gamut mapping:** `toSrgbGamut`, `toP3Gamut`, `toSrgbGamutInto`, and `toP3GamutInto` accept `{ method: 'chroma-reduction' | 'css' }` (`GamutMapMethod`, `GamutMapOptions`). `'css'` implements the CSS Color 4 algorithm and matches colorjs.io `toGamut({ method: 'css' })` outside the `GAMUT_EPSILON` band. The default stays `'chroma-reduction'`, which preserves lightness and hue. In `color-kit/driver`, `createColorState` and `mapDisplayedColors` take `gamutMapMethod`; the state records it in `meta.gamutMapMethod`, and later updates reuse it.
