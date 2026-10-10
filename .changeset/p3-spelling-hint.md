---
'color-kit': patch
---

Point `'p3'` users to `'display-p3'`. The removed `'p3'` spelling still throws, and every check that rejects an unknown space, model, format, or gamut now ends its `TypeError` with `'p3' is not supported; use 'display-p3'`. Gamut options (`maxChromaAt`, `maxChromaForHue`, `chromaBand`, `gamutBoundaryPath`, contrast metrics and regions, and the plane gamut and fallback queries) now throw a `TypeError` for any unknown `gamut` value instead of silently treating it as sRGB. `packColors` / `unpackColors` throw a `TypeError` (was `RangeError`) for an unknown array space.
