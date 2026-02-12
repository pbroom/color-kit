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
import { useSelector } from '@legendapp/state/react';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import {
  colorFromColorInputKey,
  colorFromColorInputChannelValue,
  formatColorInputChannelValue,
  getColorInputChangedChannel,
  getColorInputChannelValue,
  getColorInputLabel,
  getColorInputPrecisionFromStep,
  normalizeColorInputValue,
  resolveColorInputDraftValue,
  resolveColorInputRange,
  resolveColorInputSteps,
  resolveColorInputWrap,
  type HslColorInputChannel,
  type OklchColorInputChannel,
  type RgbColorInputChannel,
} from './api/color-input.js';
import type { SetRequestedOptions } from './use-color.js';

interface ColorInputBaseProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /** Standalone requested color value (alternative to ColorProvider) */
  requested?: Color;
  /** Standalone change handler (alternative to ColorProvider) */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
  /** Optional channel range override */
  range?: [number, number];
  /** Wrap values across range boundaries (defaults true for hue channels) */
  wrap?: boolean;
  /** Arrow step value */
  step?: number;
  /** Option/Alt modifier step value */
  fineStep?: number;
  /** Shift modifier step value */
  coarseStep?: number;
  /** PageUp/PageDown step value */
  pageStep?: number;
  /** Enable expression parsing for text commits */
  allowExpressions?: boolean;
  /** Select input text on focus */
  selectAllOnFocus?: boolean;
  /** Commit draft value on blur */
  commitOnBlur?: boolean;
  /** Width (px) of the left-edge scrub hit area */
  scrubEdgeWidth?: number;
  /** Horizontal pixels per step during scrub drag */
  scrubPixelsPerStep?: number;
  /** Minimum channel delta before committing another scrub update */
  dragEpsilon?: number;
  /** Maximum scrub update rate while dragging */
  maxScrubRate?: number;
  /** Number precision for formatted channel values */
  precision?: number;
  /** Called when Enter/blur commit receives an invalid draft value */
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

interface ScrubSnapshot {
  clientX: number;
  shiftKey: boolean;
  altKey: boolean;
}

