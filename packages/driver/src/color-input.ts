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

/** Most decimals a channel input shows or derives from its step. */
const MAX_COLOR_INPUT_PRECISION = 6;

export { parseColorInputExpression } from './color-input-parser.js';
export type { ParseColorInputExpressionOptions } from './color-input-parser.js';

/**
 * Color model a numeric channel input edits: OKLCH (`l` 0-1, `c` 0-0.4, `h`
 * degrees), RGB (`r`/`g`/`b` 0-255) or HSL (`h` degrees, `s`/`l` 0-100).
 * Every model also has an `alpha` channel (0-1).
 */
export type ColorInputModel = 'oklch' | 'rgb' | 'hsl';
/** Channels of the `'oklch'` input model. */
export type OklchColorInputChannel = 'l' | 'c' | 'h' | 'alpha';
/** Channels of the `'rgb'` input model. */
export type RgbColorInputChannel = 'r' | 'g' | 'b' | 'alpha';
/** Channels of the `'hsl'` input model. */
export type HslColorInputChannel = 'h' | 's' | 'l' | 'alpha';
/** Any channel of any {@link ColorInputModel}. */
export type ColorInputChannel =
  | OklchColorInputChannel
  | RgbColorInputChannel
  | HslColorInputChannel;
/** Channels valid for `Model`, so `('rgb', 'h')` fails to type-check. */
export type ColorInputChannelFor<Model extends ColorInputModel> =
  Model extends 'oklch'
    ? OklchColorInputChannel
    : Model extends 'rgb'
      ? RgbColorInputChannel
      : HslColorInputChannel;
/**
 * A valid model/channel pair, e.g. `{ model: 'hsl', channel: 's' }`. The
 * union is discriminated on `model`.
 */
export type ColorInputSpec<Model extends ColorInputModel = ColorInputModel> = {
  [Key in Model]: {
    /** Color model the input edits. */
    model: Key;
    /** Channel of `model` the input edits. */
    channel: ColorInputChannelFor<Key>;
  };
}[Model];

/**
 * Keyboard keys {@link colorFromColorInputKey} steps on: arrows by `step`,
 * Page Up/Down by `pageStep`, Home/End to the range ends.
 */
export type ColorInputKey =
  | 'ArrowRight'
  | 'ArrowLeft'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'PageUp'
  | 'PageDown'
  | 'Home'
  | 'End';

/** Resolved step sizes for one channel input, in channel units. */
export interface ColorInputStepConfig {
  /** Arrow-key and scrub step. */
  step: number;
  /** Fine step (typically with a modifier key held). */
  fineStep: number;
  /** Coarse step (typically with Shift held). */
  coarseStep: number;
  /** Page Up / Page Down step. */
  pageStep: number;
}

/**
 * Step overrides for {@link resolveColorInputSteps}. A missing, zero,
 * negative or non-finite value falls back to the channel default.
 */
export interface ResolveColorInputStepsOptions {
  /**
   * Arrow-key and scrub step.
   * @defaultValue per channel: OKLCH `l` 0.01, `c` 0.005, hue 1, RGB 1, HSL `s`/`l` 1, alpha 0.01
   */
  step?: number;
  /**
   * Fine step.
   * @defaultValue per channel: OKLCH `l`/`c` 0.001, hue 0.1, RGB 0.1, HSL `s`/`l` 0.1, alpha 0.001
   */
  fineStep?: number;
  /**
   * Coarse step.
   * @defaultValue per channel: OKLCH `l` 0.1, `c` 0.05, hue 10, RGB 10, HSL `s`/`l` 10, alpha 0.1
   */
  coarseStep?: number;
  /**
   * Page Up / Page Down step.
   * @defaultValue per channel: OKLCH `l` 0.1, `c` 0.05, hue 45, RGB 25, HSL `s`/`l` 10, alpha 0.1
   */
  pageStep?: number;
}

