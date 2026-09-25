import { getPlaneGamutRegion } from '../gamut-region/index.js';
import { requireGamutRegionFields } from '../packed-abi.js';
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
  pack(result, writer, label) {
    const pathStart = writer.pathCount;
    result.boundaryPaths.forEach((path, index) => {
      writer.appendXYPath(path, `${label} boundary path ${index}`);
    });
    const regionPathStart = writer.pathCount;
    result.visibleRegion.paths.forEach((path, index) => {
      writer.appendXYPath(path, `${label} visible path ${index}`);
    });
    return {
      kind: 'gamutRegion',
      pathStart,

      pathCount: result.boundaryPaths.length,
      regionPathStart,
      regionPathCount: result.visibleRegion.paths.length,
      gamut: result.gamut,
      scope: result.scope,
      solver: result.solver,
      viewportRelation: result.viewportRelation,
    };
  },
  validateDescriptor(descriptor, label) {
    requireGamutRegionFields(descriptor, label);
  },
  pathSpan: (descriptor) => descriptor.pathCount + descriptor.regionPathCount,
  unpack: (descriptor, reader) => ({
    kind: 'gamutRegion',
    gamut: descriptor.gamut,
    scope: descriptor.scope,
    viewportRelation: descriptor.viewportRelation,
    solver: descriptor.solver,
    boundaryPaths: reader.readXYPaths(
      descriptor.pathStart,
      descriptor.pathCount,
    ),
    visibleRegion: {
      paths: reader.readXYPaths(
        descriptor.regionPathStart,
        descriptor.regionPathCount,
      ),
    },
  }),
};
