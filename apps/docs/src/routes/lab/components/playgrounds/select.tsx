import { ChevronDown, ChevronsUpDown, Grid3X3 } from 'lucide-react';
import {
  useCallback,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SELECT_OPTIONS,
  SELECT_OPTION_BY_ID,
  type SelectOptionId,
} from '../../fixtures/select-options.js';
import type {
  PlacementAlign,
  PlacementSide,
  SelectTriggerBehavior,
  SelectTriggerContent,
  SelectTriggerIconTextPlacement,
} from '../../types.js';
import { LabMenuContent, SelectLongMenuContent } from './menu-content.js';
import {
  TOGGLE_BUTTON_DENSITY_CLASS,
  getToggleButtonStateClass,
} from './toggle-button.js';

export function SelectPlaygroundStage({
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
