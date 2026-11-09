import {
  createContrastTest,
  nearestPassingPoint,
  NEAREST_POINT_GRID,
} from '../../contrast/point-solver.js';
import { resolveContrastCriterion } from '../../contrast/region-shared.js';
import { inGamutSpec } from '../../gamut/membership.js';
import { gamutSpec } from '../../gamut/spec.js';
import { assertGamutTarget } from '../../gamut/target.js';
import {
  incrementTraceSummary,
  type InternalPlaneTraceContext,
} from '../../trace/context.js';
import type { Color } from '../../types.js';
import { colorToPlane, planeToColor } from '../mapping.js';
import { requireContrastPointFields } from '../packed-abi.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { resolvePlaneDefinition } from '../resolve.js';
import type {
  PlaneContrastPointOptions,
  PlaneContrastPointResult,
  PlaneDefinition,
  PlanePoint,
} from '../types.js';
import { contrastTelemetrySignature } from './contrast-shared.js';
import { withFiniteHue } from './shared.js';

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function resolveStart(
  query: PlaneContrastPointOptions,
  toPoint: (color: Color) => PlanePoint,
): PlanePoint {
  const { color, point } = query;
  if ((color == null) === (point == null)) {
    throw new TypeError(
      'contrastPoint(): pass exactly one of "color" or "point"',
    );
  }
  const start = point ?? toPoint(withFiniteHue(color!));
  if (!Number.isFinite(start.x) || !Number.isFinite(start.y)) {
    throw new RangeError('contrastPoint(): start point must be finite');
  }
  return { x: clampUnit(start.x), y: clampUnit(start.y) };
}

/**
 * Finds the point of a plane nearest to a starting color or point that
 * meets a contrast threshold against a reference color and, when `gamut` is
 * set, is displayable in that gamut.
 *
 * "Nearest" is Euclidean distance in normalized plane coordinates (the
 * `x`/`y` of every plane result, each axis spanning `[0, 1]`; the same
 * measure as {@link pointDistance}). It depends on the plane's axis ranges
 * and is not a perceptual color difference. Works on every plane model.
 *
 * The result's `status` says what happened:
 *
 * - `'satisfied'`: the start already passes and is returned unchanged
 *   (`distance` is `0`).
 * - `'adjusted'`: the start fails; `point` is the nearest passing point. It
 *   lies on the edge of the passing area: it passes, and the point `1e-9`
 *   closer to the start along the same line fails.
 * - `'unreachable'`: no sampled point of the plane window passes; `point`,
 *   `contrast` and `distance` are `null`.
 *
 * A point "passes" exactly when the public checks say so:
 * `contrastRatio(color, reference, { gamut })` (or `contrastAPCA` with the
 * roles of `apcaRole`) meets the threshold, measured unrounded, and
 * `inSrgbGamut(color)` / `inP3Gamut(color)` / `inRec2020Gamut(color)` holds
 * when `gamut` is set. (`gamut: 'rec2020'`, which the scalar metrics do not
 * take, measures contrast with channels clipped to Rec. 2020, as the
 * `contrastRegion` query does.) On an
 * OKLCH lightness × chroma plane this is the area the `contrastRegion` query
 * outlines with the same options.
 *
 * The solver samples the plane on a 65 × 65 lattice (edges and corners
 * included) to find where passing areas are, then solves the nearest edge
 * point directly: a bracketed root-find along the line from the start,
 * refined over direction until no nearer passing point exists on either
 * side. A passing area thinner than 1/64 of the plane that contains no
 * lattice sample can be missed, which may yield a farther point or
 * `'unreachable'`.
 *
 * @param planeDefinition - Plane to search; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param query - Start (`color` or `point`), `reference`, contrast target
 * and optional `gamut`; see {@link PlaneContrastPointOptions}.
 * @param trace - Internal trace hook; leave it out and use
 * {@link inspectPlaneQuery} to capture a trace.
 * @returns A new result with the status, point, contrast and distance.
 * @throws {TypeError} When `gamut` is not a `GamutTarget`, or
 * not exactly one of `color` and `point` is given.
 * @throws {RangeError} When the start point is not finite.
 * @throws {Error} When the threshold is out of range for the metric.
 * @see {@link sense} for the fluent form.
 * @see {@link ensureContrast} for the lightness-only shortcut.
 *
 * @example
 * ```ts
 * import { contrastRatio, parse, toHex } from '@pbroom/color-kit';
 * import { definePlane, getPlaneContrastPoint } from '@pbroom/color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } }); // OKLCH, x: l, y: c
 * const white = parse('#ffffff');
 * const result = getPlaneContrastPoint(plane, {
 *   color: parse('oklch(0.7 0.12 264)'),
 *   reference: white,
 *   gamut: 'srgb',
 * });
 * result.status; // → 'adjusted'
 * toHex(result.point!.color); // → '#5375bf'
 * result.contrast; // → ≈ 4.5
 * contrastRatio(result.point!.color, white) >= 4.5; // → true
 * result.distance!.toFixed(3); // → '0.129'
 *
 * getPlaneContrastPoint(plane, {
 *   point: { x: 0.5, y: 1 },
 *   reference: parse('#808080'),
 *   threshold: 21,
 * }).status; // → 'unreachable'
 * ```
 */
