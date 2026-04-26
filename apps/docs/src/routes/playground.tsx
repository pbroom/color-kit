import {
  Background,
  ColorApi,
  ColorArea,
  ColorInput,
  ColorPlane,
  ColorSlider,
  ColorStringInput,
  FallbackPointsLayer,
  GamutBoundaryLayer,
  useColor,
  type ColorAreaAxes,
  type ColorAreaChannel,
  type ColorAreaPerformanceProfile,
  type ColorSliderChannel,
  type SliderHueGradientMode,
} from 'color-kit/react';
import {
  toCss,
  toHex,
  toP3Gamut,
  toSrgbGamut,
  type Color as ColorValue,
} from 'color-kit';
import { Github } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ThemeSwitcher } from '../components/theme-switcher.js';

type OutputGamut = 'display-p3' | 'srgb';
type PlaygroundPageKey = 'plane' | 'input';
type PrimitivePrecision = 'auto' | '0' | '1' | '2' | '3';
type PrimitiveWrapMode = 'clamp' | 'wrap' | 'free';
type PrimitiveScrubMultiplier = '1' | '0.1' | '0.01';
type PrimitiveSize = 'sm' | 'md' | 'lg';
type PrimitiveDensity = 'compact' | 'comfortable';
type PrimitiveVisualState = 'auto' | 'valid' | 'invalid';

type SliderRailStyle = CSSProperties & {
  '--ck-slider-gradient-active': string;
  '--ck-slider-gradient-srgb': string;
  '--ck-slider-fallback-color': string;
  '--ck-slider-rail-start-active': string;
  '--ck-slider-rail-start-srgb': string;
  '--ck-slider-rail-end-active': string;
  '--ck-slider-rail-end-srgb': string;
  '--ck-slider-thumb-fill-active': string;
  '--ck-slider-thumb-fill-srgb': string;
};

const PLAYGROUND_PAGES: Array<{
  value: PlaygroundPageKey;
  label: string;
}> = [
  {
    value: 'plane',
    label: 'ColorPlane',
  },
  {
    value: 'input',
    label: 'Input Primitive',
  },
];

const PRIMITIVE_SCRUB_MULTIPLIER: Record<PrimitiveScrubMultiplier, number> = {
  '1': 1,
  '0.1': 0.1,
  '0.01': 0.01,
};

const PRIMITIVE_SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: 'w-32',
  md: 'w-44',
  lg: 'w-60',
};

const PRIMITIVE_DENSITY_CLASS: Record<PrimitiveDensity, string> = {
  compact: 'h-6 min-h-6 text-[11px] leading-4',
  comfortable: 'h-8 min-h-8 text-xs leading-4',
};

function normalizePrimitiveValue(
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

function formatPrimitiveValue(
  value: number,
  precision: PrimitivePrecision,
): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  if (precision === 'auto') {
    const rounded = Number(value.toFixed(6));
    return Object.is(rounded, -0) ? '0' : String(rounded);
  }

  return value.toFixed(Number(precision));
}

function parsePrimitiveDraft(
  draft: string,
  currentValue: number,
  min: number,
  max: number,
  allowExpressions: boolean,
): number | null {
  return ColorApi.parseColorInputExpression(draft, {
    currentValue,
    range: [min, max],
    allowExpressions,
  });
}

function alternateAxis(channel: ColorAreaChannel): ColorAreaChannel {
  if (channel === 'l') return 'c';
  return 'l';
}

function normalizeAxes(
  x: ColorAreaChannel,
  y: ColorAreaChannel,
): { x: ColorAreaChannel; y: ColorAreaChannel } {
  if (x !== y) {
    return { x, y };
  }

  return { x, y: alternateAxis(y) };
}

