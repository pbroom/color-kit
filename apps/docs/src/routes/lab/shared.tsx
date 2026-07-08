import {
  Background,
  ChromaMarkers,
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
import * as ColorApi from 'color-kit/driver';
import {
  toCss,
  toP3Gamut,
  toSrgbGamut,
  type Color as ColorValue,
} from 'color-kit';
import {
  Checkbox,
  MultiInputControl,
  PrimitiveValueInput,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  normalizePrimitivePrecision,
  type MultiInputConfig as ControlMultiInputConfig,
  type MultiInputField,
  type PrimitiveDensity,
  type PrimitiveExpressionParser,
  type PrimitiveHandleSide,
  type PrimitivePrecision,
  type PrimitiveSize,
  type PrimitiveVisualState,
  type PrimitiveWrapMode,
} from '@color-kit/control-kit';
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
  ChevronsUpDown,
  ArrowLeftToLine,
  ArrowRightToLine,
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
import {
  DropdownMenuItemButton,
  DropdownMenuItemContent,
  DropdownMenuPanel,
  DropdownMenuPanelSeparator,
  SelectList,
  SelectListItem,
} from './lab-menu.js';
import { ThemeSwitcher } from '../../components/theme-switcher.js';
import {
  LabPageSlotProvider,
  useLabPageSlotContent,
} from './lab-page-slots.js';

type OutputGamut = 'display-p3' | 'srgb';
type LabPageKey =
  | 'plane'
  | 'input'
  | 'inputMulti'
  | 'checkbox'
  | 'slider'
  | 'tooltip'
  | 'menu'
  | 'select'
  | 'toggleButton'
  | 'toggle';
type PrimitiveHandleContent = 'none' | 'letter' | 'icon' | 'swatch';
type MultiInputFieldId = 'l' | 'c' | 'h' | 'a';
type MultiInputConfig = ControlMultiInputConfig<MultiInputFieldId>;
type PrimitiveScrubFieldId = 'dragStep' | 'stepDragDistance';
type PrimitiveScrubConfig = ControlMultiInputConfig<PrimitiveScrubFieldId>;
type TooltipSide = 'top' | 'right' | 'bottom' | 'left';
type PlacementSide = TooltipSide;
type PlacementAlign = 'start' | 'center' | 'end';
type ToggleButtonSelectionState = 'off' | 'on';
type ToggleButtonInteractionState = 'default' | 'hovered' | 'pressedDown';
type ToggleButtonContent = 'iconOnly' | 'iconLabel' | 'label';
type ToggleGroupIconMode = 'none' | 'leading' | 'trailing' | 'iconOnly';
type SelectTriggerContent = 'icon' | 'iconText' | 'text';
type SelectTriggerIconTextPlacement = 'leading' | 'trailing' | 'both';
type SelectTriggerBehavior = 'press' | 'release';
type ConfigurableMenuItemId = 'itemOne' | 'itemTwo' | 'itemThree';
type ConfigurableMenuItemType = 'default' | 'onOff' | 'submenu';
type ConfigurableMenuItemLeading = 'none' | 'icon' | 'avatar';
type ConfigurableMenuItemConfig = {
  type: ConfigurableMenuItemType;
  leading: ConfigurableMenuItemLeading;
  label: string;
  secondaryText: string;
  checked: boolean;
  disabled: boolean;
};
type SelectOptionId =
  | 'copy'
  | 'pasteAs'
  | 'selectLayer'
  | 'bringToFront'
  | 'groupSelection';

const MAX_PRIMITIVE_PRECISION_DIGITS = 12;
const SLIDER_RANGE_EPSILON = 0.0001;

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
type SliderOrientation = 'horizontal' | 'vertical';
type SliderMarkerMode = 'auto' | 'off';

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

const PLACEMENT_GRID_OPTIONS: Array<{
  side: PlacementSide;
  align: PlacementAlign;
  label: string;
  gridColumn: string;
  gridRow: string;
}> = [
  {
    side: 'top',
    align: 'start',
    label: 'Top start',
    gridColumn: '2',
    gridRow: '1',
  },
  {
    side: 'top',
    align: 'center',
    label: 'Top center',
    gridColumn: '3',
    gridRow: '1',
  },
  {
    side: 'top',
    align: 'end',
    label: 'Top end',
    gridColumn: '4',
    gridRow: '1',
  },
  {
    side: 'right',
    align: 'start',
    label: 'Right start',
    gridColumn: '5',
    gridRow: '2',
  },
  {
    side: 'right',
    align: 'center',
    label: 'Right center',
    gridColumn: '5',
    gridRow: '3',
  },
  {
    side: 'right',
    align: 'end',
    label: 'Right end',
    gridColumn: '5',
    gridRow: '4',
  },
  {
    side: 'bottom',
    align: 'end',
    label: 'Bottom end',
    gridColumn: '4',
    gridRow: '5',
  },
  {
    side: 'bottom',
    align: 'center',
    label: 'Bottom center',
    gridColumn: '3',
    gridRow: '5',
  },
  {
    side: 'bottom',
    align: 'start',
    label: 'Bottom start',
    gridColumn: '2',
    gridRow: '5',
  },
  {
    side: 'left',
    align: 'end',
    label: 'Left end',
    gridColumn: '1',
    gridRow: '4',
  },
  {
    side: 'left',
    align: 'center',
    label: 'Left center',
    gridColumn: '1',
    gridRow: '3',
  },
  {
    side: 'left',
    align: 'start',
    label: 'Left start',
    gridColumn: '1',
    gridRow: '2',
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

const SELECT_LONG_MENU_NUMBERS = Array.from({ length: 101 }, (_, index) =>
  index.toString(),
);

const CONFIGURABLE_MENU_ITEM_IDS: ConfigurableMenuItemId[] = [
  'itemOne',
  'itemTwo',
  'itemThree',
];

const CONFIGURABLE_MENU_ITEM_LABELS: Record<ConfigurableMenuItemId, string> = {
  itemOne: 'Item 1',
  itemTwo: 'Item 2',
  itemThree: 'Item 3',
};

const DEFAULT_CONFIGURABLE_MENU_ITEMS: Record<
  ConfigurableMenuItemId,
  ConfigurableMenuItemConfig
> = {
  itemOne: {
    type: 'default',
    leading: 'none',
    label: 'Menu item',
    secondaryText: '',
    checked: true,
    disabled: false,
  },
  itemTwo: {
    type: 'default',
    leading: 'none',
    label: 'Menu item',
    secondaryText: '',
    checked: true,
    disabled: false,
  },
  itemThree: {
    type: 'default',
    leading: 'none',
    label: 'Menu item',
    secondaryText: '',
    checked: true,
    disabled: false,
  },
};

const SELECT_OPTION_BY_ID = SELECT_OPTIONS.reduce(
  (options, option) => ({
    ...options,
    [option.value]: option,
  }),
  {} as Record<SelectOptionId, SelectOption>,
);

type LabMultiInputField = MultiInputField<MultiInputFieldId> & {
  min: number;
  max: number;
  step: number;
  fineStep: number;
  coarseStep: number;
  pageStep: number;
  precision: number;
};

const MULTI_INPUT_FIELDS: Array<LabMultiInputField> = [
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
    weight: 'flex-[0_1_44px]',
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
    weight: 'flex-[0_1_44px]',
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
    weight: 'flex-[0_1_44px]',
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
    weight: 'flex-[1_1_65px]',
  },
];

const COLOR_PLANE_MULTI_INPUT_FIELDS = MULTI_INPUT_FIELDS.filter(
  (field) => field.value !== 'a',
).map(({ weight: _weight, ...field }) => field);

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

const PRIMITIVE_SCRUB_FIELDS: Array<MultiInputField<PrimitiveScrubFieldId>> = [
  {
    value: 'dragStep',
    label: 'D',
    tooltip: 'Drag step',
  },
  {
    value: 'stepDragDistance',
    label: '',
    tooltip: 'Step drag distance',
    unit: 'px',
  },
];

const PRIMITIVE_SCRUB_CONFIG: PrimitiveScrubConfig = {
  dragStep: {
    min: 0,
    max: 1000,
    step: 0.1,
    fineStep: 0.01,
    coarseStep: 1,
    pageStep: 1,
    precision: 6,
    autoTrim: true,
    wrapMode: 'free',
    disabled: false,
  },
  stepDragDistance: {
    min: 0.01,
    max: 1000,
    step: 0.5,
    fineStep: 0.1,
    coarseStep: 2,
    pageStep: 4,
    precision: 2,
    autoTrim: true,
    wrapMode: 'clamp',
    disabled: false,
  },
};

const SEGMENTED_FIELD_GROUP_CLASS =
  'box-border h-6 min-h-6 w-full min-w-0 max-w-full justify-start gap-0 overflow-hidden rounded-[5px] border-0 bg-[#383838] p-0 shadow-none';

const SEGMENTED_FIELD_ITEM_ACTIVE_BG_CLASS =
  'bg-[var(--ck-lab-segmented-active-bg,#171717)] data-[pressed]:!bg-[var(--ck-lab-segmented-active-bg,#171717)]';

const SEGMENTED_FIELD_ITEM_CLASS = `h-full min-h-0 w-full min-w-0 flex-1 rounded-[5px] border px-2 py-0 text-[11px] font-medium leading-4 tracking-[0.005em] transition-[background-color,color] hover:text-white/70 focus-visible:ring-2 focus-visible:ring-[#0d99ff]/80 focus-visible:ring-offset-0 data-[pressed]:!text-white/90 data-[pressed]:!shadow-none ${SEGMENTED_FIELD_ITEM_ACTIVE_BG_CLASS}`;

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

const SELECT_SUBMENU_HOVER_OPEN_DELAY_MS = 200;

function useSubmenuHoverTimer<TSubmenuId extends string>({
  enabled,
  trappedOpenSubmenu = null,
}: {
  enabled: boolean;
  trappedOpenSubmenu?: TSubmenuId | null;
}) {
  const [openSubmenu, setOpenSubmenu] = useState<TSubmenuId | null>(null);
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
    (optionValue: TSubmenuId) => {
      clearSubmenuHoverTimer();
      setOpenSubmenu(optionValue);
    },
    [clearSubmenuHoverTimer],
  );
  const scheduleSubmenuHoverOpen = useCallback(
    (optionValue: TSubmenuId) => {
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
    (optionValue?: TSubmenuId) => {
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

type LabMenuSurface = 'dropdown' | 'inline';

const LAB_MENU_HEADING_CLASS =
  'block w-full px-2 py-1 text-left text-[11px] font-[450] leading-4 tracking-[0.005em] text-white/40 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/20';

function isSubmenuOpenKey(event: ReactKeyboardEvent<HTMLElement>): boolean {
  return (
    event.key === 'ArrowRight' ||
    event.key === 'Enter' ||
    event.key === ' ' ||
    event.key === 'Spacebar'
  );
}

function getHeadingForSelectOption(option: SelectOption): string | null {
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
}

function LabMenuOptionRows({
  surface,
  onValueChange,
  showShortcuts,
  showSubmenus,
  showDividers,
  showDisabledOptions,
  showHeadings = false,
  showLeadingIcons,
  showTrailingHints,
  activeOpenSubmenu,
  clearSubmenuHoverTimer,
  closeSubmenu,
  openSubmenuImmediately,
  scheduleSubmenuHoverOpen,
}: {
  surface: LabMenuSurface;
  onValueChange: (value: SelectOptionId) => void;
  showShortcuts: boolean;
  showSubmenus: boolean;
  showDividers: boolean;
  showDisabledOptions: boolean;
  showHeadings?: boolean;
  showLeadingIcons: boolean;
  showTrailingHints: boolean;
  activeOpenSubmenu: SelectOptionId | null;
  clearSubmenuHoverTimer: () => void;
  closeSubmenu: (optionValue?: SelectOptionId) => void;
  openSubmenuImmediately: (optionValue: SelectOptionId) => void;
  scheduleSubmenuHoverOpen: (optionValue: SelectOptionId) => void;
}) {
  const renderContent = (
    option: SelectOption | SelectSubmenuItem,
    submenuCaret = false,
  ) => (
    <DropdownMenuItemContent
      label={option.label}
      disabled={option.disabled}
      leadingIcon={option.icon}
      showLeadingIcon={showLeadingIcons}
      showTrailingHints={showTrailingHints}
      showShortcuts={showShortcuts}
      shortcut={'shortcut' in option ? option.shortcut : undefined}
      trailingHint={option.trailingHint}
      submenuCaret={submenuCaret}
    />
  );
  const renderSeparator = () =>
    surface === 'dropdown' ? (
      <DropdownMenuSeparator variant="ui3" />
    ) : (
      <DropdownMenuPanelSeparator />
    );
  const renderSubmenuItems = (option: SelectOption) => {
    if (!('submenuItems' in option) || !option.submenuItems) {
      return null;
    }

    const children = option.submenuItems
      .filter((submenuItem) => showDisabledOptions || !submenuItem.disabled)
      .map((submenuItem) =>
        surface === 'dropdown' ? (
          <DropdownMenuItem
            key={submenuItem.label}
            variant="ui3"
            typeaheadLabel={submenuItem.label}
            disabled={submenuItem.disabled}
            onSelect={() => onValueChange(option.value)}
          >
            {renderContent(submenuItem)}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItemButton
            key={submenuItem.label}
            type="button"
            disabled={submenuItem.disabled}
            onClick={() => onValueChange(option.value)}
          >
            {renderContent(submenuItem)}
          </DropdownMenuItemButton>
        ),
      );

    if (surface === 'dropdown') {
      return (
        <DropdownMenuPortal>
          <DropdownMenuSubContent sideOffset={8} alignOffset={-8} variant="ui3">
            {children}
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      );
    }

    return (
      <DropdownMenuPanel
        data-state="open"
        variant="ui3"
        panel="subcontent"
        className="absolute left-[calc(100%+8px)] top-[-8px] z-50"
      >
        {children}
      </DropdownMenuPanel>
    );
  };

  return (
    <>
      {SELECT_OPTIONS.filter(
        (option) => showDisabledOptions || !option.disabled,
      ).map((option) => {
        const isSubmenu = showSubmenus && 'submenuItems' in option;
        const isSubmenuOpen = activeOpenSubmenu === option.value;
        const heading = showHeadings ? getHeadingForSelectOption(option) : null;

        return (
          <Fragment key={option.value}>
            {heading ? (
              <div
                aria-label={`${heading} heading`}
                className={LAB_MENU_HEADING_CLASS}
                role="heading"
              >
                {heading}
              </div>
            ) : null}
            {showDividers && option.dividerBefore ? renderSeparator() : null}
            {isSubmenu ? (
              surface === 'dropdown' ? (
                <DropdownMenuSub
                  open={isSubmenuOpen}
                  onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                      closeSubmenu(option.value);
                    }
                  }}
                >
                  <DropdownMenuSubTrigger
                    variant="ui3"
                    typeaheadLabel={option.label}
                    onClick={() => openSubmenuImmediately(option.value)}
                    onKeyDown={(event) => {
                      if (isSubmenuOpenKey(event)) {
                        openSubmenuImmediately(option.value);
                      }
                    }}
                    onPointerEnter={() =>
                      scheduleSubmenuHoverOpen(option.value)
                    }
                    onPointerLeave={clearSubmenuHoverTimer}
                    className="pr-0"
                  >
                    {renderContent(option, true)}
                  </DropdownMenuSubTrigger>
                  {renderSubmenuItems(option)}
                </DropdownMenuSub>
              ) : (
                <div className="relative">
                  <DropdownMenuItemButton
                    type="button"
                    aria-expanded={isSubmenuOpen}
                    onClick={() => openSubmenuImmediately(option.value)}
                    onKeyDown={(event) => {
                      if (isSubmenuOpenKey(event)) {
                        openSubmenuImmediately(option.value);
                      }
                    }}
                    onPointerEnter={() =>
                      scheduleSubmenuHoverOpen(option.value)
                    }
                    onPointerLeave={clearSubmenuHoverTimer}
                    className={
                      !option.disabled && isSubmenuOpen
                        ? 'pr-0 bg-[#303030]'
                        : 'pr-0'
                    }
                  >
                    {renderContent(option, true)}
                  </DropdownMenuItemButton>
                  {isSubmenuOpen ? renderSubmenuItems(option) : null}
                </div>
              )
            ) : surface === 'dropdown' ? (
              <DropdownMenuItem
                variant="ui3"
                typeaheadLabel={option.label}
                disabled={option.disabled}
                onSelect={() => onValueChange(option.value)}
              >
                {renderContent(option)}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItemButton
                type="button"
                disabled={option.disabled}
                onFocus={() => closeSubmenu()}
                onClick={() => onValueChange(option.value)}
                onPointerEnter={() => closeSubmenu()}
              >
                {renderContent(option)}
              </DropdownMenuItemButton>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

const PANEL_TWO_COLUMN_GRID_CLASS =
  'grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3';

const LAB_PANEL_SCROLL_AREA_CLASS =
  'h-full w-full min-w-0 max-w-full overflow-hidden [&>[data-radix-scroll-area-viewport]]:w-full [&>[data-radix-scroll-area-viewport]]:min-w-0 [&>[data-radix-scroll-area-viewport]]:max-w-full [&>[data-radix-scroll-area-viewport]]:overflow-x-hidden [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!w-full [&>[data-radix-scroll-area-viewport]>div]:!min-w-0 [&>[data-radix-scroll-area-viewport]>div]:!max-w-full';

function getSegmentedFieldItemStateClass(isSelected: boolean): string {
  return isSelected
    ? `border-[#4C4C4C] ${SEGMENTED_FIELD_ITEM_ACTIVE_BG_CLASS} text-white/90 shadow-none`
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

const parsePrimitiveExpression: PrimitiveExpressionParser = (draft, options) =>
  ColorApi.parseColorInputExpression(draft, options);

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
  rangeOverride?: [number, number],
): { colorSpace: OutputGamut; style: SliderRailStyle } {
  const range = ColorApi.resolveColorSliderRange(channel, rangeOverride);
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

function PlacementGridField({
  label,
  side,
  align,
  onChange,
}: {
  label: string;
  side: PlacementSide;
  align: PlacementAlign;
  onChange: (placement: { side: PlacementSide; align: PlacementAlign }) => void;
}) {
  const selectedIndex = useMemo(() => {
    const idx = PLACEMENT_GRID_OPTIONS.findIndex(
      (opt) => opt.side === side && opt.align === align,
    );
    return idx >= 0 ? idx : 0;
  }, [side, align]);

  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveSelection = useCallback(
    (nextIndex: number) => {
      const len = PLACEMENT_GRID_OPTIONS.length;
      const wrapped = ((nextIndex % len) + len) % len;
      const opt = PLACEMENT_GRID_OPTIONS[wrapped];
      onChange({ side: opt.side, align: opt.align });
      requestAnimationFrame(() => {
        optionRefs.current[wrapped]?.focus();
      });
    },
    [onChange],
  );

  const handleRadioKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown': {
          event.preventDefault();
          moveSelection(index + 1);
          break;
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          event.preventDefault();
          moveSelection(index - 1);
          break;
        }
        case 'Home': {
          event.preventDefault();
          moveSelection(0);
          break;
        }
        case 'End': {
          event.preventDefault();
          moveSelection(PLACEMENT_GRID_OPTIONS.length - 1);
          break;
        }
        default: {
          break;
        }
      }
    },
    [moveSelection],
  );

  return (
    <div className="w-full min-w-0 max-w-full space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid w-fit grid-cols-[repeat(5,22px)] grid-rows-[repeat(5,22px)] gap-1 rounded-[9px] bg-[#252525] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
      >
        <div
          aria-hidden="true"
          className="relative col-start-2 col-end-5 row-start-2 row-end-5 rounded-[7px] border border-[#4C4C4C] bg-[#383838] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-white/15 bg-[#2c2c2c]" />
        </div>
        {PLACEMENT_GRID_OPTIONS.map((option, index) => {
          const isSelected = side === option.side && align === option.align;

          return (
            <Tooltip key={`${option.side}-${option.align}`}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  tabIndex={selectedIndex === index ? 0 : -1}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  aria-checked={isSelected}
                  aria-label={`${label}: ${option.label}`}
                  className={`relative z-10 flex size-[22px] items-center justify-center rounded-[5px] border outline-none transition-[background-color,border-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-[#5288db]/80 ${
                    isSelected
                      ? 'border-[#0d99ff] bg-[#0d99ff] text-white shadow-[0_0_0_1px_rgba(13,153,255,0.25)]'
                      : 'border-transparent bg-[#383838] text-white/45 hover:border-[#4C4C4C] hover:bg-[#444] hover:text-white/80'
                  }`}
                  style={{
                    gridColumn: option.gridColumn,
                    gridRow: option.gridRow,
                  }}
                  onClick={() =>
                    onChange({ side: option.side, align: option.align })
                  }
                  onKeyDown={(event) => handleRadioKeyDown(event, index)}
                >
                  <span
                    aria-hidden="true"
                    className={`rounded-full ${
                      isSelected ? 'size-1.5 bg-white' : 'size-1 bg-current'
                    }`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="pointer-events-none">
                {option.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
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
    <Checkbox checked={checked} onCheckedChange={onChange}>
      {label}
    </Checkbox>
  );
}

function PagesPanel({
  activePage,
  onPageChange,
  pages,
}: {
  activePage: LabPageKey;
  onPageChange: (page: LabPageKey) => void;
  pages: readonly LabPageNavigationItem[];
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
        {pages.map((page) => {
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
  min = 0,
  max = 5000,
  precision = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label className="block w-full min-w-0 max-w-full space-y-2">
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          {label}
        </span>
        <PrimitiveValueInput
          value={value}
          onValueChange={(nextValue) =>
            onChange(Math.min(max, Math.max(min, nextValue)))
          }
          ariaLabel={label}
          leadingElement={null}
          min={min}
          max={max}
          wrapMode="clamp"
          step={step}
          fineStep={step / 10}
          coarseStep={step * 10}
          pageStep={step * 10}
          precision={precision}
          autoTrim
          allowExpressions
          parseExpression={parsePrimitiveExpression}
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
  showLabel = true,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  showLabel?: boolean;
  placeholder?: string;
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label
        className={`block w-full min-w-0 max-w-full ${showLabel ? 'space-y-2' : ''}`}
      >
        <span
          className={
            showLabel
              ? 'block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45'
              : 'sr-only'
          }
        >
          {label}
        </span>
        <input
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={showLabel ? undefined : (placeholder ?? label)}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-full min-w-0 max-w-full rounded-[4px] border border-transparent bg-[#383838] px-2 text-[11px] font-medium text-white outline-none transition-[border-color] placeholder:text-white/35 hover:border-[#4C4C4C] focus:border-[#5288db]"
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
      <label className="block w-full min-w-0 max-w-full">
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
          parseExpression={parsePrimitiveExpression}
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
  dragStep,
  stepDragDistance,
  onDragStepChange,
  onStepDragDistanceChange,
}: {
  dragStep: number;
  stepDragDistance: number;
  onDragStepChange: (value: number) => void;
  onStepDragDistanceChange: (value: number) => void;
}) {
  const values = useMemo<Record<PrimitiveScrubFieldId, number>>(
    () => ({
      dragStep,
      stepDragDistance,
    }),
    [dragStep, stepDragDistance],
  );
  const handleFieldChange = useCallback(
    (field: PrimitiveScrubFieldId, nextValue: number) => {
      if (field === 'dragStep') {
        onDragStepChange(nextValue);
        return;
      }

      const normalized = Number.isFinite(nextValue)
        ? Math.min(1000, Math.max(0.01, Number(nextValue.toFixed(4))))
        : 1;
      onStepDragDistanceChange(normalized);
    },
    [onDragStepChange, onStepDragDistanceChange],
  );

  return (
    <div className="w-full min-w-0 max-w-full">
      <MultiInputControl
        values={values}
        config={PRIMITIVE_SCRUB_CONFIG}
        fields={PRIMITIVE_SCRUB_FIELDS}
        onFieldChange={handleFieldChange}
        parseExpression={parsePrimitiveExpression}
        showLeadingLabels
      />
    </div>
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
}) {
  return (
    <PropertyFieldTooltip label={label}>
      <label className="block w-full min-w-0 max-w-full">
        <PrimitiveValueInput
          value={value}
          onValueChange={onValueChange}
          ariaLabel={label}
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
          parseExpression={parsePrimitiveExpression}
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
      <label className="block w-full min-w-0 max-w-full">
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
          parseExpression={parsePrimitiveExpression}
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

function TooltipPlaygroundStage({
  align,
  delayDuration,
  highContrast,
  skipDelayDuration,
  side,
  showPointer,
}: {
  align: PlacementAlign;
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
              align={align}
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
                  align={align}
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
                  align={align}
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
  align,
  onValueChange,
  side,
  showShortcuts,
  showSubmenus,
  showDividers,
  showDisabledOptions = true,
  showLeadingIcons = true,
  showTrailingHints = true,
  trappedOpenSubmenu = null,
}: {
  align: PlacementAlign;
  onValueChange: (value: SelectOptionId) => void;
  side: PlacementSide;
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
    <DropdownMenuContent align={align} side={side} sideOffset={4} variant="ui3">
      <LabMenuOptionRows
        surface="dropdown"
        onValueChange={onValueChange}
        showShortcuts={showShortcuts}
        showSubmenus={showSubmenus}
        showDividers={showDividers}
        showDisabledOptions={showDisabledOptions}
        showLeadingIcons={showLeadingIcons}
        showTrailingHints={showTrailingHints}
        activeOpenSubmenu={activeOpenSubmenu}
        clearSubmenuHoverTimer={clearSubmenuHoverTimer}
        closeSubmenu={closeSubmenu}
        openSubmenuImmediately={openSubmenuImmediately}
        scheduleSubmenuHoverOpen={scheduleSubmenuHoverOpen}
      />
    </DropdownMenuContent>
  );
}

function MenuPlaygroundStage({
  onValueChange,
  configurableItems,
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
  configurableItems: Record<ConfigurableMenuItemId, ConfigurableMenuItemConfig>;
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
    <div className="flex flex-col items-center gap-5">
      <InlineConfigurableMenuContent items={configurableItems} />
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
    </div>
  );
}

function InlineConfigurableMenuContent({
  items,
}: {
  items: Record<ConfigurableMenuItemId, ConfigurableMenuItemConfig>;
}) {
  const {
    activeOpenSubmenu,
    clearSubmenuHoverTimer,
    closeSubmenu,
    openSubmenuImmediately,
    scheduleSubmenuHoverOpen,
  } = useSubmenuHoverTimer({
    enabled: true,
  });
  const closeSubmenuFromActionRow = useCallback(() => {
    closeSubmenu();
  }, [closeSubmenu]);
  const shouldAlignOnOffItems = CONFIGURABLE_MENU_ITEM_IDS.some(
    (itemId) => items[itemId].type === 'onOff',
  );
  const shouldAlignLeadingItems = CONFIGURABLE_MENU_ITEM_IDS.some(
    (itemId) => items[itemId].leading !== 'none',
  );

  return (
    <div className="relative">
      <DropdownMenuPanel
        data-state="open"
        variant="ui3"
        reserveCheckColumn={shouldAlignOnOffItems}
        reserveLeadingColumn={shouldAlignLeadingItems}
      >
        {CONFIGURABLE_MENU_ITEM_IDS.map((itemId) => {
          const item = items[itemId];
          const label = item.label.trim() || 'Menu item';
          const leadingIcon = item.leading === 'icon' ? Sparkles : undefined;
          const leadingAvatar =
            item.leading === 'avatar'
              ? label.trim().slice(0, 1).toUpperCase() || 'M'
              : undefined;
          const isSubmenu = item.type === 'submenu';
          const isSubmenuOpen = activeOpenSubmenu === itemId;
          const secondaryText = item.secondaryText.trim();
          const isOnOff = item.type === 'onOff';
          const isOnOffChecked = item.checked ?? true;
          const showConfiguredLeading = item.leading !== 'none';

          if (isSubmenu) {
            return (
              <div key={itemId} className="relative">
                <DropdownMenuItemButton
                  type="button"
                  aria-expanded={isSubmenuOpen}
                  disabled={item.disabled}
                  onClick={() => openSubmenuImmediately(itemId)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'ArrowRight' ||
                      event.key === 'Enter' ||
                      event.key === ' ' ||
                      event.key === 'Spacebar'
                    ) {
                      openSubmenuImmediately(itemId);
                    }
                  }}
                  onPointerEnter={() => scheduleSubmenuHoverOpen(itemId)}
                  onPointerLeave={clearSubmenuHoverTimer}
                  className={
                    !item.disabled && isSubmenuOpen
                      ? 'pr-0 bg-[#303030]'
                      : 'pr-0'
                  }
                >
                  <DropdownMenuItemContent
                    label={label}
                    disabled={item.disabled}
                    leadingIcon={leadingIcon}
                    leadingAvatar={leadingAvatar}
                    showLeadingIcon={showConfiguredLeading}
                    showTrailingHints
                    showShortcuts
                    submenuCaret
                  />
                </DropdownMenuItemButton>
                {isSubmenuOpen ? (
                  <DropdownMenuPanel
                    data-state="open"
                    variant="ui3"
                    panel="subcontent"
                    reserveCheckColumn={false}
                    reserveLeadingColumn={false}
                    className="absolute left-[calc(100%+8px)] top-[-8px] z-50"
                  >
                    {['First action', 'Second action'].map((submenuLabel) => (
                      <DropdownMenuItemButton key={submenuLabel} type="button">
                        <DropdownMenuItemContent
                          label={submenuLabel}
                          showLeadingIcon={false}
                          showTrailingHints
                          showShortcuts
                        />
                      </DropdownMenuItemButton>
                    ))}
                  </DropdownMenuPanel>
                ) : null}
              </div>
            );
          }

          return (
            <DropdownMenuItemButton
              key={itemId}
              type="button"
              role={isOnOff ? 'menuitemcheckbox' : undefined}
              aria-checked={isOnOff ? isOnOffChecked : undefined}
              disabled={item.disabled}
              onFocus={closeSubmenuFromActionRow}
              onPointerEnter={closeSubmenuFromActionRow}
            >
              <DropdownMenuItemContent
                label={label}
                disabled={item.disabled}
                leadingIcon={leadingIcon}
                leadingAvatar={leadingAvatar}
                checked={isOnOff && isOnOffChecked}
                showLeadingIcon={showConfiguredLeading}
                showTrailingHints
                showShortcuts
                shortcut={secondaryText || undefined}
              />
            </DropdownMenuItemButton>
          );
        })}
      </DropdownMenuPanel>
    </div>
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

  return (
    <div className="relative">
      <DropdownMenuPanel
        data-state="open"
        variant="ui3"
        reserveCheckColumn={showOnOffItems}
        reserveLeadingColumn={showOnOffItems && showLeadingIcons}
      >
        <LabMenuOptionRows
          surface="inline"
          onValueChange={onValueChange}
          showShortcuts={showShortcuts}
          showSubmenus={showSubmenus}
          showDividers={showDividers}
          showDisabledOptions={showDisabledOptions}
          showHeadings={showHeadings}
          showLeadingIcons={showLeadingIcons}
          showTrailingHints={showTrailingHints}
          activeOpenSubmenu={activeOpenSubmenu}
          clearSubmenuHoverTimer={clearSubmenuHoverTimer}
          closeSubmenu={closeSubmenu}
          openSubmenuImmediately={openSubmenuImmediately}
          scheduleSubmenuHoverOpen={scheduleSubmenuHoverOpen}
        />
        {showOnOffItems ? (
          <>
            {showDividers ? <DropdownMenuPanelSeparator /> : null}
            {showHeadings ? (
              <div
                aria-label="Options heading"
                className={LAB_MENU_HEADING_CLASS}
                role="heading"
              >
                Options
              </div>
            ) : null}
            {menuOnOffItems.map((item) => (
              <DropdownMenuItemButton
                key={item.label}
                type="button"
                role="menuitemcheckbox"
                aria-checked={item.checked}
                onClick={() => item.onCheckedChange?.(!item.checked)}
                onFocus={closeSubmenuFromActionRow}
                onPointerEnter={closeSubmenuFromActionRow}
              >
                <DropdownMenuItemContent
                  label={item.label}
                  checked={item.checked}
                  showLeadingIcon={false}
                  showTrailingHints={false}
                  showShortcuts={false}
                />
              </DropdownMenuItemButton>
            ))}
          </>
        ) : null}
      </DropdownMenuPanel>
    </div>
  );
}

function SelectLongMenuContent({
  align,
  onValueChange,
  selectedValue,
  side,
}: {
  align: PlacementAlign;
  onValueChange: (value: string) => void;
  selectedValue: string;
  side: PlacementSide;
}) {
  return (
    <DropdownMenuContent
      aria-label="Number list"
      align={align}
      collisionPadding={8}
      side={side}
      sideOffset={4}
      variant="ui3"
      className="ck-lab-select-long-menu overflow-y-auto overscroll-contain"
      style={{
        maxHeight: 'min(420px, var(--available-height, 420px))',
      }}
    >
      <SelectList value={selectedValue} onValueChange={onValueChange}>
        {SELECT_LONG_MENU_NUMBERS.map((number) => (
          <SelectListItem key={number} value={number}>
            {number}
          </SelectListItem>
        ))}
      </SelectList>
    </DropdownMenuContent>
  );
}

function SelectPlaygroundStage({
  value,
  onValueChange,
  align,
  disabled,
  side,
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
  align: PlacementAlign;
  disabled: boolean;
  side: PlacementSide;
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
  const [numberOpen, setNumberOpen] = useState(false);
  const [numberValue, setNumberValue] = useState('0');
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
  const handleNumberTriggerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || event.ctrlKey) {
        return;
      }

      event.preventDefault();
      event.currentTarget.focus();
    },
    [],
  );
  const handleNumberTriggerClick = useCallback(() => {
    setNumberOpen(true);
  }, []);
  const handleNumberValueChange = useCallback((nextValue: string) => {
    setNumberValue(nextValue);
    setNumberOpen(false);
  }, []);

  return (
    <div className="inline-flex items-center gap-1">
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
          align={align}
          onValueChange={onValueChange}
          side={side}
          showShortcuts={showShortcuts}
          showSubmenus={showSubmenus}
          showDividers={showDividers}
          showLeadingIcons={showLeadingIcons}
          showTrailingHints={showTrailingHints}
        />
      </DropdownMenu>
      <DropdownMenu
        open={numberOpen}
        onOpenChange={(nextOpen) => {
          if (disabled && nextOpen) {
            return;
          }

          setNumberOpen(nextOpen);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Number: ${numberValue}`}
            disabled={disabled}
            onPointerDown={handleNumberTriggerPointerDown}
            onClick={handleNumberTriggerClick}
            className={`box-border inline-flex min-w-6 max-w-[180px] items-center justify-center gap-1.5 rounded-[5px] border px-2 py-0 font-medium leading-4 tracking-[0.005em] outline-none shadow-none transition-[background-color,border-color,color] focus:ring-0 focus-visible:ring-2 focus-visible:ring-[#0d99ff]/80 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-white/25 disabled:hover:border-transparent disabled:hover:bg-transparent data-[state=open]:border-transparent data-[state=open]:bg-[#0d99ff] data-[state=open]:text-white ${TOGGLE_BUTTON_DENSITY_CLASS.compact} ${getToggleButtonStateClass(
              false,
              'default',
            )}`}
          >
            <span className="min-w-0 truncate">{numberValue}</span>
            <ChevronsUpDown
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.75}
            />
          </button>
        </DropdownMenuTrigger>
        <SelectLongMenuContent
          align={align}
          onValueChange={handleNumberValueChange}
          selectedValue={numberValue}
          side={side}
        />
      </DropdownMenu>
    </div>
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
        fields={MULTI_INPUT_FIELDS}
        parseExpression={parsePrimitiveExpression}
      />
    </div>
  );
}

function CheckboxPlaygroundStage({
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="w-[160px] min-w-0 max-w-full">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      >
        {label.trim() || 'Checkbox'}
      </Checkbox>
    </div>
  );
}

function SliderPlaygroundStage({
  channel,
  gamut,
  orientation,
  range,
  hueGradientMode,
  dragEpsilon,
  maxPointerRate,
  markerMode,
}: {
  channel: ColorSliderChannel;
  gamut: OutputGamut;
  orientation: SliderOrientation;
  range: [number, number];
  hueGradientMode: SliderHueGradientMode;
  dragEpsilon: number;
  maxPointerRate: number;
  markerMode: SliderMarkerMode;
}) {
  const color = useColor({
    defaultColor: 'oklch(0.64 0.22 35)',
    defaultGamut: gamut,
  });
  const setSliderGamutRef = useRef(color.setActiveGamut);

  useEffect(() => {
    setSliderGamutRef.current = color.setActiveGamut;
  }, [color.setActiveGamut]);

  useEffect(() => {
    if (color.activeGamut === gamut) {
      return;
    }
    setSliderGamutRef.current(gamut, 'programmatic');
  }, [color.activeGamut, gamut]);

  const sliderRail = useMemo(
    () =>
      getOklchSliderRail(
        channel,
        color.requested,
        color.activeGamut,
        hueGradientMode,
        range,
      ),
    [channel, color.activeGamut, color.requested, hueGradientMode, range],
  );

  return (
    <div
      className={
        orientation === 'vertical'
          ? 'ck-demo-stack ck-slider-single-demo ck-slider-single-demo-vertical'
          : 'ck-demo-stack ck-slider-single-demo'
      }
    >
      <ColorSlider
        channel={channel}
        className="ck-slider ck-slider-v2"
        data-color-space={sliderRail.colorSpace}
        orientation={orientation}
        range={range}
        requested={color.requested}
        onChangeRequested={color.setRequested}
        dragEpsilon={dragEpsilon}
        maxPointerRate={maxPointerRate}
        style={sliderRail.style}
      >
        {channel === 'c' && markerMode === 'auto' ? <ChromaMarkers /> : null}
      </ColorSlider>
    </div>
  );
}

type LabPageNavigationItem = {
  value: LabPageKey;
  label: string;
};

type LabPanelTooltipProviderProps = {
  delayDuration: number;
  skipDelayDuration: number;
};

type LabPageFrameProps = {
  activePage: LabPageKey;
  onPageChange: (page: LabPageKey) => void;
  pages: readonly LabPageNavigationItem[];
  children: ReactNode;
};

function LabPagePreviewFallback() {
  return (
    <div className="size-full min-h-[320px] animate-pulse rounded-[24px] bg-white/[0.04]" />
  );
}

function LabPagePropertiesFallback() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
      <div className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />
      <div className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />
    </div>
  );
}

function LabPageFrameContent({
  activePage,
  onPageChange,
  pages,
  children,
}: LabPageFrameProps) {
  const { panelTooltipProviderProps, preview, properties } =
    useLabPageSlotContent();

  return (
    <div className="min-h-screen overflow-hidden bg-[#171717]">
      <LabHeaderExit />

      <main className="h-screen min-h-screen min-w-0 bg-[#171717] [--ck-lab-segmented-active-bg:#171717] text-white lg:overflow-hidden">
        <div className="grid min-h-screen min-w-0 grid-cols-1 lg:h-full lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="relative flex min-h-[420px] min-w-0 items-center justify-center overflow-hidden px-6 py-10 lg:min-h-0 lg:py-14">
            <PagesPanel
              activePage={activePage}
              onPageChange={onPageChange}
              pages={pages}
            />
            {preview ?? <LabPagePreviewFallback />}
          </section>

          <aside className="min-w-0 max-w-full overflow-hidden border-t border-white/8 p-3 lg:min-h-0 lg:border-t-0 lg:p-4">
            <div className="h-full w-full min-w-0 max-w-full overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.03] [--ck-lab-segmented-active-bg:color-mix(in_srgb,#171717_97%,white_3%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur lg:min-h-0">
              <ScrollArea className={LAB_PANEL_SCROLL_AREA_CLASS}>
                <TooltipProvider
                  delayDuration={panelTooltipProviderProps.delayDuration}
                  skipDelayDuration={
                    panelTooltipProviderProps.skipDelayDuration
                  }
                >
                  <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden p-4">
                    {properties ?? <LabPagePropertiesFallback />}
                  </div>
                </TooltipProvider>
              </ScrollArea>
            </div>
          </aside>
        </div>
      </main>
      {children}
    </div>
  );
}

function LabPageFrame(props: LabPageFrameProps) {
  return (
    <LabPageSlotProvider>
      <LabPageFrameContent {...props} />
    </LabPageSlotProvider>
  );
}

export {
  Background,
  BoundsConfigInput,
  Checkbox,
  CheckboxPlaygroundStage,
  ChromaMarkers,
  ColorApi,
  ColorArea,
  ColorPlane,
  ColorSlider,
  ColorStringInput,
  CONFIGURABLE_MENU_ITEM_IDS,
  CONFIGURABLE_MENU_ITEM_LABELS,
  COLOR_PLANE_MULTI_INPUT_FIELDS,
  DEFAULT_CONFIGURABLE_MENU_ITEMS,
  DEFAULT_MULTI_INPUT_CONFIG,
  DragStepConfigInput,
  DragThresholdConfigInput,
  DynamicLucideIcon,
  FallbackPointsLayer,
  GamutBoundaryLayer,
  InlineConfigurableMenuContent,
  InlineLabMenuContent,
  LAB_PANEL_SCROLL_AREA_CLASS,
  LabMenuContent,
  LabPageFrame,
  LucideIconPicker,
  MULTI_INPUT_FIELD_BY_ID,
  MULTI_INPUT_FIELDS,
  Menu,
  MenuPlaygroundStage,
  MultiInputControl,
  MultiInputPlaygroundStage,
  NumberConfigField,
  PANEL_TWO_COLUMN_GRID_CLASS,
  PanelSection,
  PlacementGridField,
  PrecisionConfigInput,
  PrimitiveValueInput,
  PropertyFieldTooltip,
  Radius,
  SELECT_OPTION_BY_ID,
  SELECT_OPTIONS,
  SLIDER_RANGE_EPSILON,
  SegmentedField,
  SelectLongMenuContent,
  SelectPlaygroundStage,
  Separator,
  SliderPlaygroundStage,
  StepConfigInput,
  TextConfigField,
  ToggleButtonPlaygroundStage,
  ToggleField,
  ToggleGroupPlaygroundStage,
  TooltipPlaygroundStage,
  alternateAxis,
  getOklchSliderRail,
  getToggleButtonStateClass,
  normalizeAxes,
  parsePrimitiveExpression,
  useColor,
};

export type {
  ConfigurableMenuItemConfig,
  ConfigurableMenuItemId,
  ConfigurableMenuItemLeading,
  ConfigurableMenuItemType,
  ColorAreaAxes,
  ColorAreaChannel,
  ColorAreaPerformanceProfile,
  ColorSliderChannel,
  LabMultiInputField,
  LabPageFrameProps,
  LabPageKey,
  LabPageNavigationItem,
  LabPanelTooltipProviderProps,
  MultiInputConfig,
  MultiInputFieldId,
  OutputGamut,
  PlacementAlign,
  PlacementSide,
  PrimitiveDensity,
  PrimitiveHandleContent,
  PrimitiveHandleSide,
  PrimitivePrecision,
  PrimitiveSize,
  PrimitiveVisualState,
  PrimitiveWrapMode,
  SelectOptionId,
  SelectTriggerBehavior,
  SelectTriggerContent,
  SelectTriggerIconTextPlacement,
  SliderMarkerMode,
  SliderHueGradientMode,
  SliderOrientation,
  ToggleButtonContent,
  ToggleButtonInteractionState,
  ToggleButtonSelectionState,
  ToggleGroupIconMode,
  TooltipSide,
};
