'use client';

import {
  clamp,
  fromHsl,
  fromRgb,
  toHsl,
  toRgb,
  type Color,
  type Hsl,
  type Rgb,
} from '@color-kit/core';
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useOptionalColorContext } from '@/hooks/color-context';
import type { SetRequestedOptions } from '@/hooks/use-color';

type ColorInputModel = 'oklch' | 'rgb' | 'hsl';
type OklchColorInputChannel = 'l' | 'c' | 'h' | 'alpha';
type RgbColorInputChannel = 'r' | 'g' | 'b' | 'alpha';
type HslColorInputChannel = 'h' | 's' | 'l' | 'alpha';
type ColorInputChannel =
  | OklchColorInputChannel
  | RgbColorInputChannel
  | HslColorInputChannel;

interface ColorInputBaseProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  requested?: Color;
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
  range?: [number, number];
  wrap?: boolean;
  step?: number;
  fineStep?: number;
  coarseStep?: number;
  pageStep?: number;
  allowExpressions?: boolean;
  selectAllOnFocus?: boolean;
  commitOnBlur?: boolean;
  scrubEdgeWidth?: number;
  scrubPixelsPerStep?: number;
  dragEpsilon?: number;
  maxScrubRate?: number;
  precision?: number;
  onInvalidCommit?: (draft: string) => void;
}

export type ColorInputProps =
  | ({
      model: 'oklch';
      channel: OklchColorInputChannel;
    } & ColorInputBaseProps)
  | ({
      model: 'rgb';
      channel: RgbColorInputChannel;
    } & ColorInputBaseProps)
  | ({
      model: 'hsl';
      channel: HslColorInputChannel;
    } & ColorInputBaseProps);

interface StepConfig {
  step: number;
  fineStep: number;
  coarseStep: number;
  pageStep: number;
}

interface ScrubSnapshot {
  clientX: number;
  shiftKey: boolean;
  altKey: boolean;
}

const LABELS: Record<ColorInputModel, Record<ColorInputChannel, string>> = {
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

const DEFAULT_RANGES: Record<
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

const DEFAULT_STEPS: Record<
  ColorInputModel,
  Record<ColorInputChannel, StepConfig>
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

function getValue(
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

function setValue(
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
    return fromRgb({
      ...rgb,
      [channel]: value,
    } as Rgb);
  }

  const hsl = toHsl(color);
  return fromHsl({
    ...hsl,
    [channel]: value,
  } as Hsl);
}

function isHue(model: ColorInputModel, channel: ColorInputChannel): boolean {
  return channel === 'h' && (model === 'oklch' || model === 'hsl');
}

function wrapInRange(value: number, range: [number, number]): number {
  const span = range[1] - range[0];
  if (span <= 0) {
    return range[0];
  }
  return ((((value - range[0]) % span) + span) % span) + range[0];
}

function normalizeValue(
  value: number,
  range: [number, number],
  wrap: boolean,
): number {
  if (!Number.isFinite(value)) {
    return range[0];
  }
  return wrap ? wrapInRange(value, range) : clamp(value, range[0], range[1]);
}

function resolveStepValue(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return fallback;
  }
  return value;
}

function resolvePrecision(step: number): number {
  const safe = Math.abs(step);
  if (!Number.isFinite(safe) || safe <= 0) {
    return 2;
  }

  let precision = 0;
  let current = safe;
  while (precision < 6 && Math.abs(Math.round(current) - current) > 0.0000001) {
    current *= 10;
    precision += 1;
  }
  return precision;
}

function formatValue(value: number, precision: number): string {
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
      tokens.push({ type: 'paren', value: char });
      index += 1;
      continue;
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ type: 'operator', value: char });
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

