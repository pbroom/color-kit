export type ConfigurableMenuItemId = 'itemOne' | 'itemTwo' | 'itemThree';
export type ConfigurableMenuItemType = 'default' | 'onOff' | 'submenu';
export type ConfigurableMenuItemLeading = 'none' | 'icon' | 'avatar';
export type ConfigurableMenuItemConfig = {
  type: ConfigurableMenuItemType;
  leading: ConfigurableMenuItemLeading;
  label: string;
  secondaryText: string;
  checked: boolean;
  disabled: boolean;
};

export const CONFIGURABLE_MENU_ITEM_IDS: ConfigurableMenuItemId[] = [
  'itemOne',
  'itemTwo',
  'itemThree',
];

export const CONFIGURABLE_MENU_ITEM_LABELS: Record<
  ConfigurableMenuItemId,
  string
> = {
  itemOne: 'Item 1',
  itemTwo: 'Item 2',
  itemThree: 'Item 3',
};

export const DEFAULT_CONFIGURABLE_MENU_ITEMS: Record<
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
