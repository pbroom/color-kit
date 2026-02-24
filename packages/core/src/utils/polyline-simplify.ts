/**
 * Ramer-Douglas-Peucker polyline simplification in (l, c) space.
 * Preserves endpoints and optional loop closure. Deterministic.
 */

export interface LcPoint {
  l: number;
  c: number;
}

/**
 * Squared perpendicular distance from point p to the segment a-b in (l, c) space.
 */
function segmentDistanceSq(p: LcPoint, a: LcPoint, b: LcPoint): number {
  const dl = b.l - a.l;
  const dc = b.c - a.c;
  const lenSq = dl * dl + dc * dc;
  if (lenSq <= 0) {
    const dL = p.l - a.l;
    const dC = p.c - a.c;
    return dL * dL + dC * dC;
  }
  let t = ((p.l - a.l) * dl + (p.c - a.c) * dc) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projL = a.l + t * dl;
  const projC = a.c + t * dc;
  const dL = p.l - projL;
  const dC = p.c - projC;
  return dL * dL + dC * dC;
}

function rdpRecurse(
  points: LcPoint[],
  start: number,
  end: number,
  tolSq: number,
  keep: boolean[],
): void {
  if (end <= start + 1) return;
  const a = points[start];
  const b = points[end];
  let maxDistSq = 0;
  let maxIndex = start + 1;
  for (let i = start + 1; i < end; i += 1) {
    const dSq = segmentDistanceSq(points[i], a, b);
    if (dSq > maxDistSq) {
      maxDistSq = dSq;
      maxIndex = i;
    }
  }
  if (maxDistSq <= tolSq) return;
  keep[maxIndex] = true;
  rdpRecurse(points, start, maxIndex, tolSq, keep);
  rdpRecurse(points, maxIndex, end, tolSq, keep);
}

/**
 * Simplify a polyline with the Ramer-Douglas-Peucker algorithm.
 * Uses (l, c) as 2D coordinates; tolerance is in the same normalized space.
 * Preserves first and last point. For closed paths, pass closed: true so the
 * duplicate end point is preserved and the path stays closed.
 *
 * @param points - Input path (LcPoint with l, c)
 * @param tolerance - Max allowed perpendicular distance (e.g. 0.001–0.002)
 * @param closed - If true, path is treated as closed (first === last); keeps both ends
 * @returns Simplified path (new array)
 */
export function simplifyPolyline<T extends LcPoint>(
  points: T[],
  tolerance: number,
  closed: boolean = false,
): T[] {
  if (tolerance <= 0 || !Number.isFinite(tolerance)) {
    return points.slice();
  }
  if (points.length <= 2) return points.slice();

  const tolSq = tolerance * tolerance;
  let work: T[];
  let useClosed = false;
  if (closed && points.length > 2) {
    const first = points[0];
    const last = points[points.length - 1];
    const same =
      Math.abs(first.l - last.l) < 1e-12 && Math.abs(first.c - last.c) < 1e-12;
    if (same) {
      work = points.slice(0, -1);
      useClosed = true;
    } else {
      work = points.slice();
    }
  } else {
    work = points.slice();
  }

  const n = work.length;
  if (n <= 2) return useClosed ? [...work, work[0]] : work.slice();

  const keep = new Array<boolean>(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;
  rdpRecurse(work, 0, n - 1, tolSq, keep);

  const result: T[] = [];
  for (let i = 0; i < n; i += 1) {
    if (keep[i]) result.push(work[i]);
  }
  if (useClosed) result.push(work[0]);
  return result;
}
