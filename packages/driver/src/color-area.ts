import type { Color } from '@color-kit/core';
import {
  assertGamutTarget,
  clamp,
  definePlane,
  PLANE_MODEL_DEFAULT_RANGES,
  sense,
  toP3Gamut,
  toSrgbGamut,
  type ChromaBandMode,
  type ContrastRegionPathOptions,
  type GamutTarget,
} from '@color-kit/core';
import {
  DEFAULT_LARGE_STEP_RATIO,
  getChannelValueText,
  stepRangeValue,
} from './channel-keys.js';

/**
 * OKLCH channel a color-area axis can drive: lightness `l` (0..1), chroma `c`
 * (0..~0.4) or hue `h` (degrees).
 */
export type ColorAreaChannel = 'l' | 'c' | 'h';
/** Keyboard keys handled by {@link colorFromColorAreaKey}. */
export type ColorAreaKey =
  | 'ArrowRight'
  | 'ArrowLeft'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'PageUp'
  | 'PageDown'
  | 'Home'
  | 'End';

/** Options for {@link colorFromColorAreaKey}. */
export interface ColorAreaKeyOptions {
  /**
   * PageUp/PageDown step as a ratio of the y-axis range.
   * @defaultValue 0.1
   */
  largeStepRatio?: number;
  /**
   * Wrap hue axes around their range ends instead of clamping.
   * @defaultValue true
   */
  wrapHue?: boolean;
}
const COLOR_AREA_PLANE_MODEL = 'oklch' as const;

/** One axis of a color area as authored: a channel and an optional range. */
export interface ColorAreaAxis {
  /** OKLCH channel the axis drives. */
  channel: ColorAreaChannel;
  /**
   * `[start, end]` channel values. `start` maps to the left (x) or bottom (y)
   * edge, `end` to the right or top edge.
   * @defaultValue `COLOR_AREA_DEFAULT_RANGES[channel]`
   */
  range?: [number, number];
}

/** Axis configuration for a color area. */
export interface ColorAreaAxes {
  /** Horizontal axis. */
  x: ColorAreaAxis;
  /** Vertical axis. */
  y: ColorAreaAxis;
}

/** A {@link ColorAreaAxis} with its range filled in. */
export interface ResolvedColorAreaAxis {
  /** OKLCH channel the axis drives. */
  channel: ColorAreaChannel;
  /** `[start, end]` values; `start` is the left/bottom edge. */
  range: [number, number];
}

/** {@link ColorAreaAxes} with both ranges filled in; see {@link resolveColorAreaAxes}. */
export interface ResolvedColorAreaAxes {
  /** Horizontal axis. */
  x: ResolvedColorAreaAxis;
  /** Vertical axis. */
  y: ResolvedColorAreaAxis;
}

const OKLCH_DEFAULT_RANGES = PLANE_MODEL_DEFAULT_RANGES.oklch;

/**
 * Default `[start, end]` range per color-area channel: `l` `[0, 1]`, `c`
 * `[0, 0.4]`, `h` `[0, 360]`. `start` sits at the left/bottom edge.
 *
 * @see {@link resolveColorAreaRange}
 */
export const COLOR_AREA_DEFAULT_RANGES: Record<
  ColorAreaChannel,
  [number, number]
> = {
  l: [OKLCH_DEFAULT_RANGES.l[0], OKLCH_DEFAULT_RANGES.l[1]],
  // UI Y coordinates are flipped, so keep chroma ascending here.
  c: [OKLCH_DEFAULT_RANGES.c[1], OKLCH_DEFAULT_RANGES.c[0]],
  h: [OKLCH_DEFAULT_RANGES.h[0], OKLCH_DEFAULT_RANGES.h[1]],
};

const COLOR_AREA_DEFAULT_AXES: ResolvedColorAreaAxes = {
  x: {
    channel: 'l',
    range: COLOR_AREA_DEFAULT_RANGES.l,
  },
  y: {
    channel: 'c',
    range: COLOR_AREA_DEFAULT_RANGES.c,
  },
};

/**
 * A boundary or band point in OKLCH `l`/`c` plus its normalized area position
 * (`x` right, `y` down, both `[0, 1]`).
 */
