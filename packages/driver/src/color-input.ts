import type { Color, Hsl, Rgb } from '@color-kit/core';
import {
  clamp,
  fromHsl,
  fromRgb,
  isAchromatic,
  normalizeHue,
  toHsl,
  toRgb,
} from '@color-kit/core';
import {
  formatPrimitiveValue,
  getPrimitiveSteppedValue,
  normalizePrimitiveValue,
} from './primitive-number.js';
import { parseColorInputExpression } from './color-input-parser.js';
import { resolveIncomingRequested } from './color-state.js';
import type { ParseColorInputExpressionOptions } from './color-input-parser.js';

export { parseColorInputExpression } from './color-input-parser.js';
export type { ParseColorInputExpressionOptions } from './color-input-parser.js';

export type ColorInputModel = 'oklch' | 'rgb' | 'hsl';
export type OklchColorInputChannel = 'l' | 'c' | 'h' | 'alpha';
export type RgbColorInputChannel = 'r' | 'g' | 'b' | 'alpha';
export type HslColorInputChannel = 'h' | 's' | 'l' | 'alpha';
export type ColorInputChannel =
  | OklchColorInputChannel
  | RgbColorInputChannel
  | HslColorInputChannel;
export type ColorInputChannelFor<Model extends ColorInputModel> =
  Model extends 'oklch'
    ? OklchColorInputChannel
    : Model extends 'rgb'
      ? RgbColorInputChannel
      : HslColorInputChannel;
export type ColorInputSpec<Model extends ColorInputModel = ColorInputModel> = {
  [Key in Model]: {
    model: Key;
    channel: ColorInputChannelFor<Key>;
  };
}[Model];

export type ColorInputKey =
  | 'ArrowRight'
  | 'ArrowLeft'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'PageUp'
  | 'PageDown'
  | 'Home'
  | 'End';

export interface ColorInputStepConfig {
  step: number;
  fineStep: number;
  coarseStep: number;
  pageStep: number;
}

export interface ResolveColorInputStepsOptions {
  step?: number;
  fineStep?: number;
  coarseStep?: number;
  pageStep?: number;
}

export interface ResolveColorInputDraftValueOptions extends ParseColorInputExpressionOptions {
  wrap?: boolean;
}

/**
 * Options shape shared with primitive input expression parsers (structurally
 * compatible with control-kit's `PrimitiveExpressionParser` callback).
 */
export interface ColorInputPrimitiveExpressionOptions {
  allowExpressions: boolean;
  currentValue: number;
  range: [number, number];
}

type ColorInputChannelTable<Value> = {
  oklch: Record<OklchColorInputChannel, Value>;
  rgb: Record<RgbColorInputChannel, Value>;
  hsl: Record<HslColorInputChannel, Value>;
};

const COLOR_INPUT_LABELS: ColorInputChannelTable<string> = {
  oklch: {
    l: 'OKLCH lightness',
    c: 'OKLCH chroma',
    h: 'OKLCH hue',
    alpha: 'Opacity',
  },
  rgb: {
    r: 'Red',
    g: 'Green',
    b: 'Blue',
    alpha: 'Opacity',
  },
  hsl: {
    h: 'Hue',
    s: 'Saturation',
    l: 'Lightness',
    alpha: 'Opacity',
  },
};

export const COLOR_INPUT_DEFAULT_RANGES: ColorInputChannelTable<
  [number, number]
> = {
  oklch: {
    l: [0, 1],
    c: [0, 0.4],
    h: [0, 360],
    alpha: [0, 1],
  },
  rgb: {
    r: [0, 255],
    g: [0, 255],
    b: [0, 255],
    alpha: [0, 1],
  },
  hsl: {
    h: [0, 360],
    s: [0, 100],
    l: [0, 100],
    alpha: [0, 1],
  },
};

