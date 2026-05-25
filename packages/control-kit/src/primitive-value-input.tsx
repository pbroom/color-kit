import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

export type PrimitivePrecision = number;
export type PrimitiveWrapMode = 'clamp' | 'wrap' | 'free';
export type PrimitiveSize = 'sm' | 'md' | 'lg' | 'full';
export type PrimitiveDensity = 'compact' | 'comfortable';
export type PrimitiveVisualState = 'auto' | 'valid' | 'invalid';
export type PrimitiveVisualTreatment = 'default' | 'embedded';
export type PrimitiveHandleSide = 'leading' | 'trailing';
export type PrimitiveValueInteraction = 'text-input' | 'keyboard' | 'pointer';
export type PrimitiveStepKey =
  | 'ArrowRight'
  | 'ArrowLeft'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'PageUp'
  | 'PageDown'
  | 'Home'
  | 'End';

export type PrimitiveExpressionParser = (
  draft: string,
  options: {
    allowExpressions: boolean;
    currentValue: number;
    range: [number, number];
  },
) => number | null;

export interface PrimitiveValueChangeDetails {
  interaction: PrimitiveValueInteraction;
}

export interface PrimitiveStepConfig {
  step: number;
  fineStep: number;
  coarseStep: number;
  pageStep: number;
}

export interface PrimitiveSteppedValueOptions {
  value: number;
  key: PrimitiveStepKey | string;
  min: number;
  max: number;
  wrapMode: PrimitiveWrapMode;
  step: number;
  pageStep: number;
}

const PRIMITIVE_SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: 'w-32',
  md: 'w-44',
  lg: 'w-60',
  full: 'w-full',
};

const PRIMITIVE_DENSITY_CLASS: Record<PrimitiveDensity, string> = {
  compact: 'h-6 min-h-6 text-[11px] leading-4',
  comfortable: 'h-8 min-h-8 text-xs leading-4',
};

const MAX_PRIMITIVE_PRECISION_DIGITS = 12;

export function normalizePrimitiveValue(
  value: number,
  min: number,
  max: number,
  mode: PrimitiveWrapMode,
): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  if (mode === 'free' || max <= min) {
    return value;
  }

  if (mode === 'wrap') {
    const span = max - min;
    return ((((value - min) % span) + span) % span) + min;
  }

  return Math.min(max, Math.max(min, value));
}

export function formatPrimitiveValue(
  value: number,
  precision: PrimitivePrecision,
  autoTrim: boolean,
): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const fixed = value.toFixed(precision);
  if (autoTrim) {
    const rounded = Number(fixed);
    return Object.is(rounded, -0) ? '0' : String(rounded);
  }

  return fixed;
}

export function normalizePrimitivePrecision(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(
    MAX_PRIMITIVE_PRECISION_DIGITS,
    Math.max(0, Math.round(value)),
  );
}

export function normalizePrimitiveScrubMultiplier(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1000, Math.max(0.01, Number(value.toFixed(4))));
}

