import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
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
  getColorInputChannelGlyph,
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
  /** Standalone requested color value (alternative to Color) */
  requested?: Color;
  /** Standalone change handler (alternative to Color) */
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
  /** Size (px) of the square leading scrub/drag hit area (width and height) */
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

interface InputSelectionSnapshot {
  start: number;
  end: number;
  direction: 'forward' | 'backward' | 'none';
  selectAll: boolean;
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
const SCRUB_DRAG_START_THRESHOLD_PX = 2;

function resolvePointerClientX(
  event: { clientX: number },
  fallback: number,
): number {
  return Number.isFinite(event.clientX) ? event.clientX : fallback;
}

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
      scrubEdgeWidth = 24,
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
        'ColorInput requires either a <Color> ancestor or explicit requested/onChangeRequested props.',
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
    const channelGlyph = useMemo(
      () => getColorInputChannelGlyph(model, channel),
      [channel, model],
    );
    const changedChannel = useMemo(
      () => getColorInputChangedChannel(model, channel),
      [channel, model],
    );

    const inputRef = useRef<HTMLInputElement>(null);
    const scrubHandleRef = useRef<HTMLDivElement>(null);
    const preservedSelectionRef = useRef<InputSelectionSnapshot | null>(null);
    const clearPreservedSelectionFrameRef = useRef<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [draftValue, setDraftValue] = useState('');
    const [isScrubbing, setIsScrubbing] = useState(false);

    const activePointerIdRef = useRef<number | null>(null);
    const isScrubbingRef = useRef(false);
    const hasScrubDragStartedRef = useRef(false);
    const scrubStartXRef = useRef(0);
    const lastScrubClientXRef = useRef(0);
    const scrubStartValueRef = useRef(0);
    const lastScrubValueRef = useRef<number | null>(null);
    const lastScrubCommitTsRef = useRef(0);
    const pendingScrubRef = useRef<ScrubSnapshot | null>(null);
    const scrubFrameRef = useRef<number | null>(null);
    const processPendingScrubRef = useRef<(frameTime: number) => void>(
      () => {},
    );

    const [focusStartValue, setFocusStartValue] = useState<number | null>(null);
    const lastCommittedValueRef = useRef<number | null>(null);
    const skipBlurCommitRef = useRef(false);

    const currentValue = isEditing ? draftValue : displayValue;
    const parsedDraftValue = useMemo(() => {
      if (!isEditing) {
        return channelValue;
      }
      return resolveColorInputDraftValue(draftValue, {
        currentValue: focusStartValue ?? channelValue,
        range: resolvedRange,
        wrap: resolvedWrap,
        allowExpressions,
      });
    }, [
      allowExpressions,
      channelValue,
      draftValue,
      focusStartValue,
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
        setFocusStartValue(null);
        return false;
      }

      if (
        lastCommittedValueRef.current !== null &&
        Math.abs(parsedDraftValue - lastCommittedValueRef.current) <=
          COMMIT_NOOP_EPSILON
      ) {
        setIsEditing(false);
        setFocusStartValue(null);
        return true;
      }

      commitChannelValue(parsedDraftValue, 'text-input');
      setIsEditing(false);
      setFocusStartValue(null);
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
      setFocusStartValue(channelValue);
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
        setFocusStartValue(null);
        return;
      }

