export {
  COLOR_AREA_DEFAULT_RANGES,
  colorFromColorAreaKey,
  colorFromColorAreaPosition,
  getColorAreaThumbPosition,
  resolveColorAreaRange,
} from './color-area.js';
export type { ColorAreaChannel, ColorAreaKey } from './color-area.js';

export {
  COLOR_SLIDER_DEFAULT_RANGES,
  colorFromColorSliderKey,
  colorFromColorSliderPosition,
  getColorSliderLabel,
  getColorSliderThumbPosition,
  normalizeColorSliderPointer,
  resolveColorSliderRange,
} from './color-slider.js';
export type {
  ColorSliderChannel,
  ColorSliderKey,
  ColorSliderOrientation,
} from './color-slider.js';

export {
  formatColorInputValue,
  isColorInputValueValid,
  parseColorInputValue,
} from './color-input.js';
export type { ColorInputFormat } from './color-input.js';

export {
  getColorDisplayBackground,
  getColorDisplayHex,
} from './color-display.js';

export { getContrastBadgeSummary } from './contrast-badge.js';
export type { ContrastBadgeSummary } from './contrast-badge.js';

export { SWATCH_COLOR_EQUAL_EPSILON, colorsEqual } from './swatch-group.js';
