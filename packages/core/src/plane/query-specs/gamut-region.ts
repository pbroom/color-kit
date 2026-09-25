import { getPlaneGamutRegion } from '../gamut-region/index.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { countPlanePaths } from './shared.js';

export const gamutRegionSpec: PlaneQuerySpec<'gamutRegion'> = {
  kind: 'gamutRegion',
  run: (plane, query, trace) => getPlaneGamutRegion(plane, query, trace),
  pointChannels: 'xy',
  countGeometry: (result) => {
    const boundary = countPlanePaths(result.boundaryPaths);
    const visible = countPlanePaths(result.visibleRegion.paths);
    return {
      pathCount: boundary.pathCount + visible.pathCount,
      pointCount: boundary.pointCount + visible.pointCount,
    };
  },
  budget: (query) => (query.scope === 'full' ? 6144 : 4096),
  telemetryGroup: 'gamutRegion',
  telemetrySignature: (query, plane) =>
    `${query.gamut ?? 'srgb'}:${query.scope ?? 'viewport'}:${plane.model}:${plane.x.channel}/${plane.y.channel}`,
};
