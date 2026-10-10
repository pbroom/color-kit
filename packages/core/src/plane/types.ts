import type { ContrastRegionPathOptions } from '../contrast/types.js';
import type { ChromaBandMode, GamutTarget } from '../gamut/index.js';
import type { PlanePoint } from '../geometry/types.js';
import type {
  PlaneGamutRegionScope,
  PlaneGamutSolver,
  PlaneQueryKind,
  PlaneQueryTrace,
  PlaneViewportRelation,
} from '../trace/types.js';
import type { Color } from '../types.js';

export type { PlanePoint } from '../geometry/types.js';
export type {
  PlaneComputeBackendKind,
  PlaneComputeScheduleReason,
  PlaneContrastSolver,
  PlaneGamutRegionScope,
  PlaneGamutSolver,
  PlaneQueryKind,
  PlaneQueryTrace,
  PlaneQueryTraceCellEvent,
  PlaneQueryTraceLevel,
  PlaneQueryTraceMarchingSquaresStage,
  PlaneQueryTraceMetricsStage,
  PlaneQueryTraceOptions,
  PlaneQueryTracePathStage,
  PlaneQueryTraceScalarGridStage,
  PlaneQueryTraceSolverStage,
  PlaneQueryTraceStage,
  PlaneQueryTraceSummary,
  PlaneQueryTraceViewportStage,
  PlaneTraceBounds,
  PlaneViewportRelation,
} from '../trace/types.js';

/**
 * Color models supported by plane geometry. `display-p3` is gamma-encoded
 * Display P3, named after CSS `color(display-p3 …)`.
 */
export type PlaneModel =
  | 'oklch'
  | 'rgb'
  | 'hsl'
  | 'hsv'
  | 'oklab'
  | 'hct'
  | 'display-p3';

/**
 * Channel identifiers supported by plane axes across all models.
 */
export type PlaneChannel =
  | 'l'
  | 'c'
  | 'h'
  | 'r'
  | 'g'
  | 'b'
  | 's'
  | 'v'
  | 'L'
  | 'a'
  | 't';

/**
 * Model-relative channel mapping used for type-safe plane inputs.
 */
export interface PlaneModelChannelMap {
  oklch: 'l' | 'c' | 'h';
  rgb: 'r' | 'g' | 'b';
  hsl: 'h' | 's' | 'l';
  hsv: 'h' | 's' | 'v';
  oklab: 'L' | 'a' | 'b';
  hct: 'h' | 'c' | 't';
  'display-p3': 'r' | 'g' | 'b';
}

/**
 * Channel identifiers supported by a specific plane model.
 */
export type PlaneChannelFor<Model extends PlaneModel> =
  PlaneModelChannelMap[Model];

/**
 * Partial channel bag used for model-relative fixed values.
 *
 * Channel names must be valid for the selected plane model when passed to
 * `definePlane()`.
 */
export type PlaneFixedInput<Model extends PlaneModel = PlaneModel> = Partial<
  Record<PlaneChannelFor<Model>, number>
> & {
  alpha?: number;
};

/**
 * Resolved model-relative channel bag.
 */
export type PlaneModelColor<Model extends PlaneModel = PlaneModel> = Partial<
  Record<PlaneChannelFor<Model>, number>
> & {
  alpha: number;
};

/**
 * Axis descriptor used in `definePlane()` input.
 */
export interface PlaneAxis<Model extends PlaneModel = PlaneModel> {
  /**
   * Channel projected on this axis.
   */
  channel: PlaneChannelFor<Model>;
  /**
   * Optional channel range for this axis.
   *
   * Defaults to `PLANE_MODEL_DEFAULT_RANGES[model][channel]` when omitted.
   */
  range?: [number, number];
}

/**
 * Input shape accepted by `definePlane()`.
 */
export interface PlaneDefinition<Model extends PlaneModel = PlaneModel> {
  /**
   * Plane model.
   *
   * Defaults to `'oklch'` when omitted.
   */
  model?: Model;
  /**
   * Horizontal axis.
   *
   * Defaults to the model's `PLANE_MODEL_DEFAULT_AXES[model].x` (`l` for
   * OKLCH) with its default range.
   */
  x?: PlaneAxis<Model>;
  /**
   * Vertical axis.
   *
   * Defaults to the model's `PLANE_MODEL_DEFAULT_AXES[model].y` (`c` for
   * OKLCH) with its default range.
   */
  y?: PlaneAxis<Model>;
  /**
   * Optional fixed channels for non-axis dimensions.
   *
   * Channels are interpreted relative to `model`, unsupported names throw, and
   * defaults are model-specific.
   */
  fixed?: PlaneFixedInput<Model>;
  /**
   * Optional anchor color converted into the selected model before resolving
   * `fixed`.
   *
   * Useful when switching models: omitted fixed channels are derived from this
   * color, while explicitly provided `fixed` values still win.
   */
  color?: Color;
}

