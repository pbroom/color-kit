# Changelog

## 0.2.0

### Minor Changes

- d60010d: Add tuple and typed-array interop for GPU pipelines, three.js, and WebGL/WebGPU, exported from the root and a new `color-kit/interop` subpath.
  - `to<Space>Array(color, out?, offset?, options?)` and `from<Space>Array(array, offset?)` for `LinearSrgb`, `Srgb`, `LinearP3`, `P3`, `Oklab`, and `Oklch`, plus `*Array4` variants that carry alpha. Writers fill any `number[]` or typed array without allocating.
  - `packColors` / `unpackColors` write and read many colors in one flat buffer, with `stride`, `offset`, and `alpha` layout options.
  - Writers emit unclamped floats by default (correct for HDR and linear pipelines, and matching three.js). `clamp: true` clips RGB channels to 0–1. To reduce chroma instead, compose with the gamut mappers: `toLinearSrgbArray(toSrgbGamut(color), out)` or `packColors(colors.map(toSrgbGamut), 'linearSrgb')`.
  - New `ColorTuple` / `ColorTuple4` types.

- a334c2d: **Breaking:** pre-launch API cleanup.
  - **`'display-p3'` only:** `'p3'` is no longer accepted as an interpolation space, plane model, `toCss` format, or `packColors`/`unpackColors` layout; use `'display-p3'` (`'linear-p3'` is unchanged). Unknown interpolation spaces and plane models now throw a `TypeError` instead of silently falling back.
  - **Removed aliases:** `PlaneSenseApi` (use `PlaneSense`) and `PLANE_DEFAULT_RANGES` (use `PLANE_MODEL_DEFAULT_RANGES.oklch`).
  - **Smaller root entry:** the compute engine (backend, scheduler, telemetry, packed ABI helpers) is exported only from `color-kit/compute`, and the internal marching-squares contour helpers are no longer exported.
  - **No silent contrast-region fallback:** the contrast-region solver used to hand hard queries to the marching-squares engine. It now returns its best-effort paths and records `trace.summary.degradedReason` (`ContrastHybridFallbackReason` is renamed `ContrastHybridDegradedReason`). It also traces nearly constant-lightness contours without gaps. `samplingMode: 'hybrid'` is removed. The marching-squares engine itself is removed in a separate entry.
  - **JS-only compute scheduler:** the `'webgpu'` backend kind, multi-backend scheduler options, and `circuitBreakers` telemetry are removed; every run reports backend `'js'` with reason `'default-js'`.
  - **React renames:** `ColorSlider` `maxPointerRate` is now `maxUpdateHz` (same as `ColorArea`), `Thumb` `shiftStepRatio` is now `largeStepRatio`, and `useMultiColor`'s `removeColor` no longer takes a `source` argument.

- a334c2d: More accurate contrast, achromatic hue handling, and gamut mapping.
  - **Contrast from unrounded values:** `relativeLuminance`, `contrastRatio`, `contrastAPCA`, `meetsAA`, and `meetsAAA` measure unrounded sRGB channels clipped to the display gamut instead of 8-bit rounded values, matching colorjs.io for in-gamut colors. New `ContrastOptions` take `gamut` (`'srgb'` default, or `'display-p3'`) and `precision` (`'exact'` default, or `'8bit'` to reproduce 0.1 results exactly). Contrast regions evaluate the same public checks, so points inside an AA region pass `contrastRatio() >= 4.5`. `toHsl`, `toHsv`, and `toHct` no longer round to 8-bit first. For 8-bit inputs, pass/fail decisions are unchanged.
  - **Achromatic hues:** one shared threshold, exported as `ACHROMATIC_CHROMA_THRESHOLD` with an `isAchromatic()` helper. Option-less `mix()`/`mixInto()` now use the same OKLCH default as `interpolate()` and `generateScale()`: a gray endpoint borrows the other endpoint's hue, so `mix('white', '#0000ff')` matches colorjs.io. `linearToSrgbChannel`/`srgbToLinearChannel` are exported as the single sign-preserving, extended-range sRGB transfer pair.
  - **Selectable gamut mapping:** `toSrgbGamut`, `toP3Gamut`, `toSrgbGamutInto`, and `toP3GamutInto` accept `{ method: 'chroma-reduction' | 'css' }` (`GamutMapMethod`, `GamutMapOptions`). `'css'` implements the CSS Color 4 algorithm and matches colorjs.io `toGamut({ method: 'css' })` outside the `GAMUT_EPSILON` band. The default stays `'chroma-reduction'`, which preserves lightness and hue. In `color-kit/driver`, `createColorState` and `mapDisplayedColors` take `gamutMapMethod`; the state records it in `meta.gamutMapMethod`, and later updates reuse it.

