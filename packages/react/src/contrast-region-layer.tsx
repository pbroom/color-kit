import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type SVGAttributes,
} from 'react';
import {
  clampContrastRegionSampling,
  type ContrastMetric,
  type Color,
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
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line, pathWithRoundedCorners } from './line.js';
import { PathPointsOverlay } from './path-points-overlay.js';
import {
  qualityStepMultiplier,
  REGION_QUALITY_MAX_DEPTH,
  REGION_QUALITY_STEP_MULTIPLIERS,
  resolveQuality,
  type ColorAreaLayerQuality,
} from './layer-quality-utils.js';
import { useMeasuredElementSize } from './use-measured-element-size.js';
import {
  usePlaneQueryLayer,
  type PlaneQueryWorkerPayload,
} from './use-plane-query-layer.js';
import type { PlaneQueryWorkerResponse } from './workers/plane-query-client.js';
import {
  BOUNDARY_SNAP_TOLERANCE,
  buildContrastRegionFillPaths,
  countPathPoints,
  DEFAULT_LAYER_ERROR_TOLERANCE,
  DEFAULT_LAYER_INITIAL_SAMPLES,
  isPathClosed,
  mapColorToGamut,
  MIN_LAYER_INITIAL_SAMPLES,
  resolveContrastThresholdValue,
  snapPathToBoundary,
  toColorAreaContrastRegionPaths,
  withDomainBaselinePoints,
  type LayerSampling,
} from './contrast-region-geometry.js';

/** Per-compute stats passed to `ContrastRegionLayerProps.onMetrics`. */
export interface ContrastRegionLayerMetrics {
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
  /** Resolved sampling quality level. */
  quality: 'high' | 'medium' | 'low';
  /** Whether the area was being dragged. */
  isDragging: boolean;
}

/** Props for {@link ContrastRegionLayer}; other {@link LayerProps} are forwarded. */
export interface ContrastRegionLayerProps extends LayerProps {
  /**
   * Color the region's samples are measured against (gamut-mapped into
   * `gamut` first). Defaults to the requested color.
   */
  reference?: Color;
  /** Hue of the plane slice in degrees. Defaults to the requested hue. */
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
   * ratio, or with `metric="apca"` a normalized Lc magnitude (`0.6` for
   * Lc 60).
   */
  threshold?: number;
  /**
   * WCAG threshold preset used when `threshold` is omitted.
   * @defaultValue 'AA' (4.5:1)
   */
  level?: ColorAreaContrastRegionOptions['level'];
  /**
   * APCA threshold preset used with `metric="apca"` when `threshold` is
   * omitted.
   * @defaultValue 'body' (Lc 60, normalized 0.6)
   */
  apcaPreset?: ColorAreaContrastRegionOptions['apcaPreset'];
  /**
   * APCA polarity test with `metric="apca"`: `absolute`, `positive` or
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
   * Initial samples per gamut chroma extent, scaled by `quality`. The
   * layer's default is tuned for interactive use; see `contrastRegionPaths`.
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
  /**
   * Sampling quality. `'auto'` follows the area's adaptive quality level.
   * @defaultValue 'auto'
   */
  quality?: ColorAreaLayerQuality;
  /** Props for each contour `<path>` (stroke, dash, etc.); `fill` defaults to `'none'`. */
  pathProps?: SVGAttributes<SVGPathElement>;
  /**
   * Draw a circle at every path vertex (for debugging sampling).
   * @defaultValue false
   */
  showPathPoints?: boolean;
  /** Props for the vertex circles drawn with `showPathPoints`. */
  pointProps?: SVGAttributes<SVGCircleElement>;
  /** Called after each sync or worker compute with sampling and timing stats. */
  onMetrics?: (metrics: ContrastRegionLayerMetrics) => void;
  /** RDP simplification tolerance in (l,c) space; omit to disable */
  simplifyTolerance?: number;
  /**
   * Include worker scheduler fields in `onMetrics`.
   * @defaultValue false
   */
  includeSchedulerTelemetry?: boolean;
  /** Corner radius in 0-1 for path vertices; omit for sharp corners */
  cornerRadius?: number;
  /** Optional precomputed contour paths (for plane-driven overlays). */
  paths?: ColorAreaContrastRegionPoint[][];
  /**
   * Removed with the hybrid contrast-region solver; use `initialSamples`.
   * Passing it is a type error and throws a `TypeError`.
   */
  lightnessSteps?: never;
  /** Removed with the hybrid solver; use `initialSamples`. */
  chromaSteps?: never;
  /** Removed with the hybrid solver; use `maxDepth`. */
  hybridMaxDepth?: never;
  /** Removed with the hybrid solver; use `errorTolerance`. */
  hybridErrorTolerance?: never;
  /** Removed with the hybrid solver, which forwarded it to `maxChromaAt`. */
  tolerance?: never;
  /** Removed with the hybrid solver, which forwarded it to `maxChromaAt`. */
  maxIterations?: never;
}

