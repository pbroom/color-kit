import { gamutBoundaryPath } from '../../gamut/index.js';
import { assertGamutTarget } from '../../gamut/target.js';
import { planeHue, usesLightnessAndChroma } from '../mapping.js';
import { requireGamutField, requireHueField } from '../packed-abi.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { resolvePlaneDefinition } from '../resolve.js';
import type {
  PlaneDefinition,
  PlaneGamutBoundaryQuery,
  PlaneGamutBoundaryResult,
} from '../types.js';
import { countSinglePath, toPlaneBoundaryPoint } from './shared.js';

/**
 * Traces the gamut's maximum-chroma edge at one hue and projects it onto the
 * plane.
 *
 * Samples the boundary from black (`l = 0`) to white (`l = 1`) and returns
 * one point per sample, each with its OKLCH `l`/`c` and plane `x`/`y`. Draw it
 * with {@link toSvgPath}; for a filled, viewport-clipped shape that also works
 * on non-L×C planes, use {@link getPlaneGamutRegion}.
 *
 * Only OKLCH lightness × chroma planes produce geometry (see
 * {@link usesLightnessAndChroma}); any other plane returns an empty list, after
 * the same option validation.
 *
 * @param planeDefinition - Plane to project onto; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param query - Boundary options; see {@link PlaneGamutBoundaryQuery}.
 * @returns A new result with the gamut, resolved hue and boundary points.
 * @throws {TypeError} When `gamut` is not `'srgb'` or `'display-p3'`
 * (including the removed `'p3'`).
 * @throws {Error} When `steps` is not an integer of at least 2.
 * @see {@link sense} for the fluent form.
 *
 * @example
 * ```ts
 * import { definePlane, getPlaneGamutBoundary } from 'color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } }); // OKLCH, x: l, y: c
 * const { points } = getPlaneGamutBoundary(plane, { steps: 50 });
 * points.length; // → 51
 * points[25]; // → { l: 0.5, c: ≈ 0.2811, x: 0.5, y: ≈ 0.2974 }
 * ```
 */
export function getPlaneGamutBoundary(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneGamutBoundaryQuery, 'kind'> = {},
): PlaneGamutBoundaryResult {
  assertGamutTarget(query.gamut, 'gamutBoundary()');
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    return {
      kind: 'gamutBoundary',
      gamut: query.gamut ?? 'srgb',
      hue: planeHue(resolvedPlane, query.hue),
      points: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const boundary = gamutBoundaryPath(hue, {
    gamut: query.gamut ?? 'srgb',
    steps: query.steps,
    simplifyTolerance: query.simplifyTolerance,
    samplingMode: query.samplingMode,
    adaptiveTolerance: query.adaptiveTolerance,
    adaptiveMaxDepth: query.adaptiveMaxDepth,
  });

  return {
    kind: 'gamutBoundary',
    gamut: query.gamut ?? 'srgb',
    hue,
    points: boundary.map((point) =>
      toPlaneBoundaryPoint(resolvedPlane, hue, point),
    ),
  };
}

export const gamutBoundarySpec: PlaneQuerySpec<'gamutBoundary'> = {
  kind: 'gamutBoundary',
  run: (plane, query) => getPlaneGamutBoundary(plane, query),
  pointChannels: 'xylc',
  fixedPathCount: 1,
  countGeometry: (result) => countSinglePath(result.points),
  budget: (query) => query.steps ?? 48,
  pack(result, writer, label) {
    const pathStart = writer.pathCount;
    writer.appendLCPath(result.points, label);
    return {
      kind: 'gamutBoundary',
      pathStart,
      pathCount: 1,
      gamut: result.gamut,
      hue: result.hue,
    };
  },
  validateDescriptor(descriptor, label) {
    requireGamutField(descriptor, label);
    requireHueField(descriptor, label);
  },
  unpack: (descriptor, reader) => ({
    kind: 'gamutBoundary',
    gamut: descriptor.gamut,
    hue: descriptor.hue,
    points: reader.readLCPath(descriptor.pathStart),
  }),
};
