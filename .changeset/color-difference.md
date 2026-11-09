---
'@pbroom/color-kit': minor
---

Add color-difference functions to the root entry.

- `deltaEOK(a, b)`: Euclidean distance in OKLab, as CSS Color 4 defines it, with no scaling factor (black to white is 1).
- `deltaE2000(a, b)`: CIEDE2000 in CIE Lab with the D50 white point and kL = kC = kH = 1, matching CSS Color 4 and colorjs.io (black to white is 100).

Both ignore alpha and work on unclamped values, so colors outside sRGB compare by their real coordinates.