- 4a0f631: **Breaking:** contrast regions use a new solver, and the hybrid solver and its options are removed. `contrastRegionPaths`, `contrastRegionPath`, the `contrastBoundary` / `contrastRegion` plane queries, and `ContrastRegionLayer` (`color-kit/react`) trace each side of a region as one luminance level curve along rays from black, and solve exactly where each piece meets the gamut edge.
  - New sampling options: `initialSamples` (default 32, per gamut chroma extent at the hue, clamped to 512), `errorTolerance` (default 0.0015 in `(l, c)` units, at least 1e-6), and `maxDepth` (default 6, clamped to 12). Invalid values throw an `Error`, on every plane (including planes that return empty geometry). New `clampContrastRegionSampling` returns the sampling the solver runs with.
  - Removed options: `lightnessSteps` and `chromaSteps` (use `initialSamples`), `hybridMaxDepth` (use `maxDepth`), `hybridErrorTolerance` (use `errorTolerance`), and `tolerance` / `maxIterations` (which the hybrid solver forwarded to `maxChromaAt`). Passing one is a type error and throws a `TypeError`, in direct calls, plane queries, and `ContrastRegionLayer` props.
  - The solver cannot degrade, so `degradedReason` and the `ContrastHybridDegradedReason` type are removed. Traces record solver `contrast-rays` (new `PlaneContrastSolver` type) with `samplingMode: 'adaptive'` and the sampling it ran with under `fidelity`. The hybrid-only trace stages and their types (`cusp`, `hybridSamples`, `rootBisection`, `refinement`, `branching`) and the `cusp`, `rootFinding`, and `branching` timing keys are removed. Scheduler budgets for contrast queries follow the new options.
  - `ContrastRegionLayer` takes `initialSamples` (default 8, scaled by quality), `errorTolerance` (default 0.004), and `maxDepth` (default 3 at high quality, 2 medium, 1 low); `ContrastRegionLayerMetrics` reports the clamped `initialSamples`, `errorTolerance`, and `maxDepth` the solver ran with instead of `lightnessSteps`, `chromaSteps`, and `hybridMaxDepth`.
  - Contrast regions measure against the unmapped reference, which the public checks clip. A threshold equal to the contrast against white returns white as a one-point path. Traces add `droppedPieceCount`.

  Every returned point now passes `contrastRatio` / `contrastAPCA` with the region's gamut and is in that gamut per `inSrgbGamut` / `inP3Gamut`, including in their `GAMUT_EPSILON` slack (the solver measures luminance with the same gamut clipping as the public checks). Contour pieces no longer depend on sampling: thin pieces and gamut notches in the sRGB blue fold near hue 264, paths near black, and thresholds just above 1 or just below the largest attainable contrast are traced at any setting, and chords never cut through out-of-gamut colors, with `simplifyTolerance` too. At the default settings the solver is more than 10× faster than the hybrid solver.

- a334c2d: Parse the full CSS Color 4 syntax and reject malformed input.
  - `parse()` now accepts the 148 named colors plus `transparent`; `rgb()`/`rgba()` and `hsl()`/`hsla()` in modern and legacy comma syntax with percentages; `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`; and `color()` with `srgb`, `srgb-linear`, `display-p3`, `rec2020`, `a98-rgb`, `prophoto-rgb`, `xyz`, `xyz-d65`, and `xyz-d50`. Hue units `deg`/`grad`/`rad`/`turn` are supported, parsed hues are normalized to `[0, 360)`, and `none` is treated as a missing component. Results match colorjs.io to float precision.
  - Malformed input now throws instead of producing `NaN`: invalid hex digits or lengths, malformed numbers, and values that overflow to `Infinity` are rejected. `toHex`, `toCss`, and `rgbToHex` throw a `RangeError` for non-finite channels, and `toCss` throws a `TypeError` for an unknown format (its `format` parameter is now the `CssColorFormat` union).
  - New `tryParse(input)` returns `Color | null` instead of throwing.
  - Bundle size: `parse` now carries the named-color table and the `color()` matrices, so `import { parse, toHex, contrastRatio }` grows from about 2.3 kB to about 5.2 kB gzipped.

