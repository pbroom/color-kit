import { createContext, useContext, type MutableRefObject } from 'react';
import type { Color } from '@color-kit/core';
import type { ResolvedColorAreaAxes } from './api/color-area.js';
import type { SetRequestedOptions } from './use-color.js';

export type ColorAreaPerformanceProfile =
  | 'auto'
  | 'quality'
  | 'balanced'
  | 'performance';

export type ColorAreaQualityLevel = 'high' | 'medium' | 'low';

export interface ColorAreaInteractionFrameStats {
  frameTimeMs: number;
  updateDurationMs: number;
  droppedFrame: boolean;
  longTask: boolean;
  qualityLevel: ColorAreaQualityLevel;
  coalescedCount: number;
}

export interface ColorAreaContextValue {
  areaRef: MutableRefObject<HTMLDivElement | null>;
  requested: Color;
  setRequested: (requested: Color, options?: SetRequestedOptions) => void;
  axes: ResolvedColorAreaAxes;
  performanceProfile: ColorAreaPerformanceProfile;
  qualityLevel: ColorAreaQualityLevel;
  isDragging: boolean;
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
