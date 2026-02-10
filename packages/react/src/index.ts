// Context & Provider
export { ColorContext, useColorContext } from './context.js';
export type { ColorContextValue } from './context.js';
export { ColorProvider } from './color-provider.js';
export type { ColorProviderProps } from './color-provider.js';

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
  ColorAreaChannel,
  ColorAreaKey,
  ColorInputFormat,
  ColorSliderChannel,
  ColorSliderKey,
  ColorSliderOrientation,
  ContrastBadgeSummary,
} from './api/index.js';

// Primitives
export { ColorArea } from './color-area.js';
export type { ColorAreaProps } from './color-area.js';

export { ColorSlider } from './color-slider.js';
export type { ColorSliderProps } from './color-slider.js';

export { HueSlider } from './hue-slider.js';
export type { HueSliderProps } from './hue-slider.js';

export { AlphaSlider } from './alpha-slider.js';
export type { AlphaSliderProps } from './alpha-slider.js';

export { Swatch } from './swatch.js';
export type { SwatchProps } from './swatch.js';

export { SwatchGroup } from './swatch-group.js';
export type { SwatchGroupProps } from './swatch-group.js';

export { ColorInput } from './color-input.js';
export type { ColorInputProps } from './color-input.js';

export { ColorDisplay } from './color-display.js';
export type { ColorDisplayProps } from './color-display.js';

export { ContrastBadge } from './contrast-badge.js';
export type { ContrastBadgeProps } from './contrast-badge.js';
