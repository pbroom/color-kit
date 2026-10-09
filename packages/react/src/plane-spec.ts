import { useMemo } from 'react';
import type { Color } from '@color-kit/core';
import {
  areColorAreaAxesDistinct,
  resolveColorAreaAxes,
  type ColorAreaAxes,
  type ColorAreaChannel,
  type ResolvedColorAreaAxes,
} from '@color-kit/driver';
import type {
  ColorPlanePerformanceProfile,
  ColorPlaneQualityLevel,
} from './use-adaptive-quality.js';

/**
 * The OKLCH plane a plane hook works on: a color and the two channels mapped
 * to x and y.
 *
 * Every point of the plane is `color` with the two axis channels replaced by
 * the point's position; the third channel (by default the hue) stays fixed.
 * Coordinates are normalized with `x` running left to right and `y` top to
 * bottom, so a y-axis value at the end of its range sits at `y = 0`.
 */
export interface ColorPlaneSpec {
  /** Color the plane is sliced through, usually the requested color. */
  color: Color;
  /**
   * OKLCH channel and `[start, end]` range for each axis; the two channels
   * must differ. `start` sits at the left or bottom edge, so y values
   * increase upward. Omitted ranges use the channel defaults (`l` [0, 1],
   * `c` [0, 0.4], `h` [0, 360]).
   * @defaultValue `{ x: { channel: 'l' }, y: { channel: 'c' } }`
   */
  axes?: ColorAreaAxes;
}

/**
 * Interaction options shared by the geometry hooks ({@link useGamutBoundary},
 * {@link useChromaBand}, {@link useContrastRegion}).
 */
export interface ColorPlaneQueryOptions {
  /**
   * Sampling detail. Pass {@link useAdaptiveQuality}'s `quality` to coarsen
   * sampling while frames are slow.
   * @defaultValue 'high'
   */
  quality?: ColorPlaneQualityLevel;
  /**
   * Whether the plane is being dragged. While true, queries run in a shared
   * Web Worker (when available) and the last result stays in place until a
   * fresh one arrives; at rest they run synchronously.
   * @defaultValue false
   */
  isDragging?: boolean;
  /**
   * Profile forwarded to the worker's compute scheduler.
   * @defaultValue 'auto'
   */
  performanceProfile?: ColorPlanePerformanceProfile;
}

/** Plane size in device pixels, used to derive adaptive sampling budgets. */
export interface ColorPlanePixelSize {
  /** Width in device pixels (CSS width × `devicePixelRatio`). */
  width: number;
  /** Height in device pixels (CSS height × `devicePixelRatio`). */
  height: number;
}

/** A {@link ColorPlaneSpec} resolved to value-stable objects. */
export interface StablePlane {
  color: Color;
  axes: ResolvedColorAreaAxes;
}

/**
 * Resolves a plane spec to a color and axes that keep their identity until a
 * channel value changes, so callers can pass inline objects every render.
 *
 * @throws {Error} When both axes use the same channel.
 */
export function useStablePlane(plane: ColorPlaneSpec): StablePlane {
  const { l, c, h, alpha } = plane.color;
  const color = useMemo<Color>(() => ({ l, c, h, alpha }), [l, c, h, alpha]);

  const xChannel: ColorAreaChannel = plane.axes?.x.channel ?? 'l';
  const yChannel: ColorAreaChannel = plane.axes?.y.channel ?? 'c';
  const xStart = plane.axes?.x.range?.[0];
  const xEnd = plane.axes?.x.range?.[1];
  const yStart = plane.axes?.y.range?.[0];
  const yEnd = plane.axes?.y.range?.[1];

  const axes = useMemo(() => {
    const next = resolveColorAreaAxes({
      x: {
        channel: xChannel,
        range:
          xStart === undefined || xEnd === undefined
            ? undefined
            : [xStart, xEnd],
      },
      y: {
        channel: yChannel,
        range:
          yStart === undefined || yEnd === undefined
            ? undefined
            : [yStart, yEnd],
      },
    });
    if (!areColorAreaAxesDistinct(next)) {
      throw new Error(
        `Plane axes must use distinct channels; both use "${next.x.channel}".`,
      );
    }
    return next;
  }, [xChannel, xEnd, xStart, yChannel, yEnd, yStart]);

  return useMemo(() => ({ color, axes }), [axes, color]);
}