type PlaneDefinitionWithRequiredModel<Model extends PlaneModel> = Omit<
  PlaneDefinition<Model>,
  'model'
> & {
  model: Model;
};

/**
 * Model-aware `definePlane()` input.
 *
 * This is useful for TypeScript callers that want model-specific channel
 * narrowing even when they store the definition in a variable first.
 */
export type PlaneDefinitionFor<Model extends PlaneModel> = Model extends 'oklch'
  ? PlaneDefinition<'oklch'>
  : PlaneDefinitionWithRequiredModel<Model>;

/** A plane axis with its range resolved. */
export interface ResolvedPlaneAxis<Model extends PlaneModel = PlaneModel> {
  /** Channel projected on this axis. */
  channel: PlaneChannelFor<Model>;
  /**
   * Channel values at normalized `0` and `1`; descending when the axis is
   * inverted.
   */
  range: [number, number];
}

/**
 * Fully-resolved plane: model, both axes with explicit ranges, and every
 * channel value. Aliased as {@link Plane}.
 */
export interface ResolvedPlaneDefinition<
  Model extends PlaneModel = PlaneModel,
> {
  /** Color model the plane slices. */
  model: Model;
  /** Horizontal axis. */
  x: ResolvedPlaneAxis<Model>;
  /** Vertical axis. */
  y: ResolvedPlaneAxis<Model>;
  /**
   * Every model channel plus `alpha`, clamped to the model's valid range. The
   * values for the two axis channels are ignored when mapping points.
   */
  fixed: PlaneModelColor<Model>;
}

/**
 * Resolved plane returned by {@link definePlane}; the input to every plane
 * query and projection.
 */
export type Plane<Model extends PlaneModel = PlaneModel> =
  ResolvedPlaneDefinition<Model>;

/** A plane point carrying the color it represents. */
export interface PlaneColorPoint extends PlanePoint {
  /** Color at this point (OKLCH). */
  color: Color;
}

/** A plane point on a gamut boundary or chroma band, with its OKLCH values. */
export interface PlaneBoundaryPoint extends PlanePoint {
  /** OKLCH lightness of the point, `0`–`1`. */
  l: number;
  /** OKLCH chroma of the point. */
  c: number;
}

/** A plane point on a contrast contour, with its OKLCH values. */
export interface PlaneRegionPoint extends PlanePoint {
  /** OKLCH lightness of the point, `0`–`1`. */
  l: number;
  /** OKLCH chroma of the point. */
  c: number;
}

/** A filled area of a plane, as closed outlines. */
export interface PlaneRegion {
  /**
   * Outlines of the area in normalized plane coordinates. Fill them together,
   * for example with `toSvgCompoundPath(paths, { closeLoop: true })`.
   */
  paths: PlanePoint[][];
}

/** A query result paired with its solver trace, from {@link inspectPlaneQuery}. */
export interface PlaneQueryInspection<
  Result extends PlaneQueryResult = PlaneQueryResult,
> {
  /** Query result, identical to what {@link runPlaneQuery} returns. */
  result: Result;
  /** Summary counters and ordered solver stages for this run. */
  trace: PlaneQueryTrace;
}

/** Query for {@link getPlaneGamutBoundary}. */
export interface PlaneGamutBoundaryQuery {
  kind: 'gamutBoundary';
  /**
   * Gamut whose edge is traced.
   * @defaultValue 'srgb'
   */
  gamut?: GamutTarget;
  /**
   * OKLCH hue in degrees. Defaults to the plane's hue (see {@link planeHue}).
   */
  hue?: number;
  /**
   * Number of equal lightness segments in `'uniform'` mode; the result has
   * `steps + 1` points. Must be an integer of at least 2.
   * @defaultValue 100
   */
  steps?: number;
  /**
   * Ramer-Douglas-Peucker tolerance in normalized `(l, c)` space (for example
   * `0.001`). Omit or `0` to keep every sample.
   */
  simplifyTolerance?: number;
  /**
   * `'uniform'` samples fixed lightness steps; `'adaptive'` subdivides where
   * the edge curves.
   * @defaultValue 'uniform'
   */
  samplingMode?: 'uniform' | 'adaptive';
  /**
   * Maximum perpendicular error in `(l, c)` before an adaptive segment is
   * split.
   * @defaultValue 0.001
   */
  adaptiveTolerance?: number;
  /**
   * Maximum recursion depth in `'adaptive'` mode.
   * @defaultValue 12
   */
  adaptiveMaxDepth?: number;
}

