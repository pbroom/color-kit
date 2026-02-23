import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const toggleGroupVariants = cva('flex items-center justify-center gap-1', {
  variants: {
    variant: {
      default: 'rounded-lg bg-muted p-1',
      outline: 'rounded-lg border p-1',
    },
    size: {
      default: 'h-9',
      sm: 'h-8',
      lg: 'h-10',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

const toggleGroupItemVariants = cva(
  'inline-flex items-center justify-center rounded-md px-2.5 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      size: {
        default: 'h-7 min-w-7',
        sm: 'h-6 min-w-6 text-xs',
        lg: 'h-8 min-w-8',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleGroupVariants>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(toggleGroupVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleGroupItemVariants>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(toggleGroupItemVariants({ size }), className)}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
