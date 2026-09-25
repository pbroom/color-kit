import { contrastRegionPaths } from '../../contrast/index.js';
import type { InternalPlaneTraceContext } from '../../trace/context.js';
import { planeHue, usesLightnessAndChroma } from '../mapping.js';
import { requireHueField } from '../packed-abi.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { resolvePlaneDefinition } from '../resolve.js';
import type {
  PlaneContrastRegionQuery,
  PlaneContrastRegionResult,
  PlaneDefinition,
} from '../types.js';
import {
  contrastQueryBudget,
  contrastTelemetrySignature,
  toContrastRegionPathOptions,
} from './contrast-shared.js';
import { countPlanePaths, toPlaneBoundaryPoint } from './shared.js';

/**
 * Computes one or more filled contrast regions projected into the target plane.
 *
 * Returns an empty path list when the plane is not a lightness/chroma pairing.
 *
 * @param planeDefinition Plane definition used to project the result points.
 * @param query Contrast region configuration.
 * @param query.reference Reference color used for the contrast test.
 * @param query.hue Optional hue override; falls back to the plane's hue.
 * @param query.metric Contrast metric to evaluate (for example WCAG/APCA).
 * @param query.level Named threshold level for the selected metric.
 * @param query.threshold Explicit contrast threshold override.
 * @param query.gamut Optional gamut clamp for region search.
 */
export function getPlaneContrastRegion(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneContrastRegionQuery, 'kind'>,
  trace?: InternalPlaneTraceContext | null,
): PlaneContrastRegionResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    return {
      kind: 'contrastRegion',
      hue: planeHue(resolvedPlane, query.hue),
      paths: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const paths = contrastRegionPaths(
    query.reference,
    hue,
    toContrastRegionPathOptions(query),
    trace,
  );

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
