import type { ResolvedColorAreaAxes } from '@color-kit/driver';

export type ColorAreaLayerQuality = 'auto' | 'high' | 'medium' | 'low';

export type ResolvedLayerQuality = Exclude<ColorAreaLayerQuality, 'auto'>;

export function resolveQuality(
  quality: ColorAreaLayerQuality,
  contextQuality: ResolvedLayerQuality,
): ResolvedLayerQuality {
  if (quality === 'auto') {
    return contextQuality;
  }
  return quality;
}

export interface QualityStepMultipliers {
  medium: number;
  low: number;
}

/** Step multipliers for line-style layers (gamut boundary, chroma band). */
export const LINE_QUALITY_STEP_MULTIPLIERS: QualityStepMultipliers = {
  medium: 0.72,
  low: 0.5,
};

/** Step multipliers for region-style layers (contrast region grids). */
export const REGION_QUALITY_STEP_MULTIPLIERS: QualityStepMultipliers = {
  medium: 0.68,
  low: 0.45,
};

export function qualityStepMultiplier(
  quality: ResolvedLayerQuality,
  multipliers: QualityStepMultipliers = LINE_QUALITY_STEP_MULTIPLIERS,
): number {
  if (quality === 'high') return 1;
  if (quality === 'medium') return multipliers.medium;
  return multipliers.low;
}

const MIN_AUTO_ADAPTIVE_TOLERANCE = 0.00005;
const MAX_AUTO_ADAPTIVE_TOLERANCE = 0.003;
const MIN_AUTO_ADAPTIVE_LINE_DEPTH = 8;
const MAX_AUTO_ADAPTIVE_LINE_DEPTH = 18;

function rangeSpan(range: [number, number]): number {
  return Math.abs(range[1] - range[0]);
}

function unitsPerPixelForChannel(
  axes: ResolvedColorAreaAxes,
  channel: 'l' | 'c',
  widthPx: number,
  heightPx: number,
): number {
  const xUnits =
    axes.x.channel === channel
      ? rangeSpan(axes.x.range) / Math.max(1, widthPx)
      : Number.POSITIVE_INFINITY;
  const yUnits =
    axes.y.channel === channel
      ? rangeSpan(axes.y.range) / Math.max(1, heightPx)
      : Number.POSITIVE_INFINITY;
  const best = Math.min(xUnits, yUnits);
  if (Number.isFinite(best) && best > 0) {
    return best;
  }
  return 1 / Math.max(1, Math.max(widthPx, heightPx));
}

/**
 * Pixel-error-driven tolerance for adaptive line sampling (gamut boundary,
 * chroma band), derived from the on-screen resolution of the l/c axes.
 */
export function autoAdaptiveLineTolerance(
  axes: ResolvedColorAreaAxes,
  quality: ResolvedLayerQuality,
  widthPx: number,
  heightPx: number,
): number {
  const lUnitsPerPixel = unitsPerPixelForChannel(axes, 'l', widthPx, heightPx);
  const cUnitsPerPixel = unitsPerPixelForChannel(axes, 'c', widthPx, heightPx);
  const pixelError =
    quality === 'high' ? 0.35 : quality === 'medium' ? 0.55 : 0.8;
  const tolerance = pixelError * Math.min(lUnitsPerPixel, cUnitsPerPixel);
  return Math.min(
    MAX_AUTO_ADAPTIVE_TOLERANCE,
    Math.max(MIN_AUTO_ADAPTIVE_TOLERANCE, tolerance),
  );
}

/** Recursion-depth budget for adaptive line sampling. */
export function autoAdaptiveLineMaxDepth(
  quality: ResolvedLayerQuality,
  widthPx: number,
  heightPx: number,
): number {
  const longestEdge = Math.max(1, Math.max(widthPx, heightPx));
  const qualityBias = quality === 'high' ? 4 : quality === 'medium' ? 3 : 2;
  const computed = Math.ceil(Math.log2(longestEdge)) + qualityBias;
  return Math.min(
    MAX_AUTO_ADAPTIVE_LINE_DEPTH,
    Math.max(MIN_AUTO_ADAPTIVE_LINE_DEPTH, computed),
  );
}

const MIN_AUTO_ADAPTIVE_BASE_STEPS = 8;
const MAX_AUTO_ADAPTIVE_BASE_STEPS = 48;
const MIN_AUTO_ADAPTIVE_REGION_DEPTH = 1;
const MAX_AUTO_ADAPTIVE_REGION_DEPTH = 6;

/** Base grid resolution for adaptive region sampling (contrast regions). */
export function autoAdaptiveRegionBaseSteps(
  quality: ResolvedLayerQuality,
  widthPx: number,
  heightPx: number,
): number {
  const targetCellPx = quality === 'high' ? 28 : quality === 'medium' ? 36 : 48;
  const longestEdge = Math.max(1, Math.max(widthPx, heightPx));
  const baseSteps = Math.round(longestEdge / targetCellPx);
  return Math.min(
    MAX_AUTO_ADAPTIVE_BASE_STEPS,
    Math.max(MIN_AUTO_ADAPTIVE_BASE_STEPS, baseSteps),
  );
}

/** Refinement-depth budget for adaptive region sampling. */
export function autoAdaptiveRegionMaxDepth(
  quality: ResolvedLayerQuality,
  widthPx: number,
  heightPx: number,
  baseSteps: number,
): number {
  const longestEdge = Math.max(1, Math.max(widthPx, heightPx));
  const baseCellPx = longestEdge / Math.max(1, baseSteps);
  const targetLeafPx = quality === 'high' ? 7 : quality === 'medium' ? 9 : 12;
  const depth = Math.ceil(Math.log2(Math.max(1, baseCellPx / targetLeafPx)));
  return Math.min(
    MAX_AUTO_ADAPTIVE_REGION_DEPTH,
    Math.max(MIN_AUTO_ADAPTIVE_REGION_DEPTH, depth),
  );
}
