import type { Color, Hsl, Rgb } from '@color-kit/core';
import { clamp, fromHsl, fromRgb, toHsl, toRgb } from '@color-kit/core';

export type ColorInputModel = 'oklch' | 'rgb' | 'hsl';
export type OklchColorInputChannel = 'l' | 'c' | 'h' | 'alpha';
export type RgbColorInputChannel = 'r' | 'g' | 'b' | 'alpha';
export type HslColorInputChannel = 'h' | 's' | 'l' | 'alpha';
export type ColorInputChannel =
  | OklchColorInputChannel
  | RgbColorInputChannel
  | HslColorInputChannel;

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

export interface ParseColorInputExpressionOptions {
  currentValue: number;
  range: [number, number];
  allowExpressions?: boolean;
}

export interface ResolveColorInputDraftValueOptions extends ParseColorInputExpressionOptions {
  wrap?: boolean;
}

const COLOR_INPUT_LABELS: Record<
  ColorInputModel,
  Record<ColorInputChannel, string>
> = {
  oklch: {
    l: 'OKLCH lightness',
    c: 'OKLCH chroma',
    h: 'OKLCH hue',
    alpha: 'Opacity',
    r: 'Red',
    g: 'Green',
    b: 'Blue',
    s: 'Saturation',
  },
  rgb: {
    r: 'Red',
    g: 'Green',
    b: 'Blue',
    alpha: 'Opacity',
    l: 'Lightness',
    c: 'Chroma',
    h: 'Hue',
    s: 'Saturation',
  },
  hsl: {
    h: 'Hue',
    s: 'Saturation',
    l: 'Lightness',
    alpha: 'Opacity',
    c: 'Chroma',
    r: 'Red',
    g: 'Green',
    b: 'Blue',
  },
};

export const COLOR_INPUT_DEFAULT_RANGES: Record<
  ColorInputModel,
  Record<ColorInputChannel, [number, number]>
> = {
  oklch: {
    l: [0, 1],
    c: [0, 0.4],
    h: [0, 360],
    alpha: [0, 1],
    r: [0, 255],
    g: [0, 255],
    b: [0, 255],
    s: [0, 100],
  },
  rgb: {
    r: [0, 255],
    g: [0, 255],
    b: [0, 255],
    alpha: [0, 1],
    l: [0, 1],
    c: [0, 0.4],
    h: [0, 360],
    s: [0, 100],
  },
  hsl: {
    h: [0, 360],
    s: [0, 100],
    l: [0, 100],
    alpha: [0, 1],
    c: [0, 0.4],
    r: [0, 255],
    g: [0, 255],
    b: [0, 255],
  },
};

const COLOR_INPUT_DEFAULT_STEPS: Record<
  ColorInputModel,
  Record<ColorInputChannel, ColorInputStepConfig>
> = {
  oklch: {
    l: { step: 0.01, fineStep: 0.001, coarseStep: 0.1, pageStep: 0.1 },
    c: { step: 0.005, fineStep: 0.001, coarseStep: 0.05, pageStep: 0.05 },
    h: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 45 },
    alpha: { step: 0.01, fineStep: 0.001, coarseStep: 0.1, pageStep: 0.1 },
    r: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 25 },
    g: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 25 },
    b: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 25 },
    s: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 10 },
  },
  rgb: {
    r: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 25 },
    g: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 25 },
    b: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 25 },
    alpha: { step: 0.01, fineStep: 0.001, coarseStep: 0.1, pageStep: 0.1 },
    l: { step: 0.01, fineStep: 0.001, coarseStep: 0.1, pageStep: 0.1 },
    c: { step: 0.005, fineStep: 0.001, coarseStep: 0.05, pageStep: 0.05 },
    h: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 45 },
    s: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 10 },
  },
  hsl: {
    h: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 45 },
    s: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 10 },
    l: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 10 },
    alpha: { step: 0.01, fineStep: 0.001, coarseStep: 0.1, pageStep: 0.1 },
    c: { step: 0.005, fineStep: 0.001, coarseStep: 0.05, pageStep: 0.05 },
    r: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 25 },
    g: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 25 },
    b: { step: 1, fineStep: 0.1, coarseStep: 10, pageStep: 25 },
  },
};

function isHueChannel(
  model: ColorInputModel,
  channel: ColorInputChannel,
): boolean {
  return channel === 'h' && (model === 'oklch' || model === 'hsl');
}

function resolveStepValue(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return fallback;
  }
  return value;
}

function wrapInRange(value: number, range: [number, number]): number {
  const span = range[1] - range[0];
  if (span <= 0) {
    return range[0];
  }
  return ((((value - range[0]) % span) + span) % span) + range[0];
}

export function resolveColorInputRange(
  model: ColorInputModel,
  channel: ColorInputChannel,
  range?: [number, number],
): [number, number] {
  return range ?? COLOR_INPUT_DEFAULT_RANGES[model][channel];
}