function resolveModifiedStep(
  shiftKey: boolean,
  altKey: boolean,
  steps: { step: number; coarseStep: number; fineStep: number },
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

/**
 * A headless value input that edits one channel in oklch/rgb/hsl.
 *
 * Supports text entry, expression parsing, keyboard stepping, and left-edge scrub dragging.
 */
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
    const contextRequested = useSelector(
      () => context?.state$.requested.get() ?? null,
    );

    const requested = requestedProp ?? contextRequested;
    const setRequested = onChangeRequestedProp ?? context?.setRequested;

    if (!requested || !setRequested) {
      throw new Error(
        'ColorInput requires either a <ColorProvider> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const resolvedRange = useMemo(
      () => resolveColorInputRange(model, channel, range),
      [channel, model, range],
    );
    const resolvedWrap = useMemo(
      () => resolveColorInputWrap(model, channel, wrap),
      [channel, model, wrap],
    );
    const resolvedSteps = useMemo(
      () =>
        resolveColorInputSteps(model, channel, {
          step,
          fineStep,
          coarseStep,
          pageStep,
        }),
      [channel, coarseStep, fineStep, model, pageStep, step],
    );
    const resolvedPrecision = useMemo(
      () => precision ?? getColorInputPrecisionFromStep(resolvedSteps.fineStep),
      [precision, resolvedSteps.fineStep],
    );
    const channelValue = useMemo(
      () => getColorInputChannelValue(requested, model, channel),
      [channel, model, requested],
    );
    const displayValue = useMemo(
      () => formatColorInputChannelValue(channelValue, resolvedPrecision),
      [channelValue, resolvedPrecision],
    );
    const channelLabel = useMemo(
      () => getColorInputLabel(model, channel),
      [channel, model],
    );
    const changedChannel = useMemo(
      () => getColorInputChangedChannel(model, channel),
      [channel, model],
    );

    const inputRef = useRef<HTMLInputElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [draftValue, setDraftValue] = useState('');
    const [isScrubbing, setIsScrubbing] = useState(false);

    const activePointerIdRef = useRef<number | null>(null);
    const isScrubbingRef = useRef(false);
    const scrubStartXRef = useRef(0);
    const scrubStartValueRef = useRef(0);
    const lastScrubValueRef = useRef<number | null>(null);
    const lastScrubCommitTsRef = useRef(0);
    const pendingScrubRef = useRef<ScrubSnapshot | null>(null);
    const scrubFrameRef = useRef<number | null>(null);

    const focusStartValueRef = useRef<number | null>(null);
    const lastCommittedValueRef = useRef<number | null>(null);
    const skipBlurCommitRef = useRef(false);

    const currentValue = isEditing ? draftValue : displayValue;
    const parsedDraftValue = useMemo(() => {
      if (!isEditing) {
        return channelValue;
      }
      return resolveColorInputDraftValue(draftValue, {
        currentValue: focusStartValueRef.current ?? channelValue,
        range: resolvedRange,
        wrap: resolvedWrap,
        allowExpressions,
      });
    }, [
      allowExpressions,
      channelValue,
      draftValue,
      isEditing,
      resolvedRange,
      resolvedWrap,
    ]);

    const isValid = useMemo(() => {
      return parsedDraftValue !== null;
    }, [parsedDraftValue]);

    const syncDraftFromValue = useCallback(
      (value: number) => {
        setDraftValue(formatColorInputChannelValue(value, resolvedPrecision));
      },
      [resolvedPrecision],
    );

    const commitChannelValue = useCallback(
      (
        nextValue: number,
        interaction: 'pointer' | 'keyboard' | 'text-input',
      ) => {
        const normalized = normalizeColorInputValue(
          nextValue,
          resolvedRange,
          resolvedWrap,
        );
        const nextColor = colorFromColorInputChannelValue(
          requested,
          model,
          channel,
          normalized,
        );
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
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setDraftValue(e.target.value);
      },
      [],
    );

    const handleKeyDown = useCallback(
      (e: ReactKeyboardEvent<HTMLInputElement>) => {
        if (
          e.key === 'ArrowRight' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'PageUp' ||
          e.key === 'PageDown' ||
          e.key === 'Home' ||
          e.key === 'End'
        ) {
          const keyStep = resolveModifiedStep(
            e.shiftKey,
            e.altKey,
            resolvedSteps,
          );
          const keyed = colorFromColorInputKey(
            requested,
            model,
            channel,
            e.key,
            {
              step: keyStep,
              pageStep: resolvedSteps.pageStep,
              range: resolvedRange,
              wrap: resolvedWrap,
            },
          );
          if (!keyed) {
            return;
          }

          e.preventDefault();
          setRequested(keyed.color, {
            interaction: 'keyboard',
            ...(changedChannel ? { changedChannel } : {}),
          });
          lastCommittedValueRef.current = keyed.value;
          syncDraftFromValue(keyed.value);
          setIsEditing(true);
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          commitDraft();
          skipBlurCommitRef.current = true;
          (e.target as HTMLInputElement).blur();
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          setIsEditing(false);
          setDraftValue(displayValue);
          skipBlurCommitRef.current = true;
          (e.target as HTMLInputElement).blur();
        }
      },
      [
        changedChannel,
        channel,
        commitDraft,
        displayValue,
        model,
        requested,
        resolvedRange,
        resolvedSteps,
        resolvedWrap,
        setRequested,
        syncDraftFromValue,
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
        const nextValue = normalizeColorInputValue(
          nextRaw,
          resolvedRange,
          resolvedWrap,
        );

        if (
          !force &&
          lastScrubValueRef.current !== null &&
          Math.abs(nextValue - lastScrubValueRef.current) <
            Math.max(0, dragEpsilon)
        ) {
          return;
        }

        const nextColor = colorFromColorInputChannelValue(
          requested,
          model,
          channel,
          nextValue,
        );
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

        if (pendingScrubRef.current) {
          scrubFrameRef.current = requestAnimationFrame(processPendingScrub);
        }
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

    const setRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        if (typeof ref === 'function') {
          ref(node);
          return;
        }

        if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    return (
      <div
        {...props}
        ref={setRootRef}
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
          aria-valuetext={`${formatColorInputChannelValue(channelValue, resolvedPrecision)} ${channelLabel}`}
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