const COLOR_INPUT_DEFAULT_STEPS: ColorInputChannelTable<ColorInputStepConfig> =
  {
    oklch: {
      l: { step: 0.01, fineStep: 0.001, coarseStep: 0.1, pageStep: 0.1 },
      c: { step: 0.005, fineStep: 0.001, coarseStep: 0.05, pageStep: 0.05 },
      h: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 45 },
      alpha: { step: 0.01, fineStep: 0.001, coarseStep: 0.1, pageStep: 0.1 },
    },
    rgb: {
      r: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 25 },
      g: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 25 },
      b: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 25 },
      alpha: { step: 0.01, fineStep: 0.001, coarseStep: 0.1, pageStep: 0.1 },
    },
    hsl: {
      h: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 45 },
      s: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 10 },
      l: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 10 },
      alpha: { step: 0.01, fineStep: 0.001, coarseStep: 0.1, pageStep: 0.1 },
    },
  };

function isOklchColorInputChannel(
  channel: ColorInputChannel,
): channel is OklchColorInputChannel {
  return (
    channel === 'l' || channel === 'c' || channel === 'h' || channel === 'alpha'
  );
}

function isRgbColorInputChannel(
  channel: ColorInputChannel,
): channel is RgbColorInputChannel {
  return (
    channel === 'r' || channel === 'g' || channel === 'b' || channel === 'alpha'
  );
}

function isHslColorInputChannel(
  channel: ColorInputChannel,
): channel is HslColorInputChannel {
  return (
    channel === 'h' || channel === 's' || channel === 'l' || channel === 'alpha'
  );
}

function assertInvalidColorInputPair(
  model: ColorInputModel,
  channel: ColorInputChannel,
): never {
  throw new Error(
    `Invalid color input channel "${channel}" for "${model}" model.`,
  );
}

function getColorInputChannelTableValue<Value, Model extends ColorInputModel>(
  table: ColorInputChannelTable<Value>,
  model: Model,
  channel: ColorInputChannelFor<Model>,
): Value {
  if (model === 'oklch' && isOklchColorInputChannel(channel)) {
    return table.oklch[channel];
  }
  if (model === 'rgb' && isRgbColorInputChannel(channel)) {
    return table.rgb[channel];
  }
  if (model === 'hsl' && isHslColorInputChannel(channel)) {
    return table.hsl[channel];
  }
  return assertInvalidColorInputPair(model, channel);
}

function isHueChannel<Model extends ColorInputModel>(
  model: Model,
  channel: ColorInputChannelFor<Model>,
): boolean {
  return channel === 'h' && (model === 'oklch' || model === 'hsl');
}

function resolveStepValue(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return fallback;
  }
  return value;
}

export function resolveColorInputRange<Model extends ColorInputModel>(
  model: Model,
  channel: ColorInputChannelFor<Model>,
  range?: [number, number],
): [number, number] {
  return (
    range ??
    getColorInputChannelTableValue(COLOR_INPUT_DEFAULT_RANGES, model, channel)
  );
}

export function resolveColorInputWrap<Model extends ColorInputModel>(
  model: Model,
  channel: ColorInputChannelFor<Model>,
  wrap?: boolean,
): boolean {
  return wrap ?? isHueChannel(model, channel);
}

export function resolveColorInputSteps<Model extends ColorInputModel>(
  model: Model,
  channel: ColorInputChannelFor<Model>,
  options: ResolveColorInputStepsOptions = {},
): ColorInputStepConfig {
  const defaults = getColorInputChannelTableValue(
    COLOR_INPUT_DEFAULT_STEPS,
    model,
    channel,
  );

  return {
    step: resolveStepValue(options.step, defaults.step),
    fineStep: resolveStepValue(options.fineStep, defaults.fineStep),
    coarseStep: resolveStepValue(options.coarseStep, defaults.coarseStep),
    pageStep: resolveStepValue(options.pageStep, defaults.pageStep),
  };
}

export function getColorInputLabel<Model extends ColorInputModel>(
  model: Model,
  channel: ColorInputChannelFor<Model>,
): string {
  return getColorInputChannelTableValue(COLOR_INPUT_LABELS, model, channel);
}

