---
'@color-kit/react': major
---

Remove deprecated `HueSlider` and `AlphaSlider` wrapper components in favor of `ColorSlider`.

## Migration

- Replace `HueSlider` with `ColorSlider channel="h"`.
- Replace `AlphaSlider` with `ColorSlider channel="alpha"`.
- Update imports to remove `HueSlider`/`AlphaSlider` from `@color-kit/react`.

## Registry changes

- Removed `hue-slider` and `alpha-slider` component entries from `registry/registry.json`.
- Use `color-slider` and set `channel` to `h` or `alpha` as needed.