      if (commitOnBlur) {
        commitDraft();
      } else {
        setIsEditing(false);
        setDraftValue(displayValue);
        setFocusStartValue(null);
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
          setFocusStartValue(null);
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

    const restorePreservedSelection = useCallback(() => {
      const input = inputRef.current;
      const snapshot = preservedSelectionRef.current;
      if (!input || !snapshot || document.activeElement !== input) {
        return;
      }

      const length = input.value.length;
      const start = snapshot.selectAll ? 0 : Math.min(snapshot.start, length);
      const end = snapshot.selectAll ? length : Math.min(snapshot.end, length);
      input.setSelectionRange(start, end, snapshot.direction);
    }, []);

    const clearPreservedSelection = useCallback(() => {
      if (clearPreservedSelectionFrameRef.current !== null) {
        cancelAnimationFrame(clearPreservedSelectionFrameRef.current);
        clearPreservedSelectionFrameRef.current = null;
      }
      preservedSelectionRef.current = null;
    }, []);

    const scheduleClearPreservedSelection = useCallback(() => {
      if (clearPreservedSelectionFrameRef.current !== null) {
        cancelAnimationFrame(clearPreservedSelectionFrameRef.current);
      }
      clearPreservedSelectionFrameRef.current = requestAnimationFrame(() => {
        restorePreservedSelection();
        preservedSelectionRef.current = null;
        clearPreservedSelectionFrameRef.current = null;
      });
    }, [restorePreservedSelection]);

    const preserveCurrentSelection = useCallback(() => {
      const input = inputRef.current;
      if (!input || document.activeElement !== input) {
        preservedSelectionRef.current = null;
        return;
      }

      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      preservedSelectionRef.current = {
        start,
        end,
        direction: input.selectionDirection ?? 'none',
        selectAll: start === 0 && end === input.value.length,
      };
    }, []);

    const hasScrubPointerLock = useCallback(() => {
      return (
        typeof document !== 'undefined' &&
        document.pointerLockElement === scrubHandleRef.current
      );
    }, []);

    const exitScrubPointerLock = useCallback(() => {
      if (
        typeof document !== 'undefined' &&
        document.pointerLockElement === scrubHandleRef.current
      ) {
        document.exitPointerLock?.();
      }
    }, []);

    const schedulePendingScrubFrame = useCallback(() => {
      scrubFrameRef.current = requestAnimationFrame((frameTime: number) => {
        processPendingScrubRef.current(frameTime);
      });
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
        const clientX = Number.isFinite(snapshot.clientX)
          ? snapshot.clientX
          : lastScrubClientXRef.current;
        const deltaPixels = clientX - scrubStartXRef.current;
        if (
          !hasScrubDragStartedRef.current &&
          Math.abs(deltaPixels) < SCRUB_DRAG_START_THRESHOLD_PX
        ) {
          return;
        }
        if (!hasScrubDragStartedRef.current) {
          hasScrubDragStartedRef.current = true;
          setIsScrubbing(true);
        }

        const deltaSteps = deltaPixels / safePixelsPerStep;
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
          schedulePendingScrubFrame();
          return;
        }

        pendingScrubRef.current = null;
        commitScrubSnapshot(pending, false);
        lastScrubCommitTsRef.current = frameTime;

        if (pendingScrubRef.current) {
          schedulePendingScrubFrame();
        }
      },
      [commitScrubSnapshot, maxScrubRate, schedulePendingScrubFrame],
    );

    useEffect(() => {
      processPendingScrubRef.current = processPendingScrub;
    }, [processPendingScrub]);

    const queueScrubSnapshot = useCallback(
      (snapshot: ScrubSnapshot) => {
        pendingScrubRef.current = snapshot;
        if (scrubFrameRef.current === null) {
          schedulePendingScrubFrame();
        }
      },
      [schedulePendingScrubFrame],
    );

    const endScrubbing = useCallback(
      (snapshot?: ScrubSnapshot) => {
        const finalSnapshot = snapshot ?? pendingScrubRef.current ?? null;
        if (finalSnapshot) {
          commitScrubSnapshot(finalSnapshot, true);
        }

        isScrubbingRef.current = false;
        hasScrubDragStartedRef.current = false;
        activePointerIdRef.current = null;
        lastScrubCommitTsRef.current = 0;
        setIsScrubbing(false);
        exitScrubPointerLock();
        scheduleClearPreservedSelection();
        stopScrubFrame();
      },
      [
        commitScrubSnapshot,
        exitScrubPointerLock,
        scheduleClearPreservedSelection,
        stopScrubFrame,
      ],
    );

    const handleScrubPointerDown = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        const button = typeof event.button === 'number' ? event.button : 0;
        if (button !== 0) {
          return;
        }