/** Single character (or "α" for alpha) for the leading scrub handle in channel inputs. */
const COLOR_INPUT_GLYPHS: ColorInputChannelTable<string> = {
  oklch: {
    l: 'L',
    c: 'C',
    h: 'H',
    alpha: 'α',
  },
  rgb: {
    r: 'R',
    g: 'G',
    b: 'B',
    alpha: 'α',
  },
  hsl: {
    h: 'H',
    s: 'S',
    l: 'L',
    alpha: 'α',
  },
};

export function getColorInputChannelGlyph<Model extends ColorInputModel>(
  model: Model,
  channel: ColorInputChannelFor<Model>,
): string {
  return getColorInputChannelTableValue(COLOR_INPUT_GLYPHS, model, channel);
}

export function getColorInputChangedChannel<Model extends ColorInputModel>(
  model: Model,
  channel: ColorInputChannelFor<Model>,
): 'l' | 'c' | 'h' | 'alpha' | undefined {
  return model === 'oklch' && isOklchColorInputChannel(channel)
    ? channel
    : undefined;
}

export function normalizeColorInputValue(
  value: number,
  range: [number, number],
  wrap: boolean,
): number {
  return normalizePrimitiveValue(
    value,
    range[0],
    range[1],
    wrap ? 'wrap' : 'clamp',
  );
}

/**
 * Reads one channel of `color` in `model`. For an achromatic color (a gray,
 * black or white) the HSL hue is not the canonical `0` but the HSL hue of the
 * stored OKLCH hue: the hue of the 1%-saturated HSL color at the same
 * lightness (clamped to 5-95%) whose OKLCH hue is `color.h`.
 */
export function getColorInputChannelValue<Model extends ColorInputModel>(
  color: Color,
  model: Model,
  channel: ColorInputChannelFor<Model>,
): number {
  if (model === 'oklch' && isOklchColorInputChannel(channel)) {
    return color[channel];
  }

  if (model === 'rgb' && isRgbColorInputChannel(channel)) {
    const rgb = toRgb(color);
    return rgb[channel];
  }

  if (model === 'hsl' && isHslColorInputChannel(channel)) {
    const hsl = toColorInputHsl(color);
    return hsl[channel];
  }

  return assertInvalidColorInputPair(model, channel);
}

/**
 * OKLCH hues of the sRGB primaries and secondaries (HSL hues 0, 60, ..., 300,
 * then red again at 360). Only used to seed `solveHslHue`.
 */
const HSL_HUE_ANCHORS = [
  29.23, 109.77, 142.5, 194.77, 264.05, 328.36, 389.23,
] as const;

/**
 * HSL saturation (percent) at which an achromatic color's HSL hue is read:
 * the HSL hue shown for a gray is the one whose 1%-saturated color at the
 * same HSL lightness has the stored OKLCH hue.
 */
const ACHROMATIC_HSL_PROBE_SATURATION = 1;

/**
 * HSL lightness range (percent) for that probe, so black and white (where
 * every saturation is achromatic) still read a hue.
 */
const ACHROMATIC_HSL_PROBE_LIGHTNESS: readonly [number, number] = [5, 95];

/** HSL hue bracket width (degrees) at which `solveHslHue` stops. */
const HSL_HUE_SOLVE_TOLERANCE = 0.0001;

function signedHueDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

/** OKLCH hue of an HSL color, or `null` when that color is achromatic. */
function oklchHueOfHsl(h: number, s: number, l: number): number | null {
  const color = fromHsl({ h, s, l, alpha: 1 });
  return isAchromatic(color.c) ? null : color.h;
}

/** Piecewise-linear OKLCH-to-HSL hue estimate between the sRGB primaries. */
function estimateHslHue(oklchHue: number): number {
  let hue = normalizeHue(oklchHue);
  if (hue < HSL_HUE_ANCHORS[0]) hue += 360;
  for (let index = 0; index < HSL_HUE_ANCHORS.length - 1; index += 1) {
    const start = HSL_HUE_ANCHORS[index];
    const end = HSL_HUE_ANCHORS[index + 1];
    if (hue <= end) {
      return (index + (hue - start) / (end - start)) * 60;
    }
  }
  return 0;
}