export interface ColorAreaGamutBoundaryPoint {
  /** OKLCH lightness, 0..1. */
  l: number;
  /** OKLCH chroma. */
  c: number;
  /** Normalized x position, 0 = left edge. */
  x: number;
  /** Normalized y position, 0 = top edge. */
  y: number;
}

/** Options for {@link getColorAreaGamutBoundaryPoints}. */
export interface ColorAreaGamutBoundaryOptions {
  /**
   * Gamut whose boundary is traced.
   * @defaultValue 'srgb'
   */
  gamut?: GamutTarget;
  /**
   * Equal lightness segments in uniform mode; the path has `steps + 1`
   * points. Must be an integer of at least 2. Ignored in adaptive mode.
   * @defaultValue 100
   */
  steps?: number;
  /** Ramer-Douglas-Peucker simplification tolerance in (l, c) space; omit to disable. */
  simplifyTolerance?: number;
  /**
   * `'uniform'` samples fixed lightness steps; `'adaptive'` subdivides where
   * the curve bends.
   * @defaultValue 'uniform'
   */
  samplingMode?: 'uniform' | 'adaptive';
  /**
   * Adaptive mode: max perpendicular error in (l, c) before subdividing.
   * @defaultValue 0.001
   */
  adaptiveTolerance?: number;
  /**
   * Adaptive mode: max recursion depth.
   * @defaultValue 12
   */
  adaptiveMaxDepth?: number;
}

/**
 * A contrast-region path point in OKLCH `l`/`c` plus its normalized area
 * position (`x` right, `y` down, both `[0, 1]`).
 */
export interface ColorAreaContrastRegionPoint {
  /** OKLCH lightness, 0..1. */
  l: number;
  /** OKLCH chroma. */
  c: number;
  /** Normalized x position, 0 = left edge. */
  x: number;
  /** Normalized y position, 0 = top edge. */
  y: number;
}

/** Result of {@link getColorAreaFallbackPoint}. */
export interface ColorAreaFallbackPoint {
  /** Normalized x position of the mapped color, 0 = left edge. */
  x: number;
  /** Normalized y position of the mapped color, 0 = top edge. */
  y: number;
  /** The color after gamut mapping into `gamut`. */
  color: Color;
  /** Gamut the color was mapped into. */
  gamut: GamutTarget;
}

/**
 * Contrast-region options for a color area: the core
 * `ContrastRegionPathOptions`.
 */
export type ColorAreaContrastRegionOptions = ContrastRegionPathOptions;

/** Options for {@link getColorAreaChromaBandPoints}. */
export interface ColorAreaChromaBandOptions {
  /**
   * Gamut the band must stay inside.
   * @defaultValue 'srgb'
   */
  gamut?: GamutTarget;
  /**
   * `'clamped'` keeps the reference chroma where the gamut allows it and
   * clamps to the boundary elsewhere; `'proportional'` scales every step by
   * the reference's requested/max chroma ratio at `selectedLightness`.
   * @defaultValue 'clamped'
   */
  mode?: ChromaBandMode;
  /**
   * Equal lightness segments in uniform mode; the band has `steps + 1`
   * points. Ignored in adaptive mode.
   * @defaultValue 12
   */
  steps?: number;
  /**
   * `'uniform'` samples fixed lightness steps; `'adaptive'` reuses adaptive
   * boundary sampling.
   * @defaultValue 'uniform'
   */
  samplingMode?: 'uniform' | 'adaptive';
  /**
   * Adaptive mode: max perpendicular error in (l, c) before subdividing.
   * @defaultValue 0.001
   */
  adaptiveTolerance?: number;
  /**
   * Adaptive mode: max recursion depth.
   * @defaultValue 12
   */
  adaptiveMaxDepth?: number;
  /**
   * Lightness anchor for `'proportional'` mode.
   * @defaultValue the reference color's `l`
   */
  selectedLightness?: number;
  /** Upper bound for the max-chroma search. */
  maxChroma?: number;
  /** Absolute precision of the max-chroma binary search. */
  tolerance?: number;
  /** Iteration cap for the max-chroma binary search. */
  maxIterations?: number;
  /**
   * Alpha used while sampling.
   * @defaultValue the reference color's `alpha`
   */
  alpha?: number;
}

