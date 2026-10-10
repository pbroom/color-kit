import type { Color } from '../types.js';
import {
  isFiniteNumber,
  planeModelSpec,
  type PlaneModelSpec,
} from './model-specs.js';
import type {
  Plane,
  PlaneChannel,
  PlaneDefinition,
  PlaneDefinitionFor,
  PlaneFixedInput,
  PlaneModel,
  ResolvedPlaneAxis,
} from './types.js';

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
 * Validates model-relative fixed input before normalization.
 */
function validateFixedChannels(
  model: PlaneModel,
  modelSpec: PlaneModelSpec,
  fixed?: PlaneFixedInput,
): void {
  if (!fixed) return;
  for (const [key, value] of Object.entries(fixed)) {
    if (value === undefined) continue;
    if (key === 'alpha') {
      if (!isFiniteNumber(value)) {
        throw new Error(
          'definePlane() fixed alpha must be a finite numeric value',
        );
      }
      continue;
    }
    if (!modelSpec.channels.includes(key as PlaneChannel)) {
      throw new Error(
        `definePlane() fixed channel "${key}" is not supported by model "${model}"`,
      );
    }
    if (!isFiniteNumber(value)) {
      throw new Error(
        `definePlane() fixed channel "${key}" must be a finite numeric value`,
      );
    }
  }
}

/**
 * Resolves and clamps model-relative fixed channels used by the plane.
 */
