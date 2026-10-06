---
'color-kit': minor
---

Accessible, steadier React sliders and areas, and correct controlled state.

- **Keyboard and ARIA:** `ColorSlider` and `ColorArea` support PageUp/PageDown (large step) and Home/End alongside the arrow keys. Hue wraps by default, and other channels clamp correctly in descending ranges. `ColorSlider` adds `stepRatio`, `largeStepRatio` (Shift+Arrow), `wrap`, `disabled`, and `getValueText`, and announces human-readable `aria-valuetext` such as "Hue 213°". `Thumb` exposes one `role="slider"` (`aria-roledescription="2D slider"`) with value text for both axes. `ColorArea` adds `disabled`. Pointer down focuses the control, and keyboard focus sets `data-focus-visible`. New driver helpers: `getColorSliderValueText`, `getColorAreaValueText`, `getColorAreaKeyAxis`, `resolveColorSliderWrap`.
- **Controlled state:** controlled `useColor`/`useMultiColor` apply each update to the latest snapshot, so two updates in one tick no longer overwrite each other. A rejected controlled update no longer affects later ones. `onChange` fires synchronously inside the setter, once per effective update, in both modes. New driver reducers: `setColorRequested`, `setColorChannel`, `setColorActiveGamut`, `setColorActiveView`.
- **Stability and performance:** `ColorPlane`, `ColorArea`, and `ColorSlider` use stable callback refs, so `ColorPlane` no longer recompiles WebGL shaders every drag frame. `ColorPlane` recovers from WebGL context loss and frees GPU resources when setup fails. `ColorSlider` composes your pointer and key handlers instead of replacing them. Slider and area drags share the driver's new `createPointerDragController`, which provides rAF coalescing, `dragEpsilon`, and a `maxUpdateHz` cap that defers frames instead of dropping them.
- `ContrastRegionLayer` scores regions with core's `contrastRatio`/`contrastAPCA` using the region's gamut, so the scores match the traced field.
