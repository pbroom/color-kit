import * as React from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type LabMenuVariant = 'default' | 'ui3';
type LabMenuDensity = 'compact' | 'comfortable';
type LabMenuPanelKind = 'content' | 'subcontent';
type SelectListOpenAlignment = 'selected' | 'none';
type LabMenuItemIcon = React.ComponentType<
  React.SVGProps<SVGSVGElement> & { strokeWidth?: number }
>;

// NOTE: These constants mirror the UI3 style constants in dropdown-menu.tsx.
// Keep both files aligned when the UI3 visual design changes.
const labMenuUi3OpenAnimationClass =
  'data-[open]:[animation-delay:-35ms] data-[open]:[animation-duration:90ms] data-[open]:[animation-fill-mode:both] data-[open]:[animation-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[open]:[--tw-enter-opacity:0.28] data-[open]:[--tw-enter-scale:0.985] data-[open]:[--tw-enter-translate-y:-1px] motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none';
const labMenuUi3ContentClass = `w-[208px] rounded-[13px] border-0 bg-[#1e1e1e] p-2 text-white shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_10px_16px_0_rgba(0,0,0,0.12),0_2px_5px_0_rgba(0,0,0,0.15)] ${labMenuUi3OpenAnimationClass}`;
const labMenuUi3SubContentClass = `w-[176px] rounded-[13px] border-0 bg-[#1e1e1e] p-2 text-white shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_10px_16px_0_rgba(0,0,0,0.12),0_2px_5px_0_rgba(0,0,0,0.15)] ${labMenuUi3OpenAnimationClass}`;
const labMenuUi3ItemDensityClass: Record<LabMenuDensity, string> = {
  compact: 'h-6 min-h-6',
  comfortable: 'h-7 min-h-7',
};
const labMenuUi3ItemClass =
  'group relative flex w-full cursor-default select-none items-center justify-start gap-0 rounded-[5px] px-2 py-0 text-left text-[11px] font-[450] leading-4 tracking-[0.005em] text-white outline-none hover:bg-[#0d99ff] hover:text-white focus-visible:bg-[#0d99ff] focus-visible:text-white data-[dropdown-menu-typeahead-active=true]:!bg-[#0d99ff] data-[dropdown-menu-typeahead-active=true]:!text-white data-[highlighted]:bg-[#0d99ff] data-[highlighted]:text-white data-[popup-open]:bg-[#303030] data-[popup-open]:text-white data-[highlighted]:data-[popup-open]:bg-[#0d99ff] data-[dropdown-menu-submenu-child-active=true]:!bg-[#303030] data-[dropdown-menu-submenu-child-active=true]:!text-white data-[dropdown-menu-suppress-pointer-hover=true]:hover:bg-transparent data-[dropdown-menu-suppress-pointer-hover=true]:hover:text-white data-[dropdown-menu-suppress-pointer-hover=true]:data-[highlighted]:bg-transparent data-[dropdown-menu-suppress-pointer-hover=true]:data-[highlighted]:text-white';
const labMenuUi3ItemDisabledClass =
  'disabled:text-white/35 disabled:hover:bg-transparent data-[disabled]:text-white/35 data-[disabled]:hover:bg-transparent data-[disabled]:focus-visible:bg-transparent';
const labMenuUi3SeparatorClass = 'mx-0 my-2 h-px bg-[#383838]';
const labMenuUi3CheckColumnClass =
  '-ml-1 flex h-6 w-4 shrink-0 items-center justify-start';
const labMenuUi3LeadingColumnClass =
  'flex size-6 shrink-0 items-center justify-center';

const LabMenuItemLayoutContext = React.createContext({
  reserveCheckColumn: false,
  reserveLeadingColumn: false,
});
const SelectListContext = React.createContext<{
  closeOnSelect: boolean;
  onValueChange?: (value: string) => void;
  value?: string;
} | null>(null);

function getTextFromNode(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return node.toString();
  }

  return '';
}

function getLabMenuPanelClass({
  variant,
  panel,
}: {
  variant: LabMenuVariant;
  panel: LabMenuPanelKind;
}) {
  if (variant !== 'ui3') {
    return null;
  }

  return panel === 'subcontent'
    ? labMenuUi3SubContentClass
    : labMenuUi3ContentClass;
}

