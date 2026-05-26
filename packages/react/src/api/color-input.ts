import type { Color, Hsl, Rgb } from '@color-kit/core';
import { fromHsl, fromRgb, toHsl, toRgb } from '@color-kit/core';
import {
  formatPrimitiveValue,
  getPrimitiveSteppedValue,
  normalizePrimitiveValue,
  parsePrimitiveDraft,
} from '@color-kit/control-kit';
import { parseColorInputExpression } from './color-input-parser.js';
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
    const hsl = toHsl(color);
    return hsl[channel];
  }

  return assertInvalidColorInputPair(model, channel);
}

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
    return fromRgb(next);
  }

  if (model === 'hsl' && isHslColorInputChannel(channel)) {
    const hsl = toHsl(color);
    const next: Hsl = {
      ...hsl,
      [channel]: value,
    };
    return fromHsl(next);
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
  const parsed = parsePrimitiveDraft(
    input,
    options.currentValue,
    options.range[0],
    options.range[1],
    options.allowExpressions ?? false,
    (draft, primitiveOptions) =>
      parseColorInputExpression(draft, {
        currentValue: primitiveOptions.currentValue,
        range: primitiveOptions.range,
        allowExpressions: primitiveOptions.allowExpressions,
      }),
  );
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