const REMOVED_LAYER_PROPS = [
  'lightnessSteps',
  'chromaSteps',
  'hybridMaxDepth',
  'hybridErrorTolerance',
  'tolerance',
  'maxIterations',
] as const;

/** Throws a `TypeError` for a prop removed with the hybrid solver. */
function rejectRemovedLayerProps(props: object): void {
  const bag = props as Record<string, unknown>;
  for (const name of REMOVED_LAYER_PROPS) {
    if (bag[name] !== undefined) {
      throw new TypeError(
        `ContrastRegionLayer prop "${name}" was removed with the hybrid contrast-region solver; tune the layer with initialSamples, errorTolerance, and maxDepth`,
      );
    }
  }
}

interface ContrastRegionPathContextValue {
  paths: ColorAreaContrastRegionPoint[][];
  regionPathData: string;
  cornerRadius?: number;
}

const ContrastRegionPathContext =
  createContext<ContrastRegionPathContextValue | null>(null);

function useContrastRegionPath(): ContrastRegionPathContextValue {
  const value = useContext(ContrastRegionPathContext);
  if (!value) {
    throw new Error(
      'ContrastRegionFill must be used as a child of ContrastRegionLayer.',
    );
  }
  return value;
}

/** Props for {@link ContrastRegionFill}. */
export interface ContrastRegionFillProps {
  /**
   * Fill color for the region.
   * @defaultValue '#c0e1ff'
   */
  fillColor?: string;
  /**
   * Fill opacity 0–1.
   * @defaultValue 0.22
   */
  fillOpacity?: number;
  /**
   * Opacity 0–1 of a white dot pattern over the region; 0 disables dots.
   * @defaultValue 0
   */
  dotOpacity?: number;
  /**
   * Dot size in px.
   * @defaultValue 2
   */
  dotSize?: number;
  /**
   * Gap between dots in px.
   * @defaultValue 3
   */
  dotGap?: number;
  /** Additional path element props (e.g. fill). */
  pathProps?: SVGAttributes<SVGPathElement>;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Fills the region computed by the enclosing {@link ContrastRegionLayer},
 * with an optional white dot pattern.
 *
 * Renders nothing while the region is empty. Must be a child of a
 * ContrastRegionLayer.
 *
 * @throws {Error} When rendered outside a `<ContrastRegionLayer>`.
 *
 * @example
 * ```tsx
 * import {
 *   Color,
 *   ColorArea,
 *   ColorPlane,
 *   ContrastRegionFill,
 *   ContrastRegionLayer,
 * } from 'color-kit/react';
 * import { parse } from 'color-kit';
 *
 * export const Picker = () => (
 *   <Color defaultColor="#3b82f6">
 *     <ColorArea style={{ width: 240, height: 240 }}>
 *       <ColorPlane />
 *       <ContrastRegionLayer reference={parse('#ffffff')} level="AA">
 *         <ContrastRegionFill fillColor="#000" fillOpacity={0.2} dotOpacity={0.4} />
 *       </ContrastRegionLayer>
 *     </ColorArea>
 *   </Color>
 * );
 * ```
 */
export function ContrastRegionFill({
  fillColor = '#c0e1ff',
  fillOpacity = 0.22,
  dotOpacity = 0,
  dotSize = 2,
  dotGap = 3,
  pathProps,
}: ContrastRegionFillProps) {
  const { regionPathData } = useContrastRegionPath();
  const patternId = useId().replace(/[:]/g, '_');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hasRegionPath = regionPathData.length > 0;

  const dotOpacityClamped = clamp01(dotOpacity);
  const size = useMeasuredElementSize(svgRef, {
    enabled: dotOpacityClamped > 0 && hasRegionPath,
    initialWidth: 100,
    initialHeight: 100,
  });
  const dotSizeEffective = Math.max(1, dotSize);
  const dotGapEffective = Math.max(0, dotGap);
  const dotCell = dotSizeEffective + dotGapEffective;
  const dotCellX = (dotCell * 100) / Math.max(1, size.width);
  const dotCellY = (dotCell * 100) / Math.max(1, size.height);
  const dotSizeX = (dotSizeEffective * 100) / Math.max(1, size.width);
  const dotSizeY = (dotSizeEffective * 100) / Math.max(1, size.height);

  if (!hasRegionPath) return null;

  return (
    <svg
      ref={svgRef}
      data-color-area-contrast-region-fill=""
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {dotOpacityClamped > 0 ? (
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={dotCellX}
            height={dotCellY}
          >
            <ellipse
              cx={dotSizeX * 0.5}
              cy={dotSizeY * 0.5}
              rx={dotSizeX * 0.5}
              ry={dotSizeY * 0.5}
              fill={`rgba(255,255,255,${dotOpacityClamped})`}
            />
          </pattern>
        </defs>
      ) : null}
      <path
        d={regionPathData}
        fill={fillColor}
        fillOpacity={clamp01(fillOpacity)}
        {...pathProps}
      />
      {dotOpacityClamped > 0 ? (
        <path d={regionPathData} fill={`url(#${patternId})`} stroke="none" />
      ) : null}
    </svg>
  );
}

function toPath(
  points: ColorAreaContrastRegionPoint[],
  closeLoop: boolean,
  cornerRadius?: number,
): string {
  if (points.length < 2) {
    return '';
  }
  if (cornerRadius != null && cornerRadius > 0) {
    return pathWithRoundedCorners(
      points.map((p) => ({ x: p.x, y: p.y })),
      cornerRadius,
      closeLoop,
    );
  }
  const commands = points.map((point, index) => {
    const x = (point.x * 100).toFixed(3);
    const y = (point.y * 100).toFixed(3);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  });

  if (closeLoop) {
    commands.push('Z');
  }

  return commands.join(' ');
}

/**
 * Overlay {@link Layer} that outlines the colors of the current hue that meet
 * a contrast threshold against a reference color.
 *
 * The region is solved in the area's lightness/chroma plane (axes `l` and
 * `c` in either order; other axis pairs render an empty layer) with WCAG
 * 2 or APCA, and drawn as SVG contour paths. Compose
 * {@link ContrastRegionFill} as a child to fill the region. The reference
 * defaults to the requested color; pass `reference` to test against a fixed
 * text or background color. Computed synchronously while idle and in a
 * shared Web Worker during drags (when workers are available), keeping the
 * last stable region until a fresh one arrives. Must be rendered inside a
 * {@link ColorArea}.
 *
 * @throws {TypeError} When a removed hybrid-solver prop (`lightnessSteps`,
 *   `chromaSteps`, `hybridMaxDepth`, `hybridErrorTolerance`, `tolerance`,
 *   `maxIterations`) is passed.
 * @throws {Error} When rendered outside a `<ColorArea>`.
 *
 * @example
 * ```tsx
 * import {
 *   Color,
 *   ColorArea,
 *   ColorPlane,
 *   ContrastRegionFill,
 *   ContrastRegionLayer,
 * } from 'color-kit/react';
 * import { parse } from 'color-kit';
 *
 * export const TextColorPicker = () => (
 *   <Color defaultColor="#1f2937">
 *     <ColorArea style={{ width: 240, height: 240 }}>
 *       <ColorPlane />
 *       <ContrastRegionLayer
 *         reference={parse('#ffffff')}
 *         metric="apca"
 *         apcaPreset="body"
 *         pathProps={{ stroke: '#fff', vectorEffect: 'non-scaling-stroke' }}
 *       >
 *         <ContrastRegionFill fillOpacity={0.15} />
 *       </ContrastRegionLayer>
 *     </ColorArea>
 *   </Color>
 * );
 * ```
 */
export function ContrastRegionLayer({
  reference,
  hue,
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
  quality = 'auto',
  pathProps,
  showPathPoints = false,
  pointProps,
  onMetrics,
  simplifyTolerance,
  includeSchedulerTelemetry = false,
  cornerRadius,
  paths: pathsProp,
  children,
  ...props
}: ContrastRegionLayerProps) {
  rejectRemovedLayerProps(props);
  const { requested, axes, performanceProfile, qualityLevel, isDragging } =
    useColorAreaContext();
  const resolvedQuality = resolveQuality(quality, qualityLevel);
  const multiplier = qualityStepMultiplier(
    resolvedQuality,
    REGION_QUALITY_STEP_MULTIPLIERS,
  );
  const effectiveInitialSamples = Math.max(
    MIN_LAYER_INITIAL_SAMPLES,
    Math.round((initialSamples ?? DEFAULT_LAYER_INITIAL_SAMPLES) * multiplier),
  );
  const effectiveMaxDepth =
    maxDepth ?? REGION_QUALITY_MAX_DEPTH[resolvedQuality];

  const resolvedReference = reference ?? requested;
  const resolvedHue = hue ?? requested.h;
  const contrastReference = useMemo(
    () => mapColorToGamut(resolvedReference, gamut),
    [gamut, resolvedReference],
  );

  const [frozenSampling, setFrozenSampling] = useState<LayerSampling | null>(
    null,
  );
  const [lastStablePaths, setLastStablePaths] = useState<
    ColorAreaContrastRegionPoint[][]
  >([]);
  const [lastStableRegionPathData, setLastStableRegionPathData] = useState('');
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

  const layerSampling: LayerSampling =
    isDragging && frozenSampling
      ? frozenSampling
      : {
          initialSamples: effectiveInitialSamples,
          maxDepth: effectiveMaxDepth,
        };
  // The sampling the solver runs with, clamped as core clamps it, so the
  // request and `onMetrics` agree with the work actually done.
  const samplingForOptions = clampContrastRegionSampling({
    ...layerSampling,
    errorTolerance,
  });
  const resolvedContrastMetric = metric ?? 'wcag';

  const options = useMemo<ColorAreaContrastRegionOptions>(
    () => ({
      gamut,
      metric,
      threshold,
      level,
      apcaPreset,
      apcaPolarity,
      apcaRole,
      initialSamples: samplingForOptions.initialSamples,
      errorTolerance: samplingForOptions.errorTolerance,
      maxDepth: samplingForOptions.maxDepth,
      maxChroma,
      alpha,
      simplifyTolerance,
    }),
    [
      alpha,
      apcaPolarity,
      apcaPreset,
      apcaRole,
      samplingForOptions.initialSamples,
      samplingForOptions.maxDepth,
      samplingForOptions.errorTolerance,
      gamut,
      level,
      maxChroma,
      metric,
      simplifyTolerance,
      threshold,
    ],
  );

  const computeSync = useCallback(
    () =>
      getColorAreaContrastRegionPaths(
        contrastReference,
        resolvedHue,
        axes,
        options,
      ),
    [axes, contrastReference, options, resolvedHue],
  );

  const workerPayload = useMemo<PlaneQueryWorkerPayload>(
    () => ({
      plane: toColorAreaPlaneDefinition(axes, contrastReference),
      queries: [
        {
          kind: 'contrastRegion' as const,
          reference: contrastReference,
          ...options,
          hue: resolvedHue,
        },
      ],
      priority: isDragging ? 'drag' : 'idle',
      quality: resolvedQuality,
      performanceProfile,
      includeSchedulerTelemetry,
    }),
    [
      axes,
      contrastReference,
      isDragging,
      options,
      performanceProfile,
      resolvedHue,
      resolvedQuality,
      includeSchedulerTelemetry,
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
      const unpacked = unpackPlaneQueryResults(response.result);
      const contrastRegionResult = unpacked.find(
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
        initialSamples: samplingForOptions.initialSamples,
        errorTolerance: samplingForOptions.errorTolerance,
        maxDepth: samplingForOptions.maxDepth,
        contrastMetric: resolvedContrastMetric,
        backend: payload.backend,
        scheduleReason: payload.scheduleReason,
        schedulerBucketCount: payload.schedulerBucketCount,
        quality: resolvedQuality,
        isDragging,
      });
    },
    [
      isDragging,
      onMetrics,
      resolvedContrastMetric,
      resolvedQuality,
      samplingForOptions.errorTolerance,
      samplingForOptions.initialSamples,
      samplingForOptions.maxDepth,
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
    external: pathsProp != null,
    isDragging,
    computeSync,
    syncWhileDragging: 'never',
    workerPayload,
    extractResult,
    onWorkerResponse: handleWorkerResponse,
  });

