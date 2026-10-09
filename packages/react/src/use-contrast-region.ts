import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clampContrastRegionSampling,
  toSvgCompoundPath,
  type Color,
  type ContrastMetric,
  type GamutTarget,
  type PlaneContrastRegionResult,
} from '@color-kit/core';
import {
  unpackPlaneQueryResults,
  type PlaneComputeBackendKind,
} from '@color-kit/core/compute';
import {
  getColorAreaContrastRegionPaths,
  getColorAreaGamutBoundaryPoints,
  toColorAreaPlaneDefinition,
  type ColorAreaContrastRegionOptions,
  type ColorAreaContrastRegionPoint,
} from '@color-kit/driver';
import {
  BOUNDARY_SNAP_TOLERANCE,
  buildContrastRegionFillPaths,
  countPathPoints,
  DEFAULT_LAYER_ERROR_TOLERANCE,
  DEFAULT_LAYER_INITIAL_SAMPLES,
  mapColorToGamut,
  MIN_LAYER_INITIAL_SAMPLES,
  resolveContrastThresholdValue,
  snapPathToBoundary,
  toColorAreaContrastRegionPaths,
  withDomainBaselinePoints,
  type LayerSampling,
} from './contrast-region-geometry.js';
import {
  qualityStepMultiplier,
  REGION_QUALITY_MAX_DEPTH,
  REGION_QUALITY_STEP_MULTIPLIERS,
} from './plane-quality.js';
import {
  useStablePlane,
  type ColorPlaneQueryOptions,
  type ColorPlaneSpec,
} from './plane-spec.js';
import type { ColorPlaneQualityLevel } from './use-adaptive-quality.js';
import {
  usePlaneQueryLayer,
  type PlaneQueryWorkerPayload,
} from './use-plane-query-layer.js';
import type { PlaneQueryWorkerResponse } from './workers/plane-query-client.js';

/** Per-compute stats passed to `UseContrastRegionOptions.onMetrics`. */
export interface ContrastRegionMetrics {
  /** Whether the paths came from the main-thread or the worker compute. */
  source: 'sync' | 'worker';
  /** Worker request id the result answers. */
  requestId: number;
  /** Compute time in milliseconds (non-deterministic). */
  computeTimeMs: number;
  /** Number of contour paths. */
  pathCount: number;
  /** Total vertices across all paths. */
  pointCount: number;
  /** Initial samples per gamut chroma extent the solver ran with. */
  initialSamples: number;
  /** Chord error tolerance the solver ran with. */
  errorTolerance: number;
  /** Maximum refinement depth the solver ran with. */
  maxDepth: number;
  /** Contrast metric the region was solved with. */
  contrastMetric: ContrastMetric;
  /** Compute backend that ran the worker query, when reported. */
  backend?: PlaneComputeBackendKind;
  /** Worker scheduler telemetry; only with `includeSchedulerTelemetry`. */
  scheduleReason?: string;
  /** Worker scheduler telemetry; only with `includeSchedulerTelemetry`. */
  schedulerBucketCount?: number;
  /** Sampling quality level. */
  quality: ColorPlaneQualityLevel;
  /** Whether the plane was being dragged. */
  isDragging: boolean;
}

