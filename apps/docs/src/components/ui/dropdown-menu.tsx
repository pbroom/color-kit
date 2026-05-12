import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

type DropdownMenuVariant = 'default' | 'ui3';
type DropdownMenuDensity = 'compact' | 'comfortable';
type DropdownMenuPanelKind = 'content' | 'subcontent';
type DropdownMenuItemIcon = React.ComponentType<
  React.SVGProps<SVGSVGElement> & { strokeWidth?: number }
>;

const dropdownMenuUi3OpenAnimationClass =
  'data-[state=open]:[animation-delay:-35ms] data-[state=open]:[animation-duration:90ms] data-[state=open]:[animation-fill-mode:both] data-[state=open]:[animation-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[state=open]:[--tw-enter-opacity:0.28] data-[state=open]:[--tw-enter-scale:0.985] data-[state=open]:[--tw-enter-translate-y:-1px] motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none';
const dropdownMenuUi3ContentClass = `w-[208px] rounded-[13px] border-0 bg-[#1e1e1e] p-2 text-white shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_10px_16px_0_rgba(0,0,0,0.12),0_2px_5px_0_rgba(0,0,0,0.15)] ${dropdownMenuUi3OpenAnimationClass}`;
const dropdownMenuUi3SubContentClass = `w-[176px] rounded-[13px] border-0 bg-[#1e1e1e] p-2 text-white shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_10px_16px_0_rgba(0,0,0,0.12),0_2px_5px_0_rgba(0,0,0,0.15)] ${dropdownMenuUi3OpenAnimationClass}`;
const dropdownMenuUi3ItemDensityClass: Record<DropdownMenuDensity, string> = {
  compact: 'h-6 min-h-6',
  comfortable: 'h-7 min-h-7',
};
const dropdownMenuUi3ItemClass =
  'relative flex w-full cursor-default select-none items-center justify-start gap-0 rounded-[5px] px-2 py-0 text-left text-[11px] font-[450] leading-4 tracking-[0.005em] text-white outline-none hover:bg-[#0d99ff] hover:text-white focus-visible:bg-[#0d99ff] focus-visible:text-white data-[highlighted]:bg-[#0d99ff] data-[highlighted]:text-white data-[state=open]:bg-[#303030] data-[state=open]:text-white data-[highlighted]:data-[state=open]:bg-[#0d99ff]';
const dropdownMenuUi3ItemDisabledClass =
  'disabled:text-white/35 disabled:hover:bg-transparent data-[disabled]:text-white/35 data-[disabled]:hover:bg-transparent data-[disabled]:focus-visible:bg-transparent';
const dropdownMenuUi3SeparatorClass = 'mx-0 my-2 h-px bg-[#383838]';
const dropdownMenuUi3CheckColumnClass =
  '-ml-1 flex h-6 w-4 shrink-0 items-center justify-start';
const dropdownMenuUi3LeadingColumnClass =
  'flex size-6 shrink-0 items-center justify-center';

const DropdownMenuItemLayoutContext = React.createContext({
  reserveCheckColumn: false,
  reserveLeadingColumn: false,
});

function dropdownMenuUi3TrailingClass(disabled: boolean): string {
  return disabled ? 'text-white/35' : 'text-white/70';
}

function getDropdownMenuPanelClass({
  variant,
  panel,
}: {
  variant: DropdownMenuVariant;
  panel: DropdownMenuPanelKind;
}) {
  if (variant !== 'ui3') {
    return null;
  }

  return panel === 'subcontent'
    ? dropdownMenuUi3SubContentClass
    : dropdownMenuUi3ContentClass;
}

function getDropdownMenuItemClass({
  variant,
  density,
}: {
  variant: DropdownMenuVariant;
  density: DropdownMenuDensity;
}) {
  if (variant !== 'ui3') {
    return null;
  }

  return cn(
    dropdownMenuUi3ItemDensityClass[density],
    dropdownMenuUi3ItemClass,
    dropdownMenuUi3ItemDisabledClass,
  );
}

function DropdownMenuUi3CheckIcon() {
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

function DropdownMenu(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>,
) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>,
) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

