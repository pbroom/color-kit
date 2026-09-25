---
'@color-kit/react': major
---

Remove deprecated `HueSlider` and `AlphaSlider` wrapper components in favor of `ColorSlider`.

## Migration

- Replace `HueSlider` with `ColorSlider channel="h"`.
- Replace `AlphaSlider` with `ColorSlider channel="alpha"`.
- Update imports to remove `HueSlider`/`AlphaSlider` from `@color-kit/react`.

## Registry distribution removed

- The shadcn-style `registry/` (including the former `hue-slider`, `alpha-slider`, and `color-slider` entries) is no longer published.
- Install the components from npm instead (`@color-kit/react` or the `color-kit` umbrella package) and use `ColorSlider` with `channel` set to `h` or `alpha` as needed.