/**
 * Returns `range` when given, otherwise the channel's entry in
 * {@link COLOR_AREA_DEFAULT_RANGES}.
 *
 * @example
 * ```ts
 * import { resolveColorAreaRange } from 'color-kit/driver';
 *
 * resolveColorAreaRange('c'); // → [0, 0.4]
 * resolveColorAreaRange('h', [0, 180]); // → [0, 180]
 * ```
 */
export function resolveColorAreaRange(
  channel: ColorAreaChannel,
  range?: [number, number],
): [number, number] {
  return range ?? COLOR_AREA_DEFAULT_RANGES[channel];
}

/**
 * Fills in missing axis ranges from {@link COLOR_AREA_DEFAULT_RANGES}. With no
 * argument, returns the default axes: lightness on x, chroma on y.
 *
 * @example
 * ```ts
 * import { resolveColorAreaAxes } from 'color-kit/driver';
 *
 * resolveColorAreaAxes();
 * // → { x: { channel: 'l', range: [0, 1] }, y: { channel: 'c', range: [0, 0.4] } }
 * resolveColorAreaAxes({ x: { channel: 'h' }, y: { channel: 'l' } });
 * // → { x: { channel: 'h', range: [0, 360] }, y: { channel: 'l', range: [0, 1] } }
 * ```
 */
export function resolveColorAreaAxes(
  axes?: ColorAreaAxes,
): ResolvedColorAreaAxes {
  const next = axes ?? COLOR_AREA_DEFAULT_AXES;
  return {
    x: {
      channel: next.x.channel,
      range: resolveColorAreaRange(next.x.channel, next.x.range),
    },
    y: {
      channel: next.y.channel,
      range: resolveColorAreaRange(next.y.channel, next.y.range),
    },
  };
}

/**
 * Whether the x and y axes drive different channels. An area whose axes share
 * a channel cannot place a color unambiguously.
 *
 * @example
 * ```ts
 * import { areColorAreaAxesDistinct } from 'color-kit/driver';
 *
 * areColorAreaAxesDistinct({ x: { channel: 'l' }, y: { channel: 'c' } }); // → true
 * areColorAreaAxesDistinct({ x: { channel: 'l' }, y: { channel: 'l' } }); // → false
 * ```
 */
export function areColorAreaAxesDistinct(axes: {
  x: { channel: ColorAreaChannel };
  y: { channel: ColorAreaChannel };
}): boolean {
  return axes.x.channel !== axes.y.channel;
}

function normalize(value: number, range: [number, number]): number {
  return clamp((value - range[0]) / (range[1] - range[0]), 0, 1);
}

function usesLightnessAndChroma(axes: {
  x: { channel: ColorAreaChannel };
  y: { channel: ColorAreaChannel };
}): boolean {
  return (
    (axes.x.channel === 'l' && axes.y.channel === 'c') ||
    (axes.x.channel === 'c' && axes.y.channel === 'l')
  );
}

/**
 * Plain, serializable OKLCH plane description of a color area; see
 * {@link toColorAreaPlaneDefinition}.
 */
export interface ColorAreaPlaneDefinition {
  /** Always `'oklch'`. */
  model: typeof COLOR_AREA_PLANE_MODEL;
  /** Horizontal axis channel and `[start, end]` range. */
  x: { channel: ColorAreaChannel; range: [number, number] };
  /** Vertical axis channel and `[start, end]` range. */
  y: { channel: ColorAreaChannel; range: [number, number] };
  /** Reference color channels; the axis channels are overridden per point. */
  fixed: { l: number; c: number; h: number; alpha: number };
}

/**
 * Builds the plain plane definition for a color area's axes and reference
 * color. This is the single source of truth for plane payloads sent to
 * plane-query workers and other transport boundaries. The result is plain
 * JSON and can be passed to `definePlane` from `color-kit/plane`.
 *
 * @example
 * ```ts
 * import { resolveColorAreaAxes, toColorAreaPlaneDefinition } from 'color-kit/driver';
 *
 * toColorAreaPlaneDefinition(resolveColorAreaAxes(), { l: 0.6, c: 0.1, h: 250, alpha: 1 });
 * // → { model: 'oklch',
 * //     x: { channel: 'l', range: [0, 1] },
 * //     y: { channel: 'c', range: [0, 0.4] },
 * //     fixed: { l: 0.6, c: 0.1, h: 250, alpha: 1 } }
 * ```
 */
