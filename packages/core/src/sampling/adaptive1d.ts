/**
 * Shared adaptive 1D sampling primitives.
 *
 * The contrast region solvers (legacy adaptive + hybrid) and the adaptive
 * gamut boundary sampler all build a deduped anchor axis (endpoints, cusp,
 * edge probes, uniform interior steps) and refine segments by perpendicular
 * error. These helpers keep that logic defined once.
 */

/** A sampled point on a 1D sweep: axis position `l`, sampled value `c`. */
export interface Adaptive1dPoint {
  l: number;
  c: number;
}

/** Minimum axis span before a segment is considered unsplittable. */
export const MIN_SEGMENT_LENGTH = 1e-6;

/** Interior fractions probed when estimating a segment's max error. */
export const ADAPTIVE_PROBE_FRACTIONS = [0.25, 0.5, 0.75] as const;

/**
 * Append `value` clamped to `[min, max]`, skipping values within `epsilon`
 * of an existing entry.
 */
export function appendUniqueAxisValue(
  values: number[],
  value: number,
  min: number,
  max: number,
  epsilon: number,
): void {
  if (!Number.isFinite(value)) {
    return;
  }
  const normalized = Math.max(min, Math.min(max, value));
  for (const current of values) {
    if (Math.abs(current - normalized) <= epsilon) {
      return;
    }
  }
  values.push(normalized);
}

export interface AxisAnchorOptions {
  min: number;
  max: number;
  /** Dedupe tolerance between anchors. */
  epsilon: number;
  /** Extra anchors (e.g. the gamut cusp), appended after the endpoints. */
  extraAnchors?: readonly number[];
  /**
   * Edge probe fractions of the axis span, mirrored from both endpoints
   * (adds `min + f * span` and `min + (1 - f) * span` per fraction).
   */
  edgeProbes?: readonly number[];
  /** Number of uniform base steps; adds `uniformSteps - 1` interior anchors. */
  uniformSteps?: number;
}

/**
 * Build a sorted, deduped anchor axis.
 *
 * Append order (endpoints, extra anchors, edge probes, uniform steps)
 * determines which of two near-duplicate anchors survives, so it is part of
 * the behavioral contract.
 */
export function buildAxisAnchors(options: AxisAnchorOptions): number[] {
  const { min, max, epsilon } = options;
  const span = max - min;
  const anchors: number[] = [];
  appendUniqueAxisValue(anchors, min, min, max, epsilon);
  appendUniqueAxisValue(anchors, max, min, max, epsilon);
  for (const anchor of options.extraAnchors ?? []) {
    appendUniqueAxisValue(anchors, anchor, min, max, epsilon);
  }
  for (const probe of options.edgeProbes ?? []) {
    appendUniqueAxisValue(anchors, min + probe * span, min, max, epsilon);
    appendUniqueAxisValue(anchors, min + (1 - probe) * span, min, max, epsilon);
  }
  const steps = options.uniformSteps ?? 0;
  for (let index = 1; index < steps; index += 1) {
    appendUniqueAxisValue(
      anchors,
      min + (index / steps) * span,
      min,
      max,
      epsilon,
    );
  }
  anchors.sort((a, b) => a - b);
  return anchors;
}

/** Perpendicular distance from `p` to the segment `a`-`b` in (l, c) space. */
export function perpendicularDistance(
  p: Adaptive1dPoint,
  a: Adaptive1dPoint,
  b: Adaptive1dPoint,
): number {
  const dl = b.l - a.l;
  const dc = b.c - a.c;
  const lenSq = dl * dl + dc * dc;
  if (lenSq <= 0) {
    return Math.hypot(p.l - a.l, p.c - a.c);
  }
  let t = ((p.l - a.l) * dl + (p.c - a.c) * dc) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projL = a.l + t * dl;
  const projC = a.c + t * dc;
  return Math.hypot(p.l - projL, p.c - projC);
}

/**
 * Probe the interior of segment `a`-`b` and return the sampled point with
 * the largest perpendicular error against the straight segment.
 */
export function adaptiveMaxErrorProbe(
  a: Adaptive1dPoint,
  b: Adaptive1dPoint,
  sampleValue: (position: number) => number,
): { probe: Adaptive1dPoint; error: number } {
  const span = b.l - a.l;
  let bestProbe: Adaptive1dPoint | null = null;
  let bestError = -1;

  for (const fraction of ADAPTIVE_PROBE_FRACTIONS) {
    const l = a.l + span * fraction;
    if (l <= a.l + MIN_SEGMENT_LENGTH || l >= b.l - MIN_SEGMENT_LENGTH) {
      continue;
    }
    const probe: Adaptive1dPoint = { l, c: sampleValue(l) };
    const error = perpendicularDistance(probe, a, b);
    if (error > bestError) {
      bestError = error;
      bestProbe = probe;
    }
  }

  if (bestProbe) {
    return { probe: bestProbe, error: bestError };
  }

  const lMid = (a.l + b.l) / 2;
  const mid: Adaptive1dPoint = { l: lMid, c: sampleValue(lMid) };
  return {
    probe: mid,
    error: perpendicularDistance(mid, a, b),
  };
}