function parseTokens(
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
      return token.isPercent ? (token.value / 100) * span : token.value;
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
  if (value === null || index !== tokens.length || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function parseExpressionValue(
  input: string,
  currentValue: number,
  range: [number, number],
  allowExpressions: boolean,
): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (!allowExpressions) {
    return parseSimpleNumber(trimmed, range);
  }

  const isRelative = /^[+\-*/]/.test(trimmed);
  const expression = isRelative ? `${currentValue}${trimmed}` : trimmed;
  const tokenized = tokenizeExpression(expression);
  if (!tokenized) {
    return parseSimpleNumber(expression, range);
  }

  const value = parseTokens(tokenized.tokens, range);
  if (value === null) {
    return parseSimpleNumber(expression, range);
  }
  if (!isRelative && tokenized.hasPercent) {
    return value + range[0];
  }
  return value;
}

function resolveModifiedStep(
  shiftKey: boolean,
  altKey: boolean,
  steps: StepConfig,
): number {
  if (altKey) {
    return steps.fineStep;
  }
  if (shiftKey) {
    return steps.coarseStep;
  }
  return steps.step;
}

const COMMIT_NOOP_EPSILON = 1e-9;

export const ColorInput = forwardRef<HTMLDivElement, ColorInputProps>(
  function ColorInput(
    {
      model,
      channel,
      requested: requestedProp,
      onChangeRequested: onChangeRequestedProp,
      range,
      wrap,
      step,
      fineStep,
      coarseStep,
      pageStep,
      allowExpressions = true,
      selectAllOnFocus = true,
      commitOnBlur = true,
      scrubEdgeWidth = 14,
      scrubPixelsPerStep = 6,
      dragEpsilon = 0.0005,
      maxScrubRate = 120,
      precision,
      onInvalidCommit,
      ...props
    },
    ref,
  ) {
    const context = useOptionalColorContext();
    const requested = requestedProp ?? context?.requested;
    const setRequested = onChangeRequestedProp ?? context?.setRequested;

    if (!requested || !setRequested) {
      throw new Error(
        'ColorInput requires either a <ColorProvider> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const resolvedRange = range ?? DEFAULT_RANGES[model][channel];
    const resolvedWrap = wrap ?? isHue(model, channel);
    const defaultSteps = DEFAULT_STEPS[model][channel];
    const resolvedSteps: StepConfig = useMemo(
      () => ({
        step: resolveStepValue(step, defaultSteps.step),
        fineStep: resolveStepValue(fineStep, defaultSteps.fineStep),
        coarseStep: resolveStepValue(coarseStep, defaultSteps.coarseStep),
        pageStep: resolveStepValue(pageStep, defaultSteps.pageStep),
      }),
      [coarseStep, defaultSteps, fineStep, pageStep, step],
    );
    const resolvedPrecision = useMemo(
      () => precision ?? resolvePrecision(resolvedSteps.fineStep),
      [precision, resolvedSteps.fineStep],
    );

    const channelValue = useMemo(
      () => getValue(requested, model, channel),
      [channel, model, requested],
    );
    const channelLabel = LABELS[model][channel];
    const displayValue = useMemo(
      () => formatValue(channelValue, resolvedPrecision),
      [channelValue, resolvedPrecision],
    );
    const changedChannel =
      model === 'oklch' ? (channel as OklchColorInputChannel) : undefined;

    const inputRef = useRef<HTMLInputElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [draftValue, setDraftValue] = useState('');
    const [isScrubbing, setIsScrubbing] = useState(false);
    const skipBlurCommitRef = useRef(false);
    const focusStartValueRef = useRef<number | null>(null);
    const lastCommittedValueRef = useRef<number | null>(null);

    const activePointerIdRef = useRef<number | null>(null);
    const isScrubbingRef = useRef(false);
    const scrubStartXRef = useRef(0);
    const scrubStartValueRef = useRef(0);
    const lastScrubValueRef = useRef<number | null>(null);
    const lastScrubCommitTsRef = useRef(0);
    const pendingScrubRef = useRef<ScrubSnapshot | null>(null);
    const scrubFrameRef = useRef<number | null>(null);

    const currentValue = isEditing ? draftValue : displayValue;
    const parsedDraftValue = useMemo(() => {
      if (!isEditing) {
        return channelValue;
      }

      const parsed = parseExpressionValue(
        draftValue,
        focusStartValueRef.current ?? channelValue,
        resolvedRange,
        allowExpressions,
      );
      if (parsed === null) {
        return null;
      }
      return normalizeValue(parsed, resolvedRange, resolvedWrap);
    }, [
      allowExpressions,
      channelValue,
      draftValue,
      isEditing,
      resolvedRange,
      resolvedWrap,
    ]);
    const isValid = parsedDraftValue !== null;

    const syncDraftFromValue = useCallback(
      (value: number) => {
        setDraftValue(formatValue(value, resolvedPrecision));
      },
      [resolvedPrecision],
    );

    const commitChannelValue = useCallback(
      (
        nextValue: number,
        interaction: 'pointer' | 'keyboard' | 'text-input',
        wrapOverride: boolean = resolvedWrap,
      ) => {
        const normalized = normalizeValue(
          nextValue,
          resolvedRange,
          wrapOverride,
        );
        const nextColor = setValue(requested, model, channel, normalized);
        setRequested(nextColor, {
          interaction,
          ...(changedChannel ? { changedChannel } : {}),
        });
        lastCommittedValueRef.current = normalized;
        syncDraftFromValue(normalized);
      },
      [
        changedChannel,
        channel,
        model,
        requested,
        resolvedRange,
        resolvedWrap,
        setRequested,
        syncDraftFromValue,
      ],
    );

    const commitDraft = useCallback((): boolean => {
      if (parsedDraftValue === null) {
        onInvalidCommit?.(draftValue);
        setDraftValue(displayValue);
        setIsEditing(false);
        return false;
      }

      if (
        lastCommittedValueRef.current !== null &&
        Math.abs(parsedDraftValue - lastCommittedValueRef.current) <=
          COMMIT_NOOP_EPSILON
      ) {
        setIsEditing(false);
        return true;
      }

      commitChannelValue(parsedDraftValue, 'text-input');
      setIsEditing(false);
      return true;
    }, [
      commitChannelValue,
      displayValue,
      draftValue,
      onInvalidCommit,
      parsedDraftValue,
    ]);

    const handleFocus = useCallback(() => {
      setIsEditing(true);
      setDraftValue(displayValue);
      focusStartValueRef.current = channelValue;
      lastCommittedValueRef.current = channelValue;

      if (!selectAllOnFocus) {
        return;
      }

      requestAnimationFrame(() => {
        inputRef.current?.select();
      });
    }, [channelValue, displayValue, selectAllOnFocus]);

    const handleBlur = useCallback(() => {
      if (skipBlurCommitRef.current) {
        skipBlurCommitRef.current = false;
        return;
      }

      if (commitOnBlur) {
        commitDraft();
      } else {
        setIsEditing(false);
        setDraftValue(displayValue);
      }
    }, [commitDraft, commitOnBlur, displayValue]);

    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setDraftValue(event.target.value);
      },
      [],
    );

    const handleKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (
          event.key === 'ArrowRight' ||
          event.key === 'ArrowLeft' ||
          event.key === 'ArrowUp' ||
          event.key === 'ArrowDown' ||
          event.key === 'PageUp' ||
          event.key === 'PageDown' ||
          event.key === 'Home' ||
          event.key === 'End'
        ) {
          const keyStep = resolveModifiedStep(
            event.shiftKey,
            event.altKey,
            resolvedSteps,
          );
          const page = resolvedSteps.pageStep;
          let nextValue: number | null = null;

          switch (event.key) {
            case 'ArrowRight':
            case 'ArrowUp':
              nextValue = channelValue + keyStep;
              break;
            case 'ArrowLeft':
            case 'ArrowDown':
              nextValue = channelValue - keyStep;
              break;
            case 'PageUp':
              nextValue = channelValue + page;
              break;
            case 'PageDown':
              nextValue = channelValue - page;
              break;
            case 'Home':
              nextValue = resolvedRange[0];
              break;
            case 'End':
              nextValue = resolvedRange[1];
              break;
          }

          if (nextValue === null) {
            return;
          }

          event.preventDefault();
          commitChannelValue(
            nextValue,
            'keyboard',
            event.key === 'Home' || event.key === 'End' ? false : resolvedWrap,
          );
          setIsEditing(true);
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          commitDraft();
          skipBlurCommitRef.current = true;
          (event.target as HTMLInputElement).blur();
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          setIsEditing(false);
          setDraftValue(displayValue);
          skipBlurCommitRef.current = true;
          (event.target as HTMLInputElement).blur();
        }
      },
      [
        channelValue,
        commitChannelValue,
        commitDraft,
        displayValue,
        resolvedRange,
        resolvedWrap,
        resolvedSteps,
      ],
    );

    const stopScrubFrame = useCallback(() => {
      if (scrubFrameRef.current !== null) {
        cancelAnimationFrame(scrubFrameRef.current);
        scrubFrameRef.current = null;
      }
      pendingScrubRef.current = null;
    }, []);

    const commitScrubSnapshot = useCallback(
      (snapshot: ScrubSnapshot, force: boolean) => {
        if (!isScrubbingRef.current) {
          return;
        }

        const activeStep = resolveModifiedStep(
          snapshot.shiftKey,
          snapshot.altKey,
          resolvedSteps,
        );
        const safePixelsPerStep =
          scrubPixelsPerStep > 0 ? scrubPixelsPerStep : 1;
        const deltaSteps =
          (snapshot.clientX - scrubStartXRef.current) / safePixelsPerStep;
        const nextRaw = scrubStartValueRef.current + deltaSteps * activeStep;
        const nextValue = normalizeValue(nextRaw, resolvedRange, resolvedWrap);

        if (
          !force &&
          lastScrubValueRef.current !== null &&
          Math.abs(nextValue - lastScrubValueRef.current) <
            Math.max(0, dragEpsilon)
        ) {
          return;
        }

        const nextColor = setValue(requested, model, channel, nextValue);
        setRequested(nextColor, {
          interaction: 'pointer',
          ...(changedChannel ? { changedChannel } : {}),
        });
        lastScrubValueRef.current = nextValue;
        lastCommittedValueRef.current = nextValue;
        syncDraftFromValue(nextValue);
        setIsEditing(true);
      },
      [
        changedChannel,
        channel,
        dragEpsilon,
        model,
        requested,
        resolvedRange,
        resolvedSteps,
        resolvedWrap,
        scrubPixelsPerStep,
        setRequested,
        syncDraftFromValue,
      ],
    );

    const processPendingScrub = useCallback(
      (frameTime: number) => {
        scrubFrameRef.current = null;

        if (!isScrubbingRef.current) {
          pendingScrubRef.current = null;
          return;
        }

        const pending = pendingScrubRef.current;
        if (!pending) {
          return;
        }

        const safeRate =
          Number.isFinite(maxScrubRate) && maxScrubRate > 0
            ? maxScrubRate
            : 120;
        const minFrameDelta = 1000 / safeRate;
        if (
          lastScrubCommitTsRef.current > 0 &&
          frameTime >= lastScrubCommitTsRef.current &&
          frameTime - lastScrubCommitTsRef.current < minFrameDelta
        ) {
          scrubFrameRef.current = requestAnimationFrame(processPendingScrub);
          return;
        }

        pendingScrubRef.current = null;
        commitScrubSnapshot(pending, false);
        lastScrubCommitTsRef.current = frameTime;
      },
      [commitScrubSnapshot, maxScrubRate],
    );

    const queueScrubSnapshot = useCallback(
      (snapshot: ScrubSnapshot) => {
        pendingScrubRef.current = snapshot;
        if (scrubFrameRef.current === null) {
          scrubFrameRef.current = requestAnimationFrame(processPendingScrub);
        }
      },
      [processPendingScrub],
    );

    const endScrubbing = useCallback(
      (snapshot?: ScrubSnapshot) => {
        const finalSnapshot = snapshot ?? pendingScrubRef.current ?? null;
        if (finalSnapshot) {
          commitScrubSnapshot(finalSnapshot, true);
        }

        isScrubbingRef.current = false;
        activePointerIdRef.current = null;
        lastScrubCommitTsRef.current = 0;
        setIsScrubbing(false);
        stopScrubFrame();
      },
      [commitScrubSnapshot, stopScrubFrame],
    );

    const handleScrubPointerDown = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        const button = typeof event.button === 'number' ? event.button : 0;
        if (button !== 0) {
          return;
        }

        event.preventDefault();
        activePointerIdRef.current = event.pointerId;
        isScrubbingRef.current = true;
        setIsScrubbing(true);
        scrubStartXRef.current = event.clientX;
        scrubStartValueRef.current = channelValue;
        lastScrubValueRef.current = channelValue;
        lastScrubCommitTsRef.current = 0;
        focusStartValueRef.current = channelValue;
        lastCommittedValueRef.current = channelValue;
        setIsEditing(true);
        setDraftValue(displayValue);
        pendingScrubRef.current = null;

        if ('setPointerCapture' in event.currentTarget) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }

        inputRef.current?.focus();
      },
      [channelValue, displayValue],
    );

    const handleScrubPointerMove = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (
          !isScrubbingRef.current ||
          event.pointerId !== activePointerIdRef.current
        ) {
          return;
        }
        queueScrubSnapshot({
          clientX: event.clientX,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        });
      },
      [queueScrubSnapshot],
    );

    const handleScrubPointerUp = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerId !== activePointerIdRef.current) {
          return;
        }
        endScrubbing({
          clientX: event.clientX,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        });
      },
      [endScrubbing],
    );

    const handleScrubPointerCancel = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerId !== activePointerIdRef.current) {
          return;
        }
        endScrubbing();
      },
      [endScrubbing],
    );

    const handleScrubLostPointerCapture = useCallback(() => {
      endScrubbing();
    }, [endScrubbing]);

    useEffect(() => stopScrubFrame, [stopScrubFrame]);

    return (
      <div
        {...props}
        ref={ref}
        data-color-input=""
        data-model={model}
        data-channel={channel}
        data-valid={isValid || undefined}
        data-editing={isEditing || undefined}
        data-scrubbing={isScrubbing || undefined}
        style={{
          position: 'relative',
          touchAction: 'manipulation',
          ...props.style,
        }}
      >
        <div
          data-color-input-scrub-handle=""
          aria-hidden="true"
          onPointerDown={handleScrubPointerDown}
          onPointerMove={handleScrubPointerMove}
          onPointerUp={handleScrubPointerUp}
          onPointerCancel={handleScrubPointerCancel}
          onLostPointerCapture={handleScrubLostPointerCapture}
          style={{
            position: 'absolute',
            inset: '0 auto 0 0',
            width: `${Math.max(0, scrubEdgeWidth)}px`,
            cursor: 'ew-resize',
            touchAction: 'none',
            userSelect: 'none',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={currentValue}
          role="spinbutton"
          aria-label={props['aria-label'] ?? `${channelLabel} value`}
          aria-valuemin={resolvedRange[0]}
          aria-valuemax={resolvedRange[1]}
          aria-valuenow={channelValue}
          aria-valuetext={`${formatValue(channelValue, resolvedPrecision)} ${channelLabel}`}
          inputMode="decimal"
          spellCheck={false}
          autoComplete="off"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  },
);
