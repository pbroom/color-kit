import {
  ArrowBigDown,
  ArrowBigUp,
  ArrowLeftToLine,
  ArrowRightToLine,
  Box,
  BringToFront,
  Clipboard,
  Code,
  Copy,
  FileText,
  Image,
  Layers,
  type LucideIcon,
} from 'lucide-react';

export type SelectOptionId =
  | 'copy'
  | 'pasteAs'
  | 'selectLayer'
  | 'bringToFront'
  | 'groupSelection';

export type SelectSubmenuItem = {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  icon?: LucideIcon;
  trailingHint?: string;
};

export type SelectOption = {
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

export const SELECT_OPTIONS: SelectOption[] = [
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

export const SELECT_LONG_MENU_NUMBERS = Array.from(
  { length: 101 },
  (_, index) => index.toString(),
);

export const SELECT_OPTION_BY_ID = SELECT_OPTIONS.reduce(
  (options, option) => ({
    ...options,
    [option.value]: option,
  }),
  {} as Record<SelectOptionId, SelectOption>,
);

export function getHeadingForSelectOption(option: SelectOption): string | null {
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