export function getPlaneContrastPoint(
  planeDefinition: PlaneDefinition,
  query: PlaneContrastPointOptions,
  trace?: InternalPlaneTraceContext | null,
): PlaneContrastPointResult {
  assertGamutTarget(query.gamut, 'contrastPoint()');
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  const { gamut } = query;
  const test = createContrastTest(
    query.reference,
    resolveContrastCriterion(query, 'contrastPoint()'),
    gamut === undefined
      ? undefined
      : (color) => inGamutSpec(color, gamutSpec(gamut)),
  );
  const start = resolveStart(query, (color) =>
    colorToPlane(resolvedPlane, color),
  );
  const colorAt = (x: number, y: number): Color =>
    withFiniteHue(planeToColor(resolvedPlane, { x, y }));

  let evaluations = 1;
  const startColor = colorAt(start.x, start.y);
  let result: PlaneContrastPointResult;
  if (test.passes(startColor)) {
    result = {
      kind: 'contrastPoint',
      status: 'satisfied',
      point: { x: start.x, y: start.y, color: startColor },
      contrast: test.measure(startColor),
      distance: 0,
    };
  } else {
    const nearest = nearestPassingPoint(
      (x, y) => test.passes(colorAt(x, y)),
      start.x,
      start.y,
      () => {
        evaluations += 1;
      },
    );
    if (nearest === null) {
      result = {
        kind: 'contrastPoint',
        status: 'unreachable',
        point: null,
        contrast: null,
        distance: null,
      };
    } else {
      const color = colorAt(nearest.x, nearest.y);
      result = {
        kind: 'contrastPoint',
        status: 'adjusted',
        point: { x: nearest.x, y: nearest.y, color },
        contrast: test.measure(color),
        distance: nearest.distance,
      };
    }
  }
  incrementTraceSummary(trace, 'sampleCount', evaluations);
  incrementTraceSummary(trace, 'scalarEvaluationCount', evaluations);
  return result;
}

export const contrastPointSpec: PlaneQuerySpec<'contrastPoint'> = {
  kind: 'contrastPoint',
  run: (plane, query, trace) => getPlaneContrastPoint(plane, query, trace),
  pointChannels: 'xycolor',
  countGeometry: (result) =>
    result.point
      ? { pathCount: 1, pointCount: 1 }
      : { pathCount: 0, pointCount: 0 },
  // The lattice scan dominates; the solve adds a few hundred evaluations.
  budget: () => (NEAREST_POINT_GRID + 1) ** 2,
  telemetryGroup: 'contrast',
  telemetrySignature: contrastTelemetrySignature,
  fixedPointCount: 1,
  pack(result, writer, label) {
    const pathStart = writer.pathCount;
    if (result.point) {
      writer.appendColorPath([result.point], label);
    }
    return {
      kind: 'contrastPoint',
      pathStart,
      pathCount: result.point ? 1 : 0,
      status: result.status,
      contrast: result.contrast,
      distance: result.distance,
    };
  },
  validateDescriptor(descriptor, label) {
    requireContrastPointFields(descriptor, label);
  },
  unpack: (descriptor, reader) => ({
    kind: 'contrastPoint',
    status: descriptor.status,
    point:
      descriptor.pathCount > 0
        ? reader.readColorPath(descriptor.pathStart)[0]
        : null,
    contrast: descriptor.contrast,
    distance: descriptor.distance,
  }),
};
