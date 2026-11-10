import type { Color, Hsl, Rgb } from '@color-kit/core';
import { clamp } from './clamp.js';
import {
  fromHsl,
  fromRgb,
  isAchromatic,
  normalizeHue,
  toHsl,
  toRgb,
} from '@color-kit/core';
import { resolveIncomingRequested } from './color-state.js';
import type { ColorChannel } from './color-state.js';

/** Most decimals {@link formatColorChannelValue} shows. */
const MAX_COLOR_CHANNEL_PRECISION = 6;

/**
 * Color model whose channels this module reads and writes: OKLCH (`l` 0-1, `c` 0-0.4, `h`
 * degrees), RGB (`r`/`g`/`b` 0-255) or HSL (`h` degrees, `s`/`l` 0-100).
 * Every model also has an `alpha` channel (0-1).
 */
export type ColorChannelModel = 'oklch' | 'rgb' | 'hsl';
/**
 * Channels of the `'oklch'` model. The same union as {@link ColorChannel},
 * the channels of the canonical `Color`.
 */
export type OklchColorModelChannel = ColorChannel;
/** Channels of the `'rgb'` model. */
export type RgbColorModelChannel = 'r' | 'g' | 'b' | 'alpha';
/** Channels of the `'hsl'` model. */
export type HslColorModelChannel = 'h' | 's' | 'l' | 'alpha';
/** Any channel of any {@link ColorChannelModel}. */
export type ColorModelChannel =
  | OklchColorModelChannel
  | RgbColorModelChannel
  | HslColorModelChannel;
/** Channels valid for `Model`, so `('rgb', 'h')` fails to type-check. */
export type ColorModelChannelFor<Model extends ColorChannelModel> =
  Model extends 'oklch'
    ? OklchColorModelChannel
    : Model extends 'rgb'
      ? RgbColorModelChannel
      : HslColorModelChannel;
/**
 * A valid model/channel pair, e.g. `{ model: 'hsl', channel: 's' }`. The
 * union is discriminated on `model`.
 */
export type ColorChannelSpec<
  Model extends ColorChannelModel = ColorChannelModel,
> = {
  [Key in Model]: {
    /** Color model the channel belongs to. */
    model: Key;
    /** Channel of `model`. */
    channel: ColorModelChannelFor<Key>;
  };
}[Model];

/** Resolved step sizes for one channel, in channel units. */
export interface ColorChannelStepConfig {
  /** Base step (one arrow-key press). */
  step: number;
  /** Fine step (typically with a modifier key held). */
  fineStep: number;
  /** Coarse step (typically with Shift held). */
  coarseStep: number;
  /** Page Up / Page Down step. */
  pageStep: number;
}

/**
 * Step overrides for {@link resolveColorChannelSteps}. A missing, zero,
 * negative or non-finite value falls back to the channel default.
 */
