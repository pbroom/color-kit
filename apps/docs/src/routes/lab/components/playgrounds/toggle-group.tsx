import { ToggleGroup, ToggleGroupItem } from '@color-kit/control-kit';
import { TOGGLE_GROUP_ITEMS } from '../../fixtures/toggle-items.js';
import {
  SEGMENTED_FIELD_GROUP_CLASS,
  SEGMENTED_FIELD_ITEM_CLASS,
  getSegmentedFieldItemStateClass,
} from '../panel/segmented-field.js';
import type { ToggleGroupIconMode } from '../../types.js';

export function ToggleGroupPlaygroundStage({
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
