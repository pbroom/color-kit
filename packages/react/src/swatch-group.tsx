import { forwardRef, useCallback, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import { Swatch } from './swatch.js';

export interface SwatchGroupProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /** Array of colors to display as swatches */
  colors: Color[];
  /** Currently selected color (controlled) */
  value?: Color;
  /** Called when a swatch is selected */
  onChange?: (color: Color) => void;
  /** Optional grid column count hint */
  columns?: number;
}

const EPSILON = 0.001;

function colorsEqual(a: Color, b: Color): boolean {
  return (
    Math.abs(a.l - b.l) < EPSILON &&
    Math.abs(a.c - b.c) < EPSILON &&
    Math.abs(a.h - b.h) < EPSILON &&
    Math.abs(a.alpha - b.alpha) < EPSILON
  );
}

/**
 * A group of swatches that manages selection state.
 *
 * Works standalone with `value`/`onChange` props, or reads from
 * a parent `<ColorProvider>` context automatically.
 *
 * Renders as a plain `<div>` — completely unstyled.
 * Use data attributes and CSS to style it.
 *
 * Data attributes on root:
 * - `[data-swatch-group]` — always present
 * - CSS custom property `--columns` set when `columns` is provided
 *
 * ARIA: `role="listbox"` on root, each swatch wrapped with
 * `role="option"` and `aria-selected`.
 */
export const SwatchGroup = forwardRef<HTMLDivElement, SwatchGroupProps>(
  function SwatchGroup(
    { colors, value, onChange, columns, style, children, ...props },
    ref,
  ) {
    const context = useOptionalColorContext();

    const handleSelect = useCallback(
      (color: Color) => {
        if (onChange) {
          onChange(color);
        } else {
          context?.setColor(color);
        }
      },
      [onChange, context],
    );

    const hasHandler = !!(onChange || context?.setColor);
    const selectedColor = value ?? context?.color;

    return (
      <div
        {...props}
        ref={ref}
        data-swatch-group=""
        role="listbox"
        aria-label={props['aria-label'] ?? 'Color swatches'}
        style={{
          ...(columns != null
            ? ({ '--columns': columns } as React.CSSProperties)
            : undefined),
          ...style,
        }}
      >
        {colors.map((color, index) => {
          const selected = selectedColor
            ? colorsEqual(color, selectedColor)
            : false;

          return (
            <div key={index} role="option" aria-selected={selected}>
              <Swatch
                color={color}
                isSelected={selected}
                onSelect={hasHandler ? handleSelect : undefined}
              />
            </div>
          );
        })}
        {children}
      </div>
    );
  },
);
