import {
  fromHct,
  fromHsl,
  fromHsv,
  fromOklab,
  fromOklch,
  fromP3,
  fromRgb,
  toHct,
  toHsl,
  toHsv,
  toOklab,
  toOklch,
  toP3,
  toRgb,
} from '../conversion/index.js';
import type { Color, Hct, Hsl, Hsv, Oklab, Oklch, P3, Rgb } from '../types.js';
import { clamp, normalizeHue } from '../utils/index.js';
import type {
  Plane,
  PlaneChannel,
  PlaneDefinition,
  PlaneFixedInput,
  PlaneModel,
  PlaneModelColor,
  PlanePoint,
  ResolvedPlaneAxis,
} from './types.js';

/**
 * Channel sets supported by each plane model.
 *
 * Use this to validate channel names before constructing model-specific axes.
 */
export const PLANE_MODEL_CHANNELS: Record<PlaneModel, readonly PlaneChannel[]> =
  {
    oklch: ['l', 'c', 'h'],
    rgb: ['r', 'g', 'b'],
    hsl: ['h', 's', 'l'],
    hsv: ['h', 's', 'v'],
    oklab: ['L', 'a', 'b'],
    hct: ['h', 'c', 't'],
    'display-p3': ['r', 'g', 'b'],
  };

/**
 * Default x/y axis channels for each plane model.
 *
 * `definePlane()` falls back to these defaults when explicit axes are omitted.
 */
export const PLANE_MODEL_DEFAULT_AXES: Record<
  PlaneModel,
  { x: PlaneChannel; y: PlaneChannel }
> = {
  oklch: { x: 'l', y: 'c' },
  rgb: { x: 'r', y: 'g' },
  hsl: { x: 'h', y: 's' },
  hsv: { x: 'h', y: 's' },
  oklab: { x: 'a', y: 'b' },
  hct: { x: 'h', y: 'c' },
  'display-p3': { x: 'r', y: 'g' },
};

const OKLCH_DEFAULT_RANGES: Record<'l' | 'c' | 'h', [number, number]> = {
  l: [0, 1],
  c: [0.4, 0], // chroma is positive, so we invert the range
  h: [0, 360],
};

/**
 * Backwards-compatible OKLCH defaults (`l`, `c`, `h`).
 *
 * Prefer `PLANE_MODEL_DEFAULT_RANGES` for model-aware usage.
 */
export const PLANE_DEFAULT_RANGES: Record<'l' | 'c' | 'h', [number, number]> =
  OKLCH_DEFAULT_RANGES;

/**
 * Default axis ranges for each model's channels.
 *
 * Ranges may be descending (for example `[100, 0]`) to intentionally invert an
 * axis direction in normalized space.
 */
export const PLANE_MODEL_DEFAULT_RANGES: Record<
  PlaneModel,
  Partial<Record<PlaneChannel, [number, number]>>
> = {
  oklch: OKLCH_DEFAULT_RANGES,
  rgb: {
    r: [0, 255],
    g: [0, 255],
    b: [0, 255],
  },
  hsl: {
    h: [0, 360],
    s: [100, 0],
    l: [100, 0],
  },
  hsv: {
    h: [0, 360],
    s: [100, 0],
    v: [100, 0],
  },
  oklab: {
    L: [0, 1],
    a: [-0.4, 0.4],
    b: [0.4, -0.4],
  },
  hct: {
    h: [0, 360],
    c: [150, 0],
    t: [100, 0],
  },
  'display-p3': {
    r: [0, 1],
    g: [0, 1],
    b: [0, 1],
  },
};

