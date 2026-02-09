'use client';

import {
  forwardRef,
  useCallback,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { Color } from '@color-kit/core';
import { Swatch } from '@/components/swatch';

export interface SwatchGroupProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /** Array of colors to display as swatches */
  colors: Color[];
  /** Currently selected color index */
  selectedIndex?: number;
  /** Called when a swatch is selected */
  onChange?: (color: Color, index: number) => void;
}

/**
 * A group of color swatches with selection support.
 *
 * Renders as a `<div>` with `role="listbox"` containing `Swatch` children.
 * Completely unstyled -- use data attributes and CSS to style it.
 *
 * Data attributes on the root:
 * - `[data-swatch-group]` — always present
 *
 * Keyboard navigation:
 * - ArrowRight / ArrowDown — move selection forward
 * - ArrowLeft / ArrowUp — move selection backward
 * - Home — select first swatch
 * - End — select last swatch
 */
export const SwatchGroup = forwardRef<HTMLDivElement, SwatchGroupProps>(
  function SwatchGroup(
    {
      colors,
      selectedIndex,
      onChange,
      onKeyDown,
      children,
      'aria-label': ariaLabel,
      ...props
    },
    ref,
  ) {
    const handleSelect = useCallback(
      (color: Color, index: number) => {
        onChange?.(color, index);
      },
      [onChange],
    );

    const handleKeyDown = useCallback(
      (e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (!onChange || colors.length === 0) return;

        const current = selectedIndex ?? 0;
        let next: number | null = null;

        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            next = current < colors.length - 1 ? current + 1 : 0;
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            next = current > 0 ? current - 1 : colors.length - 1;
            break;
          case 'Home':
            next = 0;
            break;
          case 'End':
            next = colors.length - 1;
            break;
        }

        if (next !== null) {
          e.preventDefault();
          onChange(colors[next], next);
        }

        onKeyDown?.(e);
      },
      [colors, selectedIndex, onChange, onKeyDown],
    );

    return (
      <div
        {...props}
        ref={ref}
        data-swatch-group=""
        role="listbox"
        aria-label={ariaLabel ?? 'Color swatches'}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {colors.map((color, index) => (
          <Swatch
            key={index}
            color={color}
            isSelected={selectedIndex === index}
            onSelect={() => handleSelect(color, index)}
            role="option"
            aria-selected={selectedIndex === index}
          />
        ))}
        {children}
      </div>
    );
  },
);
