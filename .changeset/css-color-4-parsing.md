---
'color-kit': minor
---

Parse the full CSS Color 4 syntax and reject malformed input.

- `parse()` now accepts the 148 named colors plus `transparent`; `rgb()`/`rgba()` and `hsl()`/`hsla()` in modern and legacy comma syntax with percentages; `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`; and `color()` with `srgb`, `srgb-linear`, `display-p3`, `rec2020`, `a98-rgb`, `prophoto-rgb`, `xyz`, `xyz-d65`, and `xyz-d50`. Hue units `deg`/`grad`/`rad`/`turn` are supported, parsed hues are normalized to `[0, 360)`, and `none` is treated as a missing component. Results match colorjs.io to float precision.
- Malformed input now throws instead of producing `NaN`: invalid hex digits or lengths, malformed numbers, and values that overflow to `Infinity` are rejected. `toHex`, `toCss`, and `rgbToHex` throw a `RangeError` for non-finite channels, and `toCss` throws a `TypeError` for an unknown format (its `format` parameter is now the `CssColorFormat` union).
- New `tryParse(input)` returns `Color | null` instead of throwing.
- Bundle size: `parse` now carries the named-color table and the `color()` matrices, so `import { parse, toHex, contrastRatio }` grows from about 2.3 kB to about 5.2 kB gzipped.
