export {
  areColorAreaAxesDistinct,
  COLOR_AREA_DEFAULT_RANGES,
  colorFromColorAreaKey,
  colorFromColorAreaPosition,
  getColorAreaContrastRegionPaths,
  getColorAreaGamutBoundaryPoints,
  getColorAreaThumbPosition,
  resolveColorAreaAxes,
  resolveColorAreaRange,
} from './color-area.js';
export type {
  ColorAreaAxes,
  ColorAreaAxis,
  ColorAreaChannel,
  ColorAreaContrastRegionOptions,
  ColorAreaContrastRegionPoint,
  ColorAreaGamutBoundaryOptions,
  ColorAreaGamutBoundaryPoint,
  ColorAreaKey,
  ResolvedColorAreaAxes,
  ResolvedColorAreaAxis,
} from './color-area.js';

export {
  COLOR_DIAL_DEFAULT_RANGES,
  colorFromColorDialKey,
  colorFromColorDialPosition,
  getColorDialLabel,
  getColorDialThumbPosition,
  normalizeColorDialPointer,
  resolveColorDialAngles,
  resolveColorDialRange,
} from './color-dial.js';
export type {
  ColorDialChannel,
  ColorDialKey,
  ResolvedColorDialAngles,
} from './color-dial.js';

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
  COLOR_WHEEL_DEFAULT_CHROMA_RANGE,
  colorFromColorWheelKey,
  colorFromColorWheelPosition,
  getColorWheelThumbPosition,
  normalizeColorWheelPointer,
  resolveColorWheelChromaRange,
} from './color-wheel.js';
export type { ColorWheelKey, ColorWheelThumbPosition } from './color-wheel.js';

export {
  formatColorInputValue,
  isColorInputValueValid,
  parseColorInputValue,
} from './color-input.js';
export type { ColorInputFormat } from './color-input.js';

export { getColorDisplayHex, getColorDisplayStyles } from './color-display.js';
export type { ColorDisplayStyles } from './color-display.js';

export { getContrastBadgeSummary } from './contrast-badge.js';
export type { ContrastBadgeSummary } from './contrast-badge.js';

export { SWATCH_COLOR_EQUAL_EPSILON, colorsEqual } from './swatch-group.js';
