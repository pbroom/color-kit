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
 * Samples evenly spaced gradient points and projects each color to the plane.
 *
 * @param planeDefinition Plane definition used to project sampled colors.
 * @param query Gradient sampling input.
 * @param query.from Gradient start color.
 * @param query.to Gradient end color.
 * @param query.steps Number of samples to generate (minimum 2).
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
