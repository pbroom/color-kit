import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type CheckboxProps = Omit<React.ComponentProps<'button'>, 'onChange'> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  indicatorClassName?: string;
  labelClassName?: string;
};

function Checkbox({
  checked,
  onCheckedChange,
  indicatorClassName,
  labelClassName,
  className,
  children,
  disabled,
  onClick,
  type = 'button',
  ...props
}: CheckboxProps) {
  return (
    <button
      type={type}
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      data-slot="checkbox"
      className={cn(
        'relative flex min-h-6 min-w-0 max-w-full items-center gap-2 py-1 text-left text-[11px] font-medium leading-4 tracking-[0.005em] text-white/80 outline-none focus-visible:ring-2 focus-visible:ring-[#0d99ff]/80 disabled:cursor-not-allowed disabled:text-white/35',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) {
          return;
        }
        onCheckedChange?.(!checked);
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        data-slot="checkbox-indicator"
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-[5px] border text-white transition-[background-color,border-color]',
          checked
            ? 'border-[#007be5] bg-[#0d99ff]'
            : 'border-[#4C4C4C] bg-[#383838]',
          disabled &&
            (checked
              ? 'border-[#0d99ff]/40 bg-[#0d99ff]/40'
              : 'border-white/15 bg-[#383838]/60'),
          indicatorClassName,
        )}
      >
        {checked ? (
          <Check aria-hidden="true" className="size-3" strokeWidth={3} />
        ) : null}
      </span>
      {children ? (
        <span
          data-slot="checkbox-label"
          className={cn('min-w-0', labelClassName)}
        >
          {children}
        </span>
      ) : null}
    </button>
  );
}

export { Checkbox };
