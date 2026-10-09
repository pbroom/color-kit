import { useCallback, useMemo } from 'react';
import { toSvgPath, type GamutTarget } from '@color-kit/core';
import {
  getColorAreaGamutBoundaryPoints,
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
import type { ColorPlaneQualityLevel } from './use-adaptive-quality.js';
import {
  usePlaneLineQuery,
  type ColorPlaneLinePoint,
} from './use-plane-line-query.js';
import type { PlaneQueryWorkerPayload } from './use-plane-query-layer.js';

export type { ColorPlaneLinePoint } from './use-plane-line-query.js';

/** Geometry returned by {@link useGamutBoundary} and {@link useChromaBand}. */
export interface ColorPlaneLineGeometry {
  /** Line vertices from `l = 0` to `l = 1`; empty off an `l`/`c` plane. */
  points: ColorPlaneLinePoint[];
  /**
   * SVG path data for `points` in a `0 0 100 100` viewBox (`''` for fewer
   * than two points). Draw it in an `<svg viewBox="0 0 100 100"
   * preserveAspectRatio="none">` laid over the plane.
   */
  path: string;
  /** Quality level the line was sampled at. */
  quality: ColorPlaneQualityLevel;
}

/** Options for {@link useGamutBoundary}. */
export interface UseGamutBoundaryOptions extends ColorPlaneQueryOptions {
  /**
   * Gamut whose boundary is traced.
   * @defaultValue 'srgb'
   */
  gamut?: GamutTarget;
  /** Hue of the boundary slice in degrees. Defaults to the plane color's hue. */
  hue?: number;
  /**
   * Boundary samples at `high` quality; lower quality levels scale this
   * down (minimum 8).
   * @defaultValue 48
   */
  steps?: number;
  /** RDP simplification tolerance in (l, c) space; omit to disable. */
  simplifyTolerance?: number;
  /**
   * `'uniform'` samples evenly; `'adaptive'` refines where the boundary
   * bends.
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
 * Traces the gamut boundary (the maximum in-gamut chroma at each lightness)
 * for one hue, as points and SVG path data in plane coordinates.
 *
 * Returns geometry only; draw `path` however you like, typically as a
 * stroked `<path>` in an SVG over a {@link useColorPlaneRenderer} canvas.
 * Traces only when the axes are lightness and chroma (in either order);
 * other planes return empty geometry. The boundary follows the plane
 * color's hue unless `hue` is set. It is computed synchronously at rest and
 * in a shared Web Worker while `isDragging` (when workers are available).
 *
 * @param plane - Color and axes of the plane.
 * @param options - See {@link UseGamutBoundaryOptions}.
 * @returns Memoized {@link ColorPlaneLineGeometry}.
 * @throws {Error} When both axes use the same channel.
 * @throws {TypeError} When `gamut` is not `'srgb'` or `'display-p3'`.
 * @see {@link useChromaBand}
 *
 * @example
 * ```tsx
 * import { useGamutBoundary } from 'color-kit/react';
 * import type { Color } from 'color-kit';
 *
 * export function GamutEdges({ color }: { color: Color }) {
 *   const srgb = useGamutBoundary({ color }, { gamut: 'srgb' });
 *   const p3 = useGamutBoundary({ color }, { gamut: 'display-p3' });
 *   return (
 *     <svg viewBox="0 0 100 100" preserveAspectRatio="none">
 *       <path d={srgb.path} fill="none" stroke="#fff" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
 *       <path d={p3.path} fill="none" stroke="#fff" vectorEffect="non-scaling-stroke" />
 *     </svg>
 *   );
 * }
 * ```
 */
export function useGamutBoundary(
  plane: ColorPlaneSpec,
  options: UseGamutBoundaryOptions = {},
): ColorPlaneLineGeometry {
  const {
    gamut = 'srgb',
    hue: hueOption,
    steps = 48,
    simplifyTolerance,
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
      getColorAreaGamutBoundaryPoints(hue, axes, {
        gamut,
        steps: effectiveSteps,
        simplifyTolerance,
        samplingMode,
        adaptiveTolerance,
        adaptiveMaxDepth,
      }),
    [
      adaptiveMaxDepth,
      adaptiveTolerance,
      axes,
      effectiveSteps,
      gamut,
      hue,
      samplingMode,
      simplifyTolerance,
    ],
  );

  const workerPayload = useMemo<PlaneQueryWorkerPayload>(
    () => ({
      plane: toColorAreaPlaneDefinition(axes, color),
      queries: [
        {
          kind: 'gamutBoundary',
          gamut,
          hue,
          steps: effectiveSteps,
          simplifyTolerance,
          samplingMode,
          adaptiveTolerance,
          adaptiveMaxDepth,
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
      performanceProfile,
      quality,
      samplingMode,
      simplifyTolerance,
    ],
  );

  const points = usePlaneLineQuery({
    kind: 'gamutBoundary',
    isDragging,
    computeSync,
    workerPayload,
  });

  return useMemo(
    () => ({ points, path: toSvgPath(points), quality }),
    [points, quality],
  );
}