export function parsePrimitiveDraft(
  draft: string,
  currentValue: number,
  min: number,
  max: number,
  allowExpressions: boolean,
  parseExpression?: PrimitiveExpressionParser,
): number | null {
  if (parseExpression) {
    return parseExpression(draft, {
      currentValue,
      range: [min, max],
      allowExpressions,
    });
  }

  const parsed = Number(draft);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getPrimitiveModifiedStep(
  shiftKey: boolean,
  altKey: boolean,
  steps: PrimitiveStepConfig,
): number {
  if (altKey) return steps.fineStep;
  if (shiftKey) return steps.coarseStep;
  return steps.step;
}

export function getPrimitiveSteppedValue({
  value,
  key,
  min,
  max,
  wrapMode,
  step,
  pageStep,
}: PrimitiveSteppedValueOptions): number | null {
  const safeStep = Math.abs(step);
  const safePageStep = Math.abs(pageStep);
  let nextValue: number | null = null;

  switch (key as PrimitiveStepKey) {
    case 'ArrowRight':
    case 'ArrowUp':
      nextValue = value + safeStep;
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      nextValue = value - safeStep;
      break;
    case 'PageUp':
      nextValue = value + safePageStep;
      break;
    case 'PageDown':
      nextValue = value - safePageStep;
      break;
    case 'Home':
      return min;
    case 'End':
      return max;
    default:
      return null;
  }

  return normalizePrimitiveValue(nextValue, min, max, wrapMode);
}

export interface UsePrimitiveValueInputOptions {
  value: number;
  onValueChange: (value: number, details: PrimitiveValueChangeDetails) => void;
  min: number;
  max: number;
  wrapMode: PrimitiveWrapMode;
  step: number;
  fineStep: number;
  coarseStep: number;
  pageStep: number;
  precision: PrimitivePrecision;
  autoTrim: boolean;
  allowExpressions: boolean;
  parseExpression?: PrimitiveExpressionParser;
  selectAllOnFocus: boolean;
  commitOnBlur: boolean;
  scrubEnabled: boolean;
  scrubPixelsPerStep?: number;
  stepDragDistance?: number;
  scrubThreshold: number;
  scrubCommitThreshold?: number;
  scrubMaxCommitRate?: number;
  pointerLockEnabled: boolean;
  horizontalArrowKeysMoveCaret?: boolean;
  disabled: boolean;
  readOnly: boolean;
  onInvalidCommit?: (draft: string) => void;
  onScrubbingChange?: (isScrubbing: boolean) => void;
}

interface PrimitiveInputSelectionSnapshot {
  start: number;
  end: number;
  direction: HTMLInputElement['selectionDirection'];
  selectAll: boolean;
}

interface PrimitiveScrubSnapshot {
  clientX: number;
  shiftKey: boolean;
  altKey: boolean;
}

export function usePrimitiveValueInput({
  value,
  onValueChange,
  min,
  max,
  wrapMode,
  step,
  fineStep,
  coarseStep,
  pageStep,
  precision,
  autoTrim,
  allowExpressions,
  parseExpression,
  selectAllOnFocus,
  commitOnBlur,
  scrubEnabled,
  scrubPixelsPerStep = 1,
  stepDragDistance,
  scrubThreshold,
  scrubCommitThreshold = 0,
  scrubMaxCommitRate,
  pointerLockEnabled,
  horizontalArrowKeysMoveCaret = true,
  disabled,
  readOnly,
  onInvalidCommit,
  onScrubbingChange,
}: UsePrimitiveValueInputOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrubHandleRef = useRef<HTMLDivElement>(null);
  const onScrubbingChangeRef = useRef(onScrubbingChange);
  const preservedSelectionRef = useRef<PrimitiveInputSelectionSnapshot | null>(
    null,
  );
  const clearPreservedSelectionFrameRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const scrubStartXRef = useRef(0);
  const scrubStartValueRef = useRef(0);
  const scrubCurrentValueRef = useRef(0);
  const lastScrubXRef = useRef(0);
  const activeScrubStepRef = useRef(step);
  const hasDragStartedRef = useRef(false);
  const pendingScrubRef = useRef<PrimitiveScrubSnapshot | null>(null);
  const scrubFrameRef = useRef<number | null>(null);
  const lastScrubCommitTsRef = useRef(0);
  const processPendingScrubRef = useRef<(frameTime: number) => void>(() => {});
  const lastCommittedValueRef = useRef(value);
  const skipBlurCommitRef = useRef(false);
  const [draft, setDraft] = useState(() =>
    formatPrimitiveValue(value, precision, autoTrim),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [focusStartValue, setFocusStartValue] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const displayValue = useMemo(
    () => formatPrimitiveValue(value, precision, autoTrim),
    [autoTrim, precision, value],
  );

  useEffect(() => {
    if (!isEditing) {
      setDraft(displayValue);
    }
  }, [displayValue, isEditing]);

  useEffect(() => {
    if (!isEditing && !isScrubbing) {
      lastCommittedValueRef.current = value;
    }
  }, [isEditing, isScrubbing, value]);

  const parsedDraft = useMemo(() => {
    if (!isEditing) {
      return value;
    }

    const parsed = parsePrimitiveDraft(
      draft,
      focusStartValue ?? value,
      min,
      max,
      allowExpressions,
      parseExpression,
    );
    return parsed === null
      ? null
      : normalizePrimitiveValue(parsed, min, max, wrapMode);
  }, [
    allowExpressions,
    draft,
    focusStartValue,
    isEditing,
    max,
    min,
    parseExpression,
    value,
    wrapMode,
  ]);

  const isDraftValid = parsedDraft !== null;
  const currentValue = isEditing ? draft : displayValue;

  const restorePreservedSelection = useCallback(() => {
    const input = inputRef.current;
    const snapshot = preservedSelectionRef.current;
    if (!input || !snapshot || document.activeElement !== input) {
      return;
    }

    const valueLength = input.value.length;
    const start = snapshot.selectAll
      ? 0
      : Math.min(snapshot.start, valueLength);
    const end = snapshot.selectAll
      ? valueLength
      : Math.min(snapshot.end, valueLength);
    input.setSelectionRange(start, end, snapshot.direction ?? undefined);
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
      direction: input.selectionDirection,
      selectAll: start === 0 && end === input.value.length,
    };
  }, []);

  useLayoutEffect(() => {
    restorePreservedSelection();
  }, [currentValue, restorePreservedSelection]);

  const emitValue = useCallback(
    (
      nextValue: number,
      interaction: PrimitiveValueInteraction,
      options: { normalize?: boolean } = {},
    ) => {
      const normalized =
        options.normalize === false
          ? nextValue
          : normalizePrimitiveValue(nextValue, min, max, wrapMode);
      const previousValue = lastCommittedValueRef.current;

      if (
        Object.is(normalized, previousValue) ||
        Math.abs(normalized - previousValue) <= 1e-12
      ) {
        return normalized;
      }

      lastCommittedValueRef.current = normalized;
      setDraft(formatPrimitiveValue(normalized, precision, autoTrim));
      onValueChange(normalized, { interaction });
      return normalized;
    },
    [autoTrim, max, min, onValueChange, precision, wrapMode],
  );

  const commitDraft = useCallback(() => {
    if (parsedDraft !== null) {
      const committedDraft = formatPrimitiveValue(
        lastCommittedValueRef.current,
        precision,
        autoTrim,
      );
      if (draft !== committedDraft) {
        emitValue(parsedDraft, 'text-input');
      }
    } else {
      onInvalidCommit?.(draft);
      setDraft(displayValue);
    }
    setIsEditing(false);
    setFocusStartValue(null);
  }, [
    autoTrim,
    displayValue,
    draft,
    emitValue,
    onInvalidCommit,
    parsedDraft,
    precision,
  ]);

  const getModifiedStep = useCallback(
    (shiftKey: boolean, altKey: boolean) =>
      getPrimitiveModifiedStep(shiftKey, altKey, {
        step,
        fineStep,
        coarseStep,
        pageStep,
      }),
    [coarseStep, fineStep, pageStep, step],
  );

  const getScrubValueFromDelta = useCallback(
    (deltaPixels: number, activeStep: number) => {
      const resolvedStepDragDistance = stepDragDistance ?? 0;
      if (
        Number.isFinite(resolvedStepDragDistance) &&
        resolvedStepDragDistance > 0
      ) {
        const wholeDeltaSteps = Math.trunc(
          deltaPixels / resolvedStepDragDistance,
        );
        return scrubStartValueRef.current + wholeDeltaSteps * activeStep;
      }

      const wholeDeltaPixels = Math.round(deltaPixels);
      const pixelsPerStep = scrubPixelsPerStep > 0 ? scrubPixelsPerStep : 1;
      return (
        scrubStartValueRef.current +
        (wholeDeltaPixels / pixelsPerStep) * activeStep
      );
    },
    [scrubPixelsPerStep, stepDragDistance],
  );

  const handleFocus = useCallback(() => {
    setIsEditing(true);
    setFocusStartValue(value);
    lastCommittedValueRef.current = value;
    setDraft(displayValue);
    if (selectAllOnFocus) {
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [displayValue, selectAllOnFocus, value]);

  const handleBlur = useCallback(() => {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }

    if (commitOnBlur) {
      commitDraft();
      return;
    }
    setDraft(displayValue);
    setIsEditing(false);
    setFocusStartValue(null);
  }, [commitDraft, commitOnBlur, displayValue]);

  const handleChange = useCallback(
    (event: ReactChangeEvent<HTMLInputElement>) => {
      setDraft(event.target.value);
      setIsEditing(true);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (disabled || readOnly) {
        return;
      }

      if (
        horizontalArrowKeysMoveCaret &&
        (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
      ) {
        return;
      }

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
        const activeStep = getModifiedStep(event.shiftKey, event.altKey);
        const nextValue = getPrimitiveSteppedValue({
          value,
          key: event.key,
          min,
          max,
          wrapMode,
          step: activeStep,
          pageStep,
        });
        if (nextValue === null) {
          return;
        }

        event.preventDefault();
        emitValue(nextValue, 'keyboard', {
          normalize: event.key !== 'Home' && event.key !== 'End',
        });
        setIsEditing(true);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        commitDraft();
        skipBlurCommitRef.current = true;
        event.currentTarget.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setDraft(displayValue);
        setIsEditing(false);
        setFocusStartValue(null);
        skipBlurCommitRef.current = true;
        event.currentTarget.blur();
      }
    },
    [
      commitDraft,
      disabled,
      displayValue,
      emitValue,
      getModifiedStep,
      horizontalArrowKeysMoveCaret,
      max,
      min,
      pageStep,
      readOnly,
      value,
      wrapMode,
    ],
  );

  const hasPointerLock = useCallback(() => {
    return document.pointerLockElement === scrubHandleRef.current;
  }, []);

  const commitScrubValue = useCallback(
    (nextValue: number, clientX: number, force = false) => {
      const normalized = normalizePrimitiveValue(nextValue, min, max, wrapMode);
      const previousCommittedValue = lastCommittedValueRef.current;
      scrubCurrentValueRef.current = normalized;
      if (
        force ||
        (!Object.is(normalized, previousCommittedValue) &&
          Math.abs(normalized - previousCommittedValue) >=
            Math.max(0, scrubCommitThreshold))
      ) {
        emitValue(normalized, 'pointer');
      }

      if (wrapMode === 'clamp' && normalized !== nextValue) {
        scrubStartXRef.current = clientX;
        scrubStartValueRef.current = normalized;
      }
    },
    [emitValue, max, min, scrubCommitThreshold, wrapMode],
  );

  const applyScrubSnapshot = useCallback(
    (snapshot: PrimitiveScrubSnapshot, force = false) => {
      const deltaPixels = snapshot.clientX - scrubStartXRef.current;
      if (
        !hasDragStartedRef.current &&
        Math.abs(deltaPixels) < scrubThreshold
      ) {
        lastScrubXRef.current = snapshot.clientX;
        return;
      }
      const activeStep = getModifiedStep(snapshot.shiftKey, snapshot.altKey);
      const previousStep = activeScrubStepRef.current;
      if (hasDragStartedRef.current && activeStep !== previousStep) {
        scrubStartXRef.current = lastScrubXRef.current;
        scrubStartValueRef.current = scrubCurrentValueRef.current;
      }
      hasDragStartedRef.current = true;
      setIsScrubbing(true);
      activeScrubStepRef.current = activeStep;
      const rebasedDeltaPixels = snapshot.clientX - scrubStartXRef.current;
      const nextValue = getScrubValueFromDelta(rebasedDeltaPixels, activeStep);
      lastScrubXRef.current = snapshot.clientX;
      commitScrubValue(nextValue, snapshot.clientX, force);
    },
    [commitScrubValue, getModifiedStep, getScrubValueFromDelta, scrubThreshold],
  );

  const schedulePendingScrubFrame = useCallback(() => {
    scrubFrameRef.current = requestAnimationFrame((frameTime: number) => {
      processPendingScrubRef.current(frameTime);
    });
  }, []);

  const shouldRateLimitScrub = useCallback(() => {
    return (
      scrubMaxCommitRate !== undefined &&
      Number.isFinite(scrubMaxCommitRate) &&
      scrubMaxCommitRate > 0
    );
  }, [scrubMaxCommitRate]);

  const processPendingScrub = useCallback(
    (frameTime: number) => {
      scrubFrameRef.current = null;
      const pending = pendingScrubRef.current;
      if (!pending || activePointerIdRef.current === null) {
        pendingScrubRef.current = null;
        return;
      }

      const safeRate = scrubMaxCommitRate ?? 120;
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
      applyScrubSnapshot(pending);
      lastScrubCommitTsRef.current = frameTime;

      if (pendingScrubRef.current) {
        schedulePendingScrubFrame();
      }
    },
    [applyScrubSnapshot, schedulePendingScrubFrame, scrubMaxCommitRate],
  );

  useEffect(() => {
    processPendingScrubRef.current = processPendingScrub;
  }, [processPendingScrub]);

  const queueScrubValue = useCallback(
    (clientX: number, shiftKey: boolean, altKey: boolean) => {
      const snapshot = { clientX, shiftKey, altKey };
      if (!shouldRateLimitScrub()) {
        applyScrubSnapshot(snapshot);
        return;
      }

      pendingScrubRef.current = snapshot;
      if (scrubFrameRef.current === null) {
        schedulePendingScrubFrame();
      }
    },
    [applyScrubSnapshot, schedulePendingScrubFrame, shouldRateLimitScrub],
  );

  const stopScrubFrame = useCallback(() => {
    if (scrubFrameRef.current !== null) {
      cancelAnimationFrame(scrubFrameRef.current);
      scrubFrameRef.current = null;
    }
    pendingScrubRef.current = null;
  }, []);

  const endScrub = useCallback(
    (clientX = lastScrubXRef.current, shiftKey?: boolean, altKey?: boolean) => {
      if (activePointerIdRef.current !== null) {
        if (shiftKey !== undefined && altKey !== undefined) {
          const snapshot = { clientX, shiftKey, altKey };
          applyScrubSnapshot(snapshot, true);
        } else if (pendingScrubRef.current) {
          applyScrubSnapshot(pendingScrubRef.current, true);
        } else {
          applyScrubSnapshot({ clientX, shiftKey: false, altKey: false }, true);
        }
      }
      activePointerIdRef.current = null;
      hasDragStartedRef.current = false;
      lastScrubCommitTsRef.current = 0;
      setIsScrubbing(false);
      stopScrubFrame();
      scheduleClearPreservedSelection();
      if (hasPointerLock()) {
        document.exitPointerLock?.();
      }
    },
    [
      applyScrubSnapshot,
      hasPointerLock,
      scheduleClearPreservedSelection,
      stopScrubFrame,
    ],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!scrubEnabled || disabled || readOnly || event.button !== 0) {
        return;
      }
      event.preventDefault();
      clearPreservedSelection();
      preserveCurrentSelection();
      activePointerIdRef.current = event.pointerId;
      scrubStartXRef.current = event.clientX;
      lastScrubXRef.current = event.clientX;
      scrubStartValueRef.current = value;
      scrubCurrentValueRef.current = value;
      activeScrubStepRef.current = getModifiedStep(
        event.shiftKey,
        event.altKey,
      );
      hasDragStartedRef.current = false;
      lastScrubCommitTsRef.current = 0;
      pendingScrubRef.current = null;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      if (pointerLockEnabled) {
        try {
          const lockRequest =
            event.currentTarget.requestPointerLock?.() as Promise<void> | void;
          if (lockRequest) {
            void lockRequest.catch(() => {});
          }
        } catch {
          // Embedded previews may reject pointer lock synchronously; document
          // pointer listeners keep scrub dragging available without it.
        }
      }
    },
    [
      clearPreservedSelection,
      disabled,
      pointerLockEnabled,
      preserveCurrentSelection,
      getModifiedStep,
      readOnly,
      scrubEnabled,
      value,
    ],
  );

  const handleLostPointerCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerId === activePointerIdRef.current) {
        endScrub();
      }
    },
    [endScrub],
  );

  useEffect(() => {
    const handleDocumentPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activePointerIdRef.current || hasPointerLock()) {
        return;
      }
      queueScrubValue(event.clientX, event.shiftKey, event.altKey);
    };

    const handleDocumentPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activePointerIdRef.current) {
        return;
      }
      endScrub(
        hasPointerLock() ? lastScrubXRef.current : event.clientX,
        event.shiftKey,
        event.altKey,
      );
    };

    const handleDocumentPointerCancel = (event: PointerEvent) => {
      if (event.pointerId === activePointerIdRef.current) {
        endScrub();
      }
    };

    const handleLockedMouseMove = (event: MouseEvent) => {
      if (activePointerIdRef.current === null || !hasPointerLock()) {
        return;
      }
      queueScrubValue(
        lastScrubXRef.current + event.movementX,
        event.shiftKey,
        event.altKey,
      );
    };

    const handlePointerLockChange = () => {
      if (activePointerIdRef.current !== null && !hasPointerLock()) {
        endScrub();
      }
    };

    document.addEventListener('pointermove', handleDocumentPointerMove);
    document.addEventListener('pointerup', handleDocumentPointerUp);
    document.addEventListener('pointercancel', handleDocumentPointerCancel);
    document.addEventListener('mousemove', handleLockedMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('pointermove', handleDocumentPointerMove);
      document.removeEventListener('pointerup', handleDocumentPointerUp);
      document.removeEventListener(
        'pointercancel',
        handleDocumentPointerCancel,
      );
      document.removeEventListener('mousemove', handleLockedMouseMove);
      document.removeEventListener(
        'pointerlockchange',
        handlePointerLockChange,
      );
    };
  }, [endScrub, hasPointerLock, queueScrubValue]);

  useEffect(() => clearPreservedSelection, [clearPreservedSelection]);
  useEffect(() => stopScrubFrame, [stopScrubFrame]);
  useEffect(() => {
    onScrubbingChangeRef.current = onScrubbingChange;
  }, [onScrubbingChange]);
  const hasReportedScrubbingRef = useRef(false);
  useEffect(() => {
    if (!hasReportedScrubbingRef.current) {
      hasReportedScrubbingRef.current = true;
      return;
    }
    onScrubbingChangeRef.current?.(isScrubbing);
  }, [isScrubbing]);

  return {
    inputRef,
    scrubHandleRef,
    currentValue,
    displayValue,
    draft,
    isDraftValid,
    isEditing,
    isScrubbing,
    inputProps: {
      value: currentValue,
      disabled,
      readOnly,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onChange: handleChange,
      onKeyDown: handleKeyDown,
    },
    scrubHandleProps: {
      onPointerDown: handlePointerDown,
      onLostPointerCapture: handleLostPointerCapture,
    },
  };
}