export function resolveColorInputWrap(
  model: ColorInputModel,
  channel: ColorInputChannel,
  wrap?: boolean,
): boolean {
  return wrap ?? isHueChannel(model, channel);
}

export function resolveColorInputSteps(
  model: ColorInputModel,
  channel: ColorInputChannel,
  options: ResolveColorInputStepsOptions = {},
): ColorInputStepConfig {
  const defaults = COLOR_INPUT_DEFAULT_STEPS[model][channel];

  return {
    step: resolveStepValue(options.step, defaults.step),
    fineStep: resolveStepValue(options.fineStep, defaults.fineStep),
    coarseStep: resolveStepValue(options.coarseStep, defaults.coarseStep),
    pageStep: resolveStepValue(options.pageStep, defaults.pageStep),
  };
}

export function getColorInputLabel(
  model: ColorInputModel,
  channel: ColorInputChannel,
): string {
  return COLOR_INPUT_LABELS[model][channel];
}

export function getColorInputChangedChannel(
  model: ColorInputModel,
  channel: ColorInputChannel,
): 'l' | 'c' | 'h' | 'alpha' | undefined {
  if (model !== 'oklch') {
    return undefined;
  }
  return channel as OklchColorInputChannel;
}

export function normalizeColorInputValue(
  value: number,
  range: [number, number],
  wrap: boolean,
): number {
  const safeValue = Number.isFinite(value) ? value : range[0];
  if (wrap) {
    return wrapInRange(safeValue, range);
  }
  return clamp(safeValue, range[0], range[1]);
}

export function getColorInputChannelValue(
  color: Color,
  model: ColorInputModel,
  channel: ColorInputChannel,
): number {
  if (model === 'oklch') {
    return color[channel as OklchColorInputChannel];
  }

  if (model === 'rgb') {
    const rgb = toRgb(color);
    return rgb[channel as RgbColorInputChannel];
  }

  const hsl = toHsl(color);
  return hsl[channel as HslColorInputChannel];
}

export function colorFromColorInputChannelValue(
  color: Color,
  model: ColorInputModel,
  channel: ColorInputChannel,
  value: number,
): Color {
  if (model === 'oklch') {
    return {
      ...color,
      [channel]: value,
    };
  }

  if (model === 'rgb') {
    const rgb = toRgb(color);
    const next = {
      ...rgb,
      [channel]: value,
    } as Rgb;
    return fromRgb(next);
  }

  const hsl = toHsl(color);
  const next = {
    ...hsl,
    [channel]: value,
  } as Hsl;
  return fromHsl(next);
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
  const rounded =
    safePrecision === 0
      ? Math.round(value)
      : Number(value.toFixed(safePrecision));

  if (!Number.isFinite(rounded) || Math.abs(rounded) === 0) {
    return '0';
  }

  const fixed = rounded.toFixed(safePrecision);
  if (safePrecision === 0) {
    return fixed;
  }

  return fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

interface NumberToken {
  type: 'number';
  value: number;
  isPercent: boolean;
}

interface OperatorToken {
  type: 'operator';
  value: '+' | '-' | '*' | '/';
}

interface ParenToken {
  type: 'paren';
  value: '(' | ')';
}

type ExpressionToken = NumberToken | OperatorToken | ParenToken;

function tokenizeExpression(
  input: string,
): { tokens: ExpressionToken[]; hasPercent: boolean } | null {
  const tokens: ExpressionToken[] = [];
  let index = 0;
  let hasPercent = false;

  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({
        type: 'paren',
        value: char,
      });
      index += 1;
      continue;
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({
        type: 'operator',
        value: char,
      });
      index += 1;
      continue;
    }

    if (char === '.' || /\d/.test(char)) {
      let cursor = index;
      let seenDot = false;
      let seenDigit = false;

      while (cursor < input.length) {
        const tokenChar = input[cursor];
        if (tokenChar === '.') {
          if (seenDot) break;
          seenDot = true;
          cursor += 1;
          continue;
        }
        if (!/\d/.test(tokenChar)) break;
        seenDigit = true;
        cursor += 1;
      }

      if (!seenDigit) {
        return null;
      }

      const numericText = input.slice(index, cursor);
      const numericValue = Number.parseFloat(numericText);
      if (!Number.isFinite(numericValue)) {
        return null;
      }

      let isPercent = false;
      const suffix = input.slice(cursor, cursor + 3).toLowerCase();
      if (suffix === 'deg') {
        cursor += 3;
      } else if (input[cursor] === '%') {
        isPercent = true;
        hasPercent = true;
        cursor += 1;
      }

      tokens.push({
        type: 'number',
        value: numericValue,
        isPercent,
      });

      index = cursor;
      continue;
    }

    return null;
  }

  return {
    tokens,
    hasPercent,
  };
}

