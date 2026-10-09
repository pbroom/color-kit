import { createContext, useContext, type MutableRefObject } from 'react';
import type { Color } from '@color-kit/core';
import type { ResolvedColorAreaAxes } from '@color-kit/driver';
import type { SetRequestedOptions } from './use-color.js';
import type {
  ColorPlanePerformanceProfile,
  ColorPlaneQualityLevel,
} from './use-adaptive-quality.js';

/**
 * {@link ColorArea} performance profile. `'quality'` always renders at full
 * quality; `'auto'`, `'balanced'` and `'performance'` adapt the quality
 * level to measured update cost, with progressively lower resolution and
 * earlier degradation.
 */
export type ColorAreaPerformanceProfile = ColorPlanePerformanceProfile;

/** Current adaptive quality level of a {@link ColorArea}. */
export type ColorAreaQualityLevel = ColorPlaneQualityLevel;

/** Per-frame stats passed to `ColorAreaProps.onInteractionFrame`. */
export interface ColorAreaInteractionFrameStats {
  /** Milliseconds since the previous committed frame. */
  frameTimeMs: number;
  /** Milliseconds spent applying this frame's color update. */
  updateDurationMs: number;
  /** Whether `frameTimeMs` exceeded one 60 Hz frame (16.67 ms). */
  droppedFrame: boolean;
  /** Whether `updateDurationMs` exceeded 50 ms. */
  longTask: boolean;
  /** Quality level after this frame's adaptation. */
  qualityLevel: ColorAreaQualityLevel;
  /** Number of coalesced pointer events merged into this frame. */
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
  /** When true, the area and its thumb ignore pointer/keyboard input. */
  disabled: boolean;
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