/** Options for {@link resolveColorInputDraftValue}. */
export interface ResolveColorInputDraftValueOptions extends ParseColorInputExpressionOptions {
  /**
   * Wrap the parsed value into `range` (hue-style) instead of clamping it.
   * @defaultValue false
   */
  wrap?: boolean;
}

/**
 * Options shape shared with primitive input expression parsers (structurally
 * compatible with control-kit's `PrimitiveExpressionParser` callback).
 */
export interface ColorInputPrimitiveExpressionOptions {
  /** Accept arithmetic and relative expressions, not just a single number. */
  allowExpressions: boolean;
  /** Current channel value; the left operand of relative input like `+10`. */
  currentValue: number;
  /** Channel range `[min, max]`; percentages are fractions of its span. */
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

/**
 * Default `[min, max]` range of every channel input, keyed by model then
 * channel: OKLCH `l` `[0, 1]`, `c` `[0, 0.4]`, `h` `[0, 360]`; RGB `r`/`g`/`b`
 * `[0, 255]`; HSL `h` `[0, 360]`, `s`/`l` `[0, 100]`; `alpha` `[0, 1]` in
 * every model. {@link resolveColorInputRange} reads it.
 */
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

/**
 * Returns `range` when given, otherwise the channel's default from
 * {@link COLOR_INPUT_DEFAULT_RANGES}.
 *
 * @param model - Color model of the input.
 * @param channel - Channel of `model`.
 * @param range - Explicit `[min, max]` override, returned as is.
 * @throws {Error} When no `range` is given and `channel` does not belong to
 * `model`.
 *
 * @example
 * ```ts
 * import { resolveColorInputRange } from 'color-kit/driver';
 *
 * resolveColorInputRange('rgb', 'r'); // → [0, 255]
 * resolveColorInputRange('oklch', 'c', [0, 0.5]); // → [0, 0.5]
 * ```
 */
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

/**
 * Returns `wrap` when given, otherwise whether the channel is a hue (OKLCH or
 * HSL `h`), which wraps around its range instead of clamping.
 *
 * @example
 * ```ts
 * import { resolveColorInputWrap } from 'color-kit/driver';
 *
 * resolveColorInputWrap('hsl', 'h'); // → true
 * resolveColorInputWrap('oklch', 'l'); // → false
 * resolveColorInputWrap('oklch', 'h', false); // → false
 * ```
 */
export function resolveColorInputWrap<Model extends ColorInputModel>(
  model: Model,
  channel: ColorInputChannelFor<Model>,
  wrap?: boolean,
): boolean {
  return wrap ?? isHueChannel(model, channel);
}

/**
 * Resolves the step sizes for a channel input: each option that is a finite
 * positive number wins, anything else falls back to the channel default.
 *
 * @throws {Error} When `channel` does not belong to `model`.
 * @see {@link ResolveColorInputStepsOptions} for the per-channel defaults.
 *
 * @example
 * ```ts
 * import { resolveColorInputSteps } from 'color-kit/driver';
 *
 * resolveColorInputSteps('oklch', 'h');
 * // → { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 45 }
 * resolveColorInputSteps('rgb', 'r', { step: 5, pageStep: -1 });
 * // → { step: 5, fineStep: 0.1, coarseStep: 10, pageStep: 25 }
 * ```
 */
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

/**
 * Returns the English accessible label for a channel input, e.g.
 * `'OKLCH lightness'`, `'Red'` or `'Opacity'`.
 *
 * @throws {Error} When `channel` does not belong to `model`.
 *
 * @example
 * ```ts
 * import { getColorInputLabel } from 'color-kit/driver';
 *
 * getColorInputLabel('oklch', 'c'); // → 'OKLCH chroma'
 * getColorInputLabel('hsl', 's'); // → 'Saturation'
 * ```
 */
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

/**
 * Returns the one-character glyph for a channel input's leading scrub
 * handle: the uppercase channel letter, or `'α'` for alpha.
 *
 * @throws {Error} When `channel` does not belong to `model`.
 *
 * @example
 * ```ts
 * import { getColorInputChannelGlyph } from 'color-kit/driver';
 *
 * getColorInputChannelGlyph('oklch', 'c'); // → 'C'
 * getColorInputChannelGlyph('rgb', 'alpha'); // → 'α'
 * ```
 */
export function getColorInputChannelGlyph<Model extends ColorInputModel>(
  model: Model,
  channel: ColorInputChannelFor<Model>,
): string {
  return getColorInputChannelTableValue(COLOR_INPUT_GLYPHS, model, channel);
}

/**
 * Maps an input's channel to the OKLCH {@link ColorChannel} reported as
 * `changedChannel` in {@link ColorUpdateEvent}. Only OKLCH inputs map to a
 * channel; RGB and HSL edits change several OKLCH channels at once and
 * return `undefined`.
 *
 * @example
 * ```ts
 * import { getColorInputChangedChannel } from 'color-kit/driver';
 *
 * getColorInputChangedChannel('oklch', 'h'); // → 'h'
 * getColorInputChangedChannel('rgb', 'r'); // → undefined
 * ```
 */
export function getColorInputChangedChannel<Model extends ColorInputModel>(
  model: Model,
  channel: ColorInputChannelFor<Model>,
): 'l' | 'c' | 'h' | 'alpha' | undefined {
  return model === 'oklch' && isOklchColorInputChannel(channel)
    ? channel
    : undefined;
}

/**
 * Wraps `value` into `range` when `wrap` is true, otherwise clamps it.
 * Wrapping keeps a value equal to `max` at `max` (360 stays 360, not 0).
 * A non-finite `value` returns `range[0]`; an empty or inverted range
 * returns `value` unchanged.
 *
 * @example
 * ```ts
 * import { normalizeColorInputValue } from 'color-kit/driver';
 *
 * normalizeColorInputValue(400, [0, 360], true); // → 40
 * normalizeColorInputValue(-20, [0, 360], true); // → 340
 * normalizeColorInputValue(1.2, [0, 1], false); // → 1
 * ```
 */
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
 *
 * Values are unrounded, in the channel's units (RGB 0-255, HSL `s`/`l`
 * 0-100); format them with {@link formatColorInputChannelValue}.
 *
 * @throws {Error} When `channel` does not belong to `model`.
 *
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * import { getColorInputChannelValue } from 'color-kit/driver';
 *
 * const blue = parse('#3b82f6');
 * getColorInputChannelValue(blue, 'rgb', 'r'); // → 59
 * getColorInputChannelValue(blue, 'hsl', 'h').toFixed(1); // → '217.2'
 * const gray = { l: 0.6, c: 0, h: 250, alpha: 1 };
 * getColorInputChannelValue(gray, 'hsl', 'h').toFixed(1); // → '211.2'
 * ```
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
 *
 * `value` is not clamped; normalize it first with
 * {@link normalizeColorInputValue}.
 *
 * @throws {Error} When `channel` does not belong to `model`.
 *
 * @example
 * ```ts
 * import { parse, toHex } from 'color-kit';
 * import { colorFromColorInputChannelValue } from 'color-kit/driver';
 *
 * const blue = parse('#3b82f6');
 * toHex(colorFromColorInputChannelValue(blue, 'rgb', 'r', 255)); // → '#ff82f6'
 * const gray = colorFromColorInputChannelValue(blue, 'hsl', 's', 0);
 * gray.c < 0.001; // → true
 * gray.h === blue.h; // → true
 * ```
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

/**
 * Number of decimal places needed to show values on a `step` grid: the count
 * of decimals in `|step|`, capped at 6 (the most
 * {@link formatColorInputChannelValue} shows), so steps finer than `1e-6`,
 * including exponent-notation steps such as `1e-9`, return `6`. Floating
 * point noise is ignored (`0.1 + 0.2` counts as one decimal). A zero or
 * non-finite step returns `2`.
 *
 * @example
 * ```ts
 * import { getColorInputPrecisionFromStep } from 'color-kit/driver';
 *
 * getColorInputPrecisionFromStep(1); // → 0
 * getColorInputPrecisionFromStep(0.01); // → 2
 * getColorInputPrecisionFromStep(0.005); // → 3
 * getColorInputPrecisionFromStep(2.5e-5); // → 6
 * getColorInputPrecisionFromStep(1e-9); // → 6
 * getColorInputPrecisionFromStep(0); // → 2
 * ```
 */
export function getColorInputPrecisionFromStep(step: number): number {
  const safeStep = Math.abs(step);
  if (!Number.isFinite(safeStep) || safeStep <= 0) {
    return 2;
  }

  let precision = 0;
  let current = safeStep;
  // The tolerance is relative to the scaled step, so a step far below 1
  // (where `current` rounds to 0) keeps adding decimals instead of looking
  // like a whole number.
  while (
    precision < MAX_COLOR_INPUT_PRECISION &&
    Math.abs(Math.round(current) - current) > current * 1e-6
  ) {
    current *= 10;
    precision += 1;
  }
  return precision;
}

/**
 * Formats a channel value for display: rounds to `precision` decimals
 * (itself rounded and clamped to 0-6) and drops trailing zeros. `-0` and
 * non-finite values format as `'0'`.
 *
 * @example
 * ```ts
 * import { formatColorInputChannelValue } from 'color-kit/driver';
 *
 * formatColorInputChannelValue(0.62795, 3); // → '0.628'
 * formatColorInputChannelValue(120, 2); // → '120'
 * formatColorInputChannelValue(-0.0001, 2); // → '0'
 * ```
 */
export function formatColorInputChannelValue(
  value: number,
  precision: number,
): string {
  const safePrecision = Math.max(
    0,
    Math.min(MAX_COLOR_INPUT_PRECISION, Math.round(precision)),
  );
  return formatPrimitiveValue(value, safePrecision, true);
}

/**
 * Parses a typed draft with {@link parseColorInputExpression}, then wraps or
 * clamps the result into `options.range` (see
 * {@link normalizeColorInputValue}). Returns `null` when the draft does not
 * parse, so the input can keep or revert its value.
 *
 * @example
 * ```ts
 * import { resolveColorInputDraftValue } from 'color-kit/driver';
 *
 * const alpha = { currentValue: 0.3, range: [0, 1] as [number, number] };
 * resolveColorInputDraftValue('50%', alpha); // → 0.5
 * resolveColorInputDraftValue('1.5', alpha); // → 1
 * resolveColorInputDraftValue('abc', alpha); // → null
 * resolveColorInputDraftValue('+0.1', { ...alpha, allowExpressions: true }); // → 0.4
 *
 * const hue = { currentValue: 0, range: [0, 360] as [number, number] };
 * resolveColorInputDraftValue('370deg', { ...hue, wrap: true }); // → 10
 * ```
 */
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

/**
 * Applies a keyboard step to one channel of `color`. Arrow Up/Right add
 * `options.step`, Arrow Down/Left subtract it, Page Up/Down use
 * `options.pageStep` (default: `step`), and Home/End jump to the range ends.
 * The stepped value is wrapped or clamped into `options.range` (`wrap`
 * defaults to `false`) and written back with
 * {@link colorFromColorInputChannelValue}.
 *
 * @param key - A `KeyboardEvent.key` value; see {@link ColorInputKey}.
 * @returns The new color and channel value, or `null` for any other key.
 * @throws {Error} When `channel` does not belong to `model`.
 *
 * @example
 * ```ts
 * import { parse, toHex } from 'color-kit';
 * import { colorFromColorInputKey } from 'color-kit/driver';
 *
 * const blue = parse('#3b82f6');
 * const options = { step: 10, range: [0, 255] as [number, number] };
 * const next = colorFromColorInputKey(blue, 'rgb', 'r', 'ArrowUp', options);
 * next?.value; // → 69
 * toHex(next!.color); // → '#4582f6'
 * colorFromColorInputKey(blue, 'rgb', 'r', 'Enter', options); // → null
 * ```
 */
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
