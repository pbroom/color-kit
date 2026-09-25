import type { Color } from '../types.js';
import {
  isFiniteNumber,
  normalizePlaneModel,
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
 * Broad plane resolver for dynamic `PlaneDefinition` objects.
 *
 * Prefer `definePlane()` in user code when the model is known at the call site,
 * because its overloads provide model-aware TypeScript narrowing.
 *
 * @param planeObject Plane input object.
 * @param planeObject.model Target model (`oklch`, `rgb`, `hsl`, `hsv`, `oklab`, `hct`, `p3`; legacy `display-p3` also works).
 * @param planeObject.x Optional x-axis descriptor; defaults to model defaults.
 * @param planeObject.y Optional y-axis descriptor; defaults to model defaults.
 * @param planeObject.color Optional anchor color converted into the selected
 * model before fixed-channel overrides are applied.
 * @param planeObject.fixed Optional fixed channel values clamped for the model.
 * @returns Fully-resolved plane safe for query and projection.
 */
export function resolvePlaneDefinition(
  planeObject: PlaneDefinition = {},
): Plane {
  const requestedModel = planeObject.model ?? 'oklch';
  const model = normalizePlaneModel(requestedModel);
  const modelSpec = planeModelSpec(requestedModel);
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

export function definePlane(
  planeObject?: PlaneDefinitionFor<'oklch'>,
): Plane<'oklch'>;
export function definePlane<Model extends Exclude<PlaneModel, 'oklch'>>(
  planeObject: PlaneDefinitionFor<Model>,
): Plane<Model>;
export function definePlane(planeObject: PlaneDefinition = {}): Plane {
  return resolvePlaneDefinition(planeObject);
}

/**
 * Defines a plane anchored to a source color.
 *
 * Equivalent to `definePlane({ ...planeObject, color })`.
 *
 * @param color Anchor color converted into the selected model.
 * @param planeObject Optional plane definition overrides.
 * @returns Fully-resolved plane safe for query and projection.
 */
export function definePlaneFromColor(
  color: Color,
  planeObject?: Omit<PlaneDefinitionFor<'oklch'>, 'color'>,
): Plane<'oklch'>;
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
