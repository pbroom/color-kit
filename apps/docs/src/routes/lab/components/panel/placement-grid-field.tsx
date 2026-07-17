import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@color-kit/control-kit';
import {
  useCallback,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { PLACEMENT_GRID_OPTIONS } from '../../fixtures/placement-grid-options.js';
import type { PlacementAlign, PlacementSide } from '../../types.js';

export function PlacementGridField({
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