function getLabMenuItemClass({
  variant,
  density,
}: {
  variant: LabMenuVariant;
  density: LabMenuDensity;
}) {
  if (variant !== 'ui3') {
    return null;
  }

  return cn(
    labMenuUi3ItemDensityClass[density],
    labMenuUi3ItemClass,
    labMenuUi3ItemDisabledClass,
  );
}

function LabMenuUi3CheckIcon() {
  return (
    <span aria-hidden="true" className="relative size-4 shrink-0 text-current">
      <svg
        className="absolute left-1 top-1 h-[7px] w-2 overflow-visible"
        viewBox="0 0 8 7"
        fill="none"
      >
        <path
          d="M1 3.5 3 5.5 7 1"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </span>
  );
}

function DropdownMenuPanel({
  className,
  variant = 'ui3',
  panel = 'content',
  reserveCheckColumn = false,
  reserveLeadingColumn = false,
  role = 'menu',
  ...props
}: React.ComponentProps<'div'> & {
  variant?: LabMenuVariant;
  panel?: LabMenuPanelKind;
  reserveCheckColumn?: boolean;
  reserveLeadingColumn?: boolean;
}) {
  return (
    <LabMenuItemLayoutContext.Provider
      value={{ reserveCheckColumn, reserveLeadingColumn }}
    >
      <div
        data-slot="dropdown-menu-panel"
        role={role}
        className={cn(getLabMenuPanelClass({ variant, panel }), className)}
        {...props}
      />
    </LabMenuItemLayoutContext.Provider>
  );
}