function parseExpressionTokens(
  tokens: ExpressionToken[],
  range: [number, number],
): number | null {
  let index = 0;
  const span = range[1] - range[0];

  const parseExpression = (): number | null => {
    const start = parseTerm();
    if (start === null) {
      return null;
    }

    let value = start;
    while (
      index < tokens.length &&
      tokens[index].type === 'operator' &&
      (tokens[index] as OperatorToken).value !== '*' &&
      (tokens[index] as OperatorToken).value !== '/'
    ) {
      const operator = (tokens[index] as OperatorToken).value;
      index += 1;
      const right = parseTerm();
      if (right === null) {
        return null;
      }
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };

  const parseTerm = (): number | null => {
    const start = parseFactor();
    if (start === null) {
      return null;
    }

    let value = start;
    while (
      index < tokens.length &&
      tokens[index].type === 'operator' &&
      ((tokens[index] as OperatorToken).value === '*' ||
        (tokens[index] as OperatorToken).value === '/')
    ) {
      const operator = (tokens[index] as OperatorToken).value;
      index += 1;
      const right = parseFactor();
      if (right === null) {
        return null;
      }
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };

  const parseFactor = (): number | null => {
    if (
      index < tokens.length &&
      tokens[index].type === 'operator' &&
      ((tokens[index] as OperatorToken).value === '+' ||
        (tokens[index] as OperatorToken).value === '-')
    ) {
      const operator = (tokens[index] as OperatorToken).value;
      index += 1;
      const next = parseFactor();
      if (next === null) {
        return null;
      }
      return operator === '-' ? -next : next;
    }

    if (index >= tokens.length) {
      return null;
    }

    const token = tokens[index];
    if (token.type === 'number') {
      index += 1;
      if (token.isPercent) {
        return (token.value / 100) * span;
      }
      return token.value;
    }

    if (token.type === 'paren' && token.value === '(') {
      index += 1;
      const nested = parseExpression();
      if (nested === null) {
        return null;
      }
      if (
        index >= tokens.length ||
        tokens[index].type !== 'paren' ||
        (tokens[index] as ParenToken).value !== ')'
      ) {
        return null;
      }
      index += 1;
      return nested;
    }

    return null;
  };

  const value = parseExpression();
  if (value === null || index !== tokens.length) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

function parseSimpleNumber(
  input: string,
  range: [number, number],
): number | null {
  const match = input.trim().match(/^([+-]?(?:\d+|\d*\.\d+))(deg|%)?$/i);
  if (!match) {
    return null;
  }

  const number = Number.parseFloat(match[1]);
  if (!Number.isFinite(number)) {
    return null;
  }

  const unit = match[2]?.toLowerCase();
  if (unit === '%') {
    return range[0] + ((range[1] - range[0]) * number) / 100;
  }

  return number;
}

export function parseColorInputExpression(
  input: string,
  options: ParseColorInputExpressionOptions,
): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (!options.allowExpressions) {
    return parseSimpleNumber(trimmed, options.range);
  }

  const isRelative = /^[+\-*/]/.test(trimmed);
  const expression = isRelative ? `${options.currentValue}${trimmed}` : trimmed;

  const tokenized = tokenizeExpression(expression);
  if (!tokenized) {
    return parseSimpleNumber(expression, options.range);
  }

  const evaluated = parseExpressionTokens(tokenized.tokens, options.range);
  if (evaluated === null) {
    return parseSimpleNumber(expression, options.range);
  }

  if (!isRelative && tokenized.hasPercent) {
    return evaluated + options.range[0];
  }
  return evaluated;
}

export function resolveColorInputDraftValue(
  input: string,
  options: ResolveColorInputDraftValueOptions,
): number | null {
  const parsed = parseColorInputExpression(input, options);
  if (parsed === null) {
    return null;
  }

  return normalizeColorInputValue(parsed, options.range, options.wrap ?? false);
}

export function colorFromColorInputKey(
  color: Color,
  model: ColorInputModel,
  channel: ColorInputChannel,
  key: string,
  options: {
    step: number;
    pageStep?: number;
    range: [number, number];
    wrap?: boolean;
  },
): { color: Color; value: number } | null {
  const current = getColorInputChannelValue(color, model, channel);
  const step = Math.abs(options.step);
  const pageStep =
    options.pageStep !== undefined ? Math.abs(options.pageStep) : step;
  const wrap = options.wrap ?? false;
  let nextValue: number | null = null;

  switch (key as ColorInputKey) {
    case 'ArrowRight':
    case 'ArrowUp':
      nextValue = current + step;
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      nextValue = current - step;
      break;
    case 'PageUp':
      nextValue = current + pageStep;
      break;
    case 'PageDown':
      nextValue = current - pageStep;
      break;
    case 'Home':
      nextValue = options.range[0];
      break;
    case 'End':
      nextValue = options.range[1];
      break;
    default:
      return null;
  }

  const normalized = normalizeColorInputValue(nextValue, options.range, wrap);
  return {
    value: normalized,
    color: colorFromColorInputChannelValue(color, model, channel, normalized),
  };
}
