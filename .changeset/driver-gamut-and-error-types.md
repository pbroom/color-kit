---
'color-kit': patch
---

The `color-kit/driver` color-state helpers now reject unknown gamuts in the same way as the core plane queries. Before, a value such as the removed `'p3'` spelling was accepted silently and rendered as sRGB. Now `createColorState`, `setColorActiveGamut`, `createMultiColorModel`, `setMultiColorActiveGamut` and `getColorDisplayStyles` throw a `TypeError` that ends `'p3' is not supported; use 'display-p3'`. Because of this, `useColor` and `useMultiColor` in `color-kit/react` also throw for an unknown `defaultGamut` or `setActiveGamut` value.

Two error types change to follow the repo convention:

- `sampleSliderGradient` and `getSliderGradientStyles` throw a `RangeError` (was `Error`) when `steps` is below 2 or not finite.
- `createMultiColorModel` and `addMultiColorEntry` throw a `TypeError` when a color is neither a string nor an object. Before, they stored an empty color.

Unparseable color strings still throw `parse`'s `Error`.
