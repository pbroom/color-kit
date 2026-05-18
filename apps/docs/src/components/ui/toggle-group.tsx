import * as React from 'react';
import {
  ToggleGroup as ToggleGroupPrimitive,
  type ToggleGroupChangeEventDetails,
} from '@base-ui/react/toggle-group';
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
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
  'inline-flex items-center justify-center rounded-md px-2.5 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 data-[pressed]:bg-background data-[pressed]:text-foreground data-[pressed]:shadow-sm disabled:pointer-events-none disabled:opacity-50',
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

type ToggleGroupSingleProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive>,
  'className' | 'defaultValue' | 'multiple' | 'onValueChange' | 'value'
> & {
  type?: 'single';
  value?: string;
  defaultValue?: string;
  onValueChange?: (
    value: string,
    eventDetails: ToggleGroupChangeEventDetails,
  ) => void;
};

type ToggleGroupMultipleProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive>,
  'className' | 'defaultValue' | 'multiple' | 'onValueChange' | 'value'
> & {
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (
    value: string[],
    eventDetails: ToggleGroupChangeEventDetails,
  ) => void;
};

type ToggleGroupProps = (ToggleGroupSingleProps | ToggleGroupMultipleProps) &
  VariantProps<typeof toggleGroupVariants> & {
    className?: string;
    loop?: boolean;
  };

function ToggleGroup({
  className,
  variant,
  size,
  children,
  defaultValue,
  loop,
  onValueChange,
  type = 'single',
  value,
  ...props
}: ToggleGroupProps) {
  const multiple = type === 'multiple';
  const primitiveValue = React.useMemo(
    () =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value],
    [value],
  );
  const primitiveDefaultValue = React.useMemo(
    () =>
      defaultValue === undefined
        ? undefined
        : Array.isArray(defaultValue)
          ? defaultValue
          : [defaultValue],
    [defaultValue],
  );

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(toggleGroupVariants({ variant, size }), className)}
      defaultValue={primitiveDefaultValue}
      loopFocus={loop}
      multiple={multiple}
      value={primitiveValue}
      onValueChange={(nextValue, eventDetails) => {
        if (multiple) {
          (
            onValueChange as
              | ToggleGroupMultipleProps['onValueChange']
              | undefined
          )?.(nextValue, eventDetails);
          return;
        }

        (
          onValueChange as ToggleGroupSingleProps['onValueChange'] | undefined
        )?.(nextValue[0] ?? '', eventDetails);
      }}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive>
  );
}

function ToggleGroupItem({
  className,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive> &
  VariantProps<typeof toggleGroupItemVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(toggleGroupItemVariants({ size }), className)}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
