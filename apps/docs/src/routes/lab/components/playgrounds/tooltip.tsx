import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@color-kit/control-kit';
import {
  TOOLTIP_RAPID_TRIGGER_ITEMS,
  TOOLTIP_SIDE_DEMO_ITEMS,
} from '../../fixtures/tooltip-items.js';
import type { PlacementAlign, TooltipSide } from '../../types.js';

export function TooltipPlaygroundStage({
  align,
  delayDuration,
  highContrast,
  skipDelayDuration,
  side,
  showPointer,
}: {
  align: PlacementAlign;
  delayDuration: number;
  highContrast: boolean;
  skipDelayDuration: number;
  side: TooltipSide;
  showPointer: boolean;
}) {
  return (
    <TooltipProvider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
    >
      <div className="relative flex w-full max-w-xl flex-col items-center gap-8">
        <div className="flex justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/75 outline-none transition-[background-color,border-color,color] hover:border-white/20 hover:bg-white/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
              >
                Hover
              </button>
            </TooltipTrigger>
            <TooltipContent
              align={align}
              highContrast={highContrast}
              side={side}
              showPointer={showPointer}
            >
              Hover trigger
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="space-y-3 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
            Rapid succession triggering
          </p>
          <div className="grid grid-cols-7 gap-0">
            {TOOLTIP_RAPID_TRIGGER_ITEMS.map(({ name, Icon }) => (
              <Tooltip key={name}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={name}
                    className="flex size-[37px] items-center justify-center rounded-none text-white/50 outline-none transition-[background-color,box-shadow,color,transform] hover:bg-white/[0.07] hover:text-white/90 focus-visible:bg-white/[0.06] focus-visible:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5288db]/80 active:scale-[0.96] active:bg-white/[0.12] active:text-white"
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-3.5"
                      strokeWidth={1.75}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  align={align}
                  highContrast={highContrast}
                  side={side}
                  showPointer={showPointer}
                >
                  {name}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
        <div className="space-y-3 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
            Fixed placement samples
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {TOOLTIP_SIDE_DEMO_ITEMS.map((item) => (
              <Tooltip key={item.side}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="h-9 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-medium capitalize text-white/65 outline-none transition-[background-color,border-color,color] hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
                  >
                    {item.side}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  align={align}
                  highContrast={highContrast}
                  side={item.side}
                  showPointer={showPointer}
                >
                  {item.tooltip}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