export function toColorAreaPlaneDefinition(
  axes: ResolvedColorAreaAxes,
  reference: Color,
): ColorAreaPlaneDefinition {
  return {
    model: COLOR_AREA_PLANE_MODEL,
    x: {
      channel: axes.x.channel,
      range: axes.x.range,
    },
    y: {
      channel: axes.y.channel,
      range: axes.y.range,
    },
    fixed: {
      l: reference.l,
      c: reference.c,
      h: reference.h,
      alpha: reference.alpha,
    },
  };
}

function toPlaneDefinition(axes: ResolvedColorAreaAxes, reference: Color) {
  return definePlane(toColorAreaPlaneDefinition(axes, reference));
}

function planeToUiPoint(point: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return {
    x: point.x,
    y: 1 - point.y,
  };
}

/**
 * Normalized thumb position of `color` in the area: `x` runs left to right
 * and `y` top to bottom, so a y-axis value at its range end sits at `y = 0`.
 * Both coordinates are clamped to `[0, 1]`.
 *
 * @example
 * ```ts
 * import { getColorAreaThumbPosition, resolveColorAreaAxes } from 'color-kit/driver';
 *
 * const axes = resolveColorAreaAxes(); // x: l [0, 1], y: c [0, 0.4]
 * getColorAreaThumbPosition({ l: 0.6, c: 0.1, h: 250, alpha: 1 }, axes);
 * // → { x: 0.6, y: 0.75 }
 * ```
 */
export function getColorAreaThumbPosition(
  color: Color,
  axes: ResolvedColorAreaAxes,
): { x: number; y: number } {
  return {
    x: normalize(color[axes.x.channel], axes.x.range),
    y: 1 - normalize(color[axes.y.channel], axes.y.range),
  };
}

/**
 * Client-space bounds of a color area, e.g. from `getBoundingClientRect()`.
 */
export interface ColorAreaPointerRect {
  /** Left edge in client pixels. */
  left: number;
  /** Top edge in client pixels. */
  top: number;
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
}

/**
 * Normalizes a pointer position against the area's client rect into clamped
 * `[0, 1]` coordinates (x right, y down). Returns `null` for an empty rect or
 * non-finite input.
 *
 * @example
 * ```ts
 * import { normalizeColorAreaPointer } from 'color-kit/driver';
 *
 * const rect = { left: 100, top: 20, width: 200, height: 100 };
 * normalizeColorAreaPointer(150, 40, rect); // → { x: 0.25, y: 0.2 }
 * normalizeColorAreaPointer(50, 400, rect); // → { x: 0, y: 1 }
 * ```
 */
export function normalizeColorAreaPointer(
  clientX: number,
  clientY: number,
  rect: ColorAreaPointerRect,
): { x: number; y: number } | null {
  if (!(rect.width > 0) || !(rect.height > 0)) {
    return null;
  }

  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
}

/**
 * Returns a copy of `color` with both axis channels set from a normalized
 * area position (`x` right, `y` down, as from
 * {@link normalizeColorAreaPointer}). Positions are clamped to `[0, 1]`; the
 * result is not gamut-mapped.
 *
 * @example
 * ```ts
 * import { colorFromColorAreaPosition, resolveColorAreaAxes } from 'color-kit/driver';
 *
 * const axes = resolveColorAreaAxes(); // x: l [0, 1], y: c [0, 0.4]
 * colorFromColorAreaPosition({ l: 0.6, c: 0.1, h: 250, alpha: 1 }, axes, 0.25, 0.5);
 * // → { l: 0.25, c: 0.2, h: 250, alpha: 1 }
 * ```
 */
export function colorFromColorAreaPosition(
  color: Color,
  axes: ResolvedColorAreaAxes,
  xNorm: number,
  yNorm: number,
): Color {
  const x = clamp(xNorm, 0, 1);
  const y = clamp(yNorm, 0, 1);

  const xRange = axes.x.range;
  const yRange = axes.y.range;

  const xValue = xRange[0] + x * (xRange[1] - xRange[0]);
  const yValue = yRange[0] + (1 - y) * (yRange[1] - yRange[0]);

  return {
    ...color,
    [axes.x.channel]: xValue,
    [axes.y.channel]: yValue,
  };
}