export interface PrimitiveValueInputProps {
  value: number;
  onValueChange: (value: number, details: PrimitiveValueChangeDetails) => void;
  ariaLabel?: string;
  placeholder?: string;
  leadingElement?: ReactNode;
  trailingElement?: ReactNode;
  handleElement?: ReactNode;
  handleSide?: PrimitiveHandleSide;
  handleContentWidth?: number;
  min: number;
  max: number;
  wrapMode: PrimitiveWrapMode;
  step: number;
  fineStep: number;
  coarseStep: number;
  pageStep: number;
  precision: PrimitivePrecision;
  autoTrim: boolean;
  allowExpressions: boolean;
  parseExpression?: PrimitiveExpressionParser;
  selectAllOnFocus: boolean;
  commitOnBlur: boolean;
  scrubEnabled: boolean;
  scrubPixelsPerStep?: number;
  stepDragDistance?: number;
  scrubThreshold: number;
  scrubCommitThreshold?: number;
  scrubMaxCommitRate?: number;
  pointerLockEnabled: boolean;
  horizontalArrowKeysMoveCaret?: boolean;
  disabled: boolean;
  readOnly: boolean;
  onInvalidCommit?: (draft: string) => void;
  visualState: PrimitiveVisualState;
  visualTreatment?: PrimitiveVisualTreatment;
  showInvalidBorder?: boolean;
  onScrubbingChange?: (isScrubbing: boolean) => void;
  size: PrimitiveSize;
  density?: PrimitiveDensity;
}

