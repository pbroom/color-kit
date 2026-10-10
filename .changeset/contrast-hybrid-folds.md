---
'color-kit': patch
---

The hybrid contrast-region engine keeps a contour connected where it folds back in lightness, and ends it exactly on the chroma axis or the gamut edge. It used to split such contours into pieces or stop short of the gamut edge (gaps of up to 0.027 chroma in a 36-hue WCAG AA sweep on white and black). It also traces thin regions at the top of the lightness range, which it used to report as degraded with no paths. Open hybrid paths start at their lower-lightness end, but their points are no longer always in ascending lightness.
