import { useMemo } from 'react';
import {
  getColorAreaFallbackPoint,
  type ColorAreaFallbackPoint,
} from '@color-kit/driver';
import { useStablePlane, type ColorPlaneSpec } from './plane-spec.js';

/** Return value of {@link useFallbackPoints}. */
export interface ColorPlaneFallbackPoints {
  /** Where the plane color lands after gamut mapping into sRGB. */
  srgb: ColorAreaFallbackPoint;
  /** Where the plane color lands after gamut mapping into Display P3. */
  p3: ColorAreaFallbackPoint;
}

/**
 * Positions of the plane color after gamut mapping into sRGB and into
 * Display P3, e.g. to mark where an out-of-gamut pick will actually render.
 *
 * Each point carries the mapped `color` and its normalized `x`/`y` (y down)
 * on the plane; for an in-gamut color both coincide with the color's own
 * position. Memoized on the color and axes.
 *
 * @param plane - Color and axes of the plane.
 * @returns The sRGB and Display P3 {@link ColorAreaFallbackPoint}s.
 * @throws {Error} When both axes use the same channel.
 *
 * @example
 * ```tsx
 * import { toHex } from 'color-kit';
 * import { useFallbackPoints } from 'color-kit/react';
 * import type { Color } from 'color-kit';
 *
 * export function SrgbMarker({ color }: { color: Color }) {
 *   const { srgb } = useFallbackPoints({ color });
 *   return (
 *     <span
 *       style={{
 *         position: 'absolute',
 *         left: `${srgb.x * 100}%`,
 *         top: `${srgb.y * 100}%`,
 *         background: toHex(srgb.color),
 *       }}
 *     />
 *   );
 * }
 * ```
 */
export function useFallbackPoints(
  plane: ColorPlaneSpec,
): ColorPlaneFallbackPoints {
  const { color, axes } = useStablePlane(plane);
  return useMemo(
    () => ({
      srgb: getColorAreaFallbackPoint(axes, { color, gamut: 'srgb' }),
      p3: getColorAreaFallbackPoint(axes, { color, gamut: 'display-p3' }),
    }),
    [axes, color],
  );
}