function getOklchSliderRail(
  channel: ColorSliderChannel,
  requested: ColorValue,
  gamut: OutputGamut,
  hueGradientMode?: SliderHueGradientMode,
): { colorSpace: OutputGamut; style: SliderRailStyle } {
  const range = ColorApi.resolveColorSliderRange(channel);
  const gradient = ColorApi.getSliderGradientStyles({
    model: 'oklch',
    channel,
    range,
    baseColor: requested,
    colorSpace: gamut,
    hueGradientMode,
  });
  const startStop = gradient.stops[0];
  const endStop = gradient.stops[gradient.stops.length - 1] ?? startStop;
  const thumbNorm = ColorApi.getColorSliderThumbPosition(
    requested,
    channel,
    range,
  );
  const thumbColor = ColorApi.colorFromColorSliderPosition(
    requested,
    channel,
    thumbNorm,
    range,
  );
  const thumbFillSrgb = toCss(toSrgbGamut(thumbColor), 'rgb');
  const thumbFillActive =
    gradient.colorSpace === 'display-p3'
      ? toCss(toP3Gamut(thumbColor), 'p3')
      : thumbFillSrgb;
  const railStartSrgb = startStop?.srgbCss ?? gradient.srgbBackgroundColor;
  const railEndSrgb = endStop?.srgbCss ?? railStartSrgb;
  const railStartActive = startStop?.activeCss ?? railStartSrgb;
  const railEndActive = endStop?.activeCss ?? railEndSrgb;

  return {
    colorSpace: gradient.colorSpace,
    style: {
      '--ck-slider-gradient-active': gradient.activeBackgroundImage,
      '--ck-slider-gradient-srgb': gradient.srgbBackgroundImage,
      '--ck-slider-fallback-color': gradient.srgbBackgroundColor,
      '--ck-slider-rail-start-active': railStartActive,
      '--ck-slider-rail-start-srgb': railStartSrgb,
      '--ck-slider-rail-end-active': railEndActive,
      '--ck-slider-rail-end-srgb': railEndSrgb,
      '--ck-slider-thumb-fill-active': thumbFillActive,
      '--ck-slider-thumb-fill-srgb': thumbFillSrgb,
    },
  };
}

function PanelSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-medium tracking-tight text-white">
          {title}
        </h2>
        {description ? (
          <p className="text-xs leading-relaxed text-white/55">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SegmentedField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <ToggleGroup
        type="single"
        value={value}
        className="h-auto w-full justify-start rounded-xl border border-white/8 bg-white/[0.03] p-1"
        onValueChange={(next) => {
          if (next) {
            onChange(next as T);
          }
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="h-8 flex-1 rounded-lg px-2 text-xs text-white/70 data-[state=on]:bg-white/10 data-[state=on]:text-white data-[state=on]:shadow-none"
            aria-label={`${label}: ${option.label}`}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white/78">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-white/20 bg-transparent accent-white"
      />
    </label>
  );
}

function PagesPanel({
  activePage,
  onPageChange,
}: {
  activePage: PlaygroundPageKey;
  onPageChange: (page: PlaygroundPageKey) => void;
}) {
  return (
    <div className="absolute left-4 top-4 z-20 w-[250px] rounded-[24px] border border-white/8 bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur">
      <div className="px-1 pb-2">
        <h2 className="text-sm font-medium tracking-tight text-white">Pages</h2>
      </div>
      <div className="space-y-0.5">
        {PLAYGROUND_PAGES.map((page) => {
          const isActive = activePage === page.value;
          return (
            <button
              key={page.value}
              type="button"
              className={`flex w-full items-center px-1 py-1.5 text-left text-sm transition-colors ${
                isActive
                  ? 'font-semibold text-white'
                  : 'font-medium text-white/55 hover:text-white/80'
              }`}
              aria-pressed={isActive}
              onClick={() => onPageChange(page.value)}
            >
              {page.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberConfigField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(next);
          }
        }}
        className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm text-white outline-none focus:border-[#5288db]"
      />
    </label>
  );
}

interface PrimitiveValueInputProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  wrapMode: PrimitiveWrapMode;
  step: number;
  fineStep: number;
  coarseStep: number;
  pageStep: number;
  precision: PrimitivePrecision;
  allowExpressions: boolean;
  selectAllOnFocus: boolean;
  commitOnBlur: boolean;
  scrubEnabled: boolean;
  scrubPixelsPerStep: number;
  scrubThreshold: number;
  pointerLockEnabled: boolean;
  disabled: boolean;
  readOnly: boolean;
  visualState: PrimitiveVisualState;
  size: PrimitiveSize;
  density: PrimitiveDensity;
}

interface PrimitiveInputSelectionSnapshot {
  start: number;
  end: number;
  direction: HTMLInputElement['selectionDirection'];
}

function PrimitiveValueInput({
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
  allowExpressions,
  selectAllOnFocus,
  commitOnBlur,
  scrubEnabled,
  scrubPixelsPerStep,
  scrubThreshold,
  pointerLockEnabled,
  disabled,
  readOnly,
  visualState,
  size,
  density,
}: PrimitiveValueInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrubHandleRef = useRef<HTMLDivElement>(null);
  const preservedSelectionRef = useRef<PrimitiveInputSelectionSnapshot | null>(
    null,
  );
  const clearPreservedSelectionFrameRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const scrubStartXRef = useRef(0);
  const scrubStartValueRef = useRef(0);
  const lastScrubXRef = useRef(0);
  const hasDragStartedRef = useRef(false);
  const [draft, setDraft] = useState(() =>
    formatPrimitiveValue(value, precision),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const displayValue = useMemo(
    () => formatPrimitiveValue(value, precision),
    [precision, value],
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
    );
    return parsed === null
      ? null
      : normalizePrimitiveValue(parsed, min, max, wrapMode);
  }, [allowExpressions, draft, isEditing, max, min, value, wrapMode]);

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
      snapshot.direction,
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
      setDraft(formatPrimitiveValue(normalized, precision));
    },
    [max, min, onValueChange, precision, wrapMode],
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

  const endScrub = useCallback(
    (clientX = lastScrubXRef.current) => {
      if (activePointerIdRef.current !== null && hasDragStartedRef.current) {
        const deltaPixels = clientX - scrubStartXRef.current;
        const pixelsPerStep = scrubPixelsPerStep > 0 ? scrubPixelsPerStep : 1;
        commitValue(
          scrubStartValueRef.current + (deltaPixels / pixelsPerStep) * step,
        );
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
      commitValue,
      hasPointerLock,
      scheduleClearPreservedSelection,
      scrubPixelsPerStep,
      step,
    ],
  );

  const queueScrubValue = useCallback(
    (clientX: number) => {
      lastScrubXRef.current = clientX;
      const deltaPixels = clientX - scrubStartXRef.current;
      if (
        !hasDragStartedRef.current &&
        Math.abs(deltaPixels) < scrubThreshold
      ) {
        return;
      }
      hasDragStartedRef.current = true;
      setIsScrubbing(true);
      const pixelsPerStep = scrubPixelsPerStep > 0 ? scrubPixelsPerStep : 1;
      commitValue(
        scrubStartValueRef.current + (deltaPixels / pixelsPerStep) * step,
      );
    },
    [commitValue, scrubPixelsPerStep, scrubThreshold, step],
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
      hasDragStartedRef.current = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      if (pointerLockEnabled) {
        const lockRequest =
          event.currentTarget.requestPointerLock?.() as Promise<void> | void;
        if (lockRequest) {
          void lockRequest.catch(() => {});
        }
      }
    },
    [
      clearPreservedSelection,
      disabled,
      pointerLockEnabled,
      preserveCurrentSelection,
      readOnly,
      scrubEnabled,
      value,
    ],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerId !== activePointerIdRef.current || hasPointerLock()) {
        return;
      }
      queueScrubValue(event.clientX);
    },
    [hasPointerLock, queueScrubValue],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerId !== activePointerIdRef.current) {
        return;
      }
      endScrub(hasPointerLock() ? lastScrubXRef.current : event.clientX);
    },
    [endScrub, hasPointerLock],
  );

  useEffect(() => {
    const handleLockedMouseMove = (event: MouseEvent) => {
      if (activePointerIdRef.current === null || !hasPointerLock()) {
        return;
      }
      queueScrubValue(lastScrubXRef.current + event.movementX);
    };

    const handlePointerLockChange = () => {
      if (activePointerIdRef.current !== null && !hasPointerLock()) {
        endScrub();
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
  }, [endScrub, hasPointerLock, queueScrubValue]);

  useEffect(() => clearPreservedSelection, [clearPreservedSelection]);

  return (
    <div
      className={`box-border flex items-center rounded-[4px] border border-transparent bg-[#383838] p-0 font-sans text-white hover:border-white/10 focus-within:border-[#5288db] ${
        showInvalidState ? 'border-[#ff4e4e]' : ''
      } ${isScrubbing ? 'border-[#97c1ef]' : ''} ${
        PRIMITIVE_SIZE_CLASS[size]
      } ${PRIMITIVE_DENSITY_CLASS[density]} ${disabled ? 'opacity-45' : ''}`}
      data-scrubbing={isScrubbing || undefined}
      data-valid={isVisuallyValid || undefined}
    >
      {scrubEnabled ? (
        <div
          ref={scrubHandleRef}
          aria-hidden="true"
          className="flex h-full w-6 shrink-0 cursor-ew-resize select-none items-center justify-center font-medium tabular-nums text-white/55"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => endScrub()}
          onLostPointerCapture={() => {
            if (!hasPointerLock()) endScrub();
          }}
        >
          V
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="text"
        value={currentValue}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={showInvalidState || (isEditing && !isDraftValid)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(event) => {
          setDraft(event.target.value);
          setIsEditing(true);
        }}
        onKeyDown={handleKeyDown}
        className="h-full min-w-0 flex-1 cursor-default bg-transparent py-0 pl-1 pr-0 font-sans tabular-nums text-white outline-none focus:cursor-text disabled:cursor-not-allowed"
      />
    </div>
  );
}

export function PlaygroundPage() {
  const color = useColor({
    defaultColor: 'oklch(0.64 0.24 28)',
    defaultGamut: 'display-p3',
  });
  const [activePage, setActivePage] = useState<PlaygroundPageKey>('plane');
  const [axisState, setAxisState] = useState<{
    x: ColorAreaChannel;
    y: ColorAreaChannel;
  }>({
    x: 'l',
    y: 'c',
  });
  const [checkerboard, setCheckerboard] = useState(false);
  const [repeatEdgePixels, setRepeatEdgePixels] = useState(false);
  const [showFallbackPoints, setShowFallbackPoints] = useState(false);
  const [showP3Boundary, setShowP3Boundary] = useState(false);
  const [showSrgbBoundary, setShowSrgbBoundary] = useState(false);
  const [performanceProfile, setPerformanceProfile] =
    useState<ColorAreaPerformanceProfile>('auto');
  const [primitiveValue, setPrimitiveValue] = useState(42);
  const [primitiveMin, setPrimitiveMin] = useState(0);
  const [primitiveMax, setPrimitiveMax] = useState(100);
  const [primitiveWrapMode, setPrimitiveWrapMode] =
    useState<PrimitiveWrapMode>('clamp');
  const [primitiveStep, setPrimitiveStep] = useState(1);
  const [primitiveFineStep, setPrimitiveFineStep] = useState(0.1);
  const [primitiveCoarseStep, setPrimitiveCoarseStep] = useState(10);
  const [primitivePageStep, setPrimitivePageStep] = useState(10);
  const [primitivePrecision, setPrimitivePrecision] =
    useState<PrimitivePrecision>('auto');
  const [primitiveAllowExpressions, setPrimitiveAllowExpressions] =
    useState(true);
  const [primitiveSelectAllOnFocus, setPrimitiveSelectAllOnFocus] =
    useState(true);
  const [primitiveCommitOnBlur, setPrimitiveCommitOnBlur] = useState(true);
  const [primitiveScrubEnabled, setPrimitiveScrubEnabled] = useState(true);
  const [primitivePointerLockEnabled, setPrimitivePointerLockEnabled] =
    useState(true);
  const [primitiveScrubThreshold, setPrimitiveScrubThreshold] = useState(2);
  const [primitiveScrubMultiplier, setPrimitiveScrubMultiplier] =
    useState<PrimitiveScrubMultiplier>('1');
  const [primitiveDisabled, setPrimitiveDisabled] = useState(false);
  const [primitiveReadOnly, setPrimitiveReadOnly] = useState(false);
  const [primitiveVisualState, setPrimitiveVisualState] =
    useState<PrimitiveVisualState>('auto');
  const [primitiveSize, setPrimitiveSize] = useState<PrimitiveSize>('md');
  const [primitiveDensity, setPrimitiveDensity] =
    useState<PrimitiveDensity>('compact');

  const channels = useMemo(
    () => normalizeAxes(axisState.x, axisState.y),
    [axisState.x, axisState.y],
  );
  const axes = useMemo<ColorAreaAxes>(
    () => ({
      x: {
        channel: channels.x,
        range: ColorApi.resolveColorAreaRange(channels.x),
      },
      y: {
        channel: channels.y,
        range: ColorApi.resolveColorAreaRange(channels.y),
      },
    }),
    [channels.x, channels.y],
  );
  const hueRail = useMemo(
    () => getOklchSliderRail('h', color.requested, color.activeGamut),
    [color.activeGamut, color.requested],
  );
  const activeDisplayedSrgb = useMemo(
    () => toCss(toSrgbGamut(color.requested), 'rgb'),
    [color.requested],
  );
  const activeDisplayedActive = useMemo(
    () =>
      color.activeGamut === 'display-p3'
        ? toCss(toP3Gamut(color.requested), 'p3')
        : activeDisplayedSrgb,
    [activeDisplayedSrgb, color.activeGamut, color.requested],
  );
  const activeDisplayedHex = useMemo(
    () => toHex(toSrgbGamut(color.requested)).toUpperCase(),
    [color.requested],
  );

  const setAxis = (axis: 'x' | 'y', channel: ColorAreaChannel) => {
    setAxisState((current) => {
      if (axis === 'x') {
        return channel === current.y
          ? { x: channel, y: alternateAxis(channel) }
          : { ...current, x: channel };
      }

      return channel === current.x
        ? { x: alternateAxis(channel), y: channel }
        : { ...current, y: channel };
    });
  };

  const primitiveScrubPixelsPerStep =
    1 / PRIMITIVE_SCRUB_MULTIPLIER[primitiveScrubMultiplier];

  return (
    <div className="ck-shell-bg min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1560px] items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="docs-brand">
              <span className="docs-brand-dot" />
              Color Kit
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              <Button asChild variant="ghost" size="sm">
                <Link to="/docs/introduction">Docs</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/docs/components/color-area">Components</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/docs/shadcn-registry">Registry</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/playground">Playground</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a
                  href="https://github.com/pbroom/color-kit"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="size-4" />
                  GitHub
                </a>
              </Button>
            </nav>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-3.5rem)] bg-[#171717] text-white lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden">
        <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 lg:h-full lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="relative flex min-h-[420px] items-center justify-center overflow-hidden px-6 py-10 lg:min-h-0 lg:py-14">
            {activePage === 'plane' ? (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_42%)]" />
            ) : null}
            <PagesPanel activePage={activePage} onPageChange={setActivePage} />
            {activePage === 'plane' ? (
              <div className="relative size-[300px]">
                <ColorArea
                  className="ck-color-area overflow-hidden rounded-none border border-white/10 bg-[#0c0c0d] shadow-[0_0_0_1px_rgba(255,255,255,0.03)] [&_[data-color-area-thumb]]:hidden"
                  style={{ width: 300, height: 300 }}
                  axes={axes}
                  requested={color.requested}
                  onChangeRequested={color.setRequested}
                  performanceProfile={performanceProfile}
                >
                  {checkerboard ? <Background checkerboard /> : null}
                  <ColorPlane
                    edgeBehavior={repeatEdgePixels ? 'clamp' : 'transparent'}
                  />
                  {showP3Boundary ? (
                    <GamutBoundaryLayer
                      gamut="display-p3"
                      steps={128}
                      pathProps={{
                        fill: 'none',
                        stroke: '#ff3b30',
                        strokeWidth: 0.45,
                        strokeLinejoin: 'miter',
                        strokeMiterlimit: 6,
                      }}
                    />
                  ) : null}
                  {showSrgbBoundary ? (
                    <GamutBoundaryLayer
                      gamut="srgb"
                      steps={128}
                      pathProps={{
                        fill: 'none',
                        stroke: 'rgba(255,255,255,0.88)',
                        strokeWidth: 0.45,
                        strokeDasharray: '1.4 1',
                        strokeLinejoin: 'miter',
                        strokeMiterlimit: 6,
                      }}
                    />
                  ) : null}
                  {showFallbackPoints ? (
                    <FallbackPointsLayer
                      showP3
                      showSrgb={color.activeGamut === 'srgb'}
                    />
                  ) : null}
                </ColorArea>
              </div>
            ) : (
              <PrimitiveValueInput
                value={primitiveValue}
                onValueChange={setPrimitiveValue}
                min={primitiveMin}
                max={primitiveMax}
                wrapMode={primitiveWrapMode}
                step={primitiveStep}
                fineStep={primitiveFineStep}
                coarseStep={primitiveCoarseStep}
                pageStep={primitivePageStep}
                precision={primitivePrecision}
                allowExpressions={primitiveAllowExpressions}
                selectAllOnFocus={primitiveSelectAllOnFocus}
                commitOnBlur={primitiveCommitOnBlur}
                scrubEnabled={primitiveScrubEnabled}
                scrubPixelsPerStep={primitiveScrubPixelsPerStep}
                scrubThreshold={primitiveScrubThreshold}
                pointerLockEnabled={primitivePointerLockEnabled}
                disabled={primitiveDisabled}
                readOnly={primitiveReadOnly}
                visualState={primitiveVisualState}
                size={primitiveSize}
                density={primitiveDensity}
              />
            )}
          </section>

          <aside className="border-t border-white/8 p-3 lg:min-h-0 lg:border-t-0 lg:p-4">
            <div className="h-full rounded-[24px] border border-white/8 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur lg:min-h-0">
              <ScrollArea className="h-full">
                <div className="space-y-6 p-4">
                  <PanelSection
                    title={activePage === 'plane' ? 'ColorPlane' : 'ColorInput'}
                    description={
                      activePage === 'plane'
                        ? 'Drag inside the color area and tune the plane from this properties rail.'
                        : 'Tune the centered input and its editing behavior from this rail.'
                    }
                  >
                    {activePage === 'plane' ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                        <div
                          className="size-12 shrink-0 rounded-xl border border-white/10"
                          style={{
                            backgroundColor: activeDisplayedSrgb,
                            background: activeDisplayedActive,
                          }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">
                            {activeDisplayedHex}
                          </div>
                          <div className="text-xs text-white/55">
                            {color.activeGamut === 'display-p3'
                              ? 'Display P3'
                              : 'sRGB'}{' '}
                            preview
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                          Current value
                        </div>
                        <div className="mt-1 font-mono text-lg text-white">
                          {formatPrimitiveValue(
                            primitiveValue,
                            primitivePrecision,
                          )}
                        </div>
                        <div className="mt-1 text-xs text-white/55">
                          {primitiveMin} to {primitiveMax} · {primitiveWrapMode}
                        </div>
                      </div>
                    )}
                  </PanelSection>

                  <Separator className="bg-white/8" />

                  {activePage === 'plane' ? (
                    <>
                      <PanelSection
                        title="Color"
                        description="Drive the current sample color."
                      >
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                              Hex
                            </p>
                            <ColorStringInput
                              format="hex"
                              className="ck-input"
                              requested={color.requested}
                              onChangeRequested={color.setRequested}
                              aria-label="Hex color input"
                            />
                          </div>

                          <div className="space-y-2">
                            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                              Hue
                            </p>
                            <ColorSlider
                              channel="h"
                              className="ck-slider ck-slider-v2"
                              data-color-space={hueRail.colorSpace}
                              requested={color.requested}
                              onChangeRequested={color.setRequested}
                              style={hueRail.style}
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <ColorInput
                              model="oklch"
                              channel="l"
                              className="ck-input"
                              requested={color.requested}
                              onChangeRequested={color.setRequested}
                              aria-label="Lightness input"
                            />
                            <ColorInput
                              model="oklch"
                              channel="c"
                              className="ck-input"
                              requested={color.requested}
                              onChangeRequested={color.setRequested}
                              aria-label="Chroma input"
                            />
                            <ColorInput
                              model="oklch"
                              channel="h"
                              className="ck-input"
                              requested={color.requested}
                              onChangeRequested={color.setRequested}
                              aria-label="Hue input"
                            />
                          </div>
                        </div>
                      </PanelSection>

                      <Separator className="bg-white/8" />

                      <PanelSection
                        title="Plane"
                        description="Change the displayed gamut and the axes mapped into the square."
                      >
                        <div className="space-y-3">
                          <SegmentedField
                            label="Preview gamut"
                            value={color.activeGamut}
                            onChange={(next) =>
                              color.setActiveGamut(next, 'programmatic')
                            }
                            options={[
                              { value: 'display-p3', label: 'P3' },
                              { value: 'srgb', label: 'sRGB' },
                            ]}
                          />
                          <SegmentedField
                            label="X axis"
                            value={axisState.x}
                            onChange={(next) => setAxis('x', next)}
                            options={[
                              { value: 'l', label: 'L' },
                              { value: 'c', label: 'C' },
                              { value: 'h', label: 'H' },
                            ]}
                          />
                          <SegmentedField
                            label="Y axis"
                            value={axisState.y}
                            onChange={(next) => setAxis('y', next)}
                            options={[
                              { value: 'l', label: 'L' },
                              { value: 'c', label: 'C' },
                              { value: 'h', label: 'H' },
                            ]}
                          />
                          <ToggleField
                            label="Repeat edge pixels"
                            checked={repeatEdgePixels}
                            onChange={setRepeatEdgePixels}
                          />
                          <ToggleField
                            label="Checkerboard background"
                            checked={checkerboard}
                            onChange={setCheckerboard}
                          />
                        </div>
                      </PanelSection>

                      <Separator className="bg-white/8" />

                      <PanelSection
                        title="Overlays"
                        description="Optional helpers for reading the active gamut geometry."
                      >
                        <div className="space-y-3">
                          <ToggleField
                            label="Display P3 boundary"
                            checked={showP3Boundary}
                            onChange={setShowP3Boundary}
                          />
                          <ToggleField
                            label="sRGB boundary"
                            checked={showSrgbBoundary}
                            onChange={setShowSrgbBoundary}
                          />
                          <ToggleField
                            label="Fallback points"
                            checked={showFallbackPoints}
                            onChange={setShowFallbackPoints}
                          />
                        </div>
                      </PanelSection>

                      <Separator className="bg-white/8" />

                      <PanelSection
                        title="Rendering"
                        description="Tune how aggressively the area optimizes pointer updates."
                      >
                        <SegmentedField
                          label="Performance profile"
                          value={performanceProfile}
                          onChange={setPerformanceProfile}
                          options={[
                            { value: 'auto', label: 'Auto' },
                            { value: 'quality', label: 'Quality' },
                            { value: 'balanced', label: 'Balanced' },
                            { value: 'performance', label: 'Perf' },
                          ]}
                        />
                      </PanelSection>
                    </>
                  ) : (
                    <>
                      <PanelSection
                        title="Input"
                        description="Plain value state for the centered input primitive."
                      >
                        <div className="space-y-3">
                          <NumberConfigField
                            label="Value"
                            value={primitiveValue}
                            onChange={setPrimitiveValue}
                            step={primitiveStep}
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <NumberConfigField
                              label="Min"
                              value={primitiveMin}
                              onChange={setPrimitiveMin}
                            />
                            <NumberConfigField
                              label="Max"
                              value={primitiveMax}
                              onChange={setPrimitiveMax}
                            />
                          </div>
                          <SegmentedField
                            label="Bounds"
                            value={primitiveWrapMode}
                            onChange={setPrimitiveWrapMode}
                            options={[
                              { value: 'clamp', label: 'Clamp' },
                              { value: 'wrap', label: 'Wrap' },
                              { value: 'free', label: 'Free' },
                            ]}
                          />
                          <SegmentedField
                            label="Precision"
                            value={primitivePrecision}
                            onChange={setPrimitivePrecision}
                            options={[
                              { value: 'auto', label: 'Auto' },
                              { value: '0', label: '0' },
                              { value: '1', label: '1' },
                              { value: '2', label: '2' },
                              { value: '3', label: '3' },
                            ]}
                          />
                        </div>
                      </PanelSection>

                      <Separator className="bg-white/8" />

                      <PanelSection
                        title="Stepping"
                        description="Configure keyboard and pointer step sizes."
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <NumberConfigField
                            label="Step"
                            value={primitiveStep}
                            onChange={setPrimitiveStep}
                            step={0.1}
                          />
                          <NumberConfigField
                            label="Fine"
                            value={primitiveFineStep}
                            onChange={setPrimitiveFineStep}
                            step={0.1}
                          />
                          <NumberConfigField
                            label="Coarse"
                            value={primitiveCoarseStep}
                            onChange={setPrimitiveCoarseStep}
                            step={1}
                          />
                          <NumberConfigField
                            label="Page"
                            value={primitivePageStep}
                            onChange={setPrimitivePageStep}
                            step={1}
                          />
                        </div>
                      </PanelSection>

                      <Separator className="bg-white/8" />

                      <PanelSection
                        title="Behavior"
                        description="Toggle text-entry affordances for the focused input."
                      >
                        <div className="space-y-3">
                          <ToggleField
                            label="Select all on focus"
                            checked={primitiveSelectAllOnFocus}
                            onChange={setPrimitiveSelectAllOnFocus}
                          />
                          <ToggleField
                            label="Allow expressions"
                            checked={primitiveAllowExpressions}
                            onChange={setPrimitiveAllowExpressions}
                          />
                          <ToggleField
                            label="Commit on blur"
                            checked={primitiveCommitOnBlur}
                            onChange={setPrimitiveCommitOnBlur}
                          />
                        </div>
                      </PanelSection>

                      <Separator className="bg-white/8" />

                      <PanelSection
                        title="Scrub"
                        description="Adjust how far the pointer moves per channel step."
                      >
                        <div className="space-y-3">
                          <ToggleField
                            label="Enable scrub handle"
                            checked={primitiveScrubEnabled}
                            onChange={setPrimitiveScrubEnabled}
                          />
                          <ToggleField
                            label="Use pointer lock"
                            checked={primitivePointerLockEnabled}
                            onChange={setPrimitivePointerLockEnabled}
                          />
                          <NumberConfigField
                            label="Drag threshold"
                            value={primitiveScrubThreshold}
                            onChange={setPrimitiveScrubThreshold}
                            step={1}
                          />
                          <SegmentedField
                            label="Drag step"
                            value={primitiveScrubMultiplier}
                            onChange={setPrimitiveScrubMultiplier}
                            options={[
                              { value: '1', label: '1' },
                              { value: '0.1', label: '0.1' },
                              { value: '0.01', label: '0.01' },
                            ]}
                          />
                        </div>
                      </PanelSection>

                      <Separator className="bg-white/8" />

                      <PanelSection
                        title="Visual State"
                        description="Preview primitive sizing and state variants."
                      >
                        <div className="space-y-3">
                          <SegmentedField
                            label="Size"
                            value={primitiveSize}
                            onChange={setPrimitiveSize}
                            options={[
                              { value: 'sm', label: 'Sm' },
                              { value: 'md', label: 'Md' },
                              { value: 'lg', label: 'Lg' },
                            ]}
                          />
                          <SegmentedField
                            label="Density"
                            value={primitiveDensity}
                            onChange={setPrimitiveDensity}
                            options={[
                              { value: 'compact', label: 'Compact' },
                              { value: 'comfortable', label: 'Comfort' },
                            ]}
                          />
                          <SegmentedField
                            label="Validity"
                            value={primitiveVisualState}
                            onChange={setPrimitiveVisualState}
                            options={[
                              { value: 'auto', label: 'Auto' },
                              { value: 'valid', label: 'Valid' },
                              { value: 'invalid', label: 'Invalid' },
                            ]}
                          />
                          <ToggleField
                            label="Disabled"
                            checked={primitiveDisabled}
                            onChange={setPrimitiveDisabled}
                          />
                          <ToggleField
                            label="Read only"
                            checked={primitiveReadOnly}
                            onChange={setPrimitiveReadOnly}
                          />
                        </div>
                      </PanelSection>
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
