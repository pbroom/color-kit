import {
  Background,
  ColorApi,
  ColorArea,
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
  ArrowBigDown,
  ArrowBigUp,
  Bell,
  Blend,
  Bookmark,
  Box,
  BringToFront,
  Brush,
  Calendar,
  Camera,
  ChevronDown,
  ArrowLeftToLine,
  ArrowRightToLine,
  Braces,
  Check,
  Circle,
  Clipboard,
  Clock,
  Code,
  Command,
  Compass,
  Copy,
  DecimalsArrowRight,
  Diff,
  Download,
  Eye,
  FileText,
  Filter,
  Flag,
  Folder,
  Gauge,
  Grid3X3,
  Heart,
  Image,
  Infinity as InfinityIcon,
  Info,
  Layers,
  LinkIcon,
  Lock,
  Mail,
  Menu,
  MousePointer2,
  Option,
  Palette,
  Pencil,
  Pipette,
  Play,
  Plus,
  Radius,
  RefreshCw,
  RotateCw,
  Save,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import {
  Fragment,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ThemeSwitcher } from '../components/theme-switcher.js';

type OutputGamut = 'display-p3' | 'srgb';
type LabPageKey =
  | 'plane'
  | 'input'
  | 'inputMulti'
  | 'tooltip'
  | 'menu'
  | 'select'
  | 'toggleButton'
  | 'toggle';
type PrimitivePrecision = number;
type PrimitiveWrapMode = 'clamp' | 'wrap' | 'free';
type PrimitiveSize = 'sm' | 'md' | 'lg' | 'full';
type PrimitiveDensity = 'compact' | 'comfortable';
type PrimitiveVisualState = 'auto' | 'valid' | 'invalid';
type PrimitiveVisualTreatment = 'default' | 'embedded';
type PrimitiveHandleContent = 'none' | 'letter' | 'icon' | 'swatch';
type PrimitiveHandleSide = 'leading' | 'trailing';
type PrimitiveAccessoryKind = 'none' | 'icon' | 'label';
type MultiInputFieldId = 'l' | 'c' | 'h' | 'a';
type MultiInputConfig = Record<
  MultiInputFieldId,
  {
    min: number;
    max: number;
    step: number;
    fineStep: number;
    coarseStep: number;
    pageStep: number;
    precision: PrimitivePrecision;
    autoTrim: boolean;
    wrapMode: PrimitiveWrapMode;
    disabled: boolean;
  }
>;
type TooltipSide = 'top' | 'right' | 'bottom' | 'left';
type ToggleButtonSelectionState = 'off' | 'on';
type ToggleButtonInteractionState = 'default' | 'hovered' | 'pressedDown';
type ToggleButtonContent = 'iconOnly' | 'iconLabel' | 'label';
type ToggleGroupIconMode = 'none' | 'leading' | 'trailing' | 'iconOnly';
type SelectTriggerContent = 'icon' | 'iconText' | 'text';
type SelectTriggerIconTextPlacement = 'leading' | 'trailing' | 'both';
type SelectTriggerBehavior = 'press' | 'release';
type SelectOptionId =
  | 'copy'
  | 'pasteAs'
  | 'selectLayer'
  | 'bringToFront'
  | 'groupSelection';

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
    value: 'inputMulti',
    label: 'Input Multi',
  },
  {
    value: 'tooltip',
    label: 'Tooltip',
  },
  {
    value: 'menu',
    label: 'Menu',
  },
  {
    value: 'select',
    label: 'Select',
  },
  {
    value: 'toggleButton',
    label: 'Toggle Button',
  },
  {
    value: 'toggle',
    label: 'Toggle Group',
  },
];

const TOOLTIP_RAPID_TRIGGER_ITEMS: Array<{
  name: string;
  Icon: LucideIcon;
}> = [
  { name: 'Bell', Icon: Bell },
  { name: 'Blend', Icon: Blend },
  { name: 'Bookmark', Icon: Bookmark },
  { name: 'Box', Icon: Box },
  { name: 'Brush', Icon: Brush },
  { name: 'Calendar', Icon: Calendar },
  { name: 'Camera', Icon: Camera },
  { name: 'Check', Icon: Check },
  { name: 'Circle', Icon: Circle },
  { name: 'Clipboard', Icon: Clipboard },
  { name: 'Clock', Icon: Clock },
  { name: 'Code', Icon: Code },
  { name: 'Command', Icon: Command },
  { name: 'Compass', Icon: Compass },
  { name: 'Copy', Icon: Copy },
  { name: 'Diff', Icon: Diff },
  { name: 'Download', Icon: Download },
  { name: 'Eye', Icon: Eye },
  { name: 'File Text', Icon: FileText },
  { name: 'Filter', Icon: Filter },
  { name: 'Flag', Icon: Flag },
  { name: 'Folder', Icon: Folder },
  { name: 'Gauge', Icon: Gauge },
  { name: 'Grid', Icon: Grid3X3 },
  { name: 'Heart', Icon: Heart },
  { name: 'Image', Icon: Image },
  { name: 'Info', Icon: Info },
  { name: 'Layers', Icon: Layers },
  { name: 'Link', Icon: LinkIcon },
  { name: 'Lock', Icon: Lock },
  { name: 'Mail', Icon: Mail },
  { name: 'Menu', Icon: Menu },
  { name: 'Mouse Pointer', Icon: MousePointer2 },
  { name: 'Option', Icon: Option },
  { name: 'Palette', Icon: Palette },
  { name: 'Pencil', Icon: Pencil },
  { name: 'Pipette', Icon: Pipette },
  { name: 'Play', Icon: Play },
  { name: 'Plus', Icon: Plus },
  { name: 'Radius', Icon: Radius },
  { name: 'Refresh', Icon: RefreshCw },
  { name: 'Rotate', Icon: RotateCw },
  { name: 'Save', Icon: Save },
  { name: 'Search', Icon: Search },
  { name: 'Settings', Icon: Settings },
  { name: 'Share', Icon: Share2 },
  { name: 'Sliders', Icon: SlidersHorizontal },
  { name: 'Sparkles', Icon: Sparkles },
  { name: 'Star', Icon: Star },
];

const TOOLTIP_SIDE_DEMO_ITEMS: Array<{
  side: TooltipSide;
  tooltip: string;
}> = [
  {
    side: 'bottom',
    tooltip: 'This tooltip opens below the trigger',
  },
  {
    side: 'left',
    tooltip: 'This tooltip opens to the left',
  },
  {
    side: 'top',
    tooltip: 'This tooltip opens above the trigger',
  },
  {
    side: 'right',
    tooltip: 'This tooltip opens to the right',
  },
];

const TOGGLE_GROUP_ITEMS = [
  {
    value: 'plane',
    label: 'Plane',
    icon: <Option aria-hidden="true" className="size-3.5" strokeWidth={1.75} />,
  },
  {
    value: 'input',
    label: 'Input',
    icon: (
      <MousePointer2
        aria-hidden="true"
        className="size-3.5"
        strokeWidth={1.75}
      />
    ),
  },
  {
    value: 'copy',
    label: 'Copy',
    icon: <Diff aria-hidden="true" className="size-3.5" strokeWidth={1.75} />,
  },
];

const TOGGLE_BUTTON_ICON = (
  <svg
    aria-hidden="true"
    className="size-3.5"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="1.5"
  >
    <path d="M4.5 2.5H2.5v2" />
    <path d="M9.5 2.5h2v2" />
    <path d="M11.5 9.5v2h-2" />
    <path d="M2.5 9.5v2h2" />
  </svg>
);

type SelectSubmenuItem = {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  icon?: LucideIcon;
  trailingHint?: string;
};

type SelectOption = {
  value: SelectOptionId;
  label: string;
  dividerBefore?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  trailingHint?: string;
} & (
  | {
      shortcut?: string;
      submenuItems?: never;
    }
  | {
      shortcut?: never;
      submenuItems: SelectSubmenuItem[];
    }
);

const SELECT_OPTIONS: SelectOption[] = [
  {
    value: 'copy',
    label: 'Copy',
    shortcut: '⌥⇧⌘O',
    icon: Copy,
    trailingHint: '800',
  },
  {
    value: 'pasteAs',
    label: 'Copy / Paste as',
    icon: Clipboard,
    trailingHint: '88',
    submenuItems: [
      { label: 'PNG', shortcut: '⇧⌘C', icon: Image, trailingHint: '128' },
      { label: 'SVG', shortcut: '⌥⌘C', icon: FileText, trailingHint: '96' },
      { label: 'CSS', disabled: true, icon: Code },
    ],
  },
  {
    value: 'selectLayer',
    label: 'Select layer',
    icon: Layers,
    trailingHint: '328',
    submenuItems: [
      { label: 'Parent layer', shortcut: '⌘↑', icon: ArrowBigUp },
      { label: 'Child layer', shortcut: '⌘↓', icon: ArrowBigDown },
      { label: 'Next sibling', shortcut: '⌘]', icon: ArrowRightToLine },
      { label: 'Previous sibling', shortcut: '⌘[', icon: ArrowLeftToLine },
    ],
    dividerBefore: true,
  },
  {
    value: 'bringToFront',
    label: 'Bring to front',
    shortcut: ']',
    disabled: true,
    icon: BringToFront,
    trailingHint: '12',
  },
  {
    value: 'groupSelection',
    label: 'Group selection',
    shortcut: '⌘G',
    icon: Box,
    trailingHint: '64',
    dividerBefore: true,
  },
];

const SELECT_OPTION_BY_ID = SELECT_OPTIONS.reduce(
  (options, option) => ({
    ...options,
    [option.value]: option,
  }),
  {} as Record<SelectOptionId, SelectOption>,
);

const MULTI_INPUT_FIELDS: Array<{
  value: MultiInputFieldId;
  label: string;
  tooltip: string;
  min: number;
  max: number;
  step: number;
  fineStep: number;
  coarseStep: number;
  pageStep: number;
  precision: number;
  unit?: string;
}> = [
  {
    value: 'l',
    label: 'L',
    tooltip: 'Lightness',
    min: 0,
    max: 1,
    step: 0.01,
    fineStep: 0.001,
    coarseStep: 0.1,
    pageStep: 0.1,
    precision: 3,
  },
  {
    value: 'c',
    label: 'C',
    tooltip: 'Chroma',
    min: 0,
    max: 0.4,
    step: 0.01,
    fineStep: 0.001,
    coarseStep: 0.05,
    pageStep: 0.05,
    precision: 3,
  },
  {
    value: 'h',
    label: 'H',
    tooltip: 'Hue',
    min: 0,
    max: 360,
    step: 1,
    fineStep: 0.1,
    coarseStep: 15,
    pageStep: 30,
    precision: 1,
  },
  {
    value: 'a',
    label: 'O',
    tooltip: 'Opacity',
    min: 0,
    max: 1,
    step: 0.01,
    fineStep: 0.001,
    coarseStep: 0.1,
    pageStep: 0.1,
    precision: 3,
    unit: '%',
  },
];

const COLOR_PLANE_MULTI_INPUT_FIELDS = MULTI_INPUT_FIELDS.filter(
  (field) => field.value !== 'a',
);