export function PrimitiveValueInput({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  leadingElement = 'V',
  trailingElement,
  handleElement,
  handleSide = 'leading',
  handleContentWidth = 24,
  min,
  max,
  wrapMode,
  step,
  fineStep,
  coarseStep,
  pageStep,
  precision,
  autoTrim,
  allowExpressions,
  parseExpression,
  selectAllOnFocus,
  commitOnBlur,
  scrubEnabled,
  scrubPixelsPerStep = 1,
  stepDragDistance,
  scrubThreshold,
  scrubCommitThreshold,
  scrubMaxCommitRate,
  pointerLockEnabled,
  horizontalArrowKeysMoveCaret = true,
  disabled,
  readOnly,
  onInvalidCommit,
  visualState,
  visualTreatment = 'default',
  showInvalidBorder = false,
  onScrubbingChange,
  size,
  density = 'compact',
}: PrimitiveValueInputProps) {
  const [isHovered, setIsHovered] = useState(false);
  const {
    inputRef,
    inputProps,
    scrubHandleRef,
    scrubHandleProps,
    isDraftValid,
    isEditing,
    isScrubbing,
  } = usePrimitiveValueInput({
    value,
    onValueChange,
    min,
    max,
    wrapMode,
    step,
    fineStep,
    coarseStep,
    pageStep,
    precision,
    autoTrim,
    allowExpressions,
    parseExpression,
    selectAllOnFocus,
    commitOnBlur,
    scrubEnabled,
    scrubPixelsPerStep,
    stepDragDistance,
    scrubThreshold,
    scrubCommitThreshold,
    scrubMaxCommitRate,
    pointerLockEnabled,
    horizontalArrowKeysMoveCaret,
    disabled,
    readOnly,
    onInvalidCommit,
    onScrubbingChange,
  });

  const showInvalidState = visualState === 'invalid';
  const isVisuallyValid =
    visualState === 'valid' || (visualState === 'auto' && isDraftValid);
  const isEmbeddedVisual = visualTreatment === 'embedded';
  const isInvalid = showInvalidState || (isEditing && !isDraftValid);
  const borderColor =
    showInvalidBorder && isInvalid
      ? '#ff4e4e'
      : isEmbeddedVisual
        ? 'transparent'
        : isScrubbing
          ? '#97c1ef'
          : isEditing
            ? '#5288db'
            : isHovered
              ? '#4C4C4C'
              : 'transparent';
  const hasTrailingElement =
    trailingElement !== null &&
    trailingElement !== undefined &&
    trailingElement !== false;
  const resolvedHandleElement =
    handleElement !== undefined
      ? handleElement
      : handleSide === 'trailing'
        ? trailingElement
        : leadingElement;
  const hasHandleElement =
    resolvedHandleElement !== null &&
    resolvedHandleElement !== undefined &&
    resolvedHandleElement !== false;
  const trailingElementFeedsHandle =
    handleSide === 'trailing' && handleElement === undefined;
  const scrubHandleStyle = hasHandleElement
    ? { width: handleContentWidth }
    : undefined;
  const scrubHandle = scrubEnabled ? (
    <div
      ref={scrubHandleRef}
      data-control-kit-scrub-handle=""
      aria-hidden="true"
      className={
        hasHandleElement
          ? 'flex h-full shrink-0 cursor-ew-resize touch-none select-none items-center justify-center font-medium tabular-nums text-white/55'
          : `absolute ${
              handleSide === 'leading' ? '-left-0.5' : '-right-0.5'
            } top-0 z-10 h-full w-[5px] cursor-ew-resize touch-none select-none`
      }
      style={scrubHandleStyle}
      {...scrubHandleProps}
    >
      {resolvedHandleElement}
    </div>
  ) : null;

  return (
    <div
      className={`relative box-border flex min-w-0 max-w-full items-center ${
        isEmbeddedVisual ? 'rounded-none' : 'rounded-[4px]'
      } border bg-[#383838] p-0 font-sans text-white ${
        PRIMITIVE_SIZE_CLASS[size]
      } ${PRIMITIVE_DENSITY_CLASS[density]} ${disabled ? 'opacity-45' : ''}`}
      style={{ borderColor }}
      data-scrubbing={isScrubbing || undefined}
      data-valid={isVisuallyValid || undefined}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      {handleSide === 'leading' ? scrubHandle : null}
      <input
        ref={inputRef}
        type="text"
        aria-label={ariaLabel}
        aria-invalid={isInvalid}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 cursor-default bg-transparent py-0 pl-1 pr-0 font-sans tabular-nums text-white outline-none focus:cursor-text disabled:cursor-not-allowed"
        {...inputProps}
      />
      {hasTrailingElement && !trailingElementFeedsHandle ? (
        <span className="flex h-full w-5 shrink-0 select-none items-center justify-center text-[11px] font-medium leading-4 text-white/50">
          {trailingElement}
        </span>
      ) : null}
      {handleSide === 'trailing' ? scrubHandle : null}
    </div>
  );
}
