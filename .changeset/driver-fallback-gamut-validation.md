---
'color-kit': patch
---

`getColorAreaFallbackPoint` (`color-kit/driver`) now throws a `TypeError` for an unknown `gamut`, such as the removed `'p3'` spelling, instead of silently mapping it to sRGB. The message matches the core plane queries and ends `'p3' is not supported; use 'display-p3'`. `assertGamutTarget` is exported from `color-kit/plane` for consumers that need the same check.
