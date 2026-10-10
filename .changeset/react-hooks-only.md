---
'color-kit': minor
---

**Breaking:** `color-kit/react` now exports state hooks and plane hooks only. Its UI components are removed outright; they have not moved to another package.

- **Removed components:** `ColorArea`, `Thumb`, `ColorPlane`, `OutOfGamutLayer`, `Layer`, `Background`, `Line`, `Point`, `GamutBoundaryLayer`, `ChromaBandLayer`, `ContrastRegionLayer`, `ContrastRegionFill`, `FallbackPointsLayer`, `ColorSlider`, `SliderMarker`, `ChromaMarkers`, `ColorStringInput` and `ColorInput`. Their prop and metric types are removed too: `ColorAreaProps`, `ColorAreaInteractionFrameStats`, `ColorAreaLayerQuality`, `ContrastRegionLayerMetrics` and the others.
- **Removed peer and subpath:** the optional `@color-kit/control-kit` peer dependency and the `@color-kit/react/color-input` subpath. `color-kit/react` re-exports fewer driver types. Import the input, slider and key-handling types (`ColorInputModel`, `ColorSliderChannel`, `SliderGradientStyles`, `ColorAreaKey`, …) from `color-kit/driver`.
- **Kept:** `Color`, `ColorContext`, `useColorContext`, `useColor`, `useMultiColor`, `createColorStore` and `useColorStoreSelector`, with their types.
- **Renamed types:** `ColorAreaPerformanceProfile` is now `ColorPlanePerformanceProfile`, and `ColorAreaQualityLevel` is now `ColorPlaneQualityLevel`. The `ColorPlaneRenderer` type no longer includes the deprecated `'canvas2d'` alias; use `'cpu'`.

Migration: build pickers from the hooks with your own elements.

- Replace `<ColorPlane>` with `useColorPlaneRenderer(plane, options)` on a `<canvas>`.
- Replace the layer components with `useGamutBoundary`, `useChromaBand`, `useContrastRegion` and `useFallbackPoints`, drawn into an `<svg viewBox="0 0 100 100">`.
- Replace `ColorArea`'s adaptive quality with `useAdaptiveQuality`.
- Handle pointer and keyboard input with the driver's `createPointerDragController`, `colorFromColorAreaPosition`, `colorFromColorAreaKey` and `getColorAreaValueText`.
- Use native range inputs, or a component library such as control-kit, for sliders and text fields.

The React docs show a complete picker built this way.