const DEFAULT_MULTI_INPUT_CONFIG: MultiInputConfig = MULTI_INPUT_FIELDS.reduce(
  (config, field) => ({
    ...config,
    [field.value]: {
      min: field.min,
      max: field.max,
      step: field.step,
      fineStep: field.fineStep,
      coarseStep: field.coarseStep,
      pageStep: field.pageStep,
      precision: field.unit === '%' ? 1 : field.precision,
      autoTrim: true,
      wrapMode: field.value === 'h' ? 'wrap' : 'clamp',
      disabled: false,
    },
  }),
  {} as MultiInputConfig,
);

const MULTI_INPUT_FIELD_BY_ID = MULTI_INPUT_FIELDS.reduce(
  (fields, field) => ({
    ...fields,
    [field.value]: field,
  }),
  {} as Record<MultiInputFieldId, (typeof MULTI_INPUT_FIELDS)[number]>,
);

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

const SEGMENTED_FIELD_GROUP_CLASS =
  'box-border h-6 min-h-6 w-full min-w-0 max-w-full justify-start gap-0 overflow-hidden rounded-[5px] border-0 bg-[#383838] p-0 shadow-none';

const SEGMENTED_FIELD_ITEM_CLASS =
  'h-full min-h-0 w-full min-w-0 flex-1 rounded-[5px] border px-2 py-0 text-[11px] font-medium leading-4 tracking-[0.005em] transition-[background-color,color] hover:text-white/70 focus-visible:ring-2 focus-visible:ring-[#0d99ff]/80 focus-visible:ring-offset-0 data-[state=on]:bg-[#1f1f1f] data-[state=on]:shadow-none';

const TOGGLE_BUTTON_DENSITY_CLASS: Record<PrimitiveDensity, string> = {
  compact: 'h-6 min-h-6 min-w-6 text-[11px]',
  comfortable: 'h-7 min-h-7 min-w-7 text-xs',
};

const TOGGLE_BUTTON_STATE_CLASS: Record<
  ToggleButtonInteractionState,
  Record<ToggleButtonSelectionState, string>
> = {
  default: {
    off: 'border-transparent bg-transparent text-white',
    on: 'border-transparent bg-[#4d5876] text-[#8dc2f3]',
  },
  hovered: {
    off: 'border-transparent bg-[#373737] text-white',
    on: 'border-transparent bg-[#3b435e] text-[#8dc2f3]',
  },
  pressedDown: {
    off: 'border-transparent bg-[#303030] text-white',
    on: 'border-transparent bg-[#4d5876] text-[#8dc2f3]',
  },
};

const TOGGLE_BUTTON_INTERACTIVE_CLASS: Record<
  ToggleButtonSelectionState,
  string
> = {
  off: 'hover:border-transparent hover:bg-[#373737] hover:text-white active:border-transparent active:bg-[#303030] active:text-white',
  on: 'hover:border-transparent hover:bg-[#3b435e] hover:text-[#8dc2f3] active:border-transparent active:bg-[#4d5876] active:text-[#8dc2f3]',
};

const SELECT_MENU_OPEN_ANIMATION_CLASS =
  'data-[state=open]:[animation-delay:-35ms] data-[state=open]:[animation-duration:90ms] data-[state=open]:[animation-fill-mode:both] data-[state=open]:[animation-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[state=open]:[--tw-enter-opacity:0.28] data-[state=open]:[--tw-enter-scale:0.985] data-[state=open]:[--tw-enter-translate-y:-1px] motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none';

const SELECT_MENU_PANEL_CLASS = `w-[208px] rounded-[13px] border-0 bg-[#1e1e1e] p-2 text-white shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_10px_16px_0_rgba(0,0,0,0.12),0_2px_5px_0_rgba(0,0,0,0.15)] ${SELECT_MENU_OPEN_ANIMATION_CLASS}`;

const SELECT_MENU_ITEM_DENSITY_CLASS: Record<PrimitiveDensity, string> = {
  compact: 'h-6 min-h-6',
  comfortable: 'h-7 min-h-7',
};

const SELECT_MENU_ITEM_CLASS =
  'justify-start rounded-[5px] px-2 py-0 text-left text-[11px] font-[450] leading-4 tracking-[0.005em] text-white outline-none hover:bg-[#0d99ff] hover:text-white focus-visible:bg-[#0d99ff] focus-visible:text-white data-[highlighted]:bg-[#0d99ff] data-[highlighted]:text-white data-[state=open]:bg-[#303030] data-[state=open]:text-white data-[highlighted]:data-[state=open]:bg-[#0d99ff]';
const SELECT_MENU_ITEM_DISABLED_CLASS =
  'disabled:text-white/35 disabled:hover:bg-transparent data-[disabled]:text-white/35 data-[disabled]:hover:bg-transparent data-[disabled]:focus-visible:bg-transparent';

/** Trailing shortcuts must not hardcode enabled meta color; overrides parent disabled foreground. */
function selectMenuTrailingShortcutClass(disabled: boolean): string {
  return disabled ? 'text-white/35' : 'text-white/70';
}

function resolveLabMenuTrailingText({
  showShortcuts,
  shortcut,
  showTrailingHints,
  trailingHint,
}: {
  showShortcuts: boolean;
  shortcut?: string;
  showTrailingHints: boolean;
  trailingHint?: string;
}): string | undefined {
  if (showShortcuts && shortcut) {
    return shortcut;
  }

  if (showTrailingHints && trailingHint) {
    return trailingHint;
  }

  return undefined;
}

/** Fixed leading column for Lab menu rows, including checkable rows, so labels share one x-origin. */
const LAB_MENU_LEADING_COLUMN_CLASS =
  'flex size-6 shrink-0 items-center justify-center';

type LabMenuItemSlotsProps = {
  label: string;
  disabled?: boolean;
  /** Icon shown inside the leading column when set; column still reserves space when `showLeadingIcons`. */
  leadingIcon?: LucideIcon;
  showLeadingIcons: boolean;
  showTrailingHints: boolean;
  showShortcuts: boolean;
  shortcut?: string;
  trailingHint?: string;
  /** Trailing submenu chevron; when true, hides shortcut/hint text. */
  submenuCaret?: boolean;
};