/** Query for {@link getPlaneGamutRegion}. */
export interface PlaneGamutRegionQuery {
  kind: 'gamutRegion';
  /**
   * Gamut whose in-gamut area is computed.
   * @defaultValue 'srgb'
   */
  gamut?: GamutTarget;
  /**
   * `'viewport'` clips boundary paths to the plane window; `'full'` traces
   * them across the whole channel domain. The visible region is always
   * clipped to the window.
   * @defaultValue 'viewport'
   */
  scope?: PlaneGamutRegionScope;
  /**
   * Path simplification tolerance in normalized plane coordinates. Omit or
   * `0` to keep every vertex.
   */
  simplifyTolerance?: number;
}

/**
 * Shared options for contrast plane queries. Identical to
 * `ContrastRegionPathOptions` (metric, threshold, gamut and sampling) plus the
 * reference color and hue override. Used by
 * {@link getPlaneContrastBoundary} and {@link getPlaneContrastRegion}.
 */
export type PlaneContrastQueryOptions = ContrastRegionPathOptions & {
  /** Color every sample is measured against. */
  reference: Color;
  /** OKLCH hue in degrees. Defaults to the plane's hue (see {@link planeHue}). */
  hue?: number;
};

/** Query for {@link getPlaneContrastBoundary}. */
export type PlaneContrastBoundaryQuery = PlaneContrastQueryOptions & {
  kind: 'contrastBoundary';
};

/** Query for {@link getPlaneContrastRegion}. */
export type PlaneContrastRegionQuery = PlaneContrastQueryOptions & {
  kind: 'contrastRegion';
};

/** Query for {@link getPlaneChromaBand}. */
export interface PlaneChromaBandQuery {
  kind: 'chromaBand';
  /**
   * Target OKLCH chroma. Defaults to the plane's fixed `c` (`0` when unset).
   */
  requestedChroma?: number;
  /**
   * Gamut that bounds the band.
   * @defaultValue 'srgb'
   */
  gamut?: GamutTarget;
  /** OKLCH hue in degrees. Defaults to the plane's hue (see {@link planeHue}). */
  hue?: number;
  /**
   * `'clamped'` uses `requestedChroma` wherever it fits and the gamut edge
   * elsewhere; `'proportional'` keeps the requested/max-chroma ratio measured
   * at `selectedLightness` across all lightness.
   * @defaultValue 'clamped'
   */
  mode?: ChromaBandMode;
  /**
   * Number of equal lightness segments in `'uniform'` mode; the result has
   * `steps + 1` points. Must be an integer of at least 2.
   * @defaultValue 12
   */
  steps?: number;
  /**
   * `'uniform'` samples fixed lightness steps; `'adaptive'` reuses adaptive
   * gamut-boundary sampling.
   * @defaultValue 'uniform'
   */
  samplingMode?: 'uniform' | 'adaptive';
  /**
   * Maximum perpendicular error in `(l, c)` before an adaptive segment is
   * split.
   * @defaultValue 0.001
   */
  adaptiveTolerance?: number;
  /**
   * Maximum recursion depth in `'adaptive'` mode.
   * @defaultValue 12
   */
  adaptiveMaxDepth?: number;
  /**
   * Lightness at which `'proportional'` mode measures the chroma ratio.
   * Defaults to the plane's fixed `l` (`0.5` for a default OKLCH plane).
   */
  selectedLightness?: number;
  /**
   * Upper bound of the maximum-chroma search.
   * @defaultValue 0.4
   */
  maxChroma?: number;
  /**
   * Absolute chroma precision at which the maximum-chroma search stops.
   * @defaultValue 0.0001
   */
  tolerance?: number;
  /**
   * Iteration cap for the maximum-chroma search.
   * @defaultValue 30
   */
  maxIterations?: number;
  /** Alpha of the sampled colors. Defaults to the plane's fixed `alpha`. */
  alpha?: number;
}

/** Query for {@link getPlaneFallbackPoint}. */
export interface PlaneFallbackPointQuery {
  kind: 'fallbackPoint';
  /** Color to gamut-map; usually out of gamut. */
  color: Color;
  /** Gamut to map into. */
  gamut: GamutTarget;
}

