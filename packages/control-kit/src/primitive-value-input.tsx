import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
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

export type PrimitiveExpressionParser = (
  draft: string,
  options: {
    allowExpressions: boolean;
    currentValue: number;
    range: [number, number];
  },
) => number | null;

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

export interface PrimitiveValueInputProps {
  value: number;
  onValueChange: (value: number) => void;
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
  scrubThreshold: number;
  pointerLockEnabled: boolean;
  horizontalArrowKeysMoveCaret?: boolean;
  disabled: boolean;
  readOnly: boolean;
  visualState: PrimitiveVisualState;
  visualTreatment?: PrimitiveVisualTreatment;
  showInvalidBorder?: boolean;
  onScrubbingChange?: (isScrubbing: boolean) => void;
  size: PrimitiveSize;
  density?: PrimitiveDensity;
}

interface PrimitiveInputSelectionSnapshot {
  start: number;
  end: number;
  direction: HTMLInputElement['selectionDirection'];
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
  scrubThreshold,
  pointerLockEnabled,
  horizontalArrowKeysMoveCaret = true,
  disabled,
  readOnly,
  visualState,
  visualTreatment = 'default',
  showInvalidBorder = false,
  onScrubbingChange,
  size,
  density = 'compact',
}: PrimitiveValueInputProps) {
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
  const [draft, setDraft] = useState(() =>
    formatPrimitiveValue(value, precision, autoTrim),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
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

  const parsedDraft = useMemo(() => {
    if (!isEditing) {
      return value;
    }

    const parsed = parsePrimitiveDraft(
      draft,
      value,
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
    isEditing,
    max,
    min,
    parseExpression,
    value,
    wrapMode,
  ]);

  const isDraftValid = parsedDraft !== null;
  const showInvalidState = visualState === 'invalid';
  const isVisuallyValid =
    visualState === 'valid' || (visualState === 'auto' && isDraftValid);
  const currentValue = isEditing ? draft : displayValue;

  const restorePreservedSelection = useCallback(() => {
    const input = inputRef.current;
    const snapshot = preservedSelectionRef.current;
    if (!input || !snapshot || document.activeElement !== input) {
      return;
    }

    const valueLength = input.value.length;
    input.setSelectionRange(
      Math.min(snapshot.start, valueLength),
      Math.min(snapshot.end, valueLength),
      snapshot.direction ?? undefined,
    );
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
    };
  }, []);

  useLayoutEffect(() => {
    restorePreservedSelection();
  }, [currentValue, restorePreservedSelection]);

  const commitValue = useCallback(
    (nextValue: number) => {
      const normalized = normalizePrimitiveValue(nextValue, min, max, wrapMode);
      onValueChange(normalized);
      setDraft(formatPrimitiveValue(normalized, precision, autoTrim));
    },
    [autoTrim, max, min, onValueChange, precision, wrapMode],
  );

  const commitDraft = useCallback(() => {
    if (parsedDraft !== null) {
      commitValue(parsedDraft);
    } else {
      setDraft(displayValue);
    }
    setIsEditing(false);
  }, [commitValue, displayValue, parsedDraft]);

  const getModifiedStep = useCallback(
    (shiftKey: boolean, altKey: boolean) => {
      if (altKey) return fineStep;
      if (shiftKey) return coarseStep;
      return step;
    },
    [coarseStep, fineStep, step],
  );

  const handleFocus = useCallback(() => {
    setIsEditing(true);
    setDraft(displayValue);
    if (selectAllOnFocus) {
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [displayValue, selectAllOnFocus]);

  const handleBlur = useCallback(() => {
    if (commitOnBlur) {
      commitDraft();
      return;
    }
    setDraft(displayValue);
    setIsEditing(false);
  }, [commitDraft, commitOnBlur, displayValue]);

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
        event.preventDefault();
        const activeStep = getModifiedStep(event.shiftKey, event.altKey);
        const direction =
          event.key === 'ArrowRight' || event.key === 'ArrowUp'
            ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
              ? -1
              : 0;

        if (direction !== 0) {
          commitValue(value + direction * activeStep);
        } else if (event.key === 'PageUp') {
          commitValue(value + pageStep);
        } else if (event.key === 'PageDown') {
          commitValue(value - pageStep);
        } else if (event.key === 'Home') {
          commitValue(min);
        } else if (event.key === 'End') {
          commitValue(max);
        }
        setIsEditing(true);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        commitDraft();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setDraft(displayValue);
        setIsEditing(false);
        event.currentTarget.blur();
      }
    },
    [
      commitDraft,
      commitValue,
      disabled,
      displayValue,
      getModifiedStep,
      horizontalArrowKeysMoveCaret,
      max,
      min,
      pageStep,
      readOnly,
      value,
    ],
  );

  const hasPointerLock = useCallback(() => {
    return document.pointerLockElement === scrubHandleRef.current;
  }, []);

  const commitScrubValue = useCallback(
    (nextValue: number, clientX: number) => {
      const normalized = normalizePrimitiveValue(nextValue, min, max, wrapMode);
      scrubCurrentValueRef.current = normalized;
      commitValue(nextValue);

      if (wrapMode === 'clamp' && normalized !== nextValue) {
        scrubStartXRef.current = clientX;
        scrubStartValueRef.current = normalized;
      }
    },
    [commitValue, max, min, wrapMode],
  );

  const endScrub = useCallback(
    (clientX = lastScrubXRef.current, shiftKey?: boolean, altKey?: boolean) => {
      if (activePointerIdRef.current !== null && hasDragStartedRef.current) {
        if (shiftKey !== undefined && altKey !== undefined) {
          const activeStep = getModifiedStep(shiftKey, altKey);
          const previousStep = activeScrubStepRef.current;
          if (activeStep !== previousStep) {
            scrubStartXRef.current = lastScrubXRef.current;
            scrubStartValueRef.current = scrubCurrentValueRef.current;
          }
          activeScrubStepRef.current = activeStep;
          const deltaPixels = clientX - scrubStartXRef.current;
          const wholeDeltaPixels = Math.round(deltaPixels);
          const pixelsPerStep = scrubPixelsPerStep > 0 ? scrubPixelsPerStep : 1;
          const nextValue =
            scrubStartValueRef.current +
            (wholeDeltaPixels / pixelsPerStep) * activeStep;
          commitScrubValue(nextValue, clientX);
        }
      }
      activePointerIdRef.current = null;
      hasDragStartedRef.current = false;
      setIsScrubbing(false);
      scheduleClearPreservedSelection();
      if (hasPointerLock()) {
        document.exitPointerLock?.();
      }
    },
    [
      commitScrubValue,
      getModifiedStep,
      hasPointerLock,
      scheduleClearPreservedSelection,
      scrubPixelsPerStep,
    ],
  );

  const queueScrubValue = useCallback(
    (clientX: number, shiftKey: boolean, altKey: boolean) => {
      const deltaPixels = clientX - scrubStartXRef.current;
      if (
        !hasDragStartedRef.current &&
        Math.abs(deltaPixels) < scrubThreshold
      ) {
        lastScrubXRef.current = clientX;
        return;
      }
      const activeStep = getModifiedStep(shiftKey, altKey);
      const previousStep = activeScrubStepRef.current;
      if (hasDragStartedRef.current && activeStep !== previousStep) {
        scrubStartXRef.current = lastScrubXRef.current;
        scrubStartValueRef.current = scrubCurrentValueRef.current;
      }
      hasDragStartedRef.current = true;
      setIsScrubbing(true);
      activeScrubStepRef.current = activeStep;
      const rebasedDeltaPixels = clientX - scrubStartXRef.current;
      const wholeDeltaPixels = Math.round(rebasedDeltaPixels);
      const pixelsPerStep = scrubPixelsPerStep > 0 ? scrubPixelsPerStep : 1;
      const nextValue =
        scrubStartValueRef.current +
        (wholeDeltaPixels / pixelsPerStep) * activeStep;
      lastScrubXRef.current = clientX;
      commitScrubValue(nextValue, clientX);
    },
    [commitScrubValue, getModifiedStep, scrubPixelsPerStep, scrubThreshold],
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
  const scrubHandleStyle = {
    ...(hasHandleElement ? { width: handleContentWidth } : {}),
    cursor: 'ew-resize',
    touchAction: 'none',
    userSelect: 'none',
  } as const;
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
      onPointerDown={handlePointerDown}
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
        value={currentValue}
        disabled={disabled}
        readOnly={readOnly}
        aria-label={ariaLabel}
        aria-invalid={isInvalid}
        placeholder={placeholder}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(event) => {
          setDraft(event.target.value);
          setIsEditing(true);
        }}
        onKeyDown={handleKeyDown}
        className="h-full min-w-0 flex-1 cursor-default bg-transparent py-0 pl-1 pr-0 font-sans tabular-nums text-white outline-none focus:cursor-text disabled:cursor-not-allowed"
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