/**
 * Traces the gamut boundary (max in-gamut chroma per lightness) at `hue`
 * degrees as area points, ordered from `l = 0` to `l = 1`. Each point carries
 * its OKLCH `l`/`c` and normalized `x`/`y` (`y` down). Returns `[]` unless the
 * axes are lightness and chroma (in either orientation).
 *
 * @throws {TypeError} When `options.gamut` is not `'srgb'` or `'display-p3'`
 * (for example the removed `'p3'` spelling).
 * @throws {Error} When `options.steps` is not an integer of at least 2.
 * @see {@link getColorAreaChromaBandPoints}
 *
 * @example
 * ```ts
 * import { getColorAreaGamutBoundaryPoints, resolveColorAreaAxes } from 'color-kit/driver';
 *
 * const points = getColorAreaGamutBoundaryPoints(250, resolveColorAreaAxes());
 * points.length; // → 101
 * points[10]; // → { l: 0.1, c: 0.02841796875, x: 0.1, y: 0.928955078125 }
 * ```
 */
export function getColorAreaGamutBoundaryPoints(
  hue: number,
  axes: ResolvedColorAreaAxes,
  options: ColorAreaGamutBoundaryOptions = {},
): ColorAreaGamutBoundaryPoint[] {
  if (!usesLightnessAndChroma(axes)) {
    return [];
  }

  const reference: Color = {
    l: 0.5,
    c: 0,
    h: hue,
    alpha: 1,
  };
  const boundary = sense(toPlaneDefinition(axes, reference)).gamutBoundary({
    gamut: options.gamut ?? 'srgb',
    hue,
    steps: options.steps,
    simplifyTolerance: options.simplifyTolerance,
    samplingMode: options.samplingMode,
    adaptiveTolerance: options.adaptiveTolerance,
    adaptiveMaxDepth: options.adaptiveMaxDepth,
  });

  return boundary.points.map((point) => {
    const position = planeToUiPoint(point);
    return {
      l: point.l,
      c: point.c,
      x: position.x,
      y: position.y,
    };
  });
}

/**
 * Outlines the region of the `hue` plane whose colors meet the contrast
 * threshold against `reference` (WCAG AA 4.5:1 by default), as one or more
 * paths of area points (`y` down). Returns `[]` unless the axes are
 * lightness and chroma (in either orientation).
 *
 * @param reference - Color to measure contrast against, e.g. the background.
 * @param hue - OKLCH hue of the plane, in degrees.
 * @throws {TypeError} When `options.gamut` is not `'srgb'` or `'display-p3'`
 * (for example the removed `'p3'` spelling).
 *
 * @example
 * ```ts
 * import { getColorAreaContrastRegionPaths, resolveColorAreaAxes } from 'color-kit/driver';
 *
 * const white = { l: 1, c: 0, h: 0, alpha: 1 };
 * const paths = getColorAreaContrastRegionPaths(white, 250, resolveColorAreaAxes(), { level: 'AA' });
 * paths.length; // → 1
 * paths[0].length; // → 57
 * ```
 */
export function getColorAreaContrastRegionPaths(
  reference: Color,
  hue: number,
  axes: ResolvedColorAreaAxes,
  options: ColorAreaContrastRegionOptions = {},
): ColorAreaContrastRegionPoint[][] {
  if (!usesLightnessAndChroma(axes)) {
    return [];
  }

  const region = sense(toPlaneDefinition(axes, reference)).contrastRegion({
    ...options,
    reference,
    gamut: options.gamut ?? 'srgb',
    hue,
  });

  return region.paths.map((path) =>
    path.map((point) => {
      const position = planeToUiPoint(point);

      return {
        l: point.l,
        c: point.c,
        x: position.x,
        y: position.y,
      };
    }),
  );
}