- f5be857: Trim the package's peer dependencies and stop shipping an entry that could not be installed.
  - **Breaking:** the `color-kit/react/color-input` subpath is removed. `ColorInput` depends on `@color-kit/control-kit`, which is not published to npm, so the entry could not be used from the published package. It will return once control-kit is published. Importing it now fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
  - `@base-ui/react` and `radix-ui` are no longer listed as required peer dependencies. Nothing in the package imports them, so package managers no longer ask you to install them. The optional `@color-kit/control-kit` peer is gone too. `react` and `react-dom` remain optional peers for `color-kit/react`.
  - The tarball now includes `LICENSE` (MIT) and `THIRD_PARTY_NOTICES.md`, which carries the Apache-2.0 notice for the bundled Material color utilities HCT solver.

- d76ddcd: **Breaking:** removed the `PlaneWithSense` type from `color-kit` and `color-kit/plane`. It described `{ ...plane, ...sense(plane) }`, but no API returned it. If you need the merged shape, use `Plane & PlaneSense`.

  The compute scheduler's work budgets for gamut-boundary, chroma-band and gradient queries now follow the real sample counts. Before, any query without `steps` was assumed to have 48. Now the budgets use the solver defaults (100, 12 and 16), and adaptive sampling is estimated from `adaptiveTolerance` and `adaptiveMaxDepth` as the `maxChromaAt` searches it runs (three probes per visited segment), not the points it returns. This can change the `budget:` bucket in `schedule.bucketKey` for queries that omit `steps` or use adaptive sampling.

- 85a3bb6: Keep the previous hue when an achromatic color is entered.
  - **State layer:** `useColor`'s `setFromString`, `setFromRgb`, `setFromHsl` and `setFromHsv`, RGB/HSL `ColorInput` edits and `ColorStringInput` now keep the latest requested hue when the new color is a gray, black or white, so raising chroma afterwards resumes it instead of jumping to hue `0`. An `oklch()` string with a hue (not `none`) or an OKLCH object passed to `setRequested` still keeps its own hue. Pass `explicitHue: true` to store the converted hue.
  - **Options:** `SetRequestedOptions`, `setColorRequested` and `setMultiColorRequested` accept `explicitHue` (default `true` for OKLCH objects); `useMultiColor().setRequested` forwards it.
  - **Driver helpers:** `resolveIncomingRequested(previous, incoming, { explicitHue })` and `hasExplicitOklchHue(css)`. `colorFromColorInputChannelValue` keeps the hue for achromatic RGB/HSL results.
  - **HSL `ColorInput` on grays:** the hue field shows the HSL hue of the stored OKLCH hue instead of `0`, raising saturation from a gray lands back on the stored OKLCH hue (not red), and typing an HSL hue on a gray stores that hue.
  - Core `parse()` and the conversions are unchanged.

- a334c2d: Accessible, steadier React sliders and areas, and correct controlled state.
  - **Keyboard and ARIA:** `ColorSlider` and `ColorArea` support PageUp/PageDown (large step) and Home/End alongside the arrow keys. Hue wraps by default, and other channels clamp correctly in descending ranges. `ColorSlider` adds `stepRatio`, `largeStepRatio` (Shift+Arrow), `wrap`, `disabled`, and `getValueText`, and announces human-readable `aria-valuetext` such as "Hue 213°". `Thumb` exposes one `role="slider"` (`aria-roledescription="2D slider"`) with value text for both axes. `ColorArea` adds `disabled`. Pointer down focuses the control, and keyboard focus sets `data-focus-visible`. New driver helpers: `getColorSliderValueText`, `getColorAreaValueText`, `getColorAreaKeyAxis`, `resolveColorSliderWrap`.
  - **Controlled state:** controlled `useColor`/`useMultiColor` apply each update to the latest snapshot, so two updates in one tick no longer overwrite each other. A rejected controlled update no longer affects later ones. `onChange` fires synchronously inside the setter, once per effective update, in both modes. New driver reducers: `setColorRequested`, `setColorChannel`, `setColorActiveGamut`, `setColorActiveView`.
  - **Stability and performance:** `ColorPlane`, `ColorArea`, and `ColorSlider` use stable callback refs, so `ColorPlane` no longer recompiles WebGL shaders every drag frame. `ColorPlane` recovers from WebGL context loss and frees GPU resources when setup fails. `ColorSlider` composes your pointer and key handlers instead of replacing them. Slider and area drags share the driver's new `createPointerDragController`, which provides rAF coalescing, `dragEpsilon`, and a `maxUpdateHz` cap that defers frames instead of dropping them.
  - `ContrastRegionLayer` scores regions with core's `contrastRatio`/`contrastAPCA` using the region's gamut, so the scores match the traced field.

