import type { PlaneQueryKind } from '../../trace/types.js';
import type { PlaneQuerySpec, PlaneQuerySpecRegistry } from '../query-spec.js';
import { chromaBandSpec } from './chroma-band.js';
import { contrastBoundarySpec } from './contrast-boundary.js';
import { contrastRegionSpec } from './contrast-region.js';
import { fallbackPointSpec } from './fallback-point.js';
import { gamutBoundarySpec } from './gamut-boundary.js';
import { gamutRegionSpec } from './gamut-region.js';
import { gradientSpec } from './gradient.js';

export { getPlaneChromaBand } from './chroma-band.js';
export { getPlaneContrastBoundary } from './contrast-boundary.js';
export { getPlaneContrastRegion } from './contrast-region.js';
export { getPlaneFallbackPoint } from './fallback-point.js';
export { getPlaneGamutBoundary } from './gamut-boundary.js';
export { samplePlaneGradient } from './gradient.js';

/** Registry of every plane query kind, keyed by discriminant. */
export const PLANE_QUERY_SPECS: PlaneQuerySpecRegistry = {
  gamutBoundary: gamutBoundarySpec,
  gamutRegion: gamutRegionSpec,
  contrastBoundary: contrastBoundarySpec,
  contrastRegion: contrastRegionSpec,
  chromaBand: chromaBandSpec,
  fallbackPoint: fallbackPointSpec,
  gradient: gradientSpec,
};

export const PLANE_QUERY_KINDS = /* @__PURE__ */ Object.keys(
  PLANE_QUERY_SPECS,
) as PlaneQueryKind[];

export function isPlaneQueryKind(kind: unknown): kind is PlaneQueryKind {
  return (
    typeof kind === 'string' &&
    Object.prototype.hasOwnProperty.call(PLANE_QUERY_SPECS, kind)
  );
}

/**
 * Looks up the spec for a query kind.
 *
 * Callers usually hold a `PlaneQuery`/`PlaneQueryResult` union, so the spec is
 * returned widened to the union: its methods then accept any query/result.
 * This helper is the single place that erases the per-kind correlation; the
 * registry type above guarantees each entry matches its key.
 */
export function getPlaneQuerySpec(
  kind: PlaneQueryKind,
): PlaneQuerySpec<PlaneQueryKind> {
  if (!isPlaneQueryKind(kind)) {
    throw new Error(`Unsupported plane query kind: ${String(kind)}`);
  }
  return PLANE_QUERY_SPECS[kind] as unknown as PlaneQuerySpec<PlaneQueryKind>;
}
