import { assertGamutTarget } from '../../gamut/target.js';
import { contrastRegionPath } from '../../contrast/index.js';
import type { InternalPlaneTraceContext } from '../../trace/context.js';
import { planeHue, usesLightnessAndChroma } from '../mapping.js';
import { requireHueField } from '../packed-abi.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { resolvePlaneDefinition } from '../resolve.js';
import type {
  PlaneContrastBoundaryResult,
  PlaneContrastQueryOptions,
  PlaneDefinition,
} from '../types.js';
import {
  assertContrastRegionPathOptions,
  contrastQueryBudget,
  contrastTelemetrySignature,
  toContrastRegionPathOptions,
} from './contrast-shared.js';
import { countSinglePath, toPlaneBoundaryPoint } from './shared.js';

/**
 * Traces where colors at one hue cross a contrast threshold against a
 * reference color, projected onto the plane.
 *
 * Returns the longest contour line that {@link getPlaneContrastRegion} finds,
 * as a single point list (each point carries OKLCH `l`/`c` and plane `x`/`y`).
 * Use `getPlaneContrastRegion()` to get every line, for example both the
 * darker and the lighter side of a mid-tone reference.
 *
 * Only OKLCH lightness × chroma planes produce geometry (see
 * {@link usesLightnessAndChroma}); any other plane returns an empty list, after
 * the same option validation.
 *
 * @param planeDefinition - Plane to project onto; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param query - Contrast options: `reference` color, optional `hue`
 * override, and the metric, threshold and sampling options of
 * `ContrastRegionPathOptions` (WCAG `'AA'` against sRGB by default).
 * @param trace - Internal trace hook; leave it out and use
 * {@link inspectPlaneQuery} to capture a trace.
 * @returns A new result with the resolved hue and contour points.
 * @throws {TypeError} When `gamut` is not `'srgb'` or `'display-p3'`, or an
 * option removed with an earlier solver (such as `lightnessSteps`) is set.
 * @throws {Error} When the threshold or a sampling option is out of range.
 * @see {@link sense} for the fluent form.
 *
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * import { definePlane, getPlaneContrastBoundary } from 'color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } });
 * const { points } = getPlaneContrastBoundary(plane, {
 *   reference: parse('#ffffff'),
 *   level: 'AA',
 * });
 * points.length; // → 53
 * points[0].l.toFixed(3); // → '0.568'
 * ```
 */
export function getPlaneContrastBoundary(
  planeDefinition: PlaneDefinition,
  query: PlaneContrastQueryOptions,
  trace?: InternalPlaneTraceContext | null,
): PlaneContrastBoundaryResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  // Validate before the non-L×C early return so every plane rejects an
  // unsupported gamut (such as the removed 'p3'), a removed option, or an
  // invalid criterion or sampling option the same way.
  assertGamutTarget(query.gamut, 'contrastBoundary()');
  const options = toContrastRegionPathOptions(query);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    assertContrastRegionPathOptions(options);
    return {
      kind: 'contrastBoundary',
      hue: planeHue(resolvedPlane, query.hue),
      points: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const path = contrastRegionPath(query.reference, hue, options, trace);

  return {
    kind: 'contrastBoundary',
    hue,
    points: path.map((point) =>
      toPlaneBoundaryPoint(resolvedPlane, hue, point),
    ),
  };
}

export const contrastBoundarySpec: PlaneQuerySpec<'contrastBoundary'> = {
  kind: 'contrastBoundary',
  run: (plane, query, trace) => getPlaneContrastBoundary(plane, query, trace),
  pointChannels: 'xylc',
  fixedPathCount: 1,
  countGeometry: (result) => countSinglePath(result.points),
  budget: contrastQueryBudget,
  telemetryGroup: 'contrast',
  telemetrySignature: contrastTelemetrySignature,
  pack(result, writer, label) {
    const pathStart = writer.pathCount;
    writer.appendLCPath(result.points, label);
    return {
      kind: 'contrastBoundary',
      pathStart,
      pathCount: 1,
      hue: result.hue,
    };
  },
  validateDescriptor(descriptor, label) {
    requireHueField(descriptor, label);
  },
  unpack: (descriptor, reader) => ({
    kind: 'contrastBoundary',
    hue: descriptor.hue,
    points: reader.readLCPath(descriptor.pathStart),
  }),
};
