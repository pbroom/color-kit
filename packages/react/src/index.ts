// Context & Provider
export { ColorContext, useColorContext } from './context.js';
export type { ColorContextValue } from './context.js';
export type {
  ColorAreaInteractionFrameStats,
  ColorAreaPerformanceProfile,
  ColorAreaQualityLevel,
} from './color-area-context.js';
export { Color } from './color.js';
export type { ColorProps } from './color.js';

// Hooks
export { useColor } from './use-color.js';
export { useMultiColor } from './use-multi-color.js';
export type {
  SetRequestedOptions,
  UseColorOptions,
  UseColorReturn,
} from './use-color.js';
export type {
  MultiColorEntryInput,
  MultiColorInput,
  MultiColorState,
  MultiColorUpdateEvent,
  UseMultiColorOptions,
  UseMultiColorReturn,
} from './use-multi-color.js';
export {
  createColorState,
  getActiveDisplayedColor,
  mapDisplayedColors,
} from './color-state.js';
export type {
  ColorChannel,
  ColorInteraction,
  ColorSource,
  ColorState,
  ColorUpdateEvent,
  GamutTarget,
  ViewModel,
} from './color-state.js';
export * as ColorApi from './api/index.js';
export type {
  ColorAreaAxes,
  ColorAreaAxis,
  ColorAreaChromaBandOptions,
  ColorAreaChannel,
  ColorAreaContrastRegionOptions,
  ColorAreaContrastRegionPoint,
  ColorAreaFallbackPoint,
  ColorAreaGamutBoundaryOptions,
  ColorAreaGamutBoundaryPoint,
  ColorAreaKey,
  ResolvedColorAreaAxes,
  ResolvedColorAreaAxis,
  ColorInputModel,
  ColorInputChannel,
  OklchColorInputChannel,
  RgbColorInputChannel,
  HslColorInputChannel,
  ColorInputStepConfig,
  ColorStringInputFormat,
  ColorSliderChannel,
  ColorSliderKey,
  SampleSliderGradientOptions,
  ColorSliderOrientation,
  SliderHueGradientMode,
  SliderColorModel,
  SliderColorSpace,
  SliderGradientStop,
  SliderGradientStyles,
  SliderModelChannel,
  HctSliderModelChannel,
} from './api/index.js';

// Primitives
export { ColorArea } from './color-area.js';
export type { ColorAreaProps } from './color-area.js';
export { Thumb } from './thumb.js';
export type { ThumbProps } from './thumb.js';
export {
  ColorPlane,
  BENCHMARK_SELECTED_COLOR_PLANE_RENDERER,
} from './color-plane.js';
export type {
  ColorPlaneEdgeBehavior,
  ColorPlaneOutOfGamutConfig,
  ColorPlaneProps,
  ColorPlaneRenderer,
  ColorPlaneSource,
} from './color-plane.js';
export {
  COLOR_PLANE_FRAGMENT_SHADER_SOURCE,
  COLOR_PLANE_VERTEX_SHADER_SOURCE,
} from './color-plane-shaders.js';
export { OutOfGamutLayer } from './out-of-gamut-layer.js';
export type { OutOfGamutLayerProps } from './out-of-gamut-layer.js';
export { Layer } from './layer.js';
export type { LayerKind, LayerProps } from './layer.js';
export { Background } from './background.js';
export type { BackgroundProps } from './background.js';
export { Line } from './line.js';
export type { LinePoint, LineProps } from './line.js';
export { Point } from './point.js';
export type { PointProps } from './point.js';
export { GamutBoundaryLayer } from './gamut-boundary-layer.js';
export type {
  GamutBoundaryLayerProps,
  ColorAreaLayerQuality,
} from './gamut-boundary-layer.js';
export { ChromaBandLayer } from './chroma-band-layer.js';
export type {
  ChromaBandLayerMode,
  ChromaBandLayerProps,
} from './chroma-band-layer.js';
export {
  ContrastRegionLayer,
  ContrastRegionFill,
} from './contrast-region-layer.js';
export type {
  ContrastRegionLayerMetrics,
  ContrastRegionLayerProps,
  ContrastRegionFillProps,
} from './contrast-region-layer.js';
export { FallbackPointsLayer } from './fallback-points-layer.js';
export type { FallbackPointsLayerProps } from './fallback-points-layer.js';

export { ColorSlider } from './color-slider.js';
export type { ColorSliderProps } from './color-slider.js';
export { SliderMarker } from './slider-marker.js';
export type {
  SliderMarkerProps,
  SliderMarkerVariant,
} from './slider-marker.js';
export { ChromaMarkers } from './chroma-markers.js';
export type { ChromaMarkersProps } from './chroma-markers.js';

export { ColorInput } from './color-input.js';
export type { ColorInputProps } from './color-input.js';
export { ColorStringInput } from './color-string-input.js';
export type { ColorStringInputProps } from './color-string-input.js';
