import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type CheckboxProps = Omit<
  React.ComponentProps<typeof CheckboxPrimitive.Root>,
  'checked' | 'className' | 'onChange' | 'onCheckedChange'
> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  indicatorClassName?: string;
  labelClassName?: string;
  className?: string;
  type?: React.ButtonHTMLAttributes<HTMLButtonElement>['type'];
};

function Checkbox({
  checked,
  onCheckedChange,
  indicatorClassName,
  labelClassName,
  className,
  children,
  disabled,
  type: _type = 'button',
  ...props
}: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      disabled={disabled}
      data-slot="checkbox"
      className={cn(
        'relative flex min-h-6 min-w-0 max-w-full items-center gap-2 py-1 text-left text-[11px] font-medium leading-4 tracking-[0.005em] text-white/80 outline-none focus-visible:ring-2 focus-visible:ring-[#0d99ff]/80 data-[disabled]:cursor-not-allowed data-[disabled]:text-white/35',
        className,
      )}
      onCheckedChange={onCheckedChange}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        keepMounted
        data-slot="checkbox-indicator"
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-[5px] border text-white transition-[background-color,border-color] data-[checked]:border-[#007be5] data-[checked]:bg-[#0d99ff] data-[unchecked]:border-[#4C4C4C] data-[unchecked]:bg-[#383838] data-[checked]:data-[disabled]:border-[#0d99ff]/40 data-[checked]:data-[disabled]:bg-[#0d99ff]/40 data-[unchecked]:data-[disabled]:border-white/15 data-[unchecked]:data-[disabled]:bg-[#383838]/60 [&[data-unchecked]>svg]:opacity-0',
          indicatorClassName,
        )}
      >
        <Check aria-hidden="true" className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
      {children ? (
        <span
          data-slot="checkbox-label"
          className={cn('min-w-0', labelClassName)}
        >
          {children}
        </span>
      ) : null}
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