/** Query for {@link samplePlaneGradient}. */
export interface PlaneGradientQuery {
  kind: 'gradient';
  /** Gradient start color. */
  from: Color;
  /** Gradient end color. */
  to: Color;
  /**
   * Finite integer sample count, endpoints included; integers below 2 are
   * raised to 2. Non-finite or fractional values throw a `RangeError`.
   * @defaultValue 16
   */
  steps?: number;
}

/** Any plane query accepted by {@link runPlaneQuery}, discriminated by `kind`. */
export type PlaneQuery =
  | PlaneGamutBoundaryQuery
  | PlaneGamutRegionQuery
  | PlaneContrastBoundaryQuery
  | PlaneContrastRegionQuery
  | PlaneChromaBandQuery
  | PlaneFallbackPointQuery
  | PlaneGradientQuery;

/** Result of {@link getPlaneGamutBoundary}. */
export interface PlaneGamutBoundaryResult {
  kind: 'gamutBoundary';
  /** Gamut that was traced. */
  gamut: GamutTarget;
  /** OKLCH hue the boundary was traced at, in degrees. */
  hue: number;
  /**
   * Boundary from black to white; empty on planes that are not OKLCH
   * lightness × chroma.
   */
  points: PlaneBoundaryPoint[];
}

/** Result of {@link getPlaneGamutRegion}. */
export interface PlaneGamutRegionResult {
  kind: 'gamutRegion';
  /** Gamut that was analyzed. */
  gamut: GamutTarget;
  /** Scope the boundary paths were traced in. */
  scope: PlaneGamutRegionScope;
  /**
   * How the gamut relates to the plane window: `'inside'` (the whole window
   * is in gamut), `'outside'` (none of it is) or `'intersects'`.
   */
  viewportRelation: PlaneViewportRelation;
  /** Solver that produced the geometry. */
  solver: PlaneGamutSolver;
  /** Gamut edge polylines in normalized plane coordinates. */
  boundaryPaths: PlanePoint[][];
  /** In-gamut part of the plane window, as closed outlines. */
  visibleRegion: PlaneRegion;
}

/** Result of {@link getPlaneContrastBoundary}. */
export interface PlaneContrastBoundaryResult {
  kind: 'contrastBoundary';
  /** OKLCH hue the contour was traced at, in degrees. */
  hue: number;
  /**
   * Longest contour line; empty on planes that are not OKLCH lightness ×
   * chroma or when no color passes.
   */
  points: PlaneRegionPoint[];
}

/** Result of {@link getPlaneContrastRegion}. */
export interface PlaneContrastRegionResult {
  kind: 'contrastRegion';
  /** OKLCH hue the region was traced at, in degrees. */
  hue: number;
  /**
   * Contour lines bounding the passing area (typically one per side of the
   * reference), longest first; empty on planes that are not OKLCH lightness ×
   * chroma or when no color passes.
   */
  paths: PlaneRegionPoint[][];
}

/** Result of {@link getPlaneChromaBand}. */
export interface PlaneChromaBandResult {
  kind: 'chromaBand';
  /** OKLCH hue the band was sampled at, in degrees. */
  hue: number;
  /**
   * Band from black to white; empty on planes that are not OKLCH lightness ×
   * chroma.
   */
  points: PlaneBoundaryPoint[];
}

/** Result of {@link getPlaneFallbackPoint}. */
export interface PlaneFallbackPointResult {
  kind: 'fallbackPoint';
  /** Gamut the color was mapped into. */
  gamut: GamutTarget;
  /** Plane position of the mapped color, with the mapped color itself. */
  point: PlaneColorPoint;
}

/** Result of {@link samplePlaneGradient}. */
export interface PlaneGradientResult {
  kind: 'gradient';
  /** One point per sample, from `from` to `to`. */
  points: PlaneColorPoint[];
}

/** Any plane query result, discriminated by `kind` (matches the query's). */
export type PlaneQueryResult =
  | PlaneGamutBoundaryResult
  | PlaneGamutRegionResult
  | PlaneContrastBoundaryResult
  | PlaneContrastRegionResult
  | PlaneChromaBandResult
  | PlaneFallbackPointResult
  | PlaneGradientResult;

type IsExactly<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
type AssertTrue<T extends true> = T;

/**
 * Compile-time guard: `PlaneQueryKind` (trace layer) must list exactly the
 * discriminants of `PlaneQuery`.
 */
export type PlaneQueryKindMatchesPlaneQuery = AssertTrue<
  IsExactly<PlaneQuery['kind'], PlaneQueryKind>
>;
