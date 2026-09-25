import { contrastRegionPath } from '../../contrast/index.js';
import type { InternalPlaneTraceContext } from '../../trace/context.js';
import { planeHue, usesLightnessAndChroma } from '../mapping.js';
import { requireHueField } from '../packed-abi.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { resolvePlaneDefinition } from '../resolve.js';
import type {
  PlaneContrastBoundaryQuery,
  PlaneContrastBoundaryResult,
  PlaneDefinition,
} from '../types.js';
import {
  contrastQueryBudget,
  contrastTelemetrySignature,
  toContrastRegionPathOptions,
} from './contrast-shared.js';
import { countSinglePath, toPlaneBoundaryPoint } from './shared.js';

/**
 * Computes a contrast-threshold contour projected into the target plane.
 *
 * Returns an empty point list when the plane is not a lightness/chroma pairing.
 *
 * @param planeDefinition Plane definition used to project the result points.
 * @param query Contrast contour configuration.
 * @param query.reference Reference color used for the contrast test.
 * @param query.hue Optional hue override; falls back to the plane's hue.
 * @param query.metric Contrast metric to evaluate (for example WCAG/APCA).
 * @param query.level Named threshold level for the selected metric.
 * @param query.threshold Explicit contrast threshold override.
 * @param query.gamut Optional gamut clamp for contour search.
 */
export function getPlaneContrastBoundary(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneContrastBoundaryQuery, 'kind'>,
  trace?: InternalPlaneTraceContext | null,
): PlaneContrastBoundaryResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    return {
      kind: 'contrastBoundary',
      hue: planeHue(resolvedPlane, query.hue),
      points: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const path = contrastRegionPath(
    query.reference,
    hue,
    toContrastRegionPathOptions(query),
    trace,
  );

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