/** Options for {@link useContrastRegion}. */
export interface UseContrastRegionOptions extends ColorPlaneQueryOptions {
  /**
   * Color the region's samples are measured against (gamut-mapped into
   * `gamut` first). Defaults to the plane color, which is rarely what a
   * text-on-background check wants: pass the fixed background or text color.
   */
  reference?: Color;
  /** Hue of the plane slice in degrees. Defaults to the plane color's hue. */
  hue?: number;
  /**
   * Gamut the reference and samples are measured in; paths stay inside it.
   * @defaultValue 'srgb'
   */
  gamut?: GamutTarget;
  /**
   * Contrast metric.
   * @defaultValue 'wcag'
   */
  metric?: ContrastMetric;
  /**
   * Explicit threshold; overrides `level` and `apcaPreset`. A WCAG contrast
   * ratio, or with `metric: 'apca'` a normalized Lc magnitude (`0.6` for
   * Lc 60).
   */
  threshold?: number;
  /**
   * WCAG threshold preset used when `threshold` is omitted.
   * @defaultValue 'AA' (4.5:1)
   */
  level?: ColorAreaContrastRegionOptions['level'];
  /**
   * APCA threshold preset used with `metric: 'apca'` when `threshold` is
   * omitted.
   * @defaultValue 'body' (Lc 60, normalized 0.6)
   */
  apcaPreset?: ColorAreaContrastRegionOptions['apcaPreset'];
  /**
   * APCA polarity test with `metric: 'apca'`: `absolute`, `positive` or
   * `negative` Lc.
   * @defaultValue 'absolute'
   */
  apcaPolarity?: ColorAreaContrastRegionOptions['apcaPolarity'];
  /**
   * Whether samples are the text (`sample-text`) or the background
   * (`sample-background`) in APCA.
   * @defaultValue 'sample-text'
   */
  apcaRole?: ColorAreaContrastRegionOptions['apcaRole'];
  /**
   * Initial samples per gamut chroma extent, scaled down at lower
   * `quality`. Tuned for interactive use; see `contrastRegionPaths` for the
   * solver's own defaults.
   * @defaultValue 8
   */
  initialSamples?: number;
  /**
   * Largest distance, in l/c units, a sampled midpoint may lie from its
   * chord before the interval is refined.
   * @defaultValue 0.004
   */
  errorTolerance?: number;
  /**
   * Maximum refinement depth per initial interval.
   * @defaultValue 3 at `high` quality, 2 at `medium`, 1 at `low`
   */
  maxDepth?: number;
  /**
   * Upper chroma bound of the region.
   * @defaultValue 0.4
   */
  maxChroma?: number;
  /** Alpha used for the samples while measuring contrast. */
  alpha?: number;
  /** RDP simplification tolerance in (l, c) space; omit to disable. */
  simplifyTolerance?: number;
  /** Called after each sync or worker compute with sampling and timing stats. */
  onMetrics?: (metrics: ContrastRegionMetrics) => void;
  /**
   * Include worker scheduler fields in `onMetrics`.
   * @defaultValue false
   */
  includeSchedulerTelemetry?: boolean;
}

/** Geometry returned by {@link useContrastRegion}. */
export interface ContrastRegionGeometry {
  /**
   * Contour lines bounding the passing colors, snapped onto the gamut
   * boundary. A closed contour repeats its first point at the end.
   */
  paths: ColorAreaContrastRegionPoint[][];
  /** SVG path data for `paths` in a `0 0 100 100` viewBox; stroke it. */
  path: string;
  /**
   * Closed polygons covering the passing colors: open contours are closed
   * along the gamut boundary on the passing side. While dragging, the last
   * fresh polygons are kept until a current result arrives.
   */
  fillPaths: ColorAreaContrastRegionPoint[][];
  /** SVG path data for `fillPaths`, each subpath closed with `Z`; fill it. */
  fillPath: string;
  /** Quality level the region was sampled at. */
  quality: ColorPlaneQualityLevel;
  /**
   * Where the current contours come from: `'worker'` for a worker result,
   * `'sync'` for a main-thread solve, including the idle result kept on
   * screen while a drag waits for its first worker response.
   */
  source: 'sync' | 'worker';
}

/**
 * The reference mapped into `gamut`, keyed on its channel values so an
 * inline reference object does not re-solve the region every render.
 */
function useMappedReference(reference: Color, gamut: GamutTarget): Color {
  const { l, c, h, alpha } = reference;
  return useMemo(
    () => mapColorToGamut({ l, c, h, alpha }, gamut),
    [alpha, c, gamut, h, l],
  );
}

