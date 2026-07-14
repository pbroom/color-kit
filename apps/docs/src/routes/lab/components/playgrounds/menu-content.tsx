import { Sparkles } from 'lucide-react';
import {
  Fragment,
  useCallback,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DropdownMenuItemButton,
  DropdownMenuItemContent,
  DropdownMenuPanel,
  DropdownMenuPanelSeparator,
  SelectList,
  SelectListItem,
} from '../../lab-menu.js';
import {
  SELECT_LONG_MENU_NUMBERS,
  SELECT_OPTIONS,
  getHeadingForSelectOption,
  type SelectOption,
  type SelectOptionId,
  type SelectSubmenuItem,
} from '../../fixtures/select-options.js';
import {
  CONFIGURABLE_MENU_ITEM_IDS,
  type ConfigurableMenuItemConfig,
  type ConfigurableMenuItemId,
} from '../../fixtures/menu-items.js';
import { useSubmenuHoverTimer } from '../../hooks/use-submenu-hover-timer.js';
import type { PlacementAlign, PlacementSide } from '../../types.js';

export type LabMenuSurface = 'dropdown' | 'inline';

export const LAB_MENU_HEADING_CLASS =
  'block w-full px-2 py-1 text-left text-[11px] font-[450] leading-4 tracking-[0.005em] text-white/40 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/20';

function isSubmenuOpenKey(event: ReactKeyboardEvent<HTMLElement>): boolean {
  return (
    event.key === 'ArrowRight' ||
    event.key === 'Enter' ||
    event.key === ' ' ||
    event.key === 'Spacebar'
  );
}

export function LabMenuOptionRows({
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

export function LabMenuContent({
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

export function InlineConfigurableMenuContent({
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

export function InlineLabMenuContent({
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

export function SelectLongMenuContent({
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
