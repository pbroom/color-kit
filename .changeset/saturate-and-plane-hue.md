---
'color-kit': patch
---

`saturate` and `desaturate` no longer cap OKLCH chroma at `0.4`. Before, a wide-gamut color above `0.4`, such as Rec. 2020 green at ≈ 0.47, lost chroma: `saturate` lowered it and `desaturate(color, 0)` changed it. Now chroma is only clamped below at `0`, which matches how `lighten` and `darken` treat lightness. `saturate` still steps by `amount * 0.4`. The results are still not gamut mapped.

`planeHue` now always returns an OKLCH hue. On `hsl`, `hsv` and `hct` planes it used to return the model's own hue. Now it converts the fixed color, so HSL red (`h: 0`) resolves to ≈ 29.2. When the fixed color is achromatic, it uses the hue's most saturated color instead. The `hue` reported by the gamut-boundary, contrast and chroma-band plane queries changes to match.