/**
 * Solves the colors of one hue that meet a contrast threshold against a
 * reference color, as contour lines and fillable polygons in plane
 * coordinates.
 *
 * The region is solved in the lightness/chroma plane (axes `l` and `c` in
 * either order; other planes return empty geometry) with WCAG 2 or APCA,
 * measured in `gamut`. The hook returns geometry only: stroke `path` and
 * fill `fillPath` in an SVG over the plane. It solves synchronously at rest
 * and in a shared Web Worker while `isDragging` (when workers are
 * available); during a drag the sampling stays at its last idle level and
 * the last region stays in place until a fresh one arrives.
 *
 * @param plane - Color and axes of the plane.
 * @param options - See {@link UseContrastRegionOptions}.
 * @returns Memoized {@link ContrastRegionGeometry}.
 * @throws {Error} When both axes use the same channel.
 * @throws {TypeError} When `gamut` is not `'srgb'` or `'display-p3'`.
 *
 * @example
 * ```tsx
 * import { parse, type Color } from 'color-kit';
 * import { useContrastRegion } from 'color-kit/react';
 *
 * const white = parse('#ffffff');
 *
 * export function ReadableOnWhite({ color }: { color: Color }) {
 *   const region = useContrastRegion({ color }, { reference: white, level: 'AA' });
 *   return (
 *     <svg viewBox="0 0 100 100" preserveAspectRatio="none">
 *       <path d={region.fillPath} fill="#000" fillOpacity={0.2} />
 *       <path d={region.path} fill="none" stroke="#fff" vectorEffect="non-scaling-stroke" />
 *     </svg>
 *   );
 * }
 * ```
 */