- cda8875: **Breaking:** `ColorPlane` drops its deprecated options. The `outOfGamut` prop (and the exported `ColorPlaneOutOfGamutConfig` type) is removed; use `edgeBehavior="transparent"` in place of `outOfGamut={{ repeatEdgePixels: false }}`, and `edgeBehavior="clamp"` (the default) in place of `repeatEdgePixels: true`. The `renderer="webgl"` alias is removed from `ColorPlaneRenderer`; use `renderer="gpu"`. Passing either old value is now a TypeScript error.
- dc60fa3: **Breaking:** `color-kit/react` now exports state hooks and plane hooks only. Its UI components are removed outright; they have not moved to another package.
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

- 230cc1c: **Breaking:** `color-kit/react` no longer exports the internal `BENCHMARK_SELECTED_COLOR_PLANE_RENDERER`, `COLOR_PLANE_VERTEX_SHADER_SOURCE` and `COLOR_PLANE_FRAGMENT_SHADER_SOURCE` constants. They were implementation details of `ColorPlane`; pick a renderer with its `renderer` prop instead. `assertGamutTarget` is now also exported from the `color-kit` root, in addition to `color-kit/plane`.
- 5265709: `color-kit/react` adds headless plane hooks that return data and own no DOM:
  - `useColorPlaneRenderer(plane, options)` rasterizes a color plane into your `<canvas>` with WebGL, falling back to a CPU renderer when WebGL is unavailable or its context is lost. It returns a stable `ref`, a `canvasKey` to use as the canvas `key`, and the active `renderer`.
  - `useGamutBoundary`, `useChromaBand`, `useContrastRegion` and `useFallbackPoints` return memoized plane geometry: points, plus SVG path data from `toSvgPath`/`toSvgCompoundPath` for a `0 0 100 100` viewBox. `useContrastRegion` returns both contour lines (`path`) and closed fill polygons (`fillPath`). Pass `isDragging` and the queries run in a shared Web Worker while you drag, keeping the last result on screen until a fresh one arrives.
  - `useAdaptiveQuality(profile)` lowers a `quality` level while measured frames are slow and raises it again when they recover. You feed that level to the hooks above.

  Each hook takes a `ColorPlaneSpec`, `{ color, axes? }`. Its axes use the driver's `ColorAreaAxes` (lightness × chroma by default).