/**
 * Samples the tonal strip at `reference.c` across lightness for `hue`
 * degrees, kept inside the gamut (see `mode`), as area points ordered from
 * `l = 0` to `l = 1` (`y` down). Returns `[]` unless the axes are lightness
 * and chroma (in either orientation).
 *
 * @param reference - Supplies the requested chroma, and the default
 * `selectedLightness` and `alpha`.
 * @param hue - OKLCH hue of the band, in degrees.
 * @throws {TypeError} When `options.gamut` is not `'srgb'` or `'display-p3'`
 * (for example the removed `'p3'` spelling).
 * @see {@link getColorAreaGamutBoundaryPoints}
 *
 * @example
 * ```ts
 * import { getColorAreaChromaBandPoints, resolveColorAreaAxes } from 'color-kit/driver';
 *
 * const color = { l: 0.6, c: 0.1, h: 250, alpha: 1 };
 * const band = getColorAreaChromaBandPoints(color, color.h, resolveColorAreaAxes());
 * band.length; // → 13
 * band[6]; // → { l: 0.5, c: 0.1, x: 0.5, y: 0.75 }
 * ```
 */
export function getColorAreaChromaBandPoints(
  reference: Color,
  hue: number,
  axes: ResolvedColorAreaAxes,
  options: ColorAreaChromaBandOptions = {},
): ColorAreaGamutBoundaryPoint[] {
  if (!usesLightnessAndChroma(axes)) {
    return [];
  }

  const band = sense(toPlaneDefinition(axes, reference)).chromaBand({
    requestedChroma: reference.c,
    gamut: options.gamut ?? 'srgb',
    hue,
    mode: options.mode ?? 'clamped',
    steps: options.steps,
    samplingMode: options.samplingMode,
    adaptiveTolerance: options.adaptiveTolerance,
    adaptiveMaxDepth: options.adaptiveMaxDepth,
    selectedLightness: options.selectedLightness ?? reference.l,
    maxChroma: options.maxChroma,
    tolerance: options.tolerance,
    maxIterations: options.maxIterations,
    alpha: options.alpha ?? reference.alpha,
  });

  return band.points.map((point) => {
    const position = planeToUiPoint(point);
    return {
      l: point.l,
      c: point.c,
      x: position.x,
      y: position.y,
    };
  });
}

/**
 * Maps `query.color` into the requested gamut and returns its thumb position,
 * e.g. to show where an out-of-gamut selection will actually render.
 *
 * @throws {TypeError} When `query.gamut` is missing or is not `'srgb'` or
 * `'display-p3'` (for example the removed `'p3'` spelling), matching the core
 * plane queries.
 * @see {@link getColorAreaThumbPosition}
 *
 * @example
 * ```ts
 * import { getColorAreaFallbackPoint, resolveColorAreaAxes } from 'color-kit/driver';
 *
 * const point = getColorAreaFallbackPoint(resolveColorAreaAxes(), {
 *   color: { l: 0.7, c: 0.35, h: 150, alpha: 1 },
 *   gamut: 'srgb',
 * });
 * point.x; // → 0.7
 * point.y.toFixed(3); // → '0.518'
 * point.color.c.toFixed(4); // → '0.1928'
 * ```
 */
export function getColorAreaFallbackPoint(
  axes: ResolvedColorAreaAxes,
  query: {
    color: Color;
    gamut: GamutTarget;
  },
): ColorAreaFallbackPoint {
  // assertGamutTarget accepts `undefined` (an omitted optional gamut), but
  // this query's gamut is required.
  if (query.gamut === undefined) {
    throw new TypeError(
      'getColorAreaFallbackPoint(): gamut is required ("srgb" or "display-p3")',
    );
  }
  assertGamutTarget(query.gamut, 'getColorAreaFallbackPoint()');
  const mapped =
    query.gamut === 'display-p3'
      ? toP3Gamut(query.color)
      : toSrgbGamut(query.color);
  const point = getColorAreaThumbPosition(mapped, axes);
  return {
    x: point.x,
    y: point.y,
    color: mapped,
    gamut: query.gamut,
  };
}

/**
 * Axis a color-area key acts on, or `null` when the key is not handled:
 * ArrowLeft/ArrowRight/Home/End act on x, ArrowUp/ArrowDown/PageUp/PageDown
 * on y.
 *
 * @example
 * ```ts
 * import { getColorAreaKeyAxis } from 'color-kit/driver';
 *
 * getColorAreaKeyAxis('ArrowUp'); // → 'y'
 * getColorAreaKeyAxis('Home'); // → 'x'
 * getColorAreaKeyAxis('Enter'); // → null
 * ```
 */
