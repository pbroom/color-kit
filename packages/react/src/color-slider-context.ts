import { createContext, useContext } from 'react';
import type { Color } from '@color-kit/core';
import type {
  ColorSliderChannel,
  ColorSliderOrientation,
} from './api/color-slider.js';

export interface ColorSliderContextValue {
  channel: ColorSliderChannel;
  orientation: ColorSliderOrientation;
  range: [number, number];
  requested: Color;
  thumbNorm: number;
}

export const ColorSliderContext =
  createContext<ColorSliderContextValue | null>(null);

export function useColorSliderContext(): ColorSliderContextValue {
  const context = useContext(ColorSliderContext);
  if (!context) {
    throw new Error(
      'Slider marker primitives must be rendered as children of <ColorSlider>.',
    );
  }

  return context;
}

export function useOptionalColorSliderContext(): ColorSliderContextValue | null {
  return useContext(ColorSliderContext);
}