function DropdownMenuPortal(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>,
) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  variant?: DropdownMenuVariant;
}) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          variant === 'ui3'
            ? [
                'z-50',
                getDropdownMenuPanelClass({
                  variant,
                  panel: 'content',
                }),
              ]
            : 'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  density = 'compact',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: DropdownMenuVariant;
  density?: DropdownMenuDensity;
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        variant === 'ui3'
          ? getDropdownMenuItemClass({ variant, density })
          : 'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        variant === 'default' && inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>,
) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn(
        'px-2 py-1.5 text-sm font-semibold',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator> & {
  variant?: DropdownMenuVariant;
}) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(
        variant === 'ui3'
          ? dropdownMenuUi3SeparatorClass
          : '-mx-1 my-1 h-px bg-border',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn('ml-auto text-xs tracking-widest opacity-60', className)}
      {...props}
    />
  );
}

function DropdownMenuGroup(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Group>,
) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

function DropdownMenuSub(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>,
) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  variant = 'default',
  density = 'compact',
  showDefaultChevron,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
  variant?: DropdownMenuVariant;
  density?: DropdownMenuDensity;
  showDefaultChevron?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={cn(
        variant === 'ui3'
          ? getDropdownMenuItemClass({ variant, density })
          : 'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent',
        variant === 'default' && inset && 'pl-8',
        className,
      )}
      {...props}
    >
      {children}
      {(showDefaultChevron ?? variant === 'default') ? (
        <ChevronRight className="ml-auto size-4" />
      ) : null}
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent> & {
  variant?: DropdownMenuVariant;
}) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        variant === 'ui3'
          ? [
              'z-50',
              getDropdownMenuPanelClass({
                variant,
                panel: 'subcontent',
              }),
            ]
          : 'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuPanel({
  className,
  variant = 'default',
  panel = 'content',
  reserveCheckColumn = false,
  reserveLeadingColumn = false,
  ...props
}: React.ComponentProps<'div'> & {
  variant?: DropdownMenuVariant;
  panel?: DropdownMenuPanelKind;
  reserveCheckColumn?: boolean;
  reserveLeadingColumn?: boolean;
}) {
  return (
    <DropdownMenuItemLayoutContext.Provider
      value={{ reserveCheckColumn, reserveLeadingColumn }}
    >
      <div
        data-slot="dropdown-menu-panel"
        className={cn(getDropdownMenuPanelClass({ variant, panel }), className)}
        {...props}
      />
    </DropdownMenuItemLayoutContext.Provider>
  );
}

function DropdownMenuPanelSeparator({
  className,
  variant = 'ui3',
  ...props
}: React.ComponentProps<'div'> & {
  variant?: DropdownMenuVariant;
}) {
  return (
    <div
      data-slot="dropdown-menu-panel-separator"
      className={cn(
        variant === 'ui3' ? dropdownMenuUi3SeparatorClass : 'h-px bg-border',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItemButton({
  className,
  variant = 'ui3',
  density = 'compact',
  ...props
}: React.ComponentProps<'button'> & {
  variant?: DropdownMenuVariant;
  density?: DropdownMenuDensity;
}) {
  return (
    <button
      data-slot="dropdown-menu-item-button"
      className={cn(
        variant === 'ui3'
          ? getDropdownMenuItemClass({ variant, density })
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
  leadingIcon?: DropdownMenuItemIcon;
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
  const menuItemLayout = React.useContext(DropdownMenuItemLayoutContext);
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
        <span className={`${dropdownMenuUi3CheckColumnClass} text-current`}>
          {checked ? <DropdownMenuUi3CheckIcon /> : null}
        </span>
      ) : null}
      {shouldShowLeadingColumn ? (
        <span className={`${dropdownMenuUi3LeadingColumnClass} text-current`}>
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
            'min-w-0 shrink-0 text-right',
            dropdownMenuUi3TrailingClass(disabled),
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

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPanel,
  DropdownMenuPanelSeparator,
  DropdownMenuItemButton,
  DropdownMenuItemContent,
};