function DropdownMenuPanelSeparator({
  className,
  variant = 'ui3',
  ...props
}: React.ComponentProps<'div'> & {
  variant?: LabMenuVariant;
}) {
  return (
    <div
      data-slot="dropdown-menu-panel-separator"
      className={cn(
        variant === 'ui3' ? labMenuUi3SeparatorClass : 'h-px bg-border',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItemButton({
  className,
  typeaheadLabel,
  variant = 'ui3',
  density = 'compact',
  type = 'button',
  role = 'menuitem',
  ...props
}: React.ComponentProps<'button'> & {
  typeaheadLabel?: string;
  variant?: LabMenuVariant;
  density?: LabMenuDensity;
}) {
  return (
    <button
      type={type}
      role={role}
      data-slot="dropdown-menu-item-button"
      data-dropdown-menu-typeahead-item=""
      data-dropdown-menu-typeahead-label={typeaheadLabel}
      className={cn(
        variant === 'ui3'
          ? getLabMenuItemClass({ variant, density })
          : 'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItemContent({
  className,
  label,
  disabled = false,
  leadingIcon: LeadingIcon,
  leadingAvatar,
  checked = false,
  reserveCheckColumn,
  reserveLeadingColumn,
  showLeadingIcon = true,
  shortcut,
  trailingHint,
  showShortcuts = true,
  showTrailingHints = true,
  submenuCaret = false,
}: {
  className?: string;
  label: React.ReactNode;
  disabled?: boolean;
  leadingIcon?: LabMenuItemIcon;
  leadingAvatar?: string;
  checked?: boolean;
  reserveCheckColumn?: boolean;
  reserveLeadingColumn?: boolean;
  showLeadingIcon?: boolean;
  shortcut?: string;
  trailingHint?: string;
  showShortcuts?: boolean;
  showTrailingHints?: boolean;
  submenuCaret?: boolean;
}) {
  const menuItemLayout = React.useContext(LabMenuItemLayoutContext);
  const resolvedReserveCheckColumn =
    reserveCheckColumn ?? menuItemLayout.reserveCheckColumn;
  const resolvedReserveLeadingColumn =
    reserveLeadingColumn ?? menuItemLayout.reserveLeadingColumn;
  const trailingText = submenuCaret
    ? undefined
    : showShortcuts && shortcut
      ? shortcut
      : showTrailingHints && trailingHint
        ? trailingHint
        : undefined;
  const showIconGlyph = Boolean(showLeadingIcon && LeadingIcon);
  const showAvatarGlyph = Boolean(showLeadingIcon && leadingAvatar);
  const shouldShowLeadingColumn =
    resolvedReserveLeadingColumn || showIconGlyph || showAvatarGlyph;

  return (
    <span
      className={cn(
        'relative flex w-full min-w-0 items-center gap-1',
        className,
      )}
    >
      {resolvedReserveCheckColumn || checked ? (
        <span
          className={cn(
            labMenuUi3CheckColumnClass,
            'text-white/70 group-data-[disabled]:text-white/35',
            disabled && 'text-white/35',
          )}
        >
          {checked ? <LabMenuUi3CheckIcon /> : null}
        </span>
      ) : null}
      {shouldShowLeadingColumn ? (
        <span className={`${labMenuUi3LeadingColumnClass} text-current`}>
          {showAvatarGlyph ? (
            <span
              aria-hidden="true"
              className="flex size-4 items-center justify-center rounded-full bg-white/18 text-[9px] font-semibold uppercase leading-none text-white"
            >
              {leadingAvatar}
            </span>
          ) : showIconGlyph && LeadingIcon ? (
            <LeadingIcon
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.75}
            />
          ) : null}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailingText ? (
        <span
          className={cn(
            'min-w-0 shrink-0 text-right text-white/70 group-data-[disabled]:text-white/35',
            disabled && 'text-white/35',
          )}
        >
          {trailingText}
        </span>
      ) : null}
      {submenuCaret ? (
        <span
          aria-hidden="true"
          className="relative flex size-6 shrink-0 items-center justify-center text-current"
        >
          <svg
            className="h-[5.25px] w-[3.33px] overflow-visible"
            viewBox="0 0 4 6"
            fill="none"
          >
            <path
              d="M0.75 0.75 3.25 3 0.75 5.25"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.2"
            />
          </svg>
        </span>
      ) : null}
    </span>
  );
}

function SelectList({
  children,
  closeOnSelect = true,
  onValueChange,
  openAlignment = 'selected',
  value,
  ...props
}: React.ComponentProps<'div'> & {
  closeOnSelect?: boolean;
  onValueChange?: (value: string) => void;
  openAlignment?: SelectListOpenAlignment;
  value?: string;
}) {
  const contextValue = React.useMemo(
    () => ({
      closeOnSelect,
      onValueChange,
      value,
    }),
    [closeOnSelect, onValueChange, value],
  );

  return (
    <SelectListContext.Provider value={contextValue}>
      <div
        role="group"
        data-select-list=""
        data-select-list-open-alignment={openAlignment}
        {...props}
      >
        {children}
      </div>
    </SelectListContext.Provider>
  );
}

function SelectListItem({
  children,
  className,
  density = 'compact',
  disabled,
  onSelect,
  shortcut,
  showShortcuts = true,
  showTrailingHints = true,
  trailingHint,
  typeaheadLabel,
  value,
  variant = 'ui3',
  ...props
}: Omit<
  React.ComponentProps<typeof DropdownMenuItem>,
  'children' | 'onSelect'
> & {
  children: React.ReactNode;
  density?: LabMenuDensity;
  onSelect?: React.ComponentProps<typeof DropdownMenuItem>['onSelect'];
  shortcut?: string;
  showShortcuts?: boolean;
  showTrailingHints?: boolean;
  trailingHint?: string;
  typeaheadLabel?: string;
  value: string;
  variant?: LabMenuVariant;
}) {
  const selectList = React.useContext(SelectListContext);
  const checked = selectList?.value === value;
  const label = typeaheadLabel ?? (getTextFromNode(children) || value);

  return (
    <DropdownMenuItem
      aria-checked={checked}
      className={className}
      data-select-list-item=""
      data-select-list-item-value={value}
      density={density}
      disabled={disabled}
      role="menuitemradio"
      closeOnClick={selectList?.closeOnSelect ?? true}
      typeaheadLabel={label}
      variant={variant}
      onSelect={(event) => {
        onSelect?.(event);
        if (event.defaultPrevented || disabled) {
          return;
        }

        selectList?.onValueChange?.(value);
        if (selectList && !selectList.closeOnSelect) {
          event.preventDefault();
        }
      }}
      {...props}
    >
      <DropdownMenuItemContent
        label={children}
        checked={checked}
        disabled={disabled}
        reserveCheckColumn
        showLeadingIcon={false}
        showShortcuts={showShortcuts}
        showTrailingHints={showTrailingHints}
        shortcut={shortcut}
        trailingHint={trailingHint}
      />
    </DropdownMenuItem>
  );
}

export {
  DropdownMenuPanel,
  DropdownMenuPanelSeparator,
  DropdownMenuItemButton,
  DropdownMenuItemContent,
  SelectList,
  SelectListItem,
};