        event.preventDefault();
        clearPreservedSelection();
        preserveCurrentSelection();
        const clientX = resolvePointerClientX(event, 0);
        activePointerIdRef.current = event.pointerId;
        isScrubbingRef.current = true;
        hasScrubDragStartedRef.current = false;
        scrubStartXRef.current = clientX;
        lastScrubClientXRef.current = clientX;
        scrubStartValueRef.current = channelValue;
        lastScrubValueRef.current = channelValue;
        lastScrubCommitTsRef.current = 0;
        setFocusStartValue(channelValue);
        lastCommittedValueRef.current = channelValue;
        setIsEditing(true);
        setDraftValue(displayValue);
        pendingScrubRef.current = null;

        if ('setPointerCapture' in event.currentTarget) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }

        const lockRequest =
          event.currentTarget.requestPointerLock?.() as Promise<void> | void;
        if (lockRequest) {
          void lockRequest.catch(() => {});
        }
      },
      [
        channelValue,
        clearPreservedSelection,
        displayValue,
        preserveCurrentSelection,
      ],
    );

    const handleScrubPointerMove = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (
          !isScrubbingRef.current ||
          event.pointerId !== activePointerIdRef.current
        ) {
          return;
        }
        if (hasScrubPointerLock()) {
          return;
        }
        const clientX = resolvePointerClientX(
          event,
          lastScrubClientXRef.current,
        );
        lastScrubClientXRef.current = clientX;
        queueScrubSnapshot({
          clientX,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        });
      },
      [hasScrubPointerLock, queueScrubSnapshot],
    );

    const handleScrubPointerUp = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerId !== activePointerIdRef.current) {
          return;
        }
        const clientX = hasScrubPointerLock()
          ? lastScrubClientXRef.current
          : resolvePointerClientX(event, lastScrubClientXRef.current);
        endScrubbing({
          clientX,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        });
      },
      [endScrubbing, hasScrubPointerLock],
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
      if (hasScrubPointerLock()) {
        return;
      }
      endScrubbing();
    }, [endScrubbing, hasScrubPointerLock]);

    useEffect(() => {
      return () => {
        clearPreservedSelection();
        stopScrubFrame();
      };
    }, [clearPreservedSelection, stopScrubFrame]);

    useLayoutEffect(() => {
      restorePreservedSelection();
    }, [currentValue, restorePreservedSelection]);

    useEffect(() => {
      const handleLockedMouseMove = (event: MouseEvent) => {
        if (!isScrubbingRef.current || !hasScrubPointerLock()) {
          return;
        }

        const movementX = Number.isFinite(event.movementX)
          ? event.movementX
          : 0;
        if (movementX === 0) {
          return;
        }

        const clientX = lastScrubClientXRef.current + movementX;
        lastScrubClientXRef.current = clientX;
        queueScrubSnapshot({
          clientX,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        });
      };

      const handlePointerLockChange = () => {
        if (
          isScrubbingRef.current &&
          scrubHandleRef.current &&
          document.pointerLockElement !== scrubHandleRef.current
        ) {
          endScrubbing();
        }
      };

      document.addEventListener('mousemove', handleLockedMouseMove);
      document.addEventListener('pointerlockchange', handlePointerLockChange);
      return () => {
        document.removeEventListener('mousemove', handleLockedMouseMove);
        document.removeEventListener(
          'pointerlockchange',
          handlePointerLockChange,
        );
      };
    }, [endScrubbing, hasScrubPointerLock, queueScrubSnapshot]);

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
          display: 'flex',
          alignItems: 'center',
          columnGap: 0,
          minHeight: 24,
          height: 24,
          boxSizing: 'border-box',
          touchAction: 'manipulation',
          ...props.style,
        }}
      >
        <div
          ref={scrubHandleRef}
          data-color-input-scrub-handle=""
          aria-hidden="true"
          onPointerDown={handleScrubPointerDown}
          onPointerMove={handleScrubPointerMove}
          onPointerUp={handleScrubPointerUp}
          onPointerCancel={handleScrubPointerCancel}
          onLostPointerCapture={handleScrubLostPointerCapture}
          style={{
            width: `${Math.max(0, scrubEdgeWidth)}px`,
            height: `${Math.max(0, scrubEdgeWidth)}px`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'ew-resize',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          {channelGlyph}
        </div>
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
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>
    );
  },
);