function LabMenuItemSlots({
  label,
  disabled = false,
  leadingIcon,
  showLeadingIcons,
  showTrailingHints,
  showShortcuts,
  shortcut,
  trailingHint,
  submenuCaret = false,
}: LabMenuItemSlotsProps) {
  const trailingText = submenuCaret
    ? undefined
    : resolveLabMenuTrailingText({
        showShortcuts,
        shortcut,
        showTrailingHints,
        trailingHint,
      });
  const showIconGlyph = Boolean(showLeadingIcons && leadingIcon);
  const LeadingGlyph = leadingIcon;

  return (
    <span className="relative flex w-full min-w-0 items-center gap-2">
      {showLeadingIcons ? (
        <span className={`${LAB_MENU_LEADING_COLUMN_CLASS} text-current`}>
          {showIconGlyph && LeadingGlyph ? (
            <LeadingGlyph
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
          ) : null}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailingText ? (
        <span
          className={`min-w-0 shrink-0 text-right ${selectMenuTrailingShortcutClass(disabled)}`}
        >
          {trailingText}
        </span>
      ) : null}
      {submenuCaret ? (
        <svg
          aria-hidden="true"
          className="size-3 shrink-0"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M6.5 4.75 9.75 8 6.5 11.25"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.4"
          />
        </svg>
      ) : null}
    </span>
  );
}

const SELECT_MENU_SUBCONTENT_CLASS = `w-[176px] rounded-[13px] border-0 bg-[#1e1e1e] p-2 text-white shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_10px_16px_0_rgba(0,0,0,0.12),0_2px_5px_0_rgba(0,0,0,0.15)] ${SELECT_MENU_OPEN_ANIMATION_CLASS}`;

const SELECT_SUBMENU_HOVER_OPEN_DELAY_MS = 200;

function useSubmenuHoverTimer({
  enabled,
  trappedOpenSubmenu = null,
}: {
  enabled: boolean;
  trappedOpenSubmenu?: SelectOptionId | null;
}) {
  const [openSubmenu, setOpenSubmenu] = useState<SelectOptionId | null>(null);
  const submenuHoverTimerRef = useRef<number | null>(null);
  const activeOpenSubmenu = enabled
    ? (openSubmenu ?? trappedOpenSubmenu)
    : null;
  const clearSubmenuHoverTimer = useCallback(() => {
    if (submenuHoverTimerRef.current !== null) {
      window.clearTimeout(submenuHoverTimerRef.current);
      submenuHoverTimerRef.current = null;
    }
  }, []);
  const openSubmenuImmediately = useCallback(
    (optionValue: SelectOptionId) => {
      clearSubmenuHoverTimer();
      setOpenSubmenu(optionValue);
    },
    [clearSubmenuHoverTimer],
  );
  const scheduleSubmenuHoverOpen = useCallback(
    (optionValue: SelectOptionId) => {
      clearSubmenuHoverTimer();
      setOpenSubmenu((current) => (current === optionValue ? current : null));
      submenuHoverTimerRef.current = window.setTimeout(() => {
        submenuHoverTimerRef.current = null;
        setOpenSubmenu(optionValue);
      }, SELECT_SUBMENU_HOVER_OPEN_DELAY_MS);
    },
    [clearSubmenuHoverTimer],
  );
  const closeSubmenu = useCallback(
    (optionValue?: SelectOptionId) => {
      clearSubmenuHoverTimer();
      setOpenSubmenu((current) =>
        optionValue && current !== optionValue ? current : null,
      );
    },
    [clearSubmenuHoverTimer],
  );

  useEffect(() => clearSubmenuHoverTimer, [clearSubmenuHoverTimer]);

  return {
    activeOpenSubmenu,
    clearSubmenuHoverTimer,
    closeSubmenu,
    openSubmenuImmediately,
    scheduleSubmenuHoverOpen,
  };
}

/** Selected selectable rows do not get a rest glyph or active background; hover/highlight classes still apply. */
function labMenuItemSelectedRestClass(): string {
  return '';
}

const PANEL_TWO_COLUMN_GRID_CLASS =
  'grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3';

const LAB_PANEL_SCROLL_AREA_CLASS =
  'h-full w-full min-w-0 max-w-full overflow-hidden [&>[data-radix-scroll-area-viewport]]:w-full [&>[data-radix-scroll-area-viewport]]:min-w-0 [&>[data-radix-scroll-area-viewport]]:max-w-full [&>[data-radix-scroll-area-viewport]]:overflow-x-hidden [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!w-full [&>[data-radix-scroll-area-viewport]>div]:!min-w-0 [&>[data-radix-scroll-area-viewport]>div]:!max-w-full';

function getSegmentedFieldItemStateClass(isSelected: boolean): string {
  return isSelected
    ? 'border-[#4C4C4C] bg-[#1f1f1f] text-white/90 shadow-none'
    : 'border-transparent bg-transparent text-white/50 shadow-none';
}

function getToggleButtonStateClass(
  selected: boolean,
  interactionState: ToggleButtonInteractionState,
): string {
  const selectionState: ToggleButtonSelectionState = selected ? 'on' : 'off';
  return [
    TOGGLE_BUTTON_STATE_CLASS[interactionState][selectionState],
    interactionState === 'default'
      ? TOGGLE_BUTTON_INTERACTIVE_CLASS[selectionState]
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

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
    <section className="w-full min-w-0 max-w-full space-y-3 overflow-x-hidden">
      <div className="w-full min-w-0 max-w-full space-y-1">
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
        <div className="w-full min-w-0 max-w-full">{children}</div>
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
    <div className="w-full min-w-0 max-w-full space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <ToggleGroup
        type="single"
        value={value}
        className={`${SEGMENTED_FIELD_GROUP_CLASS} ${controlClassName}`}
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
                    className={`${SEGMENTED_FIELD_ITEM_CLASS} ${getSegmentedFieldItemStateClass(isSelected)}`}
                    aria-label={`${label}: ${option.label}`}
                  >
                    {option.icon ? (
                      <span className="flex size-3.5 items-center justify-center text-current">
                        {option.icon}
                      </span>
                    ) : (
                      <span className="min-w-0 truncate">{option.label}</span>
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
    <label className="relative flex min-h-6 min-w-0 max-w-full items-center gap-2 py-1 text-[11px] font-medium leading-4 tracking-[0.005em] text-white/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer absolute left-0 top-1 size-4 cursor-default opacity-0"
      />
      <span
        aria-hidden="true"
        className="flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-[#4C4C4C] bg-[#383838] text-white transition-[background-color,border-color] peer-checked:border-[#007be5] peer-checked:bg-[#0d99ff] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0d99ff]/80"
      >
        {checked ? (
          <Check aria-hidden="true" className="size-3" strokeWidth={3} />
        ) : null}
      </span>
      <span className="min-w-0">{label}</span>
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
    <div className="absolute left-4 top-4 z-20 w-[190px]">
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
  step = 1,
  leadingAccessory,
  trailingAccessory,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  leadingAccessory?: ReactNode;
  trailingAccessory?: ReactNode;
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label className="block w-full min-w-0 max-w-full space-y-2">
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          {label}
        </span>
        <PrimitiveValueInput
          value={value}
          onValueChange={(nextValue) => onChange(Math.max(0, nextValue))}
          ariaLabel={label}
          leadingAccessory={leadingAccessory}
          trailingAccessory={trailingAccessory}
          leadingElement={null}
          min={0}
          max={5000}
          wrapMode="clamp"
          step={step}
          fineStep={step / 10}
          coarseStep={step * 10}
          pageStep={step * 10}
          precision={0}
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
      <label className="block w-full min-w-0 max-w-full space-y-2">
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          {label}
        </span>
        <input
          type="text"
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-full min-w-0 max-w-full rounded-[4px] border border-transparent bg-[#383838] px-2 text-[11px] font-medium text-white outline-none transition-[border-color] hover:border-[#4C4C4C] focus:border-[#5288db]"
        />
      </label>
    </PropertyFieldTooltip>
  );
}

function PrecisionConfigInput({
  value,
  onChange,
  leadingAccessory,
  trailingAccessory,
}: {
  value: PrimitivePrecision;
  onChange: (value: PrimitivePrecision) => void;
  leadingAccessory?: ReactNode;
  trailingAccessory?: ReactNode;
}) {
  return (
    <PropertyFieldTooltip label="Precision">
      <label className="block w-full min-w-0 max-w-full space-y-2">
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          Precision
        </span>
        <PrimitiveValueInput
          value={value}
          onValueChange={(nextValue) =>
            onChange(normalizePrimitivePrecision(nextValue))
          }
          ariaLabel="Precision"
          leadingAccessory={leadingAccessory}
          trailingAccessory={trailingAccessory}
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
  leadingAccessory,
  trailingAccessory,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  leadingElement: ReactNode;
  step: number;
  leadingAccessory?: ReactNode;
  trailingAccessory?: ReactNode;
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label className="block w-full min-w-0 max-w-full">
        <PrimitiveValueInput
          value={value}
          onValueChange={onValueChange}
          ariaLabel={label}
          leadingAccessory={leadingAccessory}
          trailingAccessory={trailingAccessory}
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
  leadingAccessory,
  trailingAccessory,
}: {
  value: number;
  onValueChange: (value: number) => void;
  leadingAccessory?: ReactNode;
  trailingAccessory?: ReactNode;
}) {
  return (
    <PropertyFieldTooltip label="Drag step">
      <label className="block w-full min-w-0 max-w-full">
        <PrimitiveValueInput
          value={value}
          onValueChange={(nextValue) =>
            onValueChange(normalizePrimitiveScrubMultiplier(nextValue))
          }
          ariaLabel="Drag step"
          leadingAccessory={leadingAccessory}
          trailingAccessory={trailingAccessory}
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
  step = 1,
  fineStep = 0.1,
  coarseStep = 10,
  pageStep = 10,
  precision = 6,
  leadingAccessory,
  trailingAccessory,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  leadingElement: ReactNode;
  step?: number;
  fineStep?: number;
  coarseStep?: number;
  pageStep?: number;
  precision?: PrimitivePrecision;
  leadingAccessory?: ReactNode;
  trailingAccessory?: ReactNode;
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label className="block w-full min-w-0 max-w-full">
        <PrimitiveValueInput
          value={value}
          onValueChange={onValueChange}
          ariaLabel={label}
          leadingAccessory={leadingAccessory}
          trailingAccessory={trailingAccessory}
          leadingElement={leadingElement}
          min={-1000}
          max={1000}
          wrapMode="free"
          step={step}
          fineStep={fineStep}
          coarseStep={coarseStep}
          pageStep={pageStep}
          precision={precision}
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
  leadingAccessory,
  trailingAccessory,
}: {
  value: number;
  onValueChange: (value: number) => void;
  leadingAccessory?: ReactNode;
  trailingAccessory?: ReactNode;
}) {
  return (
    <PropertyFieldTooltip label="Drag threshold">
      <label className="block w-full min-w-0 max-w-full">
        <PrimitiveValueInput
          value={value}
          onValueChange={onValueChange}
          ariaLabel="Drag threshold"
          leadingAccessory={leadingAccessory}
          trailingAccessory={trailingAccessory}
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
  /** Optional icon or label before the scrub handle and input (UI3 accessory column). */
  leadingAccessory?: ReactNode;
  /** Optional icon or label after the value area and before a trailing scrub handle. */
  trailingAccessory?: ReactNode;
  leadingElement?: ReactNode;
  trailingElement?: ReactNode;
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

function PrimitiveValueInput({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  leadingAccessory,
  trailingAccessory,
  leadingElement = 'V',
  trailingElement,
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
          scrubCurrentValueRef.current = nextValue;
          commitValue(nextValue);
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
      commitValue,
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
      scrubCurrentValueRef.current = nextValue;
      commitValue(nextValue);
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
      scrubCurrentValueRef.current = value;
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
  useEffect(() => {
    onScrubbingChange?.(isScrubbing);
  }, [isScrubbing, onScrubbingChange]);

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
  const hasLeadingAccessory =
    leadingAccessory !== null &&
    leadingAccessory !== undefined &&
    leadingAccessory !== false;
  const hasTrailingAccessory =
    trailingAccessory !== null &&
    trailingAccessory !== undefined &&
    trailingAccessory !== false;
  const handleElement =
    handleSide === 'trailing' ? trailingElement : leadingElement;
  const hasHandleElement =
    handleElement !== null &&
    handleElement !== undefined &&
    handleElement !== false;
  const scrubHandle = scrubEnabled ? (
    <div
      ref={scrubHandleRef}
      aria-hidden="true"
      className={
        hasHandleElement
          ? 'flex h-full shrink-0 cursor-ew-resize select-none items-center justify-center font-medium tabular-nums text-white/55'
          : `absolute ${
              handleSide === 'leading' ? '-left-0.5' : '-right-0.5'
            } top-0 z-10 h-full w-[5px] cursor-ew-resize select-none`
      }
      style={hasHandleElement ? { width: handleContentWidth } : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => endScrub()}
      onLostPointerCapture={() => {
        if (!hasPointerLock()) endScrub();
      }}
    >
      {handleElement}
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
      {hasLeadingAccessory ? (
        <span
          aria-hidden="true"
          className="flex h-full w-6 shrink-0 select-none items-center justify-center text-white/55"
        >
          {leadingAccessory}
        </span>
      ) : null}
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
      {hasTrailingElement && handleSide !== 'trailing' ? (
        <span className="flex h-full w-5 shrink-0 select-none items-center justify-center text-[11px] font-medium leading-4 text-white/50">
          {trailingElement}
        </span>
      ) : null}
      {hasTrailingAccessory ? (
        <span
          aria-hidden="true"
          className="flex h-full min-w-6 shrink-0 select-none items-center justify-center px-1 text-[11px] font-medium leading-4 tabular-nums text-white/50"
        >
          {trailingAccessory}
        </span>
      ) : null}
      {handleSide === 'trailing' ? scrubHandle : null}
    </div>
  );
}

function TooltipPlaygroundStage({
  delayDuration,
  highContrast,
  skipDelayDuration,
  side,
  showPointer,
}: {
  delayDuration: number;
  highContrast: boolean;
  skipDelayDuration: number;
  side: TooltipSide;
  showPointer: boolean;
}) {
  return (
    <TooltipProvider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
    >
      <div className="relative flex w-full max-w-xl flex-col items-center gap-8">
        <div className="flex justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/75 outline-none transition-[background-color,border-color,color] hover:border-white/20 hover:bg-white/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
              >
                Hover
              </button>
            </TooltipTrigger>
            <TooltipContent
              highContrast={highContrast}
              side={side}
              showPointer={showPointer}
            >
              Hover trigger
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="space-y-3 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
            Rapid succession triggering
          </p>
          <div className="grid grid-cols-7 gap-0">
            {TOOLTIP_RAPID_TRIGGER_ITEMS.map(({ name, Icon }) => (
              <Tooltip key={name}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={name}
                    className="flex size-[37px] items-center justify-center rounded-none text-white/50 outline-none transition-[background-color,box-shadow,color,transform] hover:bg-white/[0.07] hover:text-white/90 focus-visible:bg-white/[0.06] focus-visible:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5288db]/80 active:scale-[0.96] active:bg-white/[0.12] active:text-white"
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-3.5"
                      strokeWidth={1.75}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  highContrast={highContrast}
                  side={side}
                  showPointer={showPointer}
                >
                  {name}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
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
                <TooltipContent
                  highContrast={highContrast}
                  side={item.side}
                  showPointer={showPointer}
                >
                  {item.tooltip}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function ToggleGroupPlaygroundStage({
  value,
  onValueChange,
  iconMode,
}: {
  value: string;
  onValueChange: (value: string) => void;
  iconMode: ToggleGroupIconMode;
}) {
  return (
    <div className="w-[248px] min-w-0 max-w-full">
      <ToggleGroup
        type="single"
        value={value}
        className={SEGMENTED_FIELD_GROUP_CLASS}
        onValueChange={(next) => {
          if (next) {
            onValueChange(next);
          }
        }}
      >
        {TOGGLE_GROUP_ITEMS.map((item) => {
          const isSelected = value === item.value;
          const icon =
            iconMode !== 'none' ? (
              <span className="flex size-3.5 shrink-0 items-center justify-center text-current">
                {item.icon}
              </span>
            ) : null;
          const label =
            iconMode === 'iconOnly' ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <span className="min-w-0 truncate">{item.label}</span>
            );

          return (
            <ToggleGroupItem
              key={item.value}
              value={item.value}
              className={`${SEGMENTED_FIELD_ITEM_CLASS} gap-1.5 ${iconMode === 'iconOnly' ? 'px-0' : ''} ${getSegmentedFieldItemStateClass(isSelected)}`}
              aria-label={item.label}
            >
              {iconMode === 'leading' || iconMode === 'iconOnly' ? icon : null}
              {label}
              {iconMode === 'trailing' ? icon : null}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}

function ToggleButtonPlaygroundStage({
  selected,
  interactionState,
  disabled,
  density,
  content,
  label,
  onSelectedChange,
}: {
  selected: boolean;
  interactionState: ToggleButtonInteractionState;
  disabled: boolean;
  density: PrimitiveDensity;
  content: ToggleButtonContent;
  label: string;
  onSelectedChange: (selected: boolean) => void;
}) {
  const showIcon = content !== 'label';
  const showLabel = content !== 'iconOnly';
  const accessibleLabel = label.trim() || 'Toggle button';

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={showLabel ? undefined : accessibleLabel}
      disabled={disabled}
      data-selected={selected ? 'on' : 'off'}
      data-interaction-state={interactionState}
      className={`box-border inline-flex items-center justify-center gap-1.5 rounded-[5px] border px-2 py-0 font-medium leading-4 tracking-[0.005em] outline-none transition-[background-color,border-color,color] focus-visible:ring-2 focus-visible:ring-[#0d99ff]/80 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-white/25 disabled:hover:border-transparent disabled:hover:bg-transparent ${
        TOGGLE_BUTTON_DENSITY_CLASS[density]
      } ${
        content === 'iconOnly'
          ? density === 'compact'
            ? 'w-6 px-0'
            : 'w-7 px-0'
          : ''
      } ${getToggleButtonStateClass(selected, interactionState)}`}
      onClick={() => onSelectedChange(!selected)}
    >
      {showIcon ? (
        <span className="flex size-3.5 shrink-0 items-center justify-center text-current">
          {TOGGLE_BUTTON_ICON}
        </span>
      ) : null}
      {showLabel ? (
        <span className="min-w-0 truncate">{accessibleLabel}</span>
      ) : null}
    </button>
  );
}

function LabMenuContent({
  onValueChange,
  showShortcuts,
  showSubmenus,
  showDividers,
  showDisabledOptions = true,
  showLeadingIcons = true,
  showTrailingHints = true,
  trappedOpenSubmenu = null,
}: {
  onValueChange: (value: SelectOptionId) => void;
  showShortcuts: boolean;
  showSubmenus: boolean;
  showDividers: boolean;
  showDisabledOptions?: boolean;
  showLeadingIcons?: boolean;
  showTrailingHints?: boolean;
  trappedOpenSubmenu?: SelectOptionId | null;
}) {
  const {
    activeOpenSubmenu,
    clearSubmenuHoverTimer,
    closeSubmenu,
    openSubmenuImmediately,
    scheduleSubmenuHoverOpen,
  } = useSubmenuHoverTimer({
    enabled: showSubmenus,
    trappedOpenSubmenu,
  });
  return (
    <DropdownMenuContent
      align="center"
      sideOffset={4}
      className={SELECT_MENU_PANEL_CLASS}
    >
      {SELECT_OPTIONS.filter(
        (option) => showDisabledOptions || !option.disabled,
      ).map((option) => {
        const shortcut = option.shortcut;

        return (
          <Fragment key={option.value}>
            {showDividers && option.dividerBefore ? (
              <DropdownMenuSeparator className="mx-0 my-2 h-px bg-[#383838]" />
            ) : null}
            {showSubmenus && option.submenuItems ? (
              <DropdownMenuSub
                open={activeOpenSubmenu === option.value}
                onOpenChange={(nextOpen) => {
                  if (nextOpen) {
                    return;
                  }

                  closeSubmenu(option.value);
                }}
              >
                <DropdownMenuSubTrigger
                  onClick={() => openSubmenuImmediately(option.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'ArrowRight' ||
                      event.key === 'Enter' ||
                      event.key === ' ' ||
                      event.key === 'Spacebar'
                    ) {
                      openSubmenuImmediately(option.value);
                    }
                  }}
                  onPointerEnter={() => scheduleSubmenuHoverOpen(option.value)}
                  onPointerLeave={clearSubmenuHoverTimer}
                  className={`relative ${SELECT_MENU_ITEM_DENSITY_CLASS.compact} ${SELECT_MENU_ITEM_CLASS} ${SELECT_MENU_ITEM_DISABLED_CLASS} ${labMenuItemSelectedRestClass()} gap-0 pr-1 [&>svg:last-child]:hidden`}
                >
                  <LabMenuItemSlots
                    label={option.label}
                    disabled={option.disabled}
                    leadingIcon={option.icon}
                    showLeadingIcons={showLeadingIcons}
                    showTrailingHints={showTrailingHints}
                    showShortcuts={showShortcuts}
                    shortcut={shortcut}
                    trailingHint={option.trailingHint}
                    submenuCaret
                  />
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent
                    sideOffset={8}
                    alignOffset={-8}
                    className={SELECT_MENU_SUBCONTENT_CLASS}
                  >
                    {option.submenuItems
                      .filter(
                        (submenuItem) =>
                          showDisabledOptions || !submenuItem.disabled,
                      )
                      .map((submenuItem) => (
                        <DropdownMenuItem
                          key={submenuItem.label}
                          disabled={submenuItem.disabled}
                          onSelect={() => onValueChange(option.value)}
                          className={`relative ${SELECT_MENU_ITEM_DENSITY_CLASS.compact} ${SELECT_MENU_ITEM_CLASS} ${SELECT_MENU_ITEM_DISABLED_CLASS} gap-0 pr-1`}
                        >
                          <LabMenuItemSlots
                            label={submenuItem.label}
                            disabled={submenuItem.disabled}
                            leadingIcon={submenuItem.icon}
                            showLeadingIcons={showLeadingIcons}
                            showTrailingHints={showTrailingHints}
                            showShortcuts={showShortcuts}
                            shortcut={submenuItem.shortcut}
                            trailingHint={submenuItem.trailingHint}
                          />
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            ) : (
              <DropdownMenuItem
                disabled={option.disabled}
                onSelect={() => onValueChange(option.value)}
                className={`relative ${SELECT_MENU_ITEM_DENSITY_CLASS.compact} ${SELECT_MENU_ITEM_CLASS} ${SELECT_MENU_ITEM_DISABLED_CLASS} ${labMenuItemSelectedRestClass()} gap-0`}
              >
                <LabMenuItemSlots
                  label={option.label}
                  disabled={option.disabled}
                  leadingIcon={option.icon}
                  showLeadingIcons={showLeadingIcons}
                  showTrailingHints={showTrailingHints}
                  showShortcuts={showShortcuts}
                  shortcut={shortcut}
                  trailingHint={option.trailingHint}
                />
              </DropdownMenuItem>
            )}
          </Fragment>
        );
      })}
    </DropdownMenuContent>
  );
}

function MenuPlaygroundStage({
  onValueChange,
  showShortcuts,
  onShowShortcutsChange,
  showSubmenus,
  onShowSubmenusChange,
  showDividers,
  onShowDividersChange,
  showDisabledOptions,
  showOnOffItems,
  showHeadings,
  showLeadingIcons,
  showTrailingHints,
}: {
  onValueChange: (value: SelectOptionId) => void;
  showShortcuts: boolean;
  onShowShortcutsChange: (showShortcuts: boolean) => void;
  showSubmenus: boolean;
  onShowSubmenusChange: (showSubmenus: boolean) => void;
  showDividers: boolean;
  onShowDividersChange: (showDividers: boolean) => void;
  showDisabledOptions: boolean;
  showOnOffItems: boolean;
  showHeadings: boolean;
  showLeadingIcons: boolean;
  showTrailingHints: boolean;
}) {
  return (
    <InlineLabMenuContent
      onValueChange={onValueChange}
      showShortcuts={showShortcuts}
      onShowShortcutsChange={onShowShortcutsChange}
      showSubmenus={showSubmenus}
      onShowSubmenusChange={onShowSubmenusChange}
      showDividers={showDividers}
      onShowDividersChange={onShowDividersChange}
      showDisabledOptions={showDisabledOptions}
      showOnOffItems={showOnOffItems}
      showHeadings={showHeadings}
      showLeadingIcons={showLeadingIcons}
      showTrailingHints={showTrailingHints}
    />
  );
}

function InlineLabMenuContent({
  onValueChange,
  showShortcuts,
  onShowShortcutsChange,
  showSubmenus,
  onShowSubmenusChange,
  showDividers,
  onShowDividersChange,
  showDisabledOptions = true,
  showOnOffItems = false,
  showHeadings = false,
  showLeadingIcons = true,
  showTrailingHints = true,
}: {
  onValueChange: (value: SelectOptionId) => void;
  showShortcuts: boolean;
  onShowShortcutsChange?: (showShortcuts: boolean) => void;
  showSubmenus: boolean;
  onShowSubmenusChange?: (showSubmenus: boolean) => void;
  showDividers: boolean;
  onShowDividersChange?: (showDividers: boolean) => void;
  showDisabledOptions?: boolean;
  showOnOffItems?: boolean;
  showHeadings?: boolean;
  showLeadingIcons?: boolean;
  showTrailingHints?: boolean;
}) {
  const {
    activeOpenSubmenu,
    clearSubmenuHoverTimer,
    closeSubmenu,
    openSubmenuImmediately,
    scheduleSubmenuHoverOpen,
  } = useSubmenuHoverTimer({
    enabled: showSubmenus,
  });
  const closeSubmenuFromActionRow = useCallback(() => {
    closeSubmenu();
  }, [closeSubmenu]);
  const menuOnOffItems = useMemo(
    () => [
      {
        checked: showShortcuts,
        label: 'Shortcuts',
        onCheckedChange: onShowShortcutsChange,
      },
      {
        checked: showSubmenus,
        label: 'Submenus',
        onCheckedChange: onShowSubmenusChange,
      },
      {
        checked: showDividers,
        label: 'Dividers',
        onCheckedChange: onShowDividersChange,
      },
    ],
    [
      onShowDividersChange,
      onShowShortcutsChange,
      onShowSubmenusChange,
      showDividers,
      showShortcuts,
      showSubmenus,
    ],
  );
  const rootMenuItemClass = SELECT_MENU_ITEM_CLASS;
  const menuHeadingClass =
    'block w-full px-2 py-1 text-left text-[11px] font-[450] leading-4 tracking-[0.005em] text-white/40 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/20';
  const getHeadingForOption = useCallback((option: SelectOption) => {
    switch (option.value) {
      case 'copy':
        return 'Clipboard';
      case 'selectLayer':
        return 'Layer';
      case 'groupSelection':
        return 'Selection';
      case 'pasteAs':
      case 'bringToFront':
        return null;
      default:
        return null;
    }
  }, []);
  return (
    <div className="relative">
      <div data-state="open" className={SELECT_MENU_PANEL_CLASS}>
        {SELECT_OPTIONS.filter(
          (option) => showDisabledOptions || !option.disabled,
        ).map((option) => {
          const shortcut = option.shortcut;
          const isSubmenuOpen = activeOpenSubmenu === option.value;
          const heading = showHeadings ? getHeadingForOption(option) : null;

          return (
            <Fragment key={option.value}>
              {heading ? (
                <div
                  aria-label={`${heading} heading`}
                  className={menuHeadingClass}
                  role="heading"
                >
                  {heading}
                </div>
              ) : null}
              {showDividers && option.dividerBefore ? (
                <div className="mx-0 my-2 h-px bg-[#383838]" />
              ) : null}
              {showSubmenus && option.submenuItems ? (
                <div className="relative">
                  <button
                    type="button"
                    aria-expanded={isSubmenuOpen}
                    onClick={() => openSubmenuImmediately(option.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'ArrowRight' ||
                        event.key === 'Enter' ||
                        event.key === ' ' ||
                        event.key === 'Spacebar'
                      ) {
                        openSubmenuImmediately(option.value);
                      }
                    }}
                    onPointerEnter={() =>
                      scheduleSubmenuHoverOpen(option.value)
                    }
                    onPointerLeave={clearSubmenuHoverTimer}
                    className={`relative flex w-full cursor-default select-none items-center ${SELECT_MENU_ITEM_DENSITY_CLASS.compact} ${rootMenuItemClass} gap-0 pr-1 ${
                      !option.disabled && isSubmenuOpen ? 'bg-[#303030]' : ''
                    }`}
                  >
                    <LabMenuItemSlots
                      label={option.label}
                      disabled={option.disabled}
                      leadingIcon={option.icon}
                      showLeadingIcons={showLeadingIcons}
                      showTrailingHints={showTrailingHints}
                      showShortcuts={showShortcuts}
                      shortcut={shortcut}
                      trailingHint={option.trailingHint}
                      submenuCaret
                    />
                  </button>
                  {isSubmenuOpen ? (
                    <div
                      data-state="open"
                      className={`absolute left-[calc(100%+8px)] top-[-8px] z-50 ${SELECT_MENU_SUBCONTENT_CLASS}`}
                    >
                      {option.submenuItems
                        .filter(
                          (submenuItem) =>
                            showDisabledOptions || !submenuItem.disabled,
                        )
                        .map((submenuItem) => (
                          <button
                            key={submenuItem.label}
                            type="button"
                            disabled={submenuItem.disabled}
                            onClick={() => onValueChange(option.value)}
                            className={`relative flex w-full cursor-default select-none items-center ${SELECT_MENU_ITEM_DENSITY_CLASS.compact} ${SELECT_MENU_ITEM_CLASS} ${SELECT_MENU_ITEM_DISABLED_CLASS} gap-0 pr-1`}
                          >
                            <LabMenuItemSlots
                              label={submenuItem.label}
                              disabled={submenuItem.disabled}
                              leadingIcon={submenuItem.icon}
                              showLeadingIcons={showLeadingIcons}
                              showTrailingHints={showTrailingHints}
                              showShortcuts={showShortcuts}
                              shortcut={submenuItem.shortcut}
                              trailingHint={submenuItem.trailingHint}
                            />
                          </button>
                        ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={option.disabled}
                  onFocus={closeSubmenuFromActionRow}
                  onClick={() => onValueChange(option.value)}
                  onPointerEnter={closeSubmenuFromActionRow}
                  className={`relative flex w-full cursor-default select-none items-center ${SELECT_MENU_ITEM_DENSITY_CLASS.compact} ${rootMenuItemClass} ${SELECT_MENU_ITEM_DISABLED_CLASS} gap-0 ${labMenuItemSelectedRestClass()}`}
                >
                  <LabMenuItemSlots
                    label={option.label}
                    disabled={option.disabled}
                    leadingIcon={option.icon}
                    showLeadingIcons={showLeadingIcons}
                    showTrailingHints={showTrailingHints}
                    showShortcuts={showShortcuts}
                    shortcut={shortcut}
                    trailingHint={option.trailingHint}
                  />
                </button>
              )}
            </Fragment>
          );
        })}
        {showOnOffItems ? (
          <>
            {showDividers ? (
              <div className="mx-0 my-2 h-px bg-[#383838]" />
            ) : null}
            {showHeadings ? (
              <div
                aria-label="Options heading"
                className={menuHeadingClass}
                role="heading"
              >
                Options
              </div>
            ) : null}
            {menuOnOffItems.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitemcheckbox"
                aria-checked={item.checked}
                onClick={() => item.onCheckedChange?.(!item.checked)}
                onFocus={closeSubmenuFromActionRow}
                onPointerEnter={closeSubmenuFromActionRow}
                className={`relative flex w-full cursor-default select-none items-center ${SELECT_MENU_ITEM_DENSITY_CLASS.compact} ${rootMenuItemClass} gap-0`}
              >
                <span className="flex w-full min-w-0 items-center gap-2">
                  <span
                    className={`${LAB_MENU_LEADING_COLUMN_CLASS} text-current`}
                    aria-hidden="true"
                  >
                    {item.checked ? (
                      <Check className="size-4" strokeWidth={1.75} />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">
                    {item.label}
                  </span>
                </span>
              </button>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

function SelectPlaygroundStage({
  value,
  onValueChange,
  disabled,
  triggerContent,
  triggerIconTextPlacement,
  triggerBehavior,
  showShortcuts,
  showSubmenus,
  showDividers,
  showLeadingIcons,
  showTrailingHints,
}: {
  value: SelectOptionId;
  onValueChange: (value: SelectOptionId) => void;
  disabled: boolean;
  triggerContent: SelectTriggerContent;
  triggerIconTextPlacement: SelectTriggerIconTextPlacement;
  triggerBehavior: SelectTriggerBehavior;
  showShortcuts: boolean;
  showSubmenus: boolean;
  showDividers: boolean;
  showLeadingIcons: boolean;
  showTrailingHints: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = SELECT_OPTION_BY_ID[value] ?? SELECT_OPTIONS[0];
  const showTriggerText = triggerContent !== 'icon';
  const showLeadingTriggerIcon =
    triggerContent === 'icon' ||
    (triggerContent === 'iconText' &&
      (triggerIconTextPlacement === 'leading' ||
        triggerIconTextPlacement === 'both'));
  const showTrailingTriggerIcon =
    triggerContent === 'iconText' &&
    (triggerIconTextPlacement === 'trailing' ||
      triggerIconTextPlacement === 'both');
  const triggerLabel = 'Select';
  const handleTriggerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (
        triggerBehavior !== 'release' ||
        event.button !== 0 ||
        event.ctrlKey
      ) {
        return;
      }

      event.preventDefault();
      event.currentTarget.focus();
    },
    [triggerBehavior],
  );
  const handleTriggerClick = useCallback(() => {
    if (triggerBehavior !== 'release') {
      return;
    }

    setOpen(true);
  }, [triggerBehavior]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        if (disabled && nextOpen) {
          return;
        }

        setOpen(nextOpen);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Menu action: ${selectedOption.label}`}
          disabled={disabled}
          onPointerDown={handleTriggerPointerDown}
          onClick={handleTriggerClick}
          className={`box-border inline-flex items-center justify-center gap-1.5 rounded-[5px] border py-0 font-medium leading-4 tracking-[0.005em] outline-none shadow-none transition-[background-color,border-color,color] focus:ring-0 focus-visible:ring-2 focus-visible:ring-[#0d99ff]/80 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-white/25 disabled:hover:border-transparent disabled:hover:bg-transparent data-[state=open]:border-transparent data-[state=open]:bg-[#0d99ff] data-[state=open]:text-white ${
            TOGGLE_BUTTON_DENSITY_CLASS.compact
          } ${
            triggerContent === 'icon'
              ? 'w-6 px-0'
              : 'w-auto min-w-6 max-w-[180px] px-2'
          } ${getToggleButtonStateClass(false, 'default')}`}
        >
          {showLeadingTriggerIcon ? (
            <span className="flex size-3.5 shrink-0 items-center justify-center text-current">
              <Grid3X3
                aria-hidden="true"
                className="size-3.5"
                strokeWidth={1.75}
              />
            </span>
          ) : null}
          {showTriggerText ? (
            <span className="min-w-0 truncate">{triggerLabel}</span>
          ) : null}
          {showTrailingTriggerIcon ? (
            <span className="flex size-3.5 shrink-0 items-center justify-center text-current">
              <ChevronDown
                aria-hidden="true"
                className="size-3.5"
                strokeWidth={1.75}
              />
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <LabMenuContent
        onValueChange={onValueChange}
        showShortcuts={showShortcuts}
        showSubmenus={showSubmenus}
        showDividers={showDividers}
        showLeadingIcons={showLeadingIcons}
        showTrailingHints={showTrailingHints}
      />
    </DropdownMenu>
  );
}

function MultiInputSegment({
  field,
  config,
  value,
  onValueChange,
  onScrubbingChange,
  showLeadingLabel = false,
}: {
  field: (typeof MULTI_INPUT_FIELDS)[number];
  config: MultiInputConfig[MultiInputFieldId];
  value: number;
  onValueChange: (value: number) => void;
  onScrubbingChange: (field: MultiInputFieldId, isScrubbing: boolean) => void;
  showLeadingLabel?: boolean;
}) {
  const displayScale = field.unit === '%' ? 100 : 1;
  const isOpacityField = field.value === 'a';
  const leadingElement = showLeadingLabel ? field.label : null;
  const handleScrubbingChange = useCallback(
    (isScrubbing: boolean) => {
      onScrubbingChange(field.value, isScrubbing);
    },
    [field.value, onScrubbingChange],
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label className="block h-6 min-w-0 w-full">
          <PrimitiveValueInput
            value={value * displayScale}
            onValueChange={(nextValue) =>
              onValueChange(nextValue / displayScale)
            }
            ariaLabel={field.tooltip}
            leadingElement={leadingElement}
            trailingElement={isOpacityField ? field.unit : null}
            handleSide={isOpacityField ? 'trailing' : 'leading'}
            handleContentWidth={showLeadingLabel ? 18 : 16}
            min={config.min * displayScale}
            max={config.max * displayScale}
            wrapMode={config.wrapMode}
            step={config.step * displayScale}
            fineStep={config.fineStep * displayScale}
            coarseStep={config.coarseStep * displayScale}
            pageStep={config.pageStep * displayScale}
            precision={config.precision}
            autoTrim={config.autoTrim}
            allowExpressions
            selectAllOnFocus
            commitOnBlur
            scrubEnabled
            scrubPixelsPerStep={1}
            scrubThreshold={1}
            pointerLockEnabled={false}
            disabled={config.disabled}
            readOnly={false}
            visualState="auto"
            visualTreatment="embedded"
            onScrubbingChange={handleScrubbingChange}
            size="full"
            density="compact"
          />
        </label>
      </TooltipTrigger>
      <TooltipContent side="bottom">{field.tooltip}</TooltipContent>
    </Tooltip>
  );
}

function MultiInputControl({
  values,
  config,
  onFieldChange,
  fields = MULTI_INPUT_FIELDS,
  showLeadingLabels = false,
}: {
  values: Record<MultiInputFieldId, number>;
  config: MultiInputConfig;
  onFieldChange: (field: MultiInputFieldId, value: number) => void;
  fields?: Array<(typeof MULTI_INPUT_FIELDS)[number]>;
  showLeadingLabels?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [scrubbingField, setScrubbingField] =
    useState<MultiInputFieldId | null>(null);

  const handleSegmentScrubbingChange = useCallback(
    (field: MultiInputFieldId, isScrubbing: boolean) => {
      setScrubbingField((currentField) => {
        if (isScrubbing) {
          return field;
        }
        return currentField === field ? null : currentField;
      });
    },
    [],
  );
  const borderColor = scrubbingField
    ? '#97c1ef'
    : isFocused
      ? '#5288db'
      : isHovered
        ? '#4C4C4C'
        : 'transparent';

  return (
    <TooltipProvider delayDuration={1000} skipDelayDuration={300}>
      <div
        className="relative h-6 min-h-6 w-full min-w-0 max-w-full overflow-hidden rounded-[4px]"
        data-scrubbing={Boolean(scrubbingField) || undefined}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget;
          if (
            nextTarget instanceof Node &&
            event.currentTarget.contains(nextTarget)
          ) {
            return;
          }
          setIsFocused(false);
        }}
      >
        <div className="flex h-full w-full min-w-0 max-w-full gap-px bg-transparent">
          {fields.map((field) => (
            <div
              key={field.value}
              data-multi-input-segment=""
              className={`min-w-0 max-w-full ${
                fields.length === MULTI_INPUT_FIELDS.length
                  ? field.value === 'a'
                    ? 'flex-[1_1_65px]'
                    : 'flex-[0_1_44px]'
                  : 'flex-1'
              }`}
            >
              <MultiInputSegment
                field={field}
                config={config[field.value]}
                value={values[field.value]}
                onValueChange={(nextValue) =>
                  onFieldChange(field.value, nextValue)
                }
                onScrubbingChange={handleSegmentScrubbingChange}
                showLeadingLabel={showLeadingLabels}
              />
            </div>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[4px] border"
          style={{ borderColor }}
        />
      </div>
    </TooltipProvider>
  );
}

function MultiInputPlaygroundStage({
  values,
  config,
  onFieldChange,
}: {
  values: Record<MultiInputFieldId, number>;
  config: MultiInputConfig;
  onFieldChange: (field: MultiInputFieldId, value: number) => void;
}) {
  return (
    <div className="w-[200px] min-w-0 max-w-full">
      <MultiInputControl
        values={values}
        config={config}
        onFieldChange={onFieldChange}
      />
    </div>
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
  const [primitiveHandleSide, setPrimitiveHandleSide] =
    useState<PrimitiveHandleSide>('leading');
  const [primitiveHandleLetter, setPrimitiveHandleLetter] = useState('V');
  const [primitiveHandleLucideSlug, setPrimitiveHandleLucideSlug] =
    useState('mouse-pointer-2');
  const [primitiveLeadingAccessoryKind, setPrimitiveLeadingAccessoryKind] =
    useState<PrimitiveAccessoryKind>('none');
  const [primitiveLeadingAccessoryLabel, setPrimitiveLeadingAccessoryLabel] =
    useState('W');
  const [
    primitiveLeadingAccessoryIconSlug,
    setPrimitiveLeadingAccessoryIconSlug,
  ] = useState('arrow-left-right');
  const [primitiveTrailingAccessoryKind, setPrimitiveTrailingAccessoryKind] =
    useState<PrimitiveAccessoryKind>('none');
  const [primitiveTrailingAccessoryLabel, setPrimitiveTrailingAccessoryLabel] =
    useState('px');
  const [
    primitiveTrailingAccessoryIconSlug,
    setPrimitiveTrailingAccessoryIconSlug,
  ] = useState('percent');
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
  const [tooltipShowPointer, setTooltipShowPointer] = useState(true);
  const [tooltipHighContrast, setTooltipHighContrast] = useState(true);
  const [, setMenuValue] = useState<SelectOptionId>('copy');
  const [menuShowShortcuts, setMenuShowShortcuts] = useState(true);
  const [menuShowSubmenus, setMenuShowSubmenus] = useState(true);
  const [menuShowDividers, setMenuShowDividers] = useState(true);
  const [menuShowDisabledOptions, setMenuShowDisabledOptions] = useState(true);
  const [menuShowOnOffItems, setMenuShowOnOffItems] = useState(true);
  const [menuShowHeadings, setMenuShowHeadings] = useState(false);
  const [menuShowLeadingIcons, setMenuShowLeadingIcons] = useState(true);
  const [menuShowTrailingHints, setMenuShowTrailingHints] = useState(true);
  const [selectValue, setSelectValue] = useState<SelectOptionId>('copy');
  const [selectDisabled, setSelectDisabled] = useState(false);
  const [selectTriggerContent, setSelectTriggerContent] =
    useState<SelectTriggerContent>('icon');
  const [selectTriggerIconTextPlacement, setSelectTriggerIconTextPlacement] =
    useState<SelectTriggerIconTextPlacement>('trailing');
  const [selectTriggerBehavior, setSelectTriggerBehavior] =
    useState<SelectTriggerBehavior>('press');
  const [selectShowShortcuts, setSelectShowShortcuts] = useState(true);
  const [selectShowSubmenus, setSelectShowSubmenus] = useState(true);
  const [selectShowDividers, setSelectShowDividers] = useState(true);
  const [selectShowLeadingIcons, setSelectShowLeadingIcons] = useState(true);
  const [selectShowTrailingHints, setSelectShowTrailingHints] = useState(true);
  const [primitivePlaceholder, setPrimitivePlaceholder] = useState('0');
  const [multiInputValues, setMultiInputValues] = useState<
    Record<MultiInputFieldId, number>
  >({
    l: 0.64,
    c: 0.24,
    h: 28,
    a: 1,
  });
  const [activeMultiInputField, setActiveMultiInputField] =
    useState<MultiInputFieldId>('l');
  const [multiInputConfig, setMultiInputConfig] = useState<MultiInputConfig>(
    DEFAULT_MULTI_INPUT_CONFIG,
  );
  const [toggleButtonSelectionState, setToggleButtonSelectionState] =
    useState<ToggleButtonSelectionState>('off');
  const [toggleButtonInteractionState, setToggleButtonInteractionState] =
    useState<ToggleButtonInteractionState>('default');
  const [toggleButtonDisabled, setToggleButtonDisabled] = useState(false);
  const [toggleButtonDensity, setToggleButtonDensity] =
    useState<PrimitiveDensity>('compact');
  const [toggleButtonContent, setToggleButtonContent] =
    useState<ToggleButtonContent>('iconOnly');
  const [toggleButtonLabel, setToggleButtonLabel] = useState('Favorite');
  const [toggleGroupValue, setToggleGroupValue] = useState('plane');
  const [toggleGroupIconMode, setToggleGroupIconMode] =
    useState<ToggleGroupIconMode>('none');

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
  const colorPlaneMultiInputValues = useMemo<Record<MultiInputFieldId, number>>(
    () => ({
      l: color.requested.l,
      c: color.requested.c,
      h: color.requested.h,
      a: color.requested.alpha,
    }),
    [color.requested],
  );
  const setColorPlaneMultiInputFieldValue = useCallback(
    (field: MultiInputFieldId, value: number) => {
      color.setChannel(field === 'a' ? 'alpha' : field, value);
    },
    [color],
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

  const setMultiInputFieldValue = useCallback(
    (field: MultiInputFieldId, value: number) => {
      setMultiInputValues((current) => ({
        ...current,
        [field]: value,
      }));
    },
    [],
  );
  const setMultiInputFieldConfig = useCallback(
    <K extends keyof MultiInputConfig[MultiInputFieldId]>(
      field: MultiInputFieldId,
      key: K,
      value: MultiInputConfig[MultiInputFieldId][K],
    ) => {
      setMultiInputConfig((current) => {
        const fieldConfig = current[field];
        const nextFieldConfig = {
          ...fieldConfig,
          [key]: value,
        };

        if (key === 'min') {
          nextFieldConfig.min = Math.min(Number(value), fieldConfig.max);
        } else if (key === 'max') {
          nextFieldConfig.max = Math.max(Number(value), fieldConfig.min);
        }

        return {
          ...current,
          [field]: nextFieldConfig,
        };
      });
    },
    [],
  );
  const activeMultiInputConfig = multiInputConfig[activeMultiInputField];
  const activeMultiInputFieldDefinition =
    MULTI_INPUT_FIELD_BY_ID[activeMultiInputField];
  const activeMultiInputDisplayScale =
    activeMultiInputFieldDefinition.unit === '%' ? 100 : 1;

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

  const primitiveLeadingAccessory = useMemo<ReactNode>(() => {
    switch (primitiveLeadingAccessoryKind) {
      case 'none':
        return null;
      case 'label':
        return primitiveLeadingAccessoryLabel.trim().slice(0, 4) || '—';
      case 'icon':
        return (
          <DynamicLucideIcon
            slug={primitiveLeadingAccessoryIconSlug}
            className="size-3.5"
            strokeWidth={1.75}
          />
        );
    }
  }, [
    primitiveLeadingAccessoryIconSlug,
    primitiveLeadingAccessoryKind,
    primitiveLeadingAccessoryLabel,
  ]);

  const primitiveTrailingAccessory = useMemo<ReactNode>(() => {
    switch (primitiveTrailingAccessoryKind) {
      case 'none':
        return null;
      case 'label':
        return primitiveTrailingAccessoryLabel.trim().slice(0, 6) || '—';
      case 'icon':
        return (
          <DynamicLucideIcon
            slug={primitiveTrailingAccessoryIconSlug}
            className="size-3.5"
            strokeWidth={1.75}
          />
        );
    }
  }, [
    primitiveTrailingAccessoryIconSlug,
    primitiveTrailingAccessoryKind,
    primitiveTrailingAccessoryLabel,
  ]);

  return (
    <div className="min-h-screen overflow-hidden bg-[#171717]">
      <LabHeaderExit />

      <main className="h-screen min-h-screen min-w-0 bg-[#171717] text-white lg:overflow-hidden">
        <div className="grid min-h-screen min-w-0 grid-cols-1 lg:h-full lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="relative flex min-h-[420px] min-w-0 items-center justify-center overflow-hidden px-6 py-10 lg:min-h-0 lg:py-14">
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
                leadingAccessory={primitiveLeadingAccessory}
                trailingAccessory={primitiveTrailingAccessory}
                leadingElement={primitiveHandleElement}
                handleSide={primitiveHandleSide}
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
            ) : activePage === 'inputMulti' ? (
              <MultiInputPlaygroundStage
                values={multiInputValues}
                config={multiInputConfig}
                onFieldChange={setMultiInputFieldValue}
              />
            ) : activePage === 'tooltip' ? (
              <TooltipPlaygroundStage
                delayDuration={tooltipDelayDuration}
                highContrast={tooltipHighContrast}
                skipDelayDuration={tooltipSkipDelayDuration}
                side={tooltipSide}
                showPointer={tooltipShowPointer}
              />
            ) : activePage === 'menu' ? (
              <MenuPlaygroundStage
                onValueChange={setMenuValue}
                showShortcuts={menuShowShortcuts}
                onShowShortcutsChange={setMenuShowShortcuts}
                showSubmenus={menuShowSubmenus}
                onShowSubmenusChange={setMenuShowSubmenus}
                showDividers={menuShowDividers}
                onShowDividersChange={setMenuShowDividers}
                showDisabledOptions={menuShowDisabledOptions}
                showOnOffItems={menuShowOnOffItems}
                showHeadings={menuShowHeadings}
                showLeadingIcons={menuShowLeadingIcons}
                showTrailingHints={menuShowTrailingHints}
              />
            ) : activePage === 'select' ? (
              <SelectPlaygroundStage
                value={selectValue}
                onValueChange={setSelectValue}
                disabled={selectDisabled}
                triggerContent={selectTriggerContent}
                triggerIconTextPlacement={selectTriggerIconTextPlacement}
                triggerBehavior={selectTriggerBehavior}
                showShortcuts={selectShowShortcuts}
                showSubmenus={selectShowSubmenus}
                showDividers={selectShowDividers}
                showLeadingIcons={selectShowLeadingIcons}
                showTrailingHints={selectShowTrailingHints}
              />
            ) : activePage === 'toggleButton' ? (
              <ToggleButtonPlaygroundStage
                selected={toggleButtonSelectionState === 'on'}
                interactionState={toggleButtonInteractionState}
                disabled={toggleButtonDisabled}
                density={toggleButtonDensity}
                content={toggleButtonContent}
                label={toggleButtonLabel}
                onSelectedChange={(selected) =>
                  setToggleButtonSelectionState(selected ? 'on' : 'off')
                }
              />
            ) : (
              <ToggleGroupPlaygroundStage
                value={toggleGroupValue}
                onValueChange={setToggleGroupValue}
                iconMode={toggleGroupIconMode}
              />
            )}
          </section>

          <aside className="min-w-0 max-w-full overflow-hidden border-t border-white/8 p-3 lg:min-h-0 lg:border-t-0 lg:p-4">
            <div className="h-full w-full min-w-0 max-w-full overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur lg:min-h-0">
              <ScrollArea className={LAB_PANEL_SCROLL_AREA_CLASS}>
                <TooltipProvider
                  delayDuration={tooltipDelayDuration}
                  skipDelayDuration={tooltipSkipDelayDuration}
                >
                  <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden p-4">
                    {activePage === 'plane' ? (
                      <>
                        <PanelSection
                          title="Color"
                          description="Drive the current sample color."
                        >
                          <div className="w-full min-w-0 max-w-full space-y-3">
                            <PropertyFieldTooltip label="Hex">
                              <div className="w-full min-w-0 max-w-full space-y-2">
                                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                                  Hex
                                </p>
                                <ColorStringInput
                                  format="hex"
                                  className="ck-input w-full min-w-0 max-w-full"
                                  requested={color.requested}
                                  onChangeRequested={color.setRequested}
                                  aria-label="Hex color input"
                                />
                              </div>
                            </PropertyFieldTooltip>

                            <PropertyFieldTooltip label="Hue">
                              <div className="w-full min-w-0 max-w-full space-y-2">
                                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                                  Hue
                                </p>
                                <ColorSlider
                                  channel="h"
                                  className="ck-slider ck-slider-v2 w-full min-w-0 max-w-full"
                                  data-color-space={hueRail.colorSpace}
                                  requested={color.requested}
                                  onChangeRequested={color.setRequested}
                                  style={hueRail.style}
                                />
                              </div>
                            </PropertyFieldTooltip>

                            <MultiInputControl
                              values={colorPlaneMultiInputValues}
                              config={DEFAULT_MULTI_INPUT_CONFIG}
                              fields={COLOR_PLANE_MULTI_INPUT_FIELDS}
                              onFieldChange={setColorPlaneMultiInputFieldValue}
                              showLeadingLabels
                            />
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
                            <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
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
                          <div className="w-full min-w-0 max-w-full space-y-4">
                            <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
                              <PropertyFieldTooltip label="Value">
                                <label className="block w-full min-w-0 max-w-full space-y-2">
                                  <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                                    Value
                                  </span>
                                  <PrimitiveValueInput
                                    value={primitiveValue}
                                    onValueChange={setPrimitiveValue}
                                    ariaLabel="Value"
                                    placeholder={primitivePlaceholder}
                                    leadingAccessory={primitiveLeadingAccessory}
                                    trailingAccessory={
                                      primitiveTrailingAccessory
                                    }
                                    leadingElement={primitiveHandleElement}
                                    handleSide={primitiveHandleSide}
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
                            <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
                              <BoundsConfigInput
                                label="Min"
                                value={primitiveMin}
                                onValueChange={setPrimitiveMin}
                                leadingAccessory={primitiveLeadingAccessory}
                                trailingAccessory={primitiveTrailingAccessory}
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
                                leadingAccessory={primitiveLeadingAccessory}
                                trailingAccessory={primitiveTrailingAccessory}
                                leadingElement={
                                  <ArrowRightToLine
                                    aria-hidden="true"
                                    className="size-3"
                                    strokeWidth={1.75}
                                  />
                                }
                              />
                            </div>
                            <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
                              <PrecisionConfigInput
                                value={primitivePrecision}
                                onChange={setPrimitivePrecision}
                                leadingAccessory={primitiveLeadingAccessory}
                                trailingAccessory={primitiveTrailingAccessory}
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
                                      <Braces
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
                                      <InfinityIcon
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
                          title="Accessories"
                          description="Optional leading and trailing slots outside the scrub handle (UI3-style)."
                        >
                          <div className="space-y-3">
                            <SegmentedField
                              label="Leading"
                              value={primitiveLeadingAccessoryKind}
                              onChange={setPrimitiveLeadingAccessoryKind}
                              options={[
                                { value: 'none', label: 'None' },
                                { value: 'icon', label: 'Icon' },
                                { value: 'label', label: 'Label' },
                              ]}
                            />
                            {primitiveLeadingAccessoryKind === 'label' ? (
                              <TextConfigField
                                label="Leading label"
                                value={primitiveLeadingAccessoryLabel}
                                onChange={setPrimitiveLeadingAccessoryLabel}
                                maxLength={4}
                              />
                            ) : null}
                            {primitiveLeadingAccessoryKind === 'icon' ? (
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                                  Leading icon
                                </p>
                                <LucideIconPicker
                                  value={primitiveLeadingAccessoryIconSlug}
                                  onChange={
                                    setPrimitiveLeadingAccessoryIconSlug
                                  }
                                />
                              </div>
                            ) : null}
                            <SegmentedField
                              label="Trailing"
                              value={primitiveTrailingAccessoryKind}
                              onChange={setPrimitiveTrailingAccessoryKind}
                              options={[
                                { value: 'none', label: 'None' },
                                { value: 'icon', label: 'Icon' },
                                { value: 'label', label: 'Label' },
                              ]}
                            />
                            {primitiveTrailingAccessoryKind === 'label' ? (
                              <TextConfigField
                                label="Trailing label"
                                value={primitiveTrailingAccessoryLabel}
                                onChange={setPrimitiveTrailingAccessoryLabel}
                                maxLength={6}
                              />
                            ) : null}
                            {primitiveTrailingAccessoryKind === 'icon' ? (
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                                  Trailing icon
                                </p>
                                <LucideIconPicker
                                  value={primitiveTrailingAccessoryIconSlug}
                                  onChange={
                                    setPrimitiveTrailingAccessoryIconSlug
                                  }
                                />
                              </div>
                            ) : null}
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
                            <SegmentedField
                              label="Side"
                              value={primitiveHandleSide}
                              onChange={setPrimitiveHandleSide}
                              options={[
                                { value: 'leading', label: 'Leading' },
                                { value: 'trailing', label: 'Trailing' },
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
                          <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
                            <StepConfigInput
                              label="Step"
                              value={primitiveStep}
                              onValueChange={setPrimitiveStep}
                              leadingAccessory={primitiveLeadingAccessory}
                              trailingAccessory={primitiveTrailingAccessory}
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
                              leadingAccessory={primitiveLeadingAccessory}
                              trailingAccessory={primitiveTrailingAccessory}
                            />
                            <StepConfigInput
                              label="Fine"
                              value={primitiveFineStep}
                              onValueChange={setPrimitiveFineStep}
                              leadingAccessory={primitiveLeadingAccessory}
                              trailingAccessory={primitiveTrailingAccessory}
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
                              leadingAccessory={primitiveLeadingAccessory}
                              trailingAccessory={primitiveTrailingAccessory}
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
                              leadingAccessory={primitiveLeadingAccessory}
                              trailingAccessory={primitiveTrailingAccessory}
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
                    ) : activePage === 'inputMulti' ? (
                      <>
                        <PanelSection
                          title="Input Multi"
                          description="Configure the selected color channel input."
                        >
                          <div className="space-y-4">
                            <SegmentedField
                              label="Segment"
                              value={activeMultiInputField}
                              onChange={setActiveMultiInputField}
                              options={MULTI_INPUT_FIELDS.map((field) => ({
                                value: field.value,
                                label: field.label,
                                tooltip: field.tooltip,
                              }))}
                            />
                            <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
                              <BoundsConfigInput
                                label="Min"
                                value={
                                  activeMultiInputConfig.min *
                                  activeMultiInputDisplayScale
                                }
                                onValueChange={(nextValue) =>
                                  setMultiInputFieldConfig(
                                    activeMultiInputField,
                                    'min',
                                    nextValue / activeMultiInputDisplayScale,
                                  )
                                }
                                leadingElement={
                                  <ArrowLeftToLine
                                    aria-hidden="true"
                                    className="size-3"
                                    strokeWidth={1.75}
                                  />
                                }
                                step={
                                  activeMultiInputFieldDefinition.step *
                                  activeMultiInputDisplayScale
                                }
                                fineStep={
                                  activeMultiInputFieldDefinition.fineStep *
                                  activeMultiInputDisplayScale
                                }
                                coarseStep={
                                  activeMultiInputFieldDefinition.coarseStep *
                                  activeMultiInputDisplayScale
                                }
                                pageStep={
                                  activeMultiInputFieldDefinition.pageStep *
                                  activeMultiInputDisplayScale
                                }
                                precision={activeMultiInputConfig.precision}
                              />
                              <BoundsConfigInput
                                label="Max"
                                value={
                                  activeMultiInputConfig.max *
                                  activeMultiInputDisplayScale
                                }
                                onValueChange={(nextValue) =>
                                  setMultiInputFieldConfig(
                                    activeMultiInputField,
                                    'max',
                                    nextValue / activeMultiInputDisplayScale,
                                  )
                                }
                                leadingElement={
                                  <ArrowRightToLine
                                    aria-hidden="true"
                                    className="size-3"
                                    strokeWidth={1.75}
                                  />
                                }
                                step={
                                  activeMultiInputFieldDefinition.step *
                                  activeMultiInputDisplayScale
                                }
                                fineStep={
                                  activeMultiInputFieldDefinition.fineStep *
                                  activeMultiInputDisplayScale
                                }
                                coarseStep={
                                  activeMultiInputFieldDefinition.coarseStep *
                                  activeMultiInputDisplayScale
                                }
                                pageStep={
                                  activeMultiInputFieldDefinition.pageStep *
                                  activeMultiInputDisplayScale
                                }
                                precision={activeMultiInputConfig.precision}
                              />
                            </div>
                            <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
                              <PrecisionConfigInput
                                value={activeMultiInputConfig.precision}
                                onChange={(nextValue) =>
                                  setMultiInputFieldConfig(
                                    activeMultiInputField,
                                    'precision',
                                    nextValue,
                                  )
                                }
                              />
                              <SegmentedField
                                label="Bounds"
                                value={activeMultiInputConfig.wrapMode}
                                onChange={(nextValue) =>
                                  setMultiInputFieldConfig(
                                    activeMultiInputField,
                                    'wrapMode',
                                    nextValue,
                                  )
                                }
                                controlClassName="translate-y-px"
                                options={[
                                  {
                                    value: 'clamp',
                                    label: 'Clamp',
                                    icon: (
                                      <Braces
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
                                      <InfinityIcon
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

                        <PanelSection title="Stepping">
                          <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
                            <StepConfigInput
                              label="Step"
                              value={
                                activeMultiInputConfig.step *
                                activeMultiInputDisplayScale
                              }
                              onValueChange={(nextValue) =>
                                setMultiInputFieldConfig(
                                  activeMultiInputField,
                                  'step',
                                  nextValue / activeMultiInputDisplayScale,
                                )
                              }
                              leadingElement={
                                <Diff
                                  aria-hidden="true"
                                  className="size-3"
                                  strokeWidth={1.75}
                                />
                              }
                              step={0.1}
                            />
                            <StepConfigInput
                              label="Fine"
                              value={
                                activeMultiInputConfig.fineStep *
                                activeMultiInputDisplayScale
                              }
                              onValueChange={(nextValue) =>
                                setMultiInputFieldConfig(
                                  activeMultiInputField,
                                  'fineStep',
                                  nextValue / activeMultiInputDisplayScale,
                                )
                              }
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
                              value={
                                activeMultiInputConfig.coarseStep *
                                activeMultiInputDisplayScale
                              }
                              onValueChange={(nextValue) =>
                                setMultiInputFieldConfig(
                                  activeMultiInputField,
                                  'coarseStep',
                                  nextValue / activeMultiInputDisplayScale,
                                )
                              }
                              leadingElement={
                                <ArrowBigUp
                                  aria-hidden="true"
                                  className="size-3"
                                  strokeWidth={1.75}
                                />
                              }
                              step={1}
                            />
                            <StepConfigInput
                              label="Page"
                              value={
                                activeMultiInputConfig.pageStep *
                                activeMultiInputDisplayScale
                              }
                              onValueChange={(nextValue) =>
                                setMultiInputFieldConfig(
                                  activeMultiInputField,
                                  'pageStep',
                                  nextValue / activeMultiInputDisplayScale,
                                )
                              }
                              leadingElement={
                                <ArrowRightToLine
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

                        <PanelSection title="Behavior">
                          <div className="space-y-3">
                            <ToggleField
                              label="Trim trailing zeros"
                              checked={activeMultiInputConfig.autoTrim}
                              onChange={(nextValue) =>
                                setMultiInputFieldConfig(
                                  activeMultiInputField,
                                  'autoTrim',
                                  nextValue,
                                )
                              }
                            />
                            <ToggleField
                              label="Disabled"
                              checked={activeMultiInputConfig.disabled}
                              onChange={(nextValue) =>
                                setMultiInputFieldConfig(
                                  activeMultiInputField,
                                  'disabled',
                                  nextValue,
                                )
                              }
                            />
                          </div>
                        </PanelSection>
                      </>
                    ) : activePage === 'tooltip' ? (
                      <>
                        <PanelSection
                          title="Timing"
                          description="Tune the Radix initial hover delay and the cooldown window that marks tooltip handoffs."
                        >
                          <div className={PANEL_TWO_COLUMN_GRID_CLASS}>
                            <NumberConfigField
                              label="Initial delay"
                              value={tooltipDelayDuration}
                              onChange={setTooltipDelayDuration}
                              step={50}
                            />
                            <NumberConfigField
                              label="Handoff"
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
                          <div className="mt-3">
                            <ToggleField
                              label="High contrast"
                              checked={tooltipHighContrast}
                              onChange={setTooltipHighContrast}
                            />
                            <ToggleField
                              label="Show pointer"
                              checked={tooltipShowPointer}
                              onChange={setTooltipShowPointer}
                            />
                          </div>
                        </PanelSection>
                      </>
                    ) : activePage === 'menu' ? (
                      <>
                        <PanelSection
                          title="Menu"
                          description="Preview the reusable UI3 menu surface used by the Select demo."
                        >
                          <div className="space-y-3">
                            <ToggleField
                              label="Show on/off items"
                              checked={menuShowOnOffItems}
                              onChange={setMenuShowOnOffItems}
                            />
                            <ToggleField
                              label="Show headings"
                              checked={menuShowHeadings}
                              onChange={setMenuShowHeadings}
                            />
                            <ToggleField
                              label="Show leading icons"
                              checked={menuShowLeadingIcons}
                              onChange={setMenuShowLeadingIcons}
                            />
                            <ToggleField
                              label="Show trailing hints"
                              checked={menuShowTrailingHints}
                              onChange={setMenuShowTrailingHints}
                            />
                            <ToggleField
                              label="Show shortcuts"
                              checked={menuShowShortcuts}
                              onChange={setMenuShowShortcuts}
                            />
                            <ToggleField
                              label="Show submenus"
                              checked={menuShowSubmenus}
                              onChange={setMenuShowSubmenus}
                            />
                            <ToggleField
                              label="Show dividers"
                              checked={menuShowDividers}
                              onChange={setMenuShowDividers}
                            />
                            <ToggleField
                              label="Show disabled options"
                              checked={menuShowDisabledOptions}
                              onChange={setMenuShowDisabledOptions}
                            />
                          </div>
                        </PanelSection>
                      </>
                    ) : activePage === 'select' ? (
                      <>
                        <PanelSection
                          title="Menu Select"
                          description="Preview the UI3 menu trigger state."
                        >
                          <div className="space-y-3">
                            <SegmentedField
                              label="Trigger content"
                              value={selectTriggerContent}
                              onChange={setSelectTriggerContent}
                              options={[
                                { value: 'icon', label: 'Icon' },
                                { value: 'iconText', label: 'Icon + text' },
                                { value: 'text', label: 'Text' },
                              ]}
                            />
                            {selectTriggerContent === 'iconText' ? (
                              <SegmentedField
                                label="Icon position"
                                value={selectTriggerIconTextPlacement}
                                onChange={setSelectTriggerIconTextPlacement}
                                options={[
                                  { value: 'leading', label: 'Leading' },
                                  { value: 'trailing', label: 'Trailing' },
                                  { value: 'both', label: 'Both' },
                                ]}
                              />
                            ) : null}
                            <SegmentedField
                              label="Trigger behavior"
                              value={selectTriggerBehavior}
                              onChange={setSelectTriggerBehavior}
                              options={[
                                { value: 'press', label: 'Press' },
                                { value: 'release', label: 'Release' },
                              ]}
                            />
                            <ToggleField
                              label="Disabled trigger"
                              checked={selectDisabled}
                              onChange={setSelectDisabled}
                            />
                            <ToggleField
                              label="Show leading icons"
                              checked={selectShowLeadingIcons}
                              onChange={setSelectShowLeadingIcons}
                            />
                            <ToggleField
                              label="Show trailing hints"
                              checked={selectShowTrailingHints}
                              onChange={setSelectShowTrailingHints}
                            />
                            <ToggleField
                              label="Show shortcuts"
                              checked={selectShowShortcuts}
                              onChange={setSelectShowShortcuts}
                            />
                            <ToggleField
                              label="Show submenus"
                              checked={selectShowSubmenus}
                              onChange={setSelectShowSubmenus}
                            />
                            <ToggleField
                              label="Show dividers"
                              checked={selectShowDividers}
                              onChange={setSelectShowDividers}
                            />
                          </div>
                        </PanelSection>
                      </>
                    ) : activePage === 'toggleButton' ? (
                      <>
                        <PanelSection
                          title="Button"
                          description="Preview selection separately from interaction feedback."
                        >
                          <div className="space-y-3">
                            <SegmentedField
                              label="Selected"
                              value={toggleButtonSelectionState}
                              onChange={setToggleButtonSelectionState}
                              options={[
                                { value: 'off', label: 'Off' },
                                { value: 'on', label: 'On' },
                              ]}
                            />
                            <SegmentedField
                              label="Interaction"
                              value={toggleButtonInteractionState}
                              onChange={setToggleButtonInteractionState}
                              options={[
                                { value: 'default', label: 'Default' },
                                { value: 'hovered', label: 'Hover' },
                                {
                                  value: 'pressedDown',
                                  label: 'Down',
                                  tooltip: 'Interaction: pressed down',
                                },
                              ]}
                            />
                            <ToggleField
                              label="Disabled"
                              checked={toggleButtonDisabled}
                              onChange={setToggleButtonDisabled}
                            />
                            <SegmentedField
                              label="Density"
                              value={toggleButtonDensity}
                              onChange={setToggleButtonDensity}
                              options={[
                                { value: 'compact', label: 'Compact' },
                                { value: 'comfortable', label: 'Comfort' },
                              ]}
                            />
                          </div>
                        </PanelSection>

                        <Separator className="bg-white/8" />

                        <PanelSection title="Content">
                          <div className="space-y-3">
                            <SegmentedField
                              label="Content"
                              value={toggleButtonContent}
                              onChange={setToggleButtonContent}
                              options={[
                                { value: 'iconOnly', label: 'Icon' },
                                { value: 'iconLabel', label: 'Icon + label' },
                                { value: 'label', label: 'Label' },
                              ]}
                            />
                            <TextConfigField
                              label="Label"
                              value={toggleButtonLabel}
                              onChange={setToggleButtonLabel}
                              maxLength={18}
                            />
                          </div>
                        </PanelSection>
                      </>
                    ) : (
                      <>
                        <PanelSection
                          title="Icon"
                          description="Preview the toggle group icon layout."
                        >
                          <div className="space-y-3">
                            <SegmentedField
                              label="Icon"
                              value={toggleGroupIconMode}
                              onChange={setToggleGroupIconMode}
                              options={[
                                { value: 'none', label: 'None' },
                                { value: 'leading', label: 'Leading' },
                                { value: 'trailing', label: 'Trailing' },
                                { value: 'iconOnly', label: 'No text' },
                              ]}
                            />
                          </div>
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