export function getColorAreaKeyAxis(key: string): 'x' | 'y' | null {
  switch (key as ColorAreaKey) {
    case 'ArrowRight':
    case 'ArrowLeft':
    case 'Home':
    case 'End':
      return 'x';
    case 'ArrowUp':
    case 'ArrowDown':
    case 'PageUp':
    case 'PageDown':
      return 'y';
    default:
      return null;
  }
}

/**
 * Keyboard model for a 2D color-area thumb:
 * - Arrow Left/Right step the x axis; Arrow Up/Down step the y axis, by
 *   `stepRatio` of the axis range (up moves the thumb up).
 * - PageUp/PageDown step the y axis by `largeStepRatio`.
 * - Home/End jump the x axis to its range start/end.
 *
 * Hue axes wrap by default; other channels clamp. Returns `null` for keys the
 * area does not handle. Modifier keys are not read: pass a larger
 * `stepRatio` for Shift+Arrow.
 *
 * @param stepRatio - Arrow-key step as a fraction of the axis range, e.g. `0.01`.
 * @see {@link getColorAreaKeyAxis}
 *
 * @example
 * ```ts
 * import { colorFromColorAreaKey, resolveColorAreaAxes } from 'color-kit/driver';
 *
 * const axes = resolveColorAreaAxes(); // x: l [0, 1], y: c [0, 0.4]
 * const color = { l: 0.6, c: 0.1, h: 250, alpha: 1 };
 * colorFromColorAreaKey(color, axes, 'ArrowRight', 0.01); // → { l: 0.61, c: 0.1, h: 250, alpha: 1 }
 * colorFromColorAreaKey(color, axes, 'PageUp', 0.01); // → { l: 0.6, c: 0.14, h: 250, alpha: 1 }
 * colorFromColorAreaKey(color, axes, 'Enter', 0.01); // → null
 * ```
 */
export function colorFromColorAreaKey(
  color: Color,
  axes: ResolvedColorAreaAxes,
  key: string,
  stepRatio: number,
  options: ColorAreaKeyOptions = {},
): Color | null {
  const axisKey = getColorAreaKeyAxis(key);
  if (!axisKey) {
    return null;
  }

  const axis = axes[axisKey];
  const range = axis.range;
  const span = range[1] - range[0];
  const wrap = axis.channel === 'h' && (options.wrapHue ?? true);
  const largeStepRatio = options.largeStepRatio ?? DEFAULT_LARGE_STEP_RATIO;
  const value = color[axis.channel];

  let next: number;
  switch (key as ColorAreaKey) {
    case 'ArrowRight':
    case 'ArrowUp':
      next = stepRangeValue(value, stepRatio * span, range, wrap);
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      next = stepRangeValue(value, -stepRatio * span, range, wrap);
      break;
    case 'PageUp':
      next = stepRangeValue(value, largeStepRatio * span, range, wrap);
      break;
    case 'PageDown':
      next = stepRangeValue(value, -largeStepRatio * span, range, wrap);
      break;
    case 'Home':
      next = range[0];
      break;
    case 'End':
    default:
      next = range[1];
      break;
  }

  return {
    ...color,
    [axis.channel]: next,
  };
}

/**
 * Human-readable `aria-valuetext` for both axes, x first, e.g.
 * "Lightness 60%, Chroma 0.2". Lightness is shown as a percentage, hue in
 * whole degrees, chroma to three decimals.
 *
 * @example
 * ```ts
 * import { getColorAreaValueText, resolveColorAreaAxes } from 'color-kit/driver';
 *
 * getColorAreaValueText({ l: 0.6, c: 0.1, h: 250, alpha: 1 }, resolveColorAreaAxes());
 * // → 'Lightness 60%, Chroma 0.1'
 * ```
 */
export function getColorAreaValueText(
  color: Color,
  axes: ResolvedColorAreaAxes,
): string {
  return [axes.x, axes.y]
    .map((axis) => getChannelValueText(axis.channel, color[axis.channel]))
    .join(', ');
}
