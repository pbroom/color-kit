'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { ColorSlider } from '@/components/color-slider';
import type { SetRequestedOptions } from '@/hooks/use-color';

export interface HueSliderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  orientation?: 'horizontal' | 'vertical';
  requested?: Color;
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
}

export const HueSlider = forwardRef<HTMLDivElement, HueSliderProps>(
  function HueSlider(
    { orientation = 'horizontal', requested, onChangeRequested, ...props },
    ref,
  ) {
    return (
      <ColorSlider
        {...props}
        ref={ref}
        channel="h"
        orientation={orientation}
        requested={requested}
        onChangeRequested={onChangeRequested}
        aria-label={props['aria-label'] ?? 'Hue'}
        data-hue-slider=""
      />
    );
  },
);
