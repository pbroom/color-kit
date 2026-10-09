// State: provider, context and hooks
export { ColorContext, useColorContext } from './context.js';
export type { ColorContextValue } from './context.js';
export { Color } from './color.js';
export type { ColorProps } from './color.js';
export { useColor } from './use-color.js';
export type {
  SetRequestedOptions,
  UseColorOptions,
  UseColorReturn,
} from './use-color.js';
export { useMultiColor } from './use-multi-color.js';
export type {
  MultiColorEntryInput,
  MultiColorInput,
  MultiColorState,
  MultiColorUpdateEvent,
  UseMultiColorOptions,
  UseMultiColorReturn,
} from './use-multi-color.js';
export { createColorStore, useColorStoreSelector } from './color-store.js';
export type { ColorStore } from './color-store.js';

// Planes: renderer, geometry and adaptive quality
export { useColorPlaneRenderer } from './use-color-plane-renderer.js';
export type {
  ActiveColorPlaneRenderer,
  ColorPlaneEdgeBehavior,
  ColorPlaneRenderer,
  ColorPlaneRendererHandle,
  ColorPlaneSource,
  UseColorPlaneRendererOptions,
} from './use-color-plane-renderer.js';
export { useGamutBoundary } from './use-gamut-boundary.js';
export type {
  ColorPlaneLineGeometry,
  ColorPlaneLinePoint,
  UseGamutBoundaryOptions,
} from './use-gamut-boundary.js';
export { useChromaBand } from './use-chroma-band.js';
export type { UseChromaBandOptions } from './use-chroma-band.js';
export { useContrastRegion } from './use-contrast-region.js';
export type {
  ContrastRegionGeometry,
  ContrastRegionMetrics,
  UseContrastRegionOptions,
} from './use-contrast-region.js';
export { useFallbackPoints } from './use-fallback-points.js';
export type { ColorPlaneFallbackPoints } from './use-fallback-points.js';
export { useAdaptiveQuality } from './use-adaptive-quality.js';
export type {
  AdaptiveQuality,
  AdaptiveQualityFrame,
  ColorPlanePerformanceProfile,
  ColorPlaneQualityLevel,
} from './use-adaptive-quality.js';
export type {
  ColorPlanePixelSize,
  ColorPlaneQueryOptions,
  ColorPlaneSpec,
} from './plane-spec.js';

// Driver types used in hook signatures. Values (the ColorApi helpers, color
// state utilities and picker math) live in @color-kit/driver.
export type {
  ColorAreaAxes,
  ColorAreaAxis,
  ColorAreaChannel,
  ColorAreaContrastRegionOptions,
  ColorAreaContrastRegionPoint,
  ColorAreaFallbackPoint,
  ColorAreaGamutBoundaryPoint,
  ColorChannel,
  ColorInteraction,
  ColorSource,
  ColorState,
  ColorUpdateEvent,
  GamutTarget,
  ViewModel,
} from '@color-kit/driver';