  // External paths participate in metrics and stable-path tracking the same
  // way an instant sync computation would.
  const syncComputation = useMemo(() => {
    if (pathsProp) {
      return {
        paths: pathsProp,
        computeTimeMs: 0,
      };
    }
    return sync
      ? { paths: sync.data, computeTimeMs: sync.computeTimeMs }
      : null;
  }, [pathsProp, sync]);

  const rawPathsAreFresh = useMemo(() => {
    if (pathsProp) return true;
    if (!usingWorkerPath) return true;
    return hasCurrentWorkerResponse;
  }, [hasCurrentWorkerResponse, pathsProp, usingWorkerPath]);

  const rawPaths = useMemo(() => {
    if (pathsProp) {
      return pathsProp;
    }
    if (usingWorkerPath) {
      if (hasCurrentWorkerResponse && workerData != null) {
        return workerData.data;
      }
      if (lastStablePaths.length > 0) {
        return lastStablePaths;
      }
      return syncComputation?.paths ?? [];
    }
    return syncComputation?.paths ?? [];
  }, [
    usingWorkerPath,
    lastStablePaths,
    hasCurrentWorkerResponse,
    pathsProp,
    syncComputation,
    workerData,
  ]);

  useEffect(() => {
    if (!syncComputation) {
      return;
    }
    emitMetrics({
      source: 'sync',
      requestId: requestIdRef.current,
      computeTimeMs: syncComputation.computeTimeMs,
      paths: syncComputation.paths,
      backend: 'js',
      scheduleReason: 'sync-inline',
    });
  }, [emitMetrics, requestIdRef, syncComputation]);