- 7d46255: **Breaking:** the legacy marching-squares contrast-region engine is removed. `contrastRegionPaths`, `contrastRegionPath`, and the `contrastBoundary` / `contrastRegion` plane queries always use the root-tracing solver.
  - The `engine`, `samplingMode`, `edgeInterpolation`, `adaptiveBaseSteps`, and `adaptiveMaxDepth` options are removed. Passing one is a type error and throws a `TypeError`. Tune the solver with `lightnessSteps`, `chromaSteps`, `hybridMaxDepth`, and `hybridErrorTolerance`.
  - The `ContrastRegionEngine`, `ContrastRegionBaseOptions`, `ContrastRegionHybridOptions`, and `ContrastRegionLegacyOptions` types are removed. `ContrastRegionPathOptions` is now a single options interface.
  - The `contrast-legacy-uniform` and `contrast-legacy-adaptive` trace solver names are removed, and scheduler telemetry keys for contrast queries no longer include a sampling mode (`contrast:wcag` rather than `contrast:wcag:hybrid`).
  - `ContrastRegionLayer` (`color-kit/react`) uses the root-tracing solver. Its `samplingMode`, `edgeInterpolation`, `adaptiveBaseSteps`, and `adaptiveMaxDepth` props are removed, and it gains `hybridMaxDepth` and `hybridErrorTolerance` props. Its defaults (`lightnessSteps` 12, `chromaSteps` 16, `hybridMaxDepth` 3 at high quality, `hybridErrorTolerance` 0.003) take about half the time per region of the old layer, with fills that match the contrast check more closely. `ContrastRegionLayerMetrics.samplingMode` is replaced by `hybridMaxDepth`.

  The solver also fixes three contour defects found by a brute-force check: a folded contour no longer splits at a fold tip that falls between lightness samples, and contours that meet the gamut edge where the contrast barely changes with chroma now end on the edge instead of stopping short or splitting off a short stub. Roots are placed only where pass/fail changes along chroma, so they always agree with the pass/fail state at the axis and the gamut edge.

### Patch Changes

- aee1567: The hybrid contrast-region engine keeps a contour connected where it folds back in lightness, and ends it exactly on the chroma axis or the gamut edge. It used to split such contours into pieces or stop short of the gamut edge (gaps of up to 0.027 chroma in a 36-hue WCAG AA sweep on white and black). It also traces thin regions at the top of the lightness range, which it used to report as degraded with no paths. Open hybrid paths start at their lower-lightness end, but their points are no longer always in ascending lightness.
- 2fe8b4e: `getColorAreaFallbackPoint` (`color-kit/driver`) now throws a `TypeError` for an unknown `gamut`, such as the removed `'p3'` spelling, instead of silently mapping it to sRGB. The message matches the core plane queries and ends `'p3' is not supported; use 'display-p3'`. `assertGamutTarget` is exported from `color-kit/plane` for consumers that need the same check.
- 248e324: The `color-kit/driver` color-state helpers now reject unknown gamuts in the same way as the core plane queries. Before, a value such as the removed `'p3'` spelling was accepted silently and rendered as sRGB. Now `createColorState`, `setColorActiveGamut`, `createMultiColorModel`, `setMultiColorActiveGamut` and `getColorDisplayStyles` throw a `TypeError` that ends `'p3' is not supported; use 'display-p3'`. Because of this, `useColor` and `useMultiColor` in `color-kit/react` also throw for an unknown `defaultGamut` or `setActiveGamut` value.

  Two error types change to follow the repo convention:
  - `sampleSliderGradient` and `getSliderGradientStyles` throw a `RangeError` (was `Error`) when `steps` is below 2 or not finite.
  - `createMultiColorModel` and `addMultiColorEntry` throw a `TypeError` when a color is neither a string nor an object. Before, they stored an empty color.

  Unparseable color strings still throw `parse`'s `Error`.

- 8d301d1: Two fixes to how `color-kit/driver` channel inputs handle numbers:
  - `parseColorInputExpression` (and through it `resolveColorInputDraftValue` and `ColorInput`) now treats every `%` number in an absolute expression as a position in the range, the same as a lone `50%`. Before, each percent was taken as a fraction of the span and `range[0]` was added once to the whole result, which was wrong when the range does not start at 0 and the expression multiplies or combines percents. On `[100, 200]`, `50% * 2` is now `300` (was `200`), and `50% + 10` stays `160`. Relative input such as `+10%` still adds a fraction of the span.
  - `getColorInputPrecisionFromStep` returns `6`, the formatter's maximum, for steps finer than `1e-6`, such as `1e-9`. It used to return `0`, which showed tiny-step values as whole numbers.

