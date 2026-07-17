import type { PrimitiveDensity } from '@color-kit/control-kit';
import { TOGGLE_BUTTON_ICON } from '../../fixtures/toggle-items.js';
import type {
  ToggleButtonContent,
  ToggleButtonInteractionState,
  ToggleButtonSelectionState,
} from '../../types.js';

export const TOGGLE_BUTTON_DENSITY_CLASS: Record<PrimitiveDensity, string> = {
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

export function getToggleButtonStateClass(
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

export function ToggleButtonPlaygroundStage({
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
