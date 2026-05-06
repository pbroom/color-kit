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
  toP3Gamut,
  toSrgbGamut,
  type Color as ColorValue,
} from 'color-kit';
import {
  ArrowBigUp,
  ArrowLeftToLine,
  ArrowRightToLine,
  Check,
  ChevronsLeftRight,
  ChevronsRightLeft,
  DecimalsArrowRight,
  Diff,
  Menu,
  MousePointer2,
  Option,
  Radius,
  RotateCw,
} from 'lucide-react';
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
import {
  DynamicLucideIcon,
  LucideIconPicker,
} from '@/components/lucide-icon-picker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ThemeSwitcher } from '../components/theme-switcher.js';

type OutputGamut = 'display-p3' | 'srgb';
type LabPageKey = 'plane' | 'input' | 'tooltip';
type PrimitivePrecision = number;
type PrimitiveWrapMode = 'clamp' | 'wrap' | 'free';
type PrimitiveSize = 'sm' | 'md' | 'lg' | 'full';
type PrimitiveDensity = 'compact' | 'comfortable';
type PrimitiveVisualState = 'auto' | 'valid' | 'invalid';
type PrimitiveHandleContent = 'none' | 'letter' | 'icon' | 'swatch';
type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

const MAX_PRIMITIVE_PRECISION_DIGITS = 12;

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

const LAB_PAGES: Array<{
  value: LabPageKey;
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
  {
    value: 'tooltip',
    label: 'Tooltip',
  },
];

const TOOLTIP_DEMO_ITEMS: Array<{
  label: string;
  tooltip: string;
}> = [
  {
    label: 'Plane',
    tooltip: 'Show color-plane controls',
  },
  {
    label: 'Input',
    tooltip: 'Tune channel input behavior',
  },
  {
    label: 'Copy',
    tooltip: 'Copy the current value',
  },
  {
    label: 'Inspect',
    tooltip: 'Open inspector details',
  },
];

const TOOLTIP_SIDE_DEMO_ITEMS: Array<{
  side: TooltipSide;
  tooltip: string;
}> = [
  {
    side: 'top',
    tooltip: 'This tooltip opens above the trigger',
  },
  {
    side: 'right',
    tooltip: 'This tooltip opens to the right',
  },
  {
    side: 'bottom',
    tooltip: 'This tooltip opens below the trigger',
  },
  {
    side: 'left',
    tooltip: 'This tooltip opens to the left',
  },
];

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

function normalizePrimitivePrecision(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(
    MAX_PRIMITIVE_PRECISION_DIGITS,
    Math.max(0, Math.round(value)),
  );
}

function normalizePrimitiveScrubMultiplier(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1000, Math.max(0.01, Number(value.toFixed(4))));
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

function PropertyFieldTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="min-w-0">{children}</div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function SegmentedField<T extends string>({
  label,
  value,
  onChange,
  options,
  controlClassName = '',
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  controlClassName?: string;
  options: Array<{
    value: T;
    label: string;
    icon?: ReactNode;
    tooltip?: string;
  }>;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <ToggleGroup
        type="single"
        value={value}
        className={`box-border h-6 min-h-6 w-full justify-start gap-0 overflow-hidden rounded-[5px] border-0 bg-[#383838] p-0 shadow-none ${controlClassName}`}
        onValueChange={(next) => {
          if (next) {
            onChange(next as T);
          }
        }}
      >
        {options.map((option) => {
          const isSelected = value === option.value;

          return (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <span className="flex h-full min-w-0 flex-1">
                  <ToggleGroupItem
                    value={option.value}
                    className={`h-full min-h-0 w-full min-w-0 flex-1 rounded-[5px] border px-2 py-0 text-[11px] font-medium leading-4 tracking-[0.005em] transition-[background-color,color] hover:text-white/70 focus-visible:ring-2 focus-visible:ring-[#0d99ff]/80 focus-visible:ring-offset-0 data-[state=on]:bg-[#1f1f1f] data-[state=on]:shadow-none ${
                      isSelected
                        ? 'border-[#4C4C4C] bg-[#1f1f1f] text-white/90 shadow-none'
                        : 'border-transparent bg-transparent text-white/50 shadow-none'
                    }`}
                    aria-label={`${label}: ${option.label}`}
                  >
                    {option.icon ? (
                      <span className="flex size-3.5 items-center justify-center text-current">
                        {option.icon}
                      </span>
                    ) : (
                      <span>{option.label}</span>
                    )}
                  </ToggleGroupItem>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="pointer-events-none">
                {option.tooltip ?? `${label}: ${option.label}`}
              </TooltipContent>
            </Tooltip>
          );
        })}
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
    <label className="flex min-h-6 items-center gap-2 py-1 text-[11px] font-medium leading-4 tracking-[0.005em] text-white/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-[#4C4C4C] bg-[#383838] text-white transition-[background-color,border-color] peer-checked:border-[#007be5] peer-checked:bg-[#0d99ff] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0d99ff]/80"
      >
        {checked ? (
          <Check aria-hidden="true" className="size-3" strokeWidth={3} />
        ) : null}
      </span>
      <span>{label}</span>
    </label>
  );
}

