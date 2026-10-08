---
'color-kit': patch
---

`samplePlaneGradient` now rejects fractional and non-finite `steps` with a `RangeError`, preventing extrapolated endpoints and unbounded sampling. Integer counts below two still produce the two endpoints.
