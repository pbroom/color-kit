import { createContext, useContext, type MutableRefObject } from 'react';
import type { Color } from '@color-kit/core';
import type { ResolvedColorAreaAxes } from './api/color-area.js';
import type { SetRequestedOptions } from './use-color.js';

export interface ColorAreaContextValue {
  areaRef: MutableRefObject<HTMLDivElement | null>;
  requested: Color;
  setRequested: (requested: Color, options?: SetRequestedOptions) => void;
  axes: ResolvedColorAreaAxes;
}

export const ColorAreaContext = createContext<ColorAreaContextValue | null>(
  null,
);

export function useColorAreaContext(): ColorAreaContextValue {
  const ctx = useContext(ColorAreaContext);
  if (!ctx) {
    throw new Error(
      'ColorArea primitives must be used inside <ColorArea>. Wrap them in a <ColorArea> root.',
    );
  }
  return ctx;
}

export function useOptionalColorAreaContext(): ColorAreaContextValue | null {
  return useContext(ColorAreaContext);
}
