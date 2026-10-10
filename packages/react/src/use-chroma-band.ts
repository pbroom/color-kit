import { useCallback, useMemo } from 'react';
import {
  toSvgPath,
  type ChromaBandMode,
  type GamutTarget,
} from '@color-kit/core';
import {
  getColorAreaChromaBandPoints,
  toColorAreaPlaneDefinition,
} from '@color-kit/driver';
import {
  qualityStepMultiplier,
  resolveAdaptiveLineSampling,
} from './plane-quality.js';
import {
  useStablePlane,
  type ColorPlanePixelSize,
  type ColorPlaneQueryOptions,
  type ColorPlaneSpec,
} from './plane-spec.js';
import type { ColorPlaneLineGeometry } from './use-gamut-boundary.js';
import { usePlaneLineQuery } from './use-plane-line-query.js';
import type { PlaneQueryWorkerPayload } from './use-plane-query-layer.js';

/** Options for {@link useChromaBand}. */
export interface UseChromaBandOptions extends ColorPlaneQueryOptions {
  /**
   * How the band follows the plane color's chroma across lightness:
   * `'clamped'` keeps that chroma where it is in gamut and clamps to the
   * boundary elsewhere; `'proportional'` keeps its fraction of the maximum
   * in-gamut chroma at the color's lightness.
   * @defaultValue 'clamped'
   */
  mode?: ChromaBandMode;
  /**
   * Gamut the band is kept inside.
   * @defaultValue 'srgb'
   */
  gamut?: GamutTarget;
  /** Hue of the band in degrees. Defaults to the plane color's hue. */
  hue?: number;
  /**
   * Band samples at `high` quality; lower quality levels scale this down
   * (minimum 8).
   * @defaultValue 48
   */
  steps?: number;
  /**
   * `'uniform'` samples evenly; `'adaptive'` refines where the band bends.
   * @defaultValue 'uniform'
   */
  samplingMode?: 'uniform' | 'adaptive';
  /**
   * Adaptive-sampling error tolerance; derived from `pixelSize` when
   * omitted. Only used with `samplingMode: 'adaptive'`.
   */
  adaptiveTolerance?: number;
  /**
   * Adaptive-sampling maximum refinement depth; derived from `pixelSize`
   * when omitted. Only used with `samplingMode: 'adaptive'`.
   */
  adaptiveMaxDepth?: number;
  /** Plane size in device pixels, for the adaptive sampling defaults. */
  pixelSize?: ColorPlanePixelSize;
}

/**
 * Samples the plane color's chroma as a line across lightness, kept inside
 * the gamut: the tonal strip the current chroma traces for its hue.
 *
 * Returns geometry only; draw `path` as a stroked `<path>` over the plane.
 * Samples only when the axes are lightness and chroma (in either order);
 * other planes return empty geometry. Computed synchronously at rest and in
 * a shared Web Worker while `isDragging` (when workers are available).
 *
 * @param plane - Color and axes of the plane; the color supplies the chroma,
 * lightness and alpha the band follows.
 * @param options - See {@link UseChromaBandOptions}.
 * @returns Memoized {@link ColorPlaneLineGeometry}.
 * @throws {Error} When both axes use the same channel.
 * @throws {TypeError} When `gamut` is not `'srgb'` or `'display-p3'`.
 * @see {@link useGamutBoundary}
 *
 * @example
 * ```tsx
 * import { useChromaBand } from 'color-kit/react';
 * import type { Color } from 'color-kit';
 *
 * export function TonalStrip({ color }: { color: Color }) {
 *   const band = useChromaBand({ color }, { mode: 'proportional', gamut: 'display-p3' });
 *   return (
 *     <svg viewBox="0 0 100 100" preserveAspectRatio="none">
 *       <path d={band.path} fill="none" stroke="#fff" vectorEffect="non-scaling-stroke" />
 *     </svg>
 *   );
 * }
 * ```
 */
export function useChromaBand(
  plane: ColorPlaneSpec,
  options: UseChromaBandOptions = {},
): ColorPlaneLineGeometry {
  const {
    mode = 'clamped',
    gamut = 'srgb',
    hue: hueOption,
    steps = 48,
    samplingMode,
    adaptiveTolerance: adaptiveToleranceOption,
    adaptiveMaxDepth: adaptiveMaxDepthOption,
    pixelSize,
    quality = 'high',
    isDragging = false,
    performanceProfile = 'auto',
  } = options;
  const { color, axes } = useStablePlane(plane);
  const hue = hueOption ?? color.h;
  const effectiveSteps = Math.max(
    8,
    Math.round(steps * qualityStepMultiplier(quality)),
  );
  const { adaptiveTolerance, adaptiveMaxDepth } = resolveAdaptiveLineSampling({
    samplingMode,
    adaptiveTolerance: adaptiveToleranceOption,
    adaptiveMaxDepth: adaptiveMaxDepthOption,
    axes,
    quality,
    pixelSize,
  });

  const computeSync = useCallback(
    () =>
      getColorAreaChromaBandPoints(color, hue, axes, {
        gamut,
        mode,
        steps: effectiveSteps,
        samplingMode,
        adaptiveTolerance,
        adaptiveMaxDepth,
        selectedLightness: color.l,
        alpha: color.alpha,
      }),
    [
      adaptiveMaxDepth,
      adaptiveTolerance,
      axes,
      color,
      effectiveSteps,
      gamut,
      hue,
      mode,
      samplingMode,
    ],
  );

  const workerPayload = useMemo<PlaneQueryWorkerPayload>(
    () => ({
      plane: toColorAreaPlaneDefinition(axes, color),
      queries: [
        {
          kind: 'chromaBand',
          requestedChroma: color.c,
          gamut,
          hue,
          mode,
          steps: effectiveSteps,
          samplingMode,
          adaptiveTolerance,
          adaptiveMaxDepth,
          selectedLightness: color.l,
          alpha: color.alpha,
        },
      ],
      priority: isDragging ? 'drag' : 'idle',
      quality,
      performanceProfile,
    }),
    [
      adaptiveMaxDepth,
      adaptiveTolerance,
      axes,
      color,
      effectiveSteps,
      gamut,
      hue,
      isDragging,
      mode,
      performanceProfile,
      quality,
      samplingMode,
    ],
  );

  const points = usePlaneLineQuery({
    kind: 'chromaBand',
    isDragging,
    computeSync,
    workerPayload,
  });

  return useMemo(
    () => ({ points, path: toSvgPath(points), quality }),
    [points, quality],
  );
}
