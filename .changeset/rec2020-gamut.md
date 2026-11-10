---
'@pbroom/color-kit': minor
---

Gamuts are imported descriptor objects, and Rec. 2020 is one of them.

**Breaking: a `gamut` option takes a `Gamut` object, never a string.** Import the gamut you want and pass it:

```ts
import { displayP3, maxChromaAt, rec2020 } from '@pbroom/color-kit';
import { sense } from '@pbroom/color-kit/plane';

maxChromaAt(0.7, 150, { gamut: displayP3 }); // was { gamut: 'display-p3' }
sense(plane).gamutBoundary({ gamut: rec2020 });
```

- New exports from `@pbroom/color-kit` and `@pbroom/color-kit/plane`: the built-in gamuts `srgb`, `displayP3` and `rec2020`, the `Gamut` and `GamutTransfer` types, and `assertGamut()`.
- Every `gamut` option takes a `Gamut` and defaults to `srgb`: `maxChromaAt`, `maxChromaForHue`, `gamutBoundaryPath`, `chromaBand`, `contrastRegionPaths`, the contrast metrics (`contrastRatio`, `contrastAPCA`, `relativeLuminance`, `meetsAA`, `meetsAAA`), `ensureContrast` / `tryEnsureContrast` and every plane query (`gamutBoundary`, `gamutRegion`, `fallbackPoint`, `chromaBand`, `contrastRegion`, `contrastBoundary`, `contrastPoint`).
- A string such as `'display-p3'` now throws a `TypeError` that says to import a gamut. There is no string fallback.
- A `Gamut` is plain data (an `id`, three matrices, transfer-curve numbers, linear membership bounds and a default chroma bound), so it survives `structuredClone` and `postMessage`. Your own object of that shape works everywhere a built-in does, for example `{ ...rec2020, id: 'my-gamut' }`. Gamuts are identified by `id`, which caches key on, so give a custom gamut an id of its own. The built-in ids are the CSS `color()` names `'srgb'`, `'display-p3'` and `'rec2020'`.
- A bundle contains only the gamuts it imports. `contrastRatio(a, b)` no longer carries Display P3 data, and plane queries no longer carry every gamut's matrices.
- Plane query results (`gamutBoundary`, `gamutRegion`, `fallbackPoint`) report `gamut` as the `Gamut` object that went in; read `result.gamut.id` for the name. Packed results carry the same object, and the packed ABI version is now 3.
- New generic `inGamut(color, gamut)`, `toGamut(color, gamut, options?)` and `toGamutInto(out, color, gamut, options?)`. The named functions (`inSrgbGamut`, `toP3Gamut`, ...) are unchanged.
- Removed: the `GamutTarget` type and `assertGamutTarget()`.

**Rec. 2020.**

- `rec2020` works with every function and query above, including the contrast metrics and `ensureContrast` (colors are measured clipped to Rec. 2020; `precision: '8bit'` quantizes in the gamut's own encoding).
- New `inRec2020Gamut(color)`, `toRec2020Gamut(color, options?)` and `toRec2020GamutInto(out, color, options?)`, with the same options and allocation-free behavior as the sRGB and Display P3 functions.
- `toCss(color, 'rec2020')` writes `color(rec2020 r g b)`. (Format names, plane `model` names and interpolation spaces are still strings.)
- New `LINEAR_SRGB_TO_LINEAR_REC2020` matrix export.
- The default `maxChroma` of chroma searches and contrast regions is the gamut's own `maxChroma`: `0.5` for `rec2020`, because Rec. 2020 reaches about 0.47 OKLCH chroma, and `0.4` for `srgb` and `displayP3`. sRGB and Display P3 results are unchanged.
- Rec. 2020 membership allows `GAMUT_EPSILON` on Rec. 2020's own encoded channels (a 2.4 power curve, as in CSS Color 4 and colorjs.io), so its tolerance near black is much tighter than the sRGB and Display P3 one.
- Rec. 2020 does not contain all of Display P3: two thin slivers of P3, around its red primary and around its cyan near white, are outside it by up to about 0.002 OKLCH chroma.

**Driver and React keep string display gamuts.** `@pbroom/color-kit/driver` and `@pbroom/color-kit/react` still take `'srgb' | 'display-p3'` (`activeGamut`, the `gamut` option of the plane geometry hooks, `getColorArea*` options), because that is the browser's display vocabulary. `'rec2020'` and gamut objects throw a `TypeError` there.

- New `DisplayGamut` type (`'srgb' | 'display-p3'`), exported from `@pbroom/color-kit/driver` and `@pbroom/color-kit/react`. It replaces the `GamutTarget` type those entries exported.
- New in `@pbroom/color-kit/driver`: `assertDisplayGamut()` and `displayGamutDescriptor(name)`, which returns the core `Gamut` for a display gamut name. Use it to pass a picker's `activeGamut` to a core function.
- `ColorAreaContrastRegionOptions` is the core `ContrastRegionPathOptions` with `gamut` typed as `DisplayGamut`.
