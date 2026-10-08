import { assertGamutTarget } from '../../gamut/target.js';
import { contrastRegionPaths } from '../../contrast/index.js';
import type { InternalPlaneTraceContext } from '../../trace/context.js';
import { planeHue, usesLightnessAndChroma } from '../mapping.js';
import { requireHueField } from '../packed-abi.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { resolvePlaneDefinition } from '../resolve.js';
import type {
  PlaneContrastRegionResult,
  PlaneContrastQueryOptions,
  PlaneDefinition,
} from '../types.js';
import {
  assertContrastRegionPathOptions,
  contrastQueryBudget,
  contrastTelemetrySignature,
  toContrastRegionPathOptions,
} from './contrast-shared.js';
import { countPlanePaths, toPlaneBoundaryPoint } from './shared.js';

/**
 * Traces the contour lines that bound the colors of one hue meeting a
 * contrast threshold against a reference color, projected onto the plane.
 *
 * Each side of the reference (darker and lighter) that has passing colors
 * yields one line, sorted longest first. A line runs between the chroma axis,
 * the gamut edge and `maxChroma`, and every point on it passes the threshold
 * and is in the target gamut. Points carry OKLCH `l`/`c` and plane `x`/`y`;
 * stroke the lines with {@link toSvgCompoundPath}.
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
 * @returns A new result with the resolved hue and contour lines.
 * @throws {TypeError} When `gamut` is not `'srgb'` or `'display-p3'`, or an
 * option removed with an earlier solver (such as `lightnessSteps`) is set.
 * @throws {Error} When the threshold or a sampling option is out of range.
 * @see {@link sense} for the fluent form.
 *
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * import { definePlane, getPlaneContrastRegion } from 'color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } });
 * const { paths } = getPlaneContrastRegion(plane, {
 *   reference: parse('#ffffff'),
 *   metric: 'apca',
 * });
 * paths.map((path) => path.length); // → [43]
 * ```
 */
export function getPlaneContrastRegion(
  planeDefinition: PlaneDefinition,
  query: PlaneContrastQueryOptions,
  trace?: InternalPlaneTraceContext | null,
): PlaneContrastRegionResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  // Validate before the non-L×C early return so every plane rejects an
  // unsupported gamut (such as the removed 'p3'), a removed option, or an
  // invalid criterion or sampling option the same way.
  assertGamutTarget(query.gamut, 'contrastRegion()');
  const options = toContrastRegionPathOptions(query);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    assertContrastRegionPathOptions(options);
    return {
      kind: 'contrastRegion',
      hue: planeHue(resolvedPlane, query.hue),
      paths: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const paths = contrastRegionPaths(query.reference, hue, options, trace);

  return {
    kind: 'contrastRegion',
    hue,
    paths: paths.map((path) =>
      path.map((point) => toPlaneBoundaryPoint(resolvedPlane, hue, point)),
    ),
  };
}

export const contrastRegionSpec: PlaneQuerySpec<'contrastRegion'> = {
  kind: 'contrastRegion',
  run: (plane, query, trace) => getPlaneContrastRegion(plane, query, trace),
  pointChannels: 'xylc',
  countGeometry: (result) => countPlanePaths(result.paths),
  budget: contrastQueryBudget,
  telemetryGroup: 'contrast',
  telemetrySignature: contrastTelemetrySignature,
  pack(result, writer, label) {
    const pathStart = writer.pathCount;
    result.paths.forEach((path, index) => {
      writer.appendLCPath(path, `${label} path ${index}`);
    });
    return {
      kind: 'contrastRegion',
      pathStart,
      pathCount: result.paths.length,
      hue: result.hue,
    };
  },
  validateDescriptor(descriptor, label) {
    requireHueField(descriptor, label);
  },
  unpack: (descriptor, reader) => ({
    kind: 'contrastRegion',
    hue: descriptor.hue,
    paths: reader.readLCPaths(descriptor.pathStart, descriptor.pathCount),
  }),
};
