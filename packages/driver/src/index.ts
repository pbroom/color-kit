export {
  areColorAreaAxesDistinct,
  COLOR_AREA_DEFAULT_RANGES,
  getColorAreaFallbackPoint,
  colorFromColorAreaKey,
  colorFromColorAreaPosition,
  getColorAreaChromaBandPoints,
  getColorAreaContrastRegionPaths,
  getColorAreaGamutBoundaryPoints,
  getColorAreaThumbPosition,
  resolveColorAreaAxes,
  resolveColorAreaRange,
  toColorAreaPlaneDefinition,
} from './color-area.js';
export type {
  ColorAreaAxes,
  ColorAreaAxis,
  ColorAreaPlaneDefinition,
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
} from './color-area.js';

export {
  COLOR_SLIDER_DEFAULT_RANGES,
  colorFromColorSliderKey,
  colorFromColorSliderPosition,
  getColorSliderLabel,
  getColorSliderNormFromValue,
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
  getSliderGradientStyles,
  sampleSliderGradient,
} from './slider-gradient.js';
export type {
  SliderHueGradientMode,
  SliderColorModel,
  SliderColorSpace,
  SliderGradientStop,
  SliderGradientStyles,
  SliderModelChannel,
  SampleSliderGradientOptions,
  OklchSliderModelChannel,
  HslSliderModelChannel,
  HsvSliderModelChannel,
  RgbSliderModelChannel,
  HctSliderModelChannel,
} from './slider-gradient.js';

export {
  COLOR_INPUT_DEFAULT_RANGES,
  colorFromColorInputChannelValue,
  colorFromColorInputKey,
  formatColorInputChannelValue,
  getColorInputChangedChannel,
  getColorInputChannelGlyph,
  getColorInputChannelValue,
  getColorInputLabel,
  getColorInputPrecisionFromStep,
  normalizeColorInputValue,
  parseColorInputExpression,
  resolveColorInputDraftValue,
  resolveColorInputRange,
  resolveColorInputSteps,
  resolveColorInputWrap,
} from './color-input.js';
export type {
  ColorInputModel,
  ColorInputChannel,
  ColorInputChannelFor,
  ColorInputPrimitiveExpressionOptions,
  ColorInputSpec,
  OklchColorInputChannel,
  RgbColorInputChannel,
  HslColorInputChannel,
  ColorInputKey,
  ColorInputStepConfig,
  ResolveColorInputStepsOptions,
  ParseColorInputExpressionOptions,
  ResolveColorInputDraftValueOptions,
} from './color-input.js';

export {
  formatColorStringInputValue,
  isColorStringInputValueValid,
  parseColorStringInputValue,
} from './color-string-input.js';
export type { ColorStringInputFormat } from './color-string-input.js';

export { getColorDisplayHex, getColorDisplayStyles } from './color-display.js';
export type { ColorDisplayStyles } from './color-display.js';

export {
  colorsEqual,
  createColorState,
  getActiveDisplayedColor,
  mapDisplayedColors,
  resolveColorSource,
} from './color-state.js';
export type {
  ColorChannel,
  ColorInteraction,
  ColorSource,
  ColorState,
  ColorUpdateEvent,
  CreateColorStateOptions,
  GamutTarget,
  ViewModel,
} from './color-state.js';

export {
  addMultiColorEntry,
  createMultiColorModel,
  materializeMultiColorState,
  multiColorModelFromState,
  removeMultiColorEntry,
  renameMultiColorEntry,
  selectMultiColorEntry,
  setMultiColorActiveGamut,
  setMultiColorActiveView,
  setMultiColorChannel,
  setMultiColorRequested,
} from './multi-color-state.js';
export type {
  CreateMultiColorModelOptions,
  MultiColorEntryInput,
  MultiColorEntryModel,
  MultiColorInput,
  MultiColorModel,
  MultiColorState,
  MultiColorUpdateEvent,
} from './multi-color-state.js';