export function useContrastRegion(
  plane: ColorPlaneSpec,
  options: UseContrastRegionOptions = {},
): ContrastRegionGeometry {
  const {
    reference,
    hue: hueOption,
    gamut = 'srgb',
    metric,
    threshold,
    level,
    apcaPreset,
    apcaPolarity,
    apcaRole,
    initialSamples,
    errorTolerance = DEFAULT_LAYER_ERROR_TOLERANCE,
    maxDepth,
    maxChroma,
    alpha,
    simplifyTolerance,
    onMetrics,
    includeSchedulerTelemetry = false,
    quality = 'high',
    isDragging = false,
    performanceProfile = 'auto',
  } = options;
  const { color, axes } = useStablePlane(plane);
  const multiplier = qualityStepMultiplier(
    quality,
    REGION_QUALITY_STEP_MULTIPLIERS,
  );
  const effectiveInitialSamples = Math.max(
    MIN_LAYER_INITIAL_SAMPLES,
    Math.round((initialSamples ?? DEFAULT_LAYER_INITIAL_SAMPLES) * multiplier),
  );
  const effectiveMaxDepth = maxDepth ?? REGION_QUALITY_MAX_DEPTH[quality];

  const resolvedHue = hueOption ?? color.h;
  const contrastReference = useMappedReference(reference ?? color, gamut);

  // Freeze sampling at its last idle level for the length of a drag so the
  // adaptive quality drop does not reshape the region mid-gesture.
  const [frozenSampling, setFrozenSampling] = useState<LayerSampling | null>(
    null,
  );
  // The last fresh contours and where they came from, shown while a drag
  // waits for the worker.
  const [lastStable, setLastStable] = useState<{
    paths: ColorAreaContrastRegionPoint[][];
    source: 'sync' | 'worker';
  }>({ paths: [], source: 'sync' });
  const [lastStableFillPaths, setLastStableFillPaths] = useState<
    ColorAreaContrastRegionPoint[][]
  >([]);
  const prevDraggingRef = useRef(false);
  const lastIdleSamplingRef = useRef<LayerSampling | null>(null);

  useEffect(() => {
    if (isDragging) {
      return;
    }
    lastIdleSamplingRef.current = {
      initialSamples: effectiveInitialSamples,
      maxDepth: effectiveMaxDepth,
    };
  }, [effectiveInitialSamples, effectiveMaxDepth, isDragging]);

  useEffect(() => {
    if (isDragging && !prevDraggingRef.current) {
      const previousIdleSampling = lastIdleSamplingRef.current ?? {
        initialSamples: effectiveInitialSamples,
        maxDepth: effectiveMaxDepth,
      };
      queueMicrotask(() => setFrozenSampling(previousIdleSampling));
    }
    if (!isDragging) {
      queueMicrotask(() => setFrozenSampling(null));
    }
    prevDraggingRef.current = isDragging;
  }, [isDragging, effectiveInitialSamples, effectiveMaxDepth]);

  const sampling: LayerSampling =
    isDragging && frozenSampling
      ? frozenSampling
      : {
          initialSamples: effectiveInitialSamples,
          maxDepth: effectiveMaxDepth,
        };
  // The sampling the solver runs with, clamped as core clamps it, so the
  // request and `onMetrics` agree with the work actually done.
  const solverSampling = clampContrastRegionSampling({
    ...sampling,
    errorTolerance,
  });
  const resolvedContrastMetric = metric ?? 'wcag';

  const solverOptions = useMemo<ColorAreaContrastRegionOptions>(
    () => ({
      gamut,
      metric,
      threshold,
      level,
      apcaPreset,
      apcaPolarity,
      apcaRole,
      initialSamples: solverSampling.initialSamples,
      errorTolerance: solverSampling.errorTolerance,
      maxDepth: solverSampling.maxDepth,
      maxChroma,
      alpha,
      simplifyTolerance,
    }),
    [
      alpha,
      apcaPolarity,
      apcaPreset,
      apcaRole,
      gamut,
      level,
      maxChroma,
      metric,
      simplifyTolerance,
      solverSampling.errorTolerance,
      solverSampling.initialSamples,
      solverSampling.maxDepth,
      threshold,
    ],
  );

  const computeSync = useCallback(
    () =>
      getColorAreaContrastRegionPaths(
        contrastReference,
        resolvedHue,
        axes,
        solverOptions,
      ),
    [axes, contrastReference, resolvedHue, solverOptions],
  );

  const workerPayload = useMemo<PlaneQueryWorkerPayload>(
    () => ({
      plane: toColorAreaPlaneDefinition(axes, contrastReference),
      queries: [
        {
          kind: 'contrastRegion' as const,
          reference: contrastReference,
          ...solverOptions,
          hue: resolvedHue,
        },
      ],
      priority: isDragging ? 'drag' : 'idle',
      quality,
      performanceProfile,
      includeSchedulerTelemetry,
    }),
    [
      axes,
      contrastReference,
      includeSchedulerTelemetry,
      isDragging,
      performanceProfile,
      quality,
      resolvedHue,
      solverOptions,
    ],
  );

  const extractResult = useCallback(
    (
      response: PlaneQueryWorkerResponse,
    ): ColorAreaContrastRegionPoint[][] | undefined => {
      if (response.error) {
        return undefined;
      }
      if (!response.result) {
        return [];
      }
      const contrastRegionResult = unpackPlaneQueryResults(
        response.result,
      ).find(
        (entry): entry is PlaneContrastRegionResult =>
          entry.kind === 'contrastRegion',
      );
      return contrastRegionResult
        ? toColorAreaContrastRegionPaths(contrastRegionResult)
        : [];
    },
    [],
  );

  const emitMetrics = useCallback(
    (payload: {
      source: 'sync' | 'worker';
      requestId: number;
      computeTimeMs: number;
      paths: ColorAreaContrastRegionPoint[][];
      backend?: PlaneComputeBackendKind;
      scheduleReason?: string;
      schedulerBucketCount?: number;
    }) => {
      onMetrics?.({
        source: payload.source,
        requestId: payload.requestId,
        computeTimeMs: payload.computeTimeMs,
        pathCount: payload.paths.length,
        pointCount: countPathPoints(payload.paths),
        // Report the sampling the solver ran with: while dragging this is the
        // frozen idle sampling, not the current quality level's.
        initialSamples: solverSampling.initialSamples,
        errorTolerance: solverSampling.errorTolerance,
        maxDepth: solverSampling.maxDepth,
        contrastMetric: resolvedContrastMetric,
        backend: payload.backend,
        scheduleReason: payload.scheduleReason,
        schedulerBucketCount: payload.schedulerBucketCount,
        quality,
        isDragging,
      });
    },
    [
      isDragging,
      onMetrics,
      quality,
      resolvedContrastMetric,
      solverSampling.errorTolerance,
      solverSampling.initialSamples,
      solverSampling.maxDepth,
    ],
  );

  const handleWorkerResponse = useCallback(
    (
      response: PlaneQueryWorkerResponse,
      data: ColorAreaContrastRegionPoint[][] | undefined,
    ) => {
      if (response.error || !response.result || data === undefined) {
        return;
      }
      emitMetrics({
        source: 'worker',
        requestId: response.id,
        computeTimeMs:
          (response.computeTimeMs ?? 0) + (response.marshalTimeMs ?? 0),
        paths: data,
        backend: response.backend,
        scheduleReason: response.schedule?.reason,
        schedulerBucketCount: response.schedulerTelemetry?.buckets.length,
      });
    },
    [emitMetrics],
  );

  const {
    sync,
    workerData,
    hasCurrentWorkerResponse,
    usingWorkerPath,
    requestIdRef,
  } = usePlaneQueryLayer<ColorAreaContrastRegionPoint[][]>({
    external: false,
    isDragging,
    computeSync,
    syncWhileDragging: 'never',
    workerPayload,
    extractResult,
    onWorkerResponse: handleWorkerResponse,
  });

  const rawPathsAreFresh = !usingWorkerPath || hasCurrentWorkerResponse;

  const { paths: rawPaths, source: rawSource } = useMemo((): {
    paths: ColorAreaContrastRegionPoint[][];
    source: 'sync' | 'worker';
  } => {
    if (usingWorkerPath) {
      if (hasCurrentWorkerResponse && workerData != null) {
        return { paths: workerData.data, source: 'worker' };
      }
      if (lastStable.paths.length > 0) {
        return lastStable;
      }
    }
    return { paths: sync?.data ?? [], source: 'sync' };
  }, [hasCurrentWorkerResponse, lastStable, sync, usingWorkerPath, workerData]);

  useEffect(() => {
    if (!sync) {
      return;
    }
    emitMetrics({
      source: 'sync',
      requestId: requestIdRef.current,
      computeTimeMs: sync.computeTimeMs,
      paths: sync.data,
      backend: 'js',
      scheduleReason: 'sync-inline',
    });
  }, [emitMetrics, requestIdRef, sync]);

  useEffect(() => {
    if (!isDragging) {
      if (sync?.data) {
        queueMicrotask(() =>
          setLastStable({ paths: sync.data, source: 'sync' }),
        );
      }
      return;
    }
    if (!hasCurrentWorkerResponse || !workerData) {
      return;
    }
    queueMicrotask(() =>
      setLastStable({ paths: workerData.data, source: 'worker' }),
    );
  }, [hasCurrentWorkerResponse, isDragging, sync, workerData]);

  const contrastGamutBoundary = useMemo(
    () =>
      getColorAreaGamutBoundaryPoints(resolvedHue, axes, {
        gamut,
        steps: 128,
        samplingMode: 'adaptive',
        simplifyTolerance: simplifyTolerance ?? 0.001,
      }),
    [axes, gamut, resolvedHue, simplifyTolerance],
  );

  const paths = useMemo(
    () =>
      rawPaths.map((path) =>
        snapPathToBoundary(
          path,
          contrastGamutBoundary,
          BOUNDARY_SNAP_TOLERANCE,
        ),
      ),
    [contrastGamutBoundary, rawPaths],
  );

  const contrastFillBoundary = useMemo(
    () => withDomainBaselinePoints(contrastGamutBoundary),
    [contrastGamutBoundary],
  );

  const resolvedThreshold = resolveContrastThresholdValue(
    threshold,
    level,
    metric,
    apcaPreset,
  );

  const fillPaths = useMemo(
    () =>
      buildContrastRegionFillPaths({
        paths,
        fillBoundary: contrastFillBoundary,
        mappedReference: contrastReference,
        hue: resolvedHue,
        gamut,
        metric,
        threshold: resolvedThreshold,
        apcaPolarity,
        apcaRole,
      }),
    [
      apcaPolarity,
      apcaRole,
      contrastFillBoundary,
      contrastReference,
      gamut,
      metric,
      paths,
      resolvedHue,
      resolvedThreshold,
    ],
  );

  useEffect(() => {
    if (rawPathsAreFresh) {
      queueMicrotask(() => setLastStableFillPaths(fillPaths));
    }
  }, [fillPaths, rawPathsAreFresh]);

  const visibleFillPaths =
    isDragging && !rawPathsAreFresh ? lastStableFillPaths : fillPaths;

  return useMemo(
    () => ({
      paths,
      path: toSvgCompoundPath(paths),
      fillPaths: visibleFillPaths,
      fillPath: toSvgCompoundPath(visibleFillPaths, { closeLoop: true }),
      quality,
      source: rawSource,
    }),
    [paths, quality, rawSource, visibleFillPaths],
  );
}
