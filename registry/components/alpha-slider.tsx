'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { ColorSlider } from '@/components/color-slider';
import type { SetRequestedOptions } from '@/hooks/use-color';

export interface AlphaSliderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  orientation?: 'horizontal' | 'vertical';
  requested?: Color;
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
}

export const AlphaSlider = forwardRef<HTMLDivElement, AlphaSliderProps>(
  function AlphaSlider(
    { orientation = 'horizontal', requested, onChangeRequested, ...props },
    ref,
  ) {
    return (
      <ColorSlider
        {...props}
        ref={ref}
        channel="alpha"
        orientation={orientation}
        requested={requested}
        onChangeRequested={onChangeRequested}
        aria-label={props['aria-label'] ?? 'Opacity'}
        data-alpha-slider=""
      />
    );
  },
);