export interface ResolveColorChannelStepsOptions {
  /**
   * Base step (one arrow-key press).
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

type ColorModelChannelTable<Value> = {
  oklch: Record<OklchColorModelChannel, Value>;
  rgb: Record<RgbColorModelChannel, Value>;
  hsl: Record<HslColorModelChannel, Value>;
};

const COLOR_CHANNEL_LABELS: ColorModelChannelTable<string> = {
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
 * Default `[min, max]` range of every channel, keyed by model then
 * channel: OKLCH `l` `[0, 1]`, `c` `[0, 0.4]`, `h` `[0, 360]`; RGB `r`/`g`/`b`
 * `[0, 255]`; HSL `h` `[0, 360]`, `s`/`l` `[0, 100]`; `alpha` `[0, 1]` in
 * every model. {@link resolveColorChannelRange} reads it.
 */
export const COLOR_CHANNEL_DEFAULT_RANGES: ColorModelChannelTable<
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

const COLOR_CHANNEL_DEFAULT_STEPS: ColorModelChannelTable<ColorChannelStepConfig> =
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

function isOklchColorModelChannel(
  channel: ColorModelChannel,
): channel is OklchColorModelChannel {
  return (
    channel === 'l' || channel === 'c' || channel === 'h' || channel === 'alpha'
  );
}

function isRgbColorModelChannel(
  channel: ColorModelChannel,
): channel is RgbColorModelChannel {
  return (
    channel === 'r' || channel === 'g' || channel === 'b' || channel === 'alpha'
  );
}

function isHslColorModelChannel(
  channel: ColorModelChannel,
): channel is HslColorModelChannel {
  return (
    channel === 'h' || channel === 's' || channel === 'l' || channel === 'alpha'
  );
}

function assertInvalidColorChannelPair(
  model: ColorChannelModel,
  channel: ColorModelChannel,
): never {
  throw new Error(`Invalid color channel "${channel}" for "${model}" model.`);
}

function getColorModelChannelTableValue<Value, Model extends ColorChannelModel>(
  table: ColorModelChannelTable<Value>,
  model: Model,
  channel: ColorModelChannelFor<Model>,
): Value {
  if (model === 'oklch' && isOklchColorModelChannel(channel)) {
    return table.oklch[channel];
  }
  if (model === 'rgb' && isRgbColorModelChannel(channel)) {
    return table.rgb[channel];
  }
  if (model === 'hsl' && isHslColorModelChannel(channel)) {
    return table.hsl[channel];
  }
  return assertInvalidColorChannelPair(model, channel);
}

function isHueChannel<Model extends ColorChannelModel>(
  model: Model,
  channel: ColorModelChannelFor<Model>,
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
 * {@link COLOR_CHANNEL_DEFAULT_RANGES}.
 *
 * @param model - Color model the channel belongs to.
 * @param channel - Channel of `model`.
 * @param range - Explicit `[min, max]` override, returned as is.
 * @throws {Error} When no `range` is given and `channel` does not belong to
 * `model`.
 *
 * @example
 * ```ts
 * import { resolveColorChannelRange } from '@pbroom/color-kit/driver';
 *
 * resolveColorChannelRange('rgb', 'r'); // → [0, 255]
 * resolveColorChannelRange('oklch', 'c', [0, 0.5]); // → [0, 0.5]
 * ```
 */
export function resolveColorChannelRange<Model extends ColorChannelModel>(
  model: Model,
  channel: ColorModelChannelFor<Model>,
  range?: [number, number],
): [number, number] {
  return (
    range ??
    getColorModelChannelTableValue(COLOR_CHANNEL_DEFAULT_RANGES, model, channel)
  );
}

/**
 * Returns `wrap` when given, otherwise whether the channel is a hue (OKLCH or
 * HSL `h`), which wraps around its range instead of clamping.
 *
 * @example
 * ```ts
 * import { resolveColorChannelWrap } from '@pbroom/color-kit/driver';
 *
 * resolveColorChannelWrap('hsl', 'h'); // → true
 * resolveColorChannelWrap('oklch', 'l'); // → false
 * resolveColorChannelWrap('oklch', 'h', false); // → false
 * ```
 */
export function resolveColorChannelWrap<Model extends ColorChannelModel>(
  model: Model,
  channel: ColorModelChannelFor<Model>,
  wrap?: boolean,
): boolean {
  return wrap ?? isHueChannel(model, channel);
}

/**
 * Resolves the step sizes for a channel: each option that is a finite
 * positive number wins, anything else falls back to the channel default.
 *
 * @throws {Error} When `channel` does not belong to `model`.
 * @see {@link ResolveColorChannelStepsOptions} for the per-channel defaults.
 *
 * @example
 * ```ts
 * import { resolveColorChannelSteps } from '@pbroom/color-kit/driver';
 *
 * resolveColorChannelSteps('oklch', 'h');
 * // → { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 45 }
 * resolveColorChannelSteps('rgb', 'r', { step: 5, pageStep: -1 });
 * // → { step: 5, fineStep: 0.1, coarseStep: 10, pageStep: 25 }
 * ```
 */
export function resolveColorChannelSteps<Model extends ColorChannelModel>(
  model: Model,
  channel: ColorModelChannelFor<Model>,
  options: ResolveColorChannelStepsOptions = {},
): ColorChannelStepConfig {
  const defaults = getColorModelChannelTableValue(
    COLOR_CHANNEL_DEFAULT_STEPS,
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
 * Returns the English accessible label for a channel, e.g.
 * `'OKLCH lightness'`, `'Red'` or `'Opacity'`.
 *
 * @throws {Error} When `channel` does not belong to `model`.
 *
 * @example
 * ```ts
 * import { getColorChannelLabel } from '@pbroom/color-kit/driver';
 *
 * getColorChannelLabel('oklch', 'c'); // → 'OKLCH chroma'
 * getColorChannelLabel('hsl', 's'); // → 'Saturation'
 * ```
 */
export function getColorChannelLabel<Model extends ColorChannelModel>(
  model: Model,
  channel: ColorModelChannelFor<Model>,
): string {
  return getColorModelChannelTableValue(COLOR_CHANNEL_LABELS, model, channel);
}

/**
 * Maps a model channel to the OKLCH {@link ColorChannel} to report as
 * `changedChannel` in {@link ColorUpdateEvent}. Only OKLCH channels map to
 * one; RGB and HSL edits change several OKLCH channels at once and return
 * `undefined`.
 *
 * @example
 * ```ts
 * import { getChangedColorChannel } from '@pbroom/color-kit/driver';
 *
 * getChangedColorChannel('oklch', 'h'); // → 'h'
 * getChangedColorChannel('rgb', 'r'); // → undefined
 * ```
 */
export function getChangedColorChannel<Model extends ColorChannelModel>(
  model: Model,
  channel: ColorModelChannelFor<Model>,
): ColorChannel | undefined {
  return model === 'oklch' && isOklchColorModelChannel(channel)
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
 * import { normalizeColorChannelValue } from '@pbroom/color-kit/driver';
 *
 * normalizeColorChannelValue(400, [0, 360], true); // → 40
 * normalizeColorChannelValue(-20, [0, 360], true); // → 340
 * normalizeColorChannelValue(1.2, [0, 1], false); // → 1
 * ```
 */
export function normalizeColorChannelValue(
  value: number,
  range: [number, number],
  wrap: boolean,
): number {
  const [min, max] = range;
  if (!Number.isFinite(value)) {
    return min;
  }
  if (max <= min) {
    return value;
  }
  if (!wrap) {
    return clamp(value, min, max);
  }
  if (Math.abs(value - max) <= 1e-12) {
    return max;
  }
  const span = max - min;
  return ((((value - min) % span) + span) % span) + min;
}

/**
 * Reads one channel of `color` in `model`. For an achromatic color (a gray,
 * black or white) the HSL hue is not the canonical `0` but the HSL hue of the
 * stored OKLCH hue: the hue of the 1%-saturated HSL color at the same
 * lightness (clamped to 5-95%) whose OKLCH hue is `color.h`.
 *
 * Values are unrounded, in the channel's units (RGB 0-255, HSL `s`/`l`
 * 0-100); format them with {@link formatColorChannelValue}.
 *
 * @throws {Error} When `channel` does not belong to `model`.
 *
 * @example
 * ```ts
 * import { parse } from '@pbroom/color-kit';
 * import { getColorChannelValue } from '@pbroom/color-kit/driver';
 *
 * const blue = parse('#3b82f6');
 * getColorChannelValue(blue, 'rgb', 'r'); // → 59
 * getColorChannelValue(blue, 'hsl', 'h').toFixed(1); // → '217.2'
 * const gray = { l: 0.6, c: 0, h: 250, alpha: 1 };
 * getColorChannelValue(gray, 'hsl', 'h').toFixed(1); // → '211.2'
 * ```
 */
export function getColorChannelValue<Model extends ColorChannelModel>(
  color: Color,
  model: Model,
  channel: ColorModelChannelFor<Model>,
): number {
  if (model === 'oklch' && isOklchColorModelChannel(channel)) {
    return color[channel];
  }

  if (model === 'rgb' && isRgbColorModelChannel(channel)) {
    const rgb = toRgb(color);
    return rgb[channel];
  }

  if (model === 'hsl' && isHslColorModelChannel(channel)) {
    const hsl = toColorChannelHsl(color);
    return hsl[channel];
  }

  return assertInvalidColorChannelPair(model, channel);
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
function toColorChannelHsl(color: Color): Hsl {
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
 * of `toColorChannelHsl`). A saturation edit picks the HSL hue at which the new
 * saturation lands on the stored OKLCH hue. Other edits keep the stored hue.
 */
function colorFromAchromaticHslEdit(
  color: Color,
  hsl: Hsl,
  channel: HslColorModelChannel,
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
 * hue that `getColorChannelValue` reports for it, not `0`:
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
 * {@link normalizeColorChannelValue}.
 *
 * @throws {Error} When `channel` does not belong to `model`.
 *
 * @example
 * ```ts
 * import { parse, toHex } from '@pbroom/color-kit';
 * import { colorFromColorChannelValue } from '@pbroom/color-kit/driver';
 *
 * const blue = parse('#3b82f6');
 * toHex(colorFromColorChannelValue(blue, 'rgb', 'r', 255)); // → '#ff82f6'
 * const gray = colorFromColorChannelValue(blue, 'hsl', 's', 0);
 * gray.c < 0.001; // → true
 * gray.h === blue.h; // → true
 * ```
 */
export function colorFromColorChannelValue<Model extends ColorChannelModel>(
  color: Color,
  model: Model,
  channel: ColorModelChannelFor<Model>,
  value: number,
): Color {
  if (model === 'oklch' && isOklchColorModelChannel(channel)) {
    return {
      ...color,
      [channel]: value,
    };
  }

  if (model === 'rgb' && isRgbColorModelChannel(channel)) {
    const rgb = toRgb(color);
    const next: Rgb = {
      ...rgb,
      [channel]: value,
    };
    return resolveIncomingRequested(color, fromRgb(next), {
      explicitHue: false,
    });
  }

  if (model === 'hsl' && isHslColorModelChannel(channel)) {
    const hsl = toColorChannelHsl(color);
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

  return assertInvalidColorChannelPair(model, channel);
}

/**
 * Formats a channel value for display: rounds to `precision` decimals
 * (itself rounded and clamped to 0-6) and drops trailing zeros. `-0` and
 * non-finite values format as `'0'`.
 *
 * @example
 * ```ts
 * import { formatColorChannelValue } from '@pbroom/color-kit/driver';
 *
 * formatColorChannelValue(0.62795, 3); // → '0.628'
 * formatColorChannelValue(120, 2); // → '120'
 * formatColorChannelValue(-0.0001, 2); // → '0'
 * ```
 */
export function formatColorChannelValue(
  value: number,
  precision: number,
): string {
  const safePrecision = Math.max(
    0,
    Math.min(MAX_COLOR_CHANNEL_PRECISION, Math.round(precision)),
  );
  if (!Number.isFinite(value)) {
    return '0';
  }
  const rounded = Number(value.toFixed(safePrecision));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}
