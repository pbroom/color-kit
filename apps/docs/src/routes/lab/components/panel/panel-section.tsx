import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@color-kit/control-kit';
import type { ReactNode } from 'react';

export const PANEL_TWO_COLUMN_GRID_CLASS =
  'grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3';

export function PanelSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="w-full min-w-0 max-w-full space-y-3 overflow-x-hidden">
      <div className="w-full min-w-0 max-w-full space-y-1">
        <h2 className="text-sm font-medium tracking-tight text-white">
          {title}
        </h2>
        {description ? (
          <p className="text-xs leading-relaxed text-white/55">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function PropertyFieldTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-full min-w-0 max-w-full">{children}</div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