- 6c0346d: Point `'p3'` users to `'display-p3'`. The removed `'p3'` spelling still throws, and every check that rejects an unknown space, model, format, or gamut now ends its `TypeError` with `'p3' is not supported; use 'display-p3'`. Gamut options (`maxChromaAt`, `maxChromaForHue`, `chromaBand`, `gamutBoundaryPath`, contrast metrics and regions, and the plane gamut and fallback queries) now throw a `TypeError` for any unknown `gamut` value instead of silently treating it as sRGB. `packColors` / `unpackColors` throw a `TypeError` (was `RangeError`) for an unknown array space.
- 230cc1c: `samplePlaneGradient` now rejects fractional and non-finite `steps` with a `RangeError`, preventing extrapolated endpoints and unbounded sampling. Integer counts below two still produce the two endpoints.
- 6331e05: `ColorInput` and `ColorStringInput` (`color-kit/react`) now render `aria-label` only once. Before, a consumer's label was set on both the wrapper `div` and the inner input. Now `aria-label` and `aria-labelledby` go only to the inner input: the spinbutton for `ColorInput`, the textbox for `ColorStringInput`. A consumer label replaces the default (`'<channel label> value'` or `'Color value'`). When only `aria-labelledby` is given, the input gets no default `aria-label`.
- f8fcdb6: `saturate` and `desaturate` no longer cap OKLCH chroma at `0.4`. Before, a wide-gamut color above `0.4`, such as Rec. 2020 green at ≈ 0.47, lost chroma: `saturate` lowered it and `desaturate(color, 0)` changed it. Now chroma is only clamped below at `0`, which matches how `lighten` and `darken` treat lightness. `saturate` still steps by `amount * 0.4`. The results are still not gamut mapped.

  `planeHue` now always returns an OKLCH hue. On `hsl`, `hsv` and `hct` planes it used to return the model's own hue. Now it converts the fixed color, so HSL red (`h: 0`) resolves to ≈ 29.2. When the fixed color is achromatic, it uses the hue's most saturated color instead. The `hue` reported by the gamut-boundary, contrast and chroma-band plane queries changes to match.

All notable changes to `color-kit` are documented here. The package is pre-1.0, so minor releases may include breaking changes.

## 0.1.0

### Breaking changes

- Packed plane query results use a strict, versioned ABI (v2). `PackedPlaneQueryResult` now carries an `abiVersion` field, and the decoder (`unpackPlaneQueryResults`) throws on unknown versions or malformed payloads instead of decoding them leniently.
- The experimental Rust/WASM plane compute backend was removed. There is no replacement: plane queries run on the JS backend (WebGPU stays an optional scheduler backend). Specifically:
  - The `color-kit/wasm` subpath export is gone, so importing it fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
  - `PlaneComputeBackendKind` and plane metric `backend` fields no longer include `'wasm'`. Scheduler telemetry no longer reports `wasm` circuit breakers or bucket stats, and the default `preferredBackends` is `['webgpu', 'js']`.
  - `evaluateWasmParityGate` and its `WasmParityGateDecision` / `WasmParityGateMode` types were removed from the React exports.
  - `ContrastRegionLayer` no longer accepts `wasmParityMode`. `ContrastRegionLayerMetrics` no longer reports `wasmCircuitOpen`, `wasmParityStatus`, `wasmParityPathDelta`, `wasmParityPointDelta`, `wasmInitStatus`, `wasmInitError`, or `wasmBackendVersion`. The plane query worker no longer returns `wasmInit` or `wasmParity` fields.
  - Version 0.0.1 was never published to npm, so this only affects consumers who built from source.

### Accuracy

- Added a reference-accuracy test suite against colorjs.io, and fixed five core accuracy issues:
  - OKLab and Display P3 conversions use full-precision CSS Color 4 matrices.
  - `contrastAPCA` matches APCA-W3 0.0.98G-4g.
  - HSL/HSV hues wrap correctly, and `fromHsl`/`fromHsv` keep full precision.
  - The gamut epsilon applies to encoded channel values, not linear light.
  - `toSrgbGamut`/`toP3Gamut` map colors strictly inside the target gamut.

### Architecture

- Core is split into layered modules (conversion, gamut, plane model specs, resolve, mapping, trace, geometry), and plane query kinds are defined through a `PlaneQuerySpec` registry.
- Removed non-core tooling from the repository, including the docs Lab and component registry.

### Bundle size

- Core ships one module per source file with `"sideEffects": false`, so bundlers only include what you import, even from the root entry. `import { parse, toHex, contrastRatio } from 'color-kit'` is now about 2.3 KB minified and gzipped, down from about 15 KB.
- The default compute scheduler is created lazily, and unused parts of the bundled Material color utilities are no longer included.
- Size budgets for common imports are enforced in CI (`pnpm size`).
