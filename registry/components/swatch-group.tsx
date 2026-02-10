'use client';

import { forwardRef, useCallback, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from '@/hooks/color-context';
import { Swatch } from '@/components/swatch';

const EPSILON = 0.001;

function colorsEqual(a: Color, b: Color, epsilon = EPSILON): boolean {
  return (
    Math.abs(a.l - b.l) < epsilon &&
    Math.abs(a.c - b.c) < epsilon &&
    Math.abs(a.h - b.h) < epsilon &&
    Math.abs(a.alpha - b.alpha) < epsilon
  );
}

export interface SwatchGroupProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  colors: Color[];
  value?: Color;
  onChange?: (color: Color) => void;
  columns?: number;
}

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
          context?.setRequested(color, {
            interaction: 'pointer',
            source: 'derived',
          });
        }
      },
      [onChange, context],
    );

    const hasHandler = !!(onChange || context?.setRequested);
    const selectedColor = value ?? context?.requested;

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
                gamut={context?.activeGamut}
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
