import { generateOklchDefaultScale } from '../../scale/legacy.js';
import { colorToPlane } from '../mapping.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { resolvePlaneDefinition } from '../resolve.js';
import type {
  PlaneDefinition,
  PlaneGradientQuery,
  PlaneGradientResult,
} from '../types.js';
import { countSinglePath, withFiniteHue } from './shared.js';

/**
 * Samples a two-color gradient and projects each sample onto the plane.
 *
 * Colors are interpolated in OKLCH along the shorter hue arc (a powerless hue
 * borrows the other endpoint's), endpoints included. Each point carries its
 * sampled color and plane `x`/`y`, clamped to the plane window; draw the
 * path with {@link toSvgPath}. Works on every plane model.
 *
 * @param planeDefinition - Plane to project onto; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param query - Endpoints and sample count; see {@link PlaneGradientQuery}.
 * @returns A new result with one point per sample.
 * @see {@link sense} for the fluent form.
 *
 * @example
 * ```ts
 * import { parse, toHex } from 'color-kit';
 * import { definePlane, samplePlaneGradient } from 'color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } });
 * const { points } = samplePlaneGradient(plane, {
 *   from: parse('#1e3a8a'),
 *   to: parse('#93c5fd'),
 *   steps: 3,
 * });
 * points.map((point) => toHex(point.color)); // → ['#1e3a8a', '#527fc3', '#93c5fd']
 * points.map((point) => point.x.toFixed(3)); // → ['0.379', '0.594', '0.809']
 * ```
 */
export function samplePlaneGradient(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneGradientQuery, 'kind'>,
): PlaneGradientResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  const steps = query.steps ?? 16;
  const colors = generateOklchDefaultScale(
    withFiniteHue(query.from),
    withFiniteHue(query.to),
    Math.max(2, steps),
  );
  const points = colors.map((color) => {
    const point = colorToPlane(resolvedPlane, color);
    return {
      x: point.x,
      y: point.y,
      color,
    };
  });

  return {
    kind: 'gradient',
    points,
  };
}

export const gradientSpec: PlaneQuerySpec<'gradient'> = {
  kind: 'gradient',
  run: (plane, query) => samplePlaneGradient(plane, query),
  pointChannels: 'xycolor',
  fixedPathCount: 1,
  countGeometry: (result) => countSinglePath(result.points),
  budget: (query) => query.steps ?? 48,
  pack(result, writer, label) {
    const pathStart = writer.pathCount;
    writer.appendColorPath(result.points, label);
    return {
      kind: 'gradient',
      pathStart,
      pathCount: 1,
    };
  },
  validateDescriptor() {
    // Gradient descriptors carry no kind-specific fields.
  },
  unpack: (descriptor, reader) => ({
    kind: 'gradient',
    points: reader.readColorPath(descriptor.pathStart),
  }),
};