function fixedColor(
  modelSpec: PlaneModelSpec,
  options: { color?: Color; fixed?: PlaneFixedInput },
) {
  const anchoredFixed = options.color
    ? modelSpec.fromColor(options.color)
    : undefined;
  if (!anchoredFixed) {
    return modelSpec.normalizeFixed(options.fixed);
  }

  const mergedFixed: PlaneFixedInput = { ...anchoredFixed };
  for (const [key, value] of Object.entries(options.fixed ?? {})) {
    if (value !== undefined) {
      (mergedFixed as Record<string, number | undefined>)[key] = value;
    }
  }
  return modelSpec.normalizeFixed(mergedFixed);
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
 * Resolves a dynamic {@link PlaneDefinition} into a fully-specified
 * {@link Plane}.
 *
 * Applies the same defaults and validation as {@link definePlane}, but accepts
 * the broad `PlaneDefinition` type, so it suits definitions whose model is only
 * known at runtime (for example, read from settings). Prefer `definePlane()`
 * when the model is known at the call site: its overloads narrow channel names
 * per model at compile time.
 *
 * @param planeObject - Plane input. `model` defaults to `'oklch'`, omitted
 * axes fall back to {@link PLANE_MODEL_DEFAULT_AXES} and omitted ranges to
 * {@link PLANE_MODEL_DEFAULT_RANGES}. Channels not on an axis come from
 * `fixed`, then from the anchor `color`, then from model defaults, and are
 * clamped to the model's valid range.
 * @returns A new resolved plane with explicit axes, ranges and fixed channels.
 * @throws {TypeError} When `model` is not a supported plane model (including
 * the removed `'p3'` spelling; use `'display-p3'`).
 * @throws {Error} When an axis or fixed channel is not valid for the model,
 * both axes use the same channel, or a range or fixed value is not finite.
 * @see {@link definePlane}
 *
 * @example
 * ```ts
 * import { resolvePlaneDefinition } from 'color-kit/plane';
 *
 * const plane = resolvePlaneDefinition({ model: 'hsv' });
 * plane.x; // → { channel: 'h', range: [0, 360] }
 * plane.y; // → { channel: 's', range: [100, 0] }
 * plane.fixed; // → { h: 0, s: 0, v: 50, alpha: 1 }
 * ```
 */
export function resolvePlaneDefinition(
  planeObject: PlaneDefinition = {},
): Plane {
  const model = planeObject.model ?? 'oklch';
  const modelSpec = planeModelSpec(model);
  const defaultAxes = modelSpec.defaultAxes;

  validateFixedChannels(model, modelSpec, planeObject.fixed);

  const resolved: Plane = {
    model,
    x: planeAxis(model, modelSpec, planeObject.x ?? { channel: defaultAxes.x }),
    y: planeAxis(model, modelSpec, planeObject.y ?? { channel: defaultAxes.y }),
    fixed: fixedColor(modelSpec, {
      color: planeObject.color,
      fixed: planeObject.fixed,
    }),
  };

  validateDistinctAxes(resolved);
  return resolved;
}

/**
 * Defines a 2D color plane: two channels of one color model mapped onto
 * normalized `x`/`y` coordinates, with every other channel held fixed.
 *
 * The returned {@link Plane} is the input to every plane query
 * ({@link getPlaneGamutRegion}, {@link getPlaneContrastRegion}, {@link sense},
 * …) and to the {@link planeToColor} / {@link colorToPlane} projections. Plane
 * coordinates are normalized: `{ x: 0, y: 0 }` maps to the start of each axis
 * range and `{ x: 1, y: 1 }` to its end. Ranges may be descending to flip an
 * axis; the OKLCH chroma default `[0.4, 0]` puts high chroma at `y = 0`, the
 * top of an SVG or canvas.
 *
 * Defaults: `model` is `'oklch'`; omitted axes come from
 * {@link PLANE_MODEL_DEFAULT_AXES} (`x: l`, `y: c` for OKLCH) and omitted
 * ranges from {@link PLANE_MODEL_DEFAULT_RANGES}. Channels not on an axis are
 * resolved from `fixed`, then from the anchor `color` (converted into the
 * model), then from model defaults, and clamped to the model's valid range
 * (hue is wrapped into `[0, 360)`). `alpha` defaults to `1`.
 *
 * Type-level guarantees: channel names in `x`, `y` and `fixed` are checked
 * against the chosen model (`definePlane({ model: 'rgb', x: { channel: 'l' } })`
 * and `fixed: { h }` on an RGB plane are compile errors), a non-OKLCH model must
 * be spelled out, and the result is typed `Plane<Model>`. Use
 * {@link PlaneDefinitionFor} to keep that narrowing when the definition is
 * stored in a variable first, and {@link resolvePlaneDefinition} for
 * definitions whose model is only known at runtime.
 *
 * @param planeObject - Plane input; see {@link PlaneDefinition} for each
 * field. Omit it for the default OKLCH lightness × chroma plane at hue 0.
 * @returns A new resolved plane with explicit axes, ranges and fixed channels.
 * @throws {TypeError} When `model` is not a supported plane model (including
 * the removed `'p3'` spelling; use `'display-p3'`).
 * @throws {Error} When an axis or fixed channel is not valid for the model,
 * both axes use the same channel, or a range or fixed value is not finite.
 * @see {@link definePlaneFromColor}
 *
 * @example
 * ```ts
 * import { definePlane } from 'color-kit/plane';
 *
 * const plane = definePlane({
 *   model: 'oklch',
 *   x: { channel: 'l' },
 *   y: { channel: 'c' },
 *   fixed: { h: 264 },
 * });
 * plane.y; // → { channel: 'c', range: [0.4, 0] }
 * plane.fixed; // → { l: 0.5, c: 0, h: 264, alpha: 1 }
 * ```
 */
export function definePlane(
  planeObject?: PlaneDefinitionFor<'oklch'>,
): Plane<'oklch'>;
/**
 * Defines a 2D color plane for a non-OKLCH model (`model` is required).
 *
 * Same behavior as the OKLCH overload; channel names in `x`, `y` and `fixed`
 * are checked against `Model` and the result is typed `Plane<Model>`.
 *
 * @param planeObject - Plane input with an explicit `model`.
 * @returns A new resolved plane with explicit axes, ranges and fixed channels.
 */
export function definePlane<Model extends Exclude<PlaneModel, 'oklch'>>(
  planeObject: PlaneDefinitionFor<Model>,
): Plane<Model>;
export function definePlane(planeObject: PlaneDefinition = {}): Plane {
  return resolvePlaneDefinition(planeObject);
}

/**
 * Defines a plane whose fixed channels are taken from an anchor color.
 *
 * Equivalent to `definePlane({ ...planeObject, color })`: the color is
 * converted into the plane's model to fill every channel not on an axis, and
 * explicit `fixed` values still win. Useful for a picker plane that follows
 * the current color, or for switching models while keeping the same color.
 *
 * @param color - Anchor color converted into the selected model.
 * @param planeObject - Optional plane definition overrides (any
 * {@link PlaneDefinition} field except `color`).
 * @returns A new resolved plane with explicit axes, ranges and fixed channels.
 * @throws {TypeError} When `model` is not a supported plane model.
 * @throws {Error} When an axis or fixed channel is not valid for the model.
 * @see {@link definePlane}
 *
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * import { definePlaneFromColor } from 'color-kit/plane';
 *
 * const plane = definePlaneFromColor(parse('#7c3aed'), {
 *   model: 'hsl',
 *   x: { channel: 'h' },
 *   y: { channel: 's' },
 * });
 * plane.fixed.l?.toFixed(1); // → '57.8' (HSL lightness of the anchor)
 * ```
 */
export function definePlaneFromColor(
  color: Color,
  planeObject?: Omit<PlaneDefinitionFor<'oklch'>, 'color'>,
): Plane<'oklch'>;
/**
 * Defines a plane for a non-OKLCH model whose fixed channels are taken from an
 * anchor color (`model` is required).
 *
 * @param color - Anchor color converted into the selected model.
 * @param planeObject - Plane definition with an explicit `model`.
 * @returns A new resolved plane with explicit axes, ranges and fixed channels.
 */
export function definePlaneFromColor<
  Model extends Exclude<PlaneModel, 'oklch'>,
>(
  color: Color,
  planeObject: Omit<PlaneDefinitionFor<Model>, 'color'>,
): Plane<Model>;
export function definePlaneFromColor(
  color: Color,
  planeObject: Omit<PlaneDefinition, 'color'> = {},
): Plane {
  return resolvePlaneDefinition({ ...planeObject, color });
}
