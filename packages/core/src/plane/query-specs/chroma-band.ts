import { assertGamutTarget } from '../../gamut/target.js';
import { chromaBand } from '../../gamut/index.js';
import { planeHue, usesLightnessAndChroma } from '../mapping.js';
import { requireHueField } from '../packed-abi.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { resolvePlaneDefinition } from '../resolve.js';
import type {
  PlaneChromaBandQuery,
  PlaneChromaBandResult,
  PlaneDefinition,
} from '../types.js';
import { countSinglePath, toPlaneBoundaryPoint } from './shared.js';

/**
 * Samples a constant-intent chroma band across lightness at one hue and
 * projects it onto the plane.
 *
 * In `'clamped'` mode (default) each sample uses `requestedChroma`, reduced to
 * the gamut's maximum where it does not fit; `'proportional'` keeps the
 * requested/max-chroma ratio measured at `selectedLightness`. Missing
 * `requestedChroma`, `selectedLightness` and `alpha` come from the plane's
 * fixed `c`, `l` and `alpha`. Each point carries OKLCH `l`/`c` and plane
 * `x`/`y`.
 *
 * Only OKLCH lightness × chroma planes produce geometry (see
 * {@link usesLightnessAndChroma}); any other plane returns an empty list, after
 * the same option validation.
 *
 * @param planeDefinition - Plane to project onto; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param query - Band options; see {@link PlaneChromaBandQuery}.
 * @returns A new result with the resolved hue and band points.
 * @throws {TypeError} When `gamut` is not `'srgb'` or `'display-p3'`.
 * @throws {Error} When `steps` is not an integer of at least 2.
 * @see {@link sense} for the fluent form.
 *
 * @example
 * ```ts
 * import { definePlane, getPlaneChromaBand } from 'color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } });
 * const { points } = getPlaneChromaBand(plane, { requestedChroma: 0.1 });
 * points.length; // → 13
 * points[6]; // → { l: 0.5, c: 0.1, x: 0.5, y: ≈ 0.75 }
 * points[1].c.toFixed(3); // → '0.058' (clamped to the sRGB edge)
 * ```
 */
export function getPlaneChromaBand(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneChromaBandQuery, 'kind'> = {},
): PlaneChromaBandResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  // Validate before the non-L×C early return so every plane rejects an
  // unsupported gamut (such as the removed 'p3') the same way.
  assertGamutTarget(query.gamut, 'chromaBand()');
  if (!usesLightnessAndChroma(resolvedPlane)) {
    return {
      kind: 'chromaBand',
      hue: planeHue(resolvedPlane, query.hue),
      points: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const selectedLightness =
    query.selectedLightness ?? resolvedPlane.fixed.l ?? 0.5;
  const requestedChroma = query.requestedChroma ?? resolvedPlane.fixed.c ?? 0;
  const band = chromaBand(hue, requestedChroma, {
    gamut: query.gamut,
    mode: query.mode,
    steps: query.steps,
    samplingMode: query.samplingMode,
    adaptiveTolerance: query.adaptiveTolerance,
    adaptiveMaxDepth: query.adaptiveMaxDepth,
    selectedLightness,
    maxChroma: query.maxChroma,
    tolerance: query.tolerance,
    maxIterations: query.maxIterations,
    alpha: query.alpha ?? resolvedPlane.fixed.alpha,
  });

  return {
    kind: 'chromaBand',
    hue,
    points: band.map((color) =>
      toPlaneBoundaryPoint(resolvedPlane, hue, { l: color.l, c: color.c }),
    ),
  };
}

export const chromaBandSpec: PlaneQuerySpec<'chromaBand'> = {
  kind: 'chromaBand',
  run: (plane, query) => getPlaneChromaBand(plane, query),
  pointChannels: 'xylc',
  fixedPathCount: 1,
  countGeometry: (result) => countSinglePath(result.points),
  budget: (query) => query.steps ?? 48,
  pack(result, writer, label) {
    const pathStart = writer.pathCount;
    writer.appendLCPath(result.points, label);
    return {
      kind: 'chromaBand',
      pathStart,
      pathCount: 1,
      hue: result.hue,
    };
  },
  validateDescriptor(descriptor, label) {
    requireHueField(descriptor, label);
  },
  unpack: (descriptor, reader) => ({
    kind: 'chromaBand',
    hue: descriptor.hue,
    points: reader.readLCPath(descriptor.pathStart),
  }),
};
