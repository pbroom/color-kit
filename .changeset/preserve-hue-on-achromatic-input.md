---
'color-kit': minor
---

Keep the previous hue when an achromatic color is entered.

- **State layer:** `useColor`'s `setFromString`, `setFromRgb`, `setFromHsl` and `setFromHsv`, RGB/HSL `ColorInput` edits and `ColorStringInput` now keep the latest requested hue when the new color is a gray, black or white, so raising chroma afterwards resumes it instead of jumping to hue `0`. An `oklch()` string with a hue (not `none`) or an OKLCH object passed to `setRequested` still keeps its own hue. Pass `explicitHue: true` to store the converted hue.
- **Options:** `SetRequestedOptions`, `setColorRequested` and `setMultiColorRequested` accept `explicitHue` (default `true` for OKLCH objects); `useMultiColor().setRequested` forwards it.
- **Driver helpers:** `resolveIncomingRequested(previous, incoming, { explicitHue })` and `hasExplicitOklchHue(css)`. `colorFromColorInputChannelValue` keeps the hue for achromatic RGB/HSL results.
- Core `parse()` and the conversions are unchanged.