function PagesPanel({
  activePage,
  onPageChange,
}: {
  activePage: LabPageKey;
  onPageChange: (page: LabPageKey) => void;
}) {
  const [isSiteNavOpen, setIsSiteNavOpen] = useState(false);

  return (
    <div className="absolute left-4 top-4 z-20 w-[250px]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={
            isSiteNavOpen ? 'Hide site navigation' : 'Show site navigation'
          }
          aria-expanded={isSiteNavOpen}
          aria-controls="lab-site-nav"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl text-white/65 outline-none transition-[background-color,color] hover:bg-white/8 hover:text-white focus-visible:ring-2 focus-visible:ring-[#5288db]"
          onClick={() => setIsSiteNavOpen((current) => !current)}
        >
          <Menu aria-hidden="true" className="size-4" />
        </button>
        <Link
          to="/"
          className="flex min-w-0 items-center rounded-lg px-1 py-1 font-[var(--font-brand)] text-[15px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#5288db]"
        >
          <span className="truncate">color kit</span>
        </Link>
        <div className="ml-auto [&_[data-slot=button]]:size-8 [&_[data-slot=button]]:min-h-8 [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:text-white/65 [&_[data-slot=button]]:hover:bg-white/8 [&_[data-slot=button]]:hover:text-white">
          <ThemeSwitcher />
        </div>
      </div>
      <nav
        id="lab-site-nav"
        aria-label="Site navigation"
        className="mt-3"
        hidden={!isSiteNavOpen}
      >
        <div className="space-y-0.5">
          {[
            { label: 'Docs', to: '/docs/introduction' },
            { label: 'Components', to: '/docs/components/color-area' },
            { label: 'Registry', to: '/docs/shadcn-registry' },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex w-full items-center rounded-lg px-1 py-1.5 text-left text-sm font-medium text-white/55 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#5288db]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="mt-3 space-y-0.5">
        {LAB_PAGES.map((page) => {
          const isActive = activePage === page.value;
          return (
            <button
              key={page.value}
              type="button"
              className={`flex w-full items-center rounded-lg px-1 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#5288db] ${
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

function LabHeaderExit() {
  return (
    <div
      aria-hidden="true"
      className="ck-lab-header-exit pointer-events-none fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl [animation:ck-lab-header-slide-up_320ms_ease-out_forwards]"
    >
      <div className="mx-auto flex h-14 w-full max-w-[1560px] items-center justify-between gap-4 px-4">
        <div className="docs-brand">
          <span className="docs-brand-dot" />
          Color Kit
        </div>
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
    <PropertyFieldTooltip label={label}>
      <label className="block space-y-1.5">
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
    </PropertyFieldTooltip>
  );
}

function TextConfigField({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label className="block space-y-2">
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          {label}
        </span>
        <input
          type="text"
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-full rounded-[4px] border border-transparent bg-[#383838] px-2 text-[11px] font-medium text-white outline-none transition-[border-color] hover:border-[#4C4C4C] focus:border-[#5288db]"
        />
      </label>
    </PropertyFieldTooltip>
  );
}

function PrecisionConfigInput({
  value,
  onChange,
}: {
  value: PrimitivePrecision;
  onChange: (value: PrimitivePrecision) => void;
}) {
  return (
    <PropertyFieldTooltip label="Precision">
      <label className="space-y-2">
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          Precision
        </span>
        <PrimitiveValueInput
          value={value}
          onValueChange={(nextValue) =>
            onChange(normalizePrimitivePrecision(nextValue))
          }
          ariaLabel="Precision"
          leadingElement={
            <DecimalsArrowRight
              aria-hidden="true"
              className="size-3"
              strokeWidth={1.75}
            />
          }
          min={0}
          max={MAX_PRIMITIVE_PRECISION_DIGITS}
          wrapMode="clamp"
          step={1}
          fineStep={1}
          coarseStep={2}
          pageStep={3}
          precision={0}
          autoTrim
          allowExpressions={false}
          selectAllOnFocus
          commitOnBlur
          scrubEnabled
          scrubPixelsPerStep={1}
          scrubThreshold={1}
          pointerLockEnabled={false}
          disabled={false}
          readOnly={false}
          visualState="auto"
          size="full"
        />
      </label>
    </PropertyFieldTooltip>
  );
}

function StepConfigInput({
  label,
  value,
  onValueChange,
  leadingElement,
  step,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  leadingElement: ReactNode;
  step: number;
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label className="block">
        <PrimitiveValueInput
          value={value}
          onValueChange={onValueChange}
          ariaLabel={label}
          leadingElement={leadingElement}
          min={0}
          max={1000}
          wrapMode="free"
          step={step}
          fineStep={step / 10}
          coarseStep={step * 10}
          pageStep={step * 10}
          precision={6}
          autoTrim
          allowExpressions
          selectAllOnFocus
          commitOnBlur
          scrubEnabled
          scrubPixelsPerStep={1}
          scrubThreshold={1}
          pointerLockEnabled={false}
          disabled={false}
          readOnly={false}
          visualState="auto"
          size="full"
        />
      </label>
    </PropertyFieldTooltip>
  );
}

function DragStepConfigInput({
  value,
  onValueChange,
}: {
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <PropertyFieldTooltip label="Drag step">
      <label className="block">
        <PrimitiveValueInput
          value={value}
          onValueChange={(nextValue) =>
            onValueChange(normalizePrimitiveScrubMultiplier(nextValue))
          }
          ariaLabel="Drag step"
          leadingElement={
            <MousePointer2
              aria-hidden="true"
              className="size-3"
              strokeWidth={1.75}
            />
          }
          min={0.01}
          max={1000}
          wrapMode="clamp"
          step={0.01}
          fineStep={0.001}
          coarseStep={0.1}
          pageStep={1}
          precision={4}
          autoTrim
          allowExpressions
          selectAllOnFocus
          commitOnBlur
          scrubEnabled
          scrubPixelsPerStep={1}
          scrubThreshold={1}
          pointerLockEnabled={false}
          disabled={false}
          readOnly={false}
          visualState="auto"
          size="full"
        />
      </label>
    </PropertyFieldTooltip>
  );
}

function BoundsConfigInput({
  label,
  value,
  onValueChange,
  leadingElement,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  leadingElement: ReactNode;
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label className="block">
        <PrimitiveValueInput
          value={value}
          onValueChange={onValueChange}
          ariaLabel={label}
          leadingElement={leadingElement}
          min={-1000}
          max={1000}
          wrapMode="free"
          step={1}
          fineStep={0.1}
          coarseStep={10}
          pageStep={10}
          precision={6}
          autoTrim
          allowExpressions
          selectAllOnFocus
          commitOnBlur
          scrubEnabled
          scrubPixelsPerStep={1}
          scrubThreshold={1}
          pointerLockEnabled={false}
          disabled={false}
          readOnly={false}
          visualState="auto"
          size="full"
        />
      </label>
    </PropertyFieldTooltip>
  );
}

function DragThresholdConfigInput({
  value,
  onValueChange,
}: {
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <PropertyFieldTooltip label="Drag threshold">
      <label className="block">
        <PrimitiveValueInput
          value={value}
          onValueChange={onValueChange}
          ariaLabel="Drag threshold"
          leadingElement={
            <Radius aria-hidden="true" className="size-3" strokeWidth={1.75} />
          }
          min={0}
          max={1000}
          wrapMode="clamp"
          step={1}
          fineStep={0.1}
          coarseStep={10}
          pageStep={10}
          precision={6}
          autoTrim
          allowExpressions
          selectAllOnFocus
          commitOnBlur
          scrubEnabled
          scrubPixelsPerStep={1}
          scrubThreshold={1}
          pointerLockEnabled={false}
          disabled={false}
          readOnly={false}
          visualState="auto"
          size="full"
        />
      </label>
    </PropertyFieldTooltip>
  );
}

interface PrimitiveValueInputProps {
  value: number;
  onValueChange: (value: number) => void;
  ariaLabel?: string;
  placeholder?: string;
  leadingElement?: ReactNode;
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
  size: PrimitiveSize;
  density?: PrimitiveDensity;
}

interface PrimitiveInputSelectionSnapshot {
  start: number;
  end: number;
  direction: HTMLInputElement['selectionDirection'];
}

function PrimitiveValueInput({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  leadingElement = 'V',
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
  size,
  density = 'compact',
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

  const endScrub = useCallback(
    (clientX = lastScrubXRef.current, shiftKey?: boolean, altKey?: boolean) => {
      if (activePointerIdRef.current !== null && hasDragStartedRef.current) {
        const activeStep =
          shiftKey === undefined || altKey === undefined
            ? activeScrubStepRef.current
            : getModifiedStep(shiftKey, altKey);
        activeScrubStepRef.current = activeStep;
        const deltaPixels = clientX - scrubStartXRef.current;
        const wholeDeltaPixels = Math.round(deltaPixels);
        const pixelsPerStep = scrubPixelsPerStep > 0 ? scrubPixelsPerStep : 1;
        commitValue(
          scrubStartValueRef.current +
            (wholeDeltaPixels / pixelsPerStep) * activeStep,
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
      getModifiedStep,
      hasPointerLock,
      scheduleClearPreservedSelection,
      scrubPixelsPerStep,
    ],
  );

  const queueScrubValue = useCallback(
    (clientX: number, shiftKey: boolean, altKey: boolean) => {
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
      const activeStep = getModifiedStep(shiftKey, altKey);
      activeScrubStepRef.current = activeStep;
      const wholeDeltaPixels = Math.round(deltaPixels);
      const pixelsPerStep = scrubPixelsPerStep > 0 ? scrubPixelsPerStep : 1;
      commitValue(
        scrubStartValueRef.current +
          (wholeDeltaPixels / pixelsPerStep) * activeStep,
      );
    },
    [commitValue, getModifiedStep, scrubPixelsPerStep, scrubThreshold],
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
      activeScrubStepRef.current = getModifiedStep(
        event.shiftKey,
        event.altKey,
      );
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
      getModifiedStep,
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
      queueScrubValue(event.clientX, event.shiftKey, event.altKey);
    },
    [hasPointerLock, queueScrubValue],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerId !== activePointerIdRef.current) {
        return;
      }
      endScrub(
        hasPointerLock() ? lastScrubXRef.current : event.clientX,
        event.shiftKey,
        event.altKey,
      );
    },
    [endScrub, hasPointerLock],
  );

  useEffect(() => {
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

  const borderColor = showInvalidState
    ? '#ff4e4e'
    : isScrubbing
      ? '#97c1ef'
      : isEditing
        ? '#5288db'
        : isHovered
          ? '#4C4C4C'
          : 'transparent';
  const hasLeadingElement =
    leadingElement !== null &&
    leadingElement !== undefined &&
    leadingElement !== false;

  return (
    <div
      className={`relative box-border flex items-center rounded-[4px] border bg-[#383838] p-0 font-sans text-white ${
        PRIMITIVE_SIZE_CLASS[size]
      } ${PRIMITIVE_DENSITY_CLASS[density]} ${disabled ? 'opacity-45' : ''}`}
      style={{ borderColor }}
      data-scrubbing={isScrubbing || undefined}
      data-valid={isVisuallyValid || undefined}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      {scrubEnabled ? (
        <div
          ref={scrubHandleRef}
          aria-hidden="true"
          className={
            hasLeadingElement
              ? 'flex h-full w-6 shrink-0 cursor-ew-resize select-none items-center justify-center font-medium tabular-nums text-white/55'
              : 'absolute -left-0.5 top-0 z-10 h-full w-[5px] cursor-ew-resize select-none'
          }
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => endScrub()}
          onLostPointerCapture={() => {
            if (!hasPointerLock()) endScrub();
          }}
        >
          {leadingElement}
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="text"
        value={currentValue}
        disabled={disabled}
        readOnly={readOnly}
        aria-label={ariaLabel}
        aria-invalid={showInvalidState || (isEditing && !isDraftValid)}
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
    </div>
  );
}

function TooltipPlaygroundStage({
  delayDuration,
  skipDelayDuration,
  side,
}: {
  delayDuration: number;
  skipDelayDuration: number;
  side: TooltipSide;
}) {
  return (
    <TooltipProvider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
    >
      <div className="relative flex w-full max-w-xl flex-col items-center gap-8 rounded-[28px] border border-white/8 bg-black/20 px-8 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium text-white">Tooltip handoff lab</p>
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-white/55">
            Hover the buttons left to right, then pause and enter again. The
            first and final tooltip animate; handoffs stay immediate.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {TOOLTIP_DEMO_ITEMS.map((item) => (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/75 outline-none transition-[background-color,border-color,color] hover:border-white/20 hover:bg-white/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
                >
                  {item.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side={side}>{item.tooltip}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="space-y-3 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
            Fixed placement samples
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {TOOLTIP_SIDE_DEMO_ITEMS.map((item) => (
              <Tooltip key={item.side}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="h-9 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-medium capitalize text-white/65 outline-none transition-[background-color,border-color,color] hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
                  >
                    {item.side}
                  </button>
                </TooltipTrigger>
                <TooltipContent side={item.side}>{item.tooltip}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function LabPage() {
  const color = useColor({
    defaultColor: 'oklch(0.64 0.24 28)',
    defaultGamut: 'display-p3',
  });
  const [activePage, setActivePage] = useState<LabPageKey>('plane');
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
  const primitivePageStep = 10;
  const [primitivePrecision, setPrimitivePrecision] =
    useState<PrimitivePrecision>(3);
  const [primitiveAutoTrim, setPrimitiveAutoTrim] = useState(true);
  const [primitiveAllowExpressions, setPrimitiveAllowExpressions] =
    useState(true);
  const [primitiveSelectAllOnFocus, setPrimitiveSelectAllOnFocus] =
    useState(true);
  const [primitiveCommitOnBlur, setPrimitiveCommitOnBlur] = useState(true);
  const [
    primitiveHorizontalArrowKeysMoveCaret,
    setPrimitiveHorizontalArrowKeysMoveCaret,
  ] = useState(true);
  const [primitiveScrubEnabled, setPrimitiveScrubEnabled] = useState(true);
  const [primitivePointerLockEnabled, setPrimitivePointerLockEnabled] =
    useState(true);
  const [primitiveScrubThreshold, setPrimitiveScrubThreshold] = useState(2);
  const [primitiveScrubMultiplier, setPrimitiveScrubMultiplier] = useState(1);
  const [primitiveHandleContent, setPrimitiveHandleContent] =
    useState<PrimitiveHandleContent>('letter');
  const [primitiveHandleLetter, setPrimitiveHandleLetter] = useState('V');
  const [primitiveHandleLucideSlug, setPrimitiveHandleLucideSlug] =
    useState('mouse-pointer-2');
  const [primitiveDisabled, setPrimitiveDisabled] = useState(false);
  const [primitiveReadOnly, setPrimitiveReadOnly] = useState(false);
  const [primitiveVisualState, setPrimitiveVisualState] =
    useState<PrimitiveVisualState>('auto');
  const primitiveSize: PrimitiveSize = 'sm';
  const [primitiveDensity, setPrimitiveDensity] =
    useState<PrimitiveDensity>('compact');
  const [tooltipSide, setTooltipSide] = useState<TooltipSide>('top');
  const [tooltipDelayDuration, setTooltipDelayDuration] = useState(1000);
  const [tooltipSkipDelayDuration, setTooltipSkipDelayDuration] = useState(300);
  const [primitivePlaceholder, setPrimitivePlaceholder] = useState('0');

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
    1 / normalizePrimitiveScrubMultiplier(primitiveScrubMultiplier);

  const primitiveHandleElement = useMemo<ReactNode>(() => {
    switch (primitiveHandleContent) {
      case 'none':
        return null;
      case 'letter':
        return primitiveHandleLetter.trim().slice(0, 2);
      case 'icon':
        return (
          <DynamicLucideIcon
            slug={primitiveHandleLucideSlug}
            className="size-3"
            strokeWidth={1.75}
          />
        );
      case 'swatch':
        return (
          <span
            aria-hidden="true"
            className="size-3 rounded-[3px] border border-white/20 bg-[conic-gradient(from_180deg,#ff5f6d,#ffc371,#47d16c,#4cc9f0,#845ef7,#ff5f6d)]"
          />
        );
    }
  }, [
    primitiveHandleContent,
    primitiveHandleLucideSlug,
    primitiveHandleLetter,
  ]);

  return (
    <div className="min-h-screen overflow-hidden bg-[#171717]">
      <LabHeaderExit />

      <main className="h-screen min-h-screen bg-[#171717] text-white lg:overflow-hidden">
        <div className="grid min-h-screen grid-cols-1 lg:h-full lg:grid-cols-[minmax(0,1fr)_300px]">
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
            ) : activePage === 'input' ? (
              <PrimitiveValueInput
                value={primitiveValue}
                onValueChange={setPrimitiveValue}
                placeholder={primitivePlaceholder}
                leadingElement={primitiveHandleElement}
                min={primitiveMin}
                max={primitiveMax}
                wrapMode={primitiveWrapMode}
                step={primitiveStep}
                fineStep={primitiveFineStep}
                coarseStep={primitiveCoarseStep}
                pageStep={primitivePageStep}
                precision={primitivePrecision}
                autoTrim={primitiveAutoTrim}
                allowExpressions={primitiveAllowExpressions}
                selectAllOnFocus={primitiveSelectAllOnFocus}
                commitOnBlur={primitiveCommitOnBlur}
                scrubEnabled={primitiveScrubEnabled}
                scrubPixelsPerStep={primitiveScrubPixelsPerStep}
                scrubThreshold={primitiveScrubThreshold}
                pointerLockEnabled={primitivePointerLockEnabled}
                horizontalArrowKeysMoveCaret={
                  primitiveHorizontalArrowKeysMoveCaret
                }
                disabled={primitiveDisabled}
                readOnly={primitiveReadOnly}
                visualState={primitiveVisualState}
                size={primitiveSize}
                density={primitiveDensity}
              />
            ) : (
              <TooltipPlaygroundStage
                delayDuration={tooltipDelayDuration}
                skipDelayDuration={tooltipSkipDelayDuration}
                side={tooltipSide}
              />
            )}
          </section>

          <aside className="border-t border-white/8 p-3 lg:min-h-0 lg:border-t-0 lg:p-4">
            <div className="h-full rounded-[24px] border border-white/8 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur lg:min-h-0">
              <ScrollArea className="h-full">
                <TooltipProvider>
                  <div className="space-y-6 p-4">
                    {activePage === 'plane' ? (
                      <>
                        <PanelSection
                          title="Color"
                          description="Drive the current sample color."
                        >
                          <div className="space-y-3">
                            <PropertyFieldTooltip label="Hex">
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
                            </PropertyFieldTooltip>

                            <PropertyFieldTooltip label="Hue">
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
                            </PropertyFieldTooltip>

                            <div className="grid grid-cols-3 gap-3">
                              <PropertyFieldTooltip label="Lightness">
                                <ColorInput
                                  model="oklch"
                                  channel="l"
                                  className="ck-input"
                                  requested={color.requested}
                                  onChangeRequested={color.setRequested}
                                  aria-label="Lightness input"
                                />
                              </PropertyFieldTooltip>
                              <PropertyFieldTooltip label="Chroma">
                                <ColorInput
                                  model="oklch"
                                  channel="c"
                                  className="ck-input"
                                  requested={color.requested}
                                  onChangeRequested={color.setRequested}
                                  aria-label="Chroma input"
                                />
                              </PropertyFieldTooltip>
                              <PropertyFieldTooltip label="Hue">
                                <ColorInput
                                  model="oklch"
                                  channel="h"
                                  className="ck-input"
                                  requested={color.requested}
                                  onChangeRequested={color.setRequested}
                                  aria-label="Hue input"
                                />
                              </PropertyFieldTooltip>
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
                            <div className="grid grid-cols-2 gap-3">
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
                            </div>
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
                    ) : activePage === 'input' ? (
                      <>
                        <PanelSection title="Input">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <PropertyFieldTooltip label="Value">
                                <label className="block space-y-2">
                                  <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                                    Value
                                  </span>
                                  <PrimitiveValueInput
                                    value={primitiveValue}
                                    onValueChange={setPrimitiveValue}
                                    ariaLabel="Value"
                                    placeholder={primitivePlaceholder}
                                    leadingElement={primitiveHandleElement}
                                    min={primitiveMin}
                                    max={primitiveMax}
                                    wrapMode={primitiveWrapMode}
                                    step={primitiveStep}
                                    fineStep={primitiveFineStep}
                                    coarseStep={primitiveCoarseStep}
                                    pageStep={primitivePageStep}
                                    precision={primitivePrecision}
                                    autoTrim={primitiveAutoTrim}
                                    allowExpressions={primitiveAllowExpressions}
                                    selectAllOnFocus={primitiveSelectAllOnFocus}
                                    commitOnBlur={primitiveCommitOnBlur}
                                    scrubEnabled={primitiveScrubEnabled}
                                    scrubPixelsPerStep={
                                      primitiveScrubPixelsPerStep
                                    }
                                    scrubThreshold={primitiveScrubThreshold}
                                    pointerLockEnabled={
                                      primitivePointerLockEnabled
                                    }
                                    horizontalArrowKeysMoveCaret={
                                      primitiveHorizontalArrowKeysMoveCaret
                                    }
                                    disabled={primitiveDisabled}
                                    readOnly={primitiveReadOnly}
                                    visualState={primitiveVisualState}
                                    size="full"
                                  />
                                </label>
                              </PropertyFieldTooltip>
                              <TextConfigField
                                label="Placeholder"
                                value={primitivePlaceholder}
                                onChange={setPrimitivePlaceholder}
                                maxLength={12}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <BoundsConfigInput
                                label="Min"
                                value={primitiveMin}
                                onValueChange={setPrimitiveMin}
                                leadingElement={
                                  <ArrowLeftToLine
                                    aria-hidden="true"
                                    className="size-3"
                                    strokeWidth={1.75}
                                  />
                                }
                              />
                              <BoundsConfigInput
                                label="Max"
                                value={primitiveMax}
                                onValueChange={setPrimitiveMax}
                                leadingElement={
                                  <ArrowRightToLine
                                    aria-hidden="true"
                                    className="size-3"
                                    strokeWidth={1.75}
                                  />
                                }
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <PrecisionConfigInput
                                value={primitivePrecision}
                                onChange={setPrimitivePrecision}
                              />
                              <SegmentedField
                                label="Bounds"
                                value={primitiveWrapMode}
                                onChange={setPrimitiveWrapMode}
                                controlClassName="translate-y-px"
                                options={[
                                  {
                                    value: 'clamp',
                                    label: 'Clamp',
                                    icon: (
                                      <ChevronsRightLeft
                                        aria-hidden="true"
                                        className="size-3.5"
                                        strokeWidth={1.75}
                                      />
                                    ),
                                    tooltip: 'Clamp values',
                                  },
                                  {
                                    value: 'wrap',
                                    label: 'Wrap',
                                    icon: (
                                      <RotateCw
                                        aria-hidden="true"
                                        className="size-3.5"
                                        strokeWidth={1.75}
                                      />
                                    ),
                                    tooltip: 'Wrap values',
                                  },
                                  {
                                    value: 'free',
                                    label: 'Free',
                                    icon: (
                                      <ChevronsLeftRight
                                        aria-hidden="true"
                                        className="size-3.5"
                                        strokeWidth={1.75}
                                      />
                                    ),
                                    tooltip: 'Unbounded values',
                                  },
                                ]}
                              />
                            </div>
                          </div>
                        </PanelSection>

                        <Separator className="bg-white/8" />

                        <PanelSection
                          title="Drag Handle"
                          description="Choose what appears inside the scrub handle."
                        >
                          <div className="space-y-3">
                            <SegmentedField
                              label="Content"
                              value={primitiveHandleContent}
                              onChange={setPrimitiveHandleContent}
                              options={[
                                { value: 'none', label: 'None' },
                                { value: 'letter', label: 'Letter' },
                                { value: 'icon', label: 'Icon' },
                                { value: 'swatch', label: 'Swatch' },
                              ]}
                            />
                            {primitiveHandleContent === 'letter' ? (
                              <TextConfigField
                                label="Letter"
                                value={primitiveHandleLetter}
                                onChange={setPrimitiveHandleLetter}
                                maxLength={2}
                              />
                            ) : null}
                            {primitiveHandleContent === 'icon' ? (
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                                  Icon
                                </p>
                                <LucideIconPicker
                                  value={primitiveHandleLucideSlug}
                                  onChange={setPrimitiveHandleLucideSlug}
                                />
                              </div>
                            ) : null}
                          </div>
                        </PanelSection>

                        <Separator className="bg-white/8" />

                        <PanelSection title="Stepping">
                          <div className="grid grid-cols-2 gap-3">
                            <StepConfigInput
                              label="Step"
                              value={primitiveStep}
                              onValueChange={setPrimitiveStep}
                              leadingElement={
                                <Diff
                                  aria-hidden="true"
                                  className="size-3"
                                  strokeWidth={1.75}
                                />
                              }
                              step={0.1}
                            />
                            <DragStepConfigInput
                              value={primitiveScrubMultiplier}
                              onValueChange={setPrimitiveScrubMultiplier}
                            />
                            <StepConfigInput
                              label="Fine"
                              value={primitiveFineStep}
                              onValueChange={setPrimitiveFineStep}
                              leadingElement={
                                <Option
                                  aria-hidden="true"
                                  className="size-3"
                                  strokeWidth={1.75}
                                />
                              }
                              step={0.1}
                            />
                            <StepConfigInput
                              label="Coarse"
                              value={primitiveCoarseStep}
                              onValueChange={setPrimitiveCoarseStep}
                              leadingElement={
                                <ArrowBigUp
                                  aria-hidden="true"
                                  className="size-3"
                                  strokeWidth={1.75}
                                />
                              }
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
                            <ToggleField
                              label="Horizontal arrows move caret"
                              checked={primitiveHorizontalArrowKeysMoveCaret}
                              onChange={
                                setPrimitiveHorizontalArrowKeysMoveCaret
                              }
                            />
                            <ToggleField
                              label="Trim trailing zeros"
                              checked={primitiveAutoTrim}
                              onChange={setPrimitiveAutoTrim}
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
                            <DragThresholdConfigInput
                              value={primitiveScrubThreshold}
                              onValueChange={setPrimitiveScrubThreshold}
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
                    ) : (
                      <>
                        <PanelSection
                          title="Timing"
                          description="Tune the Radix initial hover delay and the cooldown window that marks tooltip handoffs."
                        >
                          <div className="space-y-3">
                            <NumberConfigField
                              label="Initial delay"
                              value={tooltipDelayDuration}
                              onChange={setTooltipDelayDuration}
                              step={50}
                            />
                            <NumberConfigField
                              label="Handoff cooldown"
                              value={tooltipSkipDelayDuration}
                              onChange={setTooltipSkipDelayDuration}
                              step={50}
                            />
                          </div>
                        </PanelSection>

                        <Separator className="bg-white/8" />

                        <PanelSection
                          title="Placement"
                          description="Move the tooltip around each trigger while preserving the same handoff behavior."
                        >
                          <SegmentedField
                            label="Side"
                            value={tooltipSide}
                            onChange={setTooltipSide}
                            options={[
                              { value: 'top', label: 'Top' },
                              { value: 'right', label: 'Right' },
                              { value: 'bottom', label: 'Bottom' },
                              { value: 'left', label: 'Left' },
                            ]}
                          />
                        </PanelSection>
                      </>
                    )}
                  </div>
                </TooltipProvider>
              </ScrollArea>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