interface PlaneModelSpec {
  channels: readonly PlaneChannel[];
  defaultAxes: { x: PlaneChannel; y: PlaneChannel };
  defaultRanges: Partial<Record<PlaneChannel, [number, number]>>;
  normalizeFixed: (fixed?: PlaneFixedInput) => PlaneModelColor;
  fromColor: (color: Color) => PlaneModelColor;
  toColor: (modelColor: PlaneModelColor) => Color;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readChannel(
  value: PlaneFixedInput | PlaneModelColor | undefined,
  channel: PlaneChannel,
  fallback: number,
): number {
  const candidate = value?.[channel];
  return isFiniteNumber(candidate) ? candidate : fallback;
}

function readAlpha(
  value: PlaneFixedInput | PlaneModelColor | undefined,
  fallback: number,
): number {
  const alpha = value?.alpha;
  return clamp(isFiniteNumber(alpha) ? alpha : fallback, 0, 1);
}

function normalizeOklchFixed(fixed?: PlaneFixedInput): PlaneModelColor {
  return {
    l: clamp(readChannel(fixed, 'l', 0.5), 0, 1),
    c: Math.max(0, readChannel(fixed, 'c', 0)),
    h: normalizeHue(readChannel(fixed, 'h', 0)),
    alpha: readAlpha(fixed, 1),
  };
}

function normalizeRgbFixed(fixed?: PlaneFixedInput): PlaneModelColor {
  return {
    r: clamp(readChannel(fixed, 'r', 128), 0, 255),
    g: clamp(readChannel(fixed, 'g', 128), 0, 255),
    b: clamp(readChannel(fixed, 'b', 128), 0, 255),
    alpha: readAlpha(fixed, 1),
  };
}

function normalizeHslFixed(fixed?: PlaneFixedInput): PlaneModelColor {
  return {
    h: normalizeHue(readChannel(fixed, 'h', 0)),
    s: clamp(readChannel(fixed, 's', 0), 0, 100),
    l: clamp(readChannel(fixed, 'l', 50), 0, 100),
    alpha: readAlpha(fixed, 1),
  };
}

function normalizeHsvFixed(fixed?: PlaneFixedInput): PlaneModelColor {
  return {
    h: normalizeHue(readChannel(fixed, 'h', 0)),
    s: clamp(readChannel(fixed, 's', 0), 0, 100),
    v: clamp(readChannel(fixed, 'v', 50), 0, 100),
    alpha: readAlpha(fixed, 1),
  };
}

function normalizeOklabFixed(fixed?: PlaneFixedInput): PlaneModelColor {
  return {
    L: clamp(readChannel(fixed, 'L', 0.5), 0, 1),
    a: clamp(readChannel(fixed, 'a', 0), -0.4, 0.4),
    b: clamp(readChannel(fixed, 'b', 0), -0.4, 0.4),
    alpha: readAlpha(fixed, 1),
  };
}

function normalizeHctFixed(fixed?: PlaneFixedInput): PlaneModelColor {
  return {
    h: normalizeHue(readChannel(fixed, 'h', 0)),
    c: Math.max(0, readChannel(fixed, 'c', 0)),
    t: clamp(readChannel(fixed, 't', 50), 0, 100),
    alpha: readAlpha(fixed, 1),
  };
}

function normalizeP3Fixed(fixed?: PlaneFixedInput): PlaneModelColor {
  return {
    r: clamp(readChannel(fixed, 'r', 0.5), 0, 1),
    g: clamp(readChannel(fixed, 'g', 0.5), 0, 1),
    b: clamp(readChannel(fixed, 'b', 0.5), 0, 1),
    alpha: readAlpha(fixed, 1),
  };
}

function toOklchModelColor(color: Color): PlaneModelColor {
  const oklch = toOklch(color);
  return {
    l: oklch.l,
    c: oklch.c,
    h: normalizeHue(oklch.h),
    alpha: oklch.alpha,
  };
}

function fromOklchModelColor(modelColor: PlaneModelColor): Color {
  const next: Oklch = {
    l: clamp(readChannel(modelColor, 'l', 0.5), 0, 1),
    c: Math.max(0, readChannel(modelColor, 'c', 0)),
    h: normalizeHue(readChannel(modelColor, 'h', 0)),
    alpha: readAlpha(modelColor, 1),
  };
  return fromOklch(next);
}

function toRgbModelColor(color: Color): PlaneModelColor {
  const rgb = toRgb(color);
  return {
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    alpha: rgb.alpha,
  };
}

function fromRgbModelColor(modelColor: PlaneModelColor): Color {
  const next: Rgb = {
    r: clamp(readChannel(modelColor, 'r', 128), 0, 255),
    g: clamp(readChannel(modelColor, 'g', 128), 0, 255),
    b: clamp(readChannel(modelColor, 'b', 128), 0, 255),
    alpha: readAlpha(modelColor, 1),
  };
  return fromRgb(next);
}

function toHslModelColor(color: Color): PlaneModelColor {
  const hsl = toHsl(color);
  return {
    h: normalizeHue(hsl.h),
    s: hsl.s,
    l: hsl.l,
    alpha: hsl.alpha,
  };
}

function fromHslModelColor(modelColor: PlaneModelColor): Color {
  const next: Hsl = {
    h: normalizeHue(readChannel(modelColor, 'h', 0)),
    s: clamp(readChannel(modelColor, 's', 0), 0, 100),
    l: clamp(readChannel(modelColor, 'l', 50), 0, 100),
    alpha: readAlpha(modelColor, 1),
  };
  return fromHsl(next);
}

function toHsvModelColor(color: Color): PlaneModelColor {
  const hsv = toHsv(color);
  return {
    h: normalizeHue(hsv.h),
    s: hsv.s,
    v: hsv.v,
    alpha: hsv.alpha,
  };
}

function fromHsvModelColor(modelColor: PlaneModelColor): Color {
  const next: Hsv = {
    h: normalizeHue(readChannel(modelColor, 'h', 0)),
    s: clamp(readChannel(modelColor, 's', 0), 0, 100),
    v: clamp(readChannel(modelColor, 'v', 50), 0, 100),
    alpha: readAlpha(modelColor, 1),
  };
  return fromHsv(next);
}

function toOklabModelColor(color: Color): PlaneModelColor {
  const oklab = toOklab(color);
  return {
    L: oklab.L,
    a: oklab.a,
    b: oklab.b,
    alpha: oklab.alpha,
  };
}

function fromOklabModelColor(modelColor: PlaneModelColor): Color {
  const next: Oklab = {
    L: clamp(readChannel(modelColor, 'L', 0.5), 0, 1),
    a: clamp(readChannel(modelColor, 'a', 0), -0.4, 0.4),
    b: clamp(readChannel(modelColor, 'b', 0), -0.4, 0.4),
    alpha: readAlpha(modelColor, 1),
  };
  return fromOklab(next);
}

function toHctModelColor(color: Color): PlaneModelColor {
  const hct = toHct(color);
  return {
    h: normalizeHue(hct.h),
    c: hct.c,
    t: hct.t,
    alpha: hct.alpha,
  };
}

function fromHctModelColor(modelColor: PlaneModelColor): Color {
  const next: Hct = {
    h: normalizeHue(readChannel(modelColor, 'h', 0)),
    c: Math.max(0, readChannel(modelColor, 'c', 0)),
    t: clamp(readChannel(modelColor, 't', 50), 0, 100),
    alpha: readAlpha(modelColor, 1),
  };
  return fromHct(next);
}

function toP3ModelColor(color: Color): PlaneModelColor {
  const p3 = toP3(color);
  return {
    r: p3.r,
    g: p3.g,
    b: p3.b,
    alpha: p3.alpha,
  };
}

function fromP3ModelColor(modelColor: PlaneModelColor): Color {
  const next: P3 = {
    r: clamp(readChannel(modelColor, 'r', 0.5), 0, 1),
    g: clamp(readChannel(modelColor, 'g', 0.5), 0, 1),
    b: clamp(readChannel(modelColor, 'b', 0.5), 0, 1),
    alpha: readAlpha(modelColor, 1),
  };
  return fromP3(next);
}

const PLANE_MODEL_SPECS: Record<PlaneModel, PlaneModelSpec> = {
  oklch: {
    channels: PLANE_MODEL_CHANNELS.oklch,
    defaultAxes: PLANE_MODEL_DEFAULT_AXES.oklch,
    defaultRanges: PLANE_MODEL_DEFAULT_RANGES.oklch,
    normalizeFixed: normalizeOklchFixed,
    fromColor: toOklchModelColor,
    toColor: fromOklchModelColor,
  },
  rgb: {
    channels: PLANE_MODEL_CHANNELS.rgb,
    defaultAxes: PLANE_MODEL_DEFAULT_AXES.rgb,
    defaultRanges: PLANE_MODEL_DEFAULT_RANGES.rgb,
    normalizeFixed: normalizeRgbFixed,
    fromColor: toRgbModelColor,
    toColor: fromRgbModelColor,
  },
  hsl: {
    channels: PLANE_MODEL_CHANNELS.hsl,
    defaultAxes: PLANE_MODEL_DEFAULT_AXES.hsl,
    defaultRanges: PLANE_MODEL_DEFAULT_RANGES.hsl,
    normalizeFixed: normalizeHslFixed,
    fromColor: toHslModelColor,
    toColor: fromHslModelColor,
  },
  hsv: {
    channels: PLANE_MODEL_CHANNELS.hsv,
    defaultAxes: PLANE_MODEL_DEFAULT_AXES.hsv,
    defaultRanges: PLANE_MODEL_DEFAULT_RANGES.hsv,
    normalizeFixed: normalizeHsvFixed,
    fromColor: toHsvModelColor,
    toColor: fromHsvModelColor,
  },
  oklab: {
    channels: PLANE_MODEL_CHANNELS.oklab,
    defaultAxes: PLANE_MODEL_DEFAULT_AXES.oklab,
    defaultRanges: PLANE_MODEL_DEFAULT_RANGES.oklab,
    normalizeFixed: normalizeOklabFixed,
    fromColor: toOklabModelColor,
    toColor: fromOklabModelColor,
  },
  hct: {
    channels: PLANE_MODEL_CHANNELS.hct,
    defaultAxes: PLANE_MODEL_DEFAULT_AXES.hct,
    defaultRanges: PLANE_MODEL_DEFAULT_RANGES.hct,
    normalizeFixed: normalizeHctFixed,
    fromColor: toHctModelColor,
    toColor: fromHctModelColor,
  },
  'display-p3': {
    channels: PLANE_MODEL_CHANNELS['display-p3'],
    defaultAxes: PLANE_MODEL_DEFAULT_AXES['display-p3'],
    defaultRanges: PLANE_MODEL_DEFAULT_RANGES['display-p3'],
    normalizeFixed: normalizeP3Fixed,
    fromColor: toP3ModelColor,
    toColor: fromP3ModelColor,
  },
};

/** Returns conversion/range behavior for a specific plane model. */
function planeModelSpec(model: PlaneModel): PlaneModelSpec {
  return PLANE_MODEL_SPECS[model];
}

/**
 * Returns the channels supported by a plane model.
 *
 * @param model Plane model to inspect.
 * @returns Ordered channel list for the model.
 */
export function planeModelChannels(model: PlaneModel): readonly PlaneChannel[] {
  return planeModelSpec(model).channels;
}

/**
 * Resolves the model default range for a channel.
 *
 * @param model Plane model to inspect.
 * @param channel Channel whose default range should be read.
 * @returns Model default range, or `undefined` when the channel is unsupported.
 */
export function planeModelDefaultRange(
  model: PlaneModel,
  channel: PlaneChannel,
): [number, number] | undefined {
  const range = planeModelSpec(model).defaultRanges[channel];
  return range ? [range[0], range[1]] : undefined;
}

/**
 * Resolves and validates an axis range.
 *
 * Uses the provided range when present; otherwise falls back to the model's
 * channel default range.
 */
function planeRange(
  model: PlaneModel,
  modelSpec: PlaneModelSpec,
  channel: PlaneChannel,
  range?: [number, number],
): [number, number] {
  if (range) {
    if (!isFiniteNumber(range[0]) || !isFiniteNumber(range[1])) {
      throw new Error(
        'definePlane() axis ranges must contain finite numeric values',
      );
    }
    return [range[0], range[1]];
  }
  const fallback = modelSpec.defaultRanges[channel];
  if (!fallback) {
    throw new Error(
      `definePlane() channel "${channel}" is not supported by model "${model}"`,
    );
  }
  return [fallback[0], fallback[1]];
}

/**
 * Normalizes a single plane axis descriptor into a fully-resolved axis object.
 *
 * Validates that the channel exists for the selected model and resolves the
 * final axis range.
 */
function planeAxis(
  model: PlaneModel,
  modelSpec: PlaneModelSpec,
  axis: {
    channel: PlaneChannel;
    range?: [number, number];
  },
): ResolvedPlaneAxis {
  if (!modelSpec.channels.includes(axis.channel)) {
    throw new Error(
      `definePlane() channel "${axis.channel}" is not supported by model "${model}"`,
    );
  }
  return {
    channel: axis.channel,
    range: planeRange(model, modelSpec, axis.channel, axis.range),
  };
}

/**
 * Resolves and clamps model-relative fixed channels used by the plane.
 */
function fixedColor(modelSpec: PlaneModelSpec, fixed?: PlaneFixedInput) {
  return modelSpec.normalizeFixed(fixed);
}

/**
 * Ensures the two plane axes target distinct channels.
 */
function validateDistinctAxes(definition: Plane): void {
  if (definition.x.channel === definition.y.channel) {
    throw new Error(
      'definePlane() requires distinct channels for x and y axes',
    );
  }
}

/**
 * Converts a channel value into normalized plane space [0..1].
 */
function normalizeInRange(value: number, range: [number, number]): number {
  const span = range[1] - range[0];
  if (Math.abs(span) <= Number.EPSILON) return 0;
  return clamp((value - range[0]) / span, 0, 1);
}

/**
 * Converts a normalized plane value [0..1] back into channel space.
 */
function denormalizeInRange(norm: number, range: [number, number]): number {
  return range[0] + clamp(norm, 0, 1) * (range[1] - range[0]);
}

/**
 * Resolves plane input into a normalized plane object.
 *
 * @param planeObject Plane input object.
 * @param planeObject.model Target model (`oklch`, `rgb`, `hsl`, `hsv`, `oklab`, `hct`, `display-p3`).
 * @param planeObject.x Optional x-axis descriptor; defaults to model defaults.
 * @param planeObject.y Optional y-axis descriptor; defaults to model defaults.
 * @param planeObject.fixed Optional fixed channel values clamped for the model.
 * @returns Fully-resolved plane safe for query and projection.
 */
export function definePlane(planeObject: PlaneDefinition = {}): Plane {
  const model = planeObject.model ?? 'oklch';
  const modelSpec = planeModelSpec(model);
  const defaultAxes = modelSpec.defaultAxes;
  const resolved: Plane = {
    model,
    x: planeAxis(model, modelSpec, planeObject.x ?? { channel: defaultAxes.x }),
    y: planeAxis(model, modelSpec, planeObject.y ?? { channel: defaultAxes.y }),
    fixed: fixedColor(modelSpec, planeObject.fixed),
  };

  validateDistinctAxes(resolved);
  return resolved;
}

/**
 * Projects a normalized point on the plane back into a color value.
 *
 * @param resolvedPlane Fully-resolved plane descriptor.
 * @param point Normalized plane point (`x`, `y` in `[0..1]`).
 * @returns A color with plane channels denormalized into channel ranges.
 */
export function planeToColor(resolvedPlane: Plane, point: PlanePoint): Color {
  const modelSpec = planeModelSpec(resolvedPlane.model);
  const modelColor: PlaneModelColor = {
    ...resolvedPlane.fixed,
    [resolvedPlane.x.channel]: denormalizeInRange(
      point.x,
      resolvedPlane.x.range,
    ),
    [resolvedPlane.y.channel]: denormalizeInRange(
      point.y,
      resolvedPlane.y.range,
    ),
    alpha: resolvedPlane.fixed.alpha,
  };
  return modelSpec.toColor(modelColor);
}

/**
 * Projects a color value into normalized plane coordinates.
 *
 * @param resolvedPlane Fully-resolved plane descriptor.
 * @param color Color to project.
 * @returns A normalized plane point (`x`, `y` in `[0..1]`).
 */
export function colorToPlane(resolvedPlane: Plane, color: Color): PlanePoint {
  const modelSpec = planeModelSpec(resolvedPlane.model);
  const modelColor = modelSpec.fromColor(color);
  const xValue = readChannel(
    modelColor,
    resolvedPlane.x.channel,
    readChannel(resolvedPlane.fixed, resolvedPlane.x.channel, 0),
  );
  const yValue = readChannel(
    modelColor,
    resolvedPlane.y.channel,
    readChannel(resolvedPlane.fixed, resolvedPlane.y.channel, 0),
  );
  return {
    x: normalizeInRange(xValue, resolvedPlane.x.range),
    y: normalizeInRange(yValue, resolvedPlane.y.range),
  };
}

/**
 * Returns whether a plane's two axes are exactly the lightness/chroma pair.
 *
 * @param resolvedPlane Fully-resolved plane descriptor.
 * @returns `true` when axes are `l/c` or `c/l`; otherwise `false`.
 */
export function usesLightnessAndChroma(resolvedPlane: Plane): boolean {
  return (
    resolvedPlane.model === 'oklch' &&
    ((resolvedPlane.x.channel === 'l' && resolvedPlane.y.channel === 'c') ||
      (resolvedPlane.x.channel === 'c' && resolvedPlane.y.channel === 'l'))
  );
}

/**
 * Resolves the effective hue angle for a plane query.
 *
 * Resolution order: explicit `hue` override -> fixed plane hue -> model color
 * hue derived from fixed channels.
 *
 * @param resolvedPlane Fully-resolved plane descriptor.
 * @param hue Optional explicit hue override.
 * @returns Normalized hue in `[0, 360)`.
 */
export function planeHue(resolvedPlane: Plane, hue?: number): number {
  if (isFiniteNumber(hue)) {
    return normalizeHue(hue);
  }
  const fixedHue = resolvedPlane.fixed.h;
  if (isFiniteNumber(fixedHue)) {
    return normalizeHue(fixedHue);
  }
  return normalizeHue(
    planeModelSpec(resolvedPlane.model).toColor(resolvedPlane.fixed).h,
  );
}