/**
 * Finds the HSL hue whose color at HSL saturation `s` and lightness `l` has
 * OKLCH hue `oklchHue`. At fixed `s` and `l` the OKLCH hue rises
 * monotonically with the HSL hue, so this bisects a ±90° bracket around an
 * estimate down to `HSL_HUE_SOLVE_TOLERANCE` (about 21 conversions). Returns
 * `null` when `s` and `l` give an achromatic color (saturation 0, black or
 * white) or the bracket misses.
 */
function solveHslHue(oklchHue: number, s: number, l: number): number | null {
  const estimate = estimateHslHue(oklchHue);
  let low = estimate - 90;
  let high = estimate + 90;
  const lowHue = oklchHueOfHsl(low, s, l);
  const highHue = oklchHueOfHsl(high, s, l);
  if (
    lowHue === null ||
    highHue === null ||
    !(signedHueDelta(lowHue, oklchHue) < 0) ||
    !(signedHueDelta(highHue, oklchHue) > 0)
  ) {
    return null;
  }

  while (high - low > HSL_HUE_SOLVE_TOLERANCE) {
    const hue = (low + high) / 2;
    const midHue = oklchHueOfHsl(hue, s, l);
    if (midHue === null) return null;
    if (signedHueDelta(midHue, oklchHue) < 0) {
      low = hue;
    } else {
      high = hue;
    }
  }
  return normalizeHue((low + high) / 2);
}

function achromaticHslProbeLightness(l: number): number {
  return clamp(
    l,
    ACHROMATIC_HSL_PROBE_LIGHTNESS[0],
    ACHROMATIC_HSL_PROBE_LIGHTNESS[1],
  );
}

/** True for a gray, black or white that still carries a stored OKLCH hue. */
function isAchromaticWithHue(color: Color): boolean {
  return isAchromatic(color.c) && Number.isFinite(color.h);
}

/**
 * `toHsl(color)`, except that an achromatic color reads the HSL hue of its
 * stored OKLCH hue (see `ACHROMATIC_HSL_PROBE_SATURATION`) instead of the
 * canonical achromatic HSL hue `0`.
 */
function toColorInputHsl(color: Color): Hsl {
  const hsl = toHsl(color);
  if (!isAchromaticWithHue(color)) return hsl;
  const h = solveHslHue(
    color.h,
    ACHROMATIC_HSL_PROBE_SATURATION,
    achromaticHslProbeLightness(hsl.l),
  );
  return h === null ? hsl : { ...hsl, h };
}

/**
 * HSL edit of an achromatic color that still carries an OKLCH hue. A hue edit
 * stays achromatic and stores the OKLCH hue of the typed HSL hue (the inverse
 * of `toColorInputHsl`). A saturation edit picks the HSL hue at which the new
 * saturation lands on the stored OKLCH hue. Other edits keep the stored hue.
 */
function colorFromAchromaticHslEdit(
  color: Color,
  hsl: Hsl,
  channel: HslColorInputChannel,
  value: number,
): Color {
  const next: Hsl = { ...hsl, [channel]: value };
  if (channel === 'h') {
    const converted = fromHsl(next);
    if (!isAchromatic(converted.c)) return converted;
    const h = oklchHueOfHsl(
      value,
      ACHROMATIC_HSL_PROBE_SATURATION,
      achromaticHslProbeLightness(hsl.l),
    );
    return h === null
      ? resolveIncomingRequested(color, converted, { explicitHue: false })
      : { ...converted, h };
  }
  if (channel === 's' && value > 0) {
    next.h = solveHslHue(color.h, value, hsl.l) ?? next.h;
  }
  return resolveIncomingRequested(color, fromHsl(next), {
    explicitHue: false,
  });
}