  useEffect(() => {
    if (!isDragging) {
      if (syncComputation?.paths) {
        queueMicrotask(() => setLastStablePaths(syncComputation.paths));
      }
      return;
    }
    if (!hasCurrentWorkerResponse || !workerData) {
      return;
    }
    queueMicrotask(() => setLastStablePaths(workerData.data));
  }, [hasCurrentWorkerResponse, isDragging, syncComputation, workerData]);

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

  const resolvedThreshold = useMemo(
    () => resolveContrastThresholdValue(threshold, level, metric, apcaPreset),
    [apcaPreset, level, metric, threshold],
  );
  const mappedReference = contrastReference;

  const regionFillPaths = useMemo(
    () =>
      buildContrastRegionFillPaths({
        paths,
        fillBoundary: contrastFillBoundary,
        mappedReference,
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
      gamut,
      mappedReference,
      metric,
      paths,
      resolvedHue,
      resolvedThreshold,
    ],
  );

  const regionPathData = useMemo(
    () =>
      regionFillPaths
        .map((points) => toPath(points, true, cornerRadius))
        .filter((path) => path.length > 0)
        .join(' '),
    [regionFillPaths, cornerRadius],
  );

  useEffect(() => {
    if (rawPathsAreFresh) {
      queueMicrotask(() => setLastStableRegionPathData(regionPathData));
    }
  }, [rawPathsAreFresh, regionPathData]);

  const visibleRegionPathData =
    isDragging && !rawPathsAreFresh ? lastStableRegionPathData : regionPathData;

  const pathContextValue: ContrastRegionPathContextValue = useMemo(
    () => ({
      paths,
      regionPathData: visibleRegionPathData,
      cornerRadius,
    }),
    [paths, visibleRegionPathData, cornerRadius],
  );

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'overlay'}
      interactive={props.interactive ?? false}
      data-color-area-contrast-region-layer=""
      data-quality={resolvedQuality}
      data-worker={pathsProp ? 'external' : usingWorkerPath ? 'async' : 'sync'}
    >
      <ContrastRegionPathContext.Provider value={pathContextValue}>
        {children}
      </ContrastRegionPathContext.Provider>
      {paths.map((points, index) => {
        const closed = isPathClosed(points);
        return (
          <Line
            key={index}
            points={points}
            cornerRadius={cornerRadius}
            closed={closed}
            pathProps={{
              fill: 'none',
              ...pathProps,
            }}
          />
        );
      })}
      {showPathPoints ? (
        <PathPointsOverlay
          paths={paths}
          pointProps={pointProps}
          data-color-area-contrast-region-points=""
        />
      ) : null}
    </Layer>
  );
}
