import {
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@color-kit/control-kit';
import type { ReactNode } from 'react';

export const SEGMENTED_FIELD_GROUP_CLASS =
  'box-border h-6 min-h-6 w-full min-w-0 max-w-full justify-start gap-0 overflow-hidden rounded-[5px] border-0 bg-[#383838] p-0 shadow-none';

export const SEGMENTED_FIELD_ITEM_ACTIVE_BG_CLASS =
  'bg-[var(--ck-lab-segmented-active-bg,#171717)] data-[pressed]:!bg-[var(--ck-lab-segmented-active-bg,#171717)]';

export const SEGMENTED_FIELD_ITEM_CLASS = `h-full min-h-0 w-full min-w-0 flex-1 rounded-[5px] border px-2 py-0 text-[11px] font-medium leading-4 tracking-[0.005em] transition-[background-color,color] hover:text-white/70 focus-visible:ring-2 focus-visible:ring-[#0d99ff]/80 focus-visible:ring-offset-0 data-[pressed]:!text-white/90 data-[pressed]:!shadow-none ${SEGMENTED_FIELD_ITEM_ACTIVE_BG_CLASS}`;

export function getSegmentedFieldItemStateClass(isSelected: boolean): string {
  return isSelected
    ? `border-[#4C4C4C] ${SEGMENTED_FIELD_ITEM_ACTIVE_BG_CLASS} text-white/90 shadow-none`
    : 'border-transparent bg-transparent text-white/50 shadow-none';
}

export function SegmentedField<T extends string>({
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
