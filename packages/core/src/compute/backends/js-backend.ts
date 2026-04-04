import { resolvePlaneDefinition } from '../../plane/plane.js';
import { runPlaneQueries } from '../../plane/query.js';
import { packPlaneQueryResults } from '../pack.js';
import type { PlaneComputeBackend } from '../types.js';

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export function createJsPlaneComputeBackend(): PlaneComputeBackend {
  return {
    kind: 'js',
    run(request) {
      const resolvedPlane = resolvePlaneDefinition(request.plane);

      const computeStart = nowMs();
      const raw = runPlaneQueries(resolvedPlane, request.queries);
      const computeEnd = nowMs();

      const marshalStart = nowMs();
      const result = packPlaneQueryResults(raw);
      const marshalEnd = nowMs();

      return {
        backend: 'js',
        computeTimeMs: computeEnd - computeStart,
        marshalTimeMs: marshalEnd - marshalStart,
        result,
      };
    },
  };
}