/**
 * Returns `color` with one channel of `model` set to `value`.
 *
 * OKLCH edits overwrite only that channel. RGB and HSL edits convert the
 * edited color back to OKLCH; when the result is achromatic (a gray, black
 * or white, or HSL saturation `0`), it keeps `color.h` instead of the
 * canonical achromatic hue `0` (see `resolveIncomingRequested`), so raising
 * OKLCH chroma afterwards resumes that hue exactly.
 *
 * HSL edits of an achromatic `color` with a stored hue start from the HSL
 * hue that `getColorInputChannelValue` reports for it, not `0`:
 * - Raising HSL saturation picks the HSL hue at which the new saturation and
 *   lightness have OKLCH hue `color.h` (to within 0.01°), so the gray turns
 *   back into its previous hue instead of red. Black and white stay
 *   achromatic and keep `color.h`.
 * - An HSL hue edit keeps the color achromatic and stores the OKLCH hue of
 *   the typed HSL hue, which the HSL hue field then reads back.
 * - Lightness and alpha edits keep `color.h`.
 *
 * RGB edits away from a gray take whatever hue the new RGB values have.
 */
export function colorFromColorInputChannelValue<Model extends ColorInputModel>(
  color: Color,
  model: Model,
  channel: ColorInputChannelFor<Model>,
  value: number,
): Color {
  if (model === 'oklch' && isOklchColorInputChannel(channel)) {
    return {
      ...color,
      [channel]: value,
    };
  }

  if (model === 'rgb' && isRgbColorInputChannel(channel)) {
    const rgb = toRgb(color);
    const next: Rgb = {
      ...rgb,
      [channel]: value,
    };
    return resolveIncomingRequested(color, fromRgb(next), {
      explicitHue: false,
    });
  }

  if (model === 'hsl' && isHslColorInputChannel(channel)) {
    const hsl = toColorInputHsl(color);
    if (isAchromaticWithHue(color)) {
      return colorFromAchromaticHslEdit(color, hsl, channel, value);
    }
    const next: Hsl = {
      ...hsl,
      [channel]: value,
    };
    return resolveIncomingRequested(color, fromHsl(next), {
      explicitHue: false,
    });
  }

  return assertInvalidColorInputPair(model, channel);
}

export function getColorInputPrecisionFromStep(step: number): number {
  const safeStep = Math.abs(step);
  if (!Number.isFinite(safeStep) || safeStep <= 0) {
    return 2;
  }

  let precision = 0;
  let current = safeStep;
  while (precision < 6 && Math.abs(Math.round(current) - current) > 0.0000001) {
    current *= 10;
    precision += 1;
  }
  return precision;
}

export function formatColorInputChannelValue(
  value: number,
  precision: number,
): string {
  const safePrecision = Math.max(0, Math.min(6, Math.round(precision)));
  return formatPrimitiveValue(value, safePrecision, true);
}

export function resolveColorInputDraftValue(
  input: string,
  options: ResolveColorInputDraftValueOptions,
): number | null {
  const parsed = parseColorInputExpression(input, {
    currentValue: options.currentValue,
    range: options.range,
    allowExpressions: options.allowExpressions ?? false,
  });
  if (parsed === null) {
    return null;
  }

  return normalizeColorInputValue(parsed, options.range, options.wrap ?? false);
}

export function colorFromColorInputKey<Model extends ColorInputModel>(
  color: Color,
  model: Model,
  channel: ColorInputChannelFor<Model>,
  key: string,
  options: {
    step: number;
    pageStep?: number;
    range: [number, number];
    wrap?: boolean;
  },
): { color: Color; value: number } | null {
  const current = getColorInputChannelValue(color, model, channel);
  const wrap = options.wrap ?? false;
  const step = Math.abs(options.step);
  const pageStep =
    options.pageStep !== undefined ? Math.abs(options.pageStep) : step;
  const normalized = getPrimitiveSteppedValue({
    value: current,
    key,
    min: options.range[0],
    max: options.range[1],
    wrapMode: wrap ? 'wrap' : 'clamp',
    step,
    pageStep,
  });
  if (normalized === null) {
    return null;
  }

  return {
    value: normalized,
    color: colorFromColorInputChannelValue(color, model, channel, normalized),
  };
}
