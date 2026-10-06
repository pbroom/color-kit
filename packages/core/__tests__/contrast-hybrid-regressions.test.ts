import { describe, expect, it } from 'vitest';
import {
  contrastAPCA,
  contrastRatio,
  definePlane,
  inspectPlaneQuery,
  maxChromaAt,
  parse,
  toSrgbGamut,
  type Color,
  type ContrastMetric,
} from '../src/index.js';

/**
 * Regression cases from a brute-force review of the hybrid contrast engine
 * against the public `contrastRatio` / `contrastAPCA` checks.
 */

interface RegressionCase {
  name: string;
  reference: Color;
  hue: number;
  metric: ContrastMetric;
  threshold: number;
}

const DARK_TEAL: Color = { l: 0.25, c: 0.08, h: 180, alpha: 1 };

function margin(testCase: RegressionCase): (l: number, c: number) => number {
  // The public checks clip an out-of-gamut reference (such as DARK_TEAL)
  // themselves, and the region solvers measure against it unmapped too.
  const reference = testCase.reference;
  return (l, c) => {
    const sample = toSrgbGamut({ l, c, h: testCase.hue, alpha: 1 });
    const value =
      testCase.metric === 'apca'
        ? Math.abs(contrastAPCA(sample, reference))
        : contrastRatio(sample, reference);
    return value - testCase.threshold;
  };
}

/** Threshold crossings along chroma, sampled on a lightness grid. */
function bruteForceCrossings(
  testCase: RegressionCase,
  rows = 120,
  columns = 120,
): Array<{ l: number; c: number }> {
  const evaluate = margin(testCase);
  const crossings: Array<{ l: number; c: number }> = [];
  for (let row = 1; row < rows; row += 1) {
    const l = row / rows;
    const cMax = maxChromaAt(l, testCase.hue, {
      gamut: 'srgb',
      maxChroma: 0.4,
    });
    if (cMax <= 1e-6) continue;
    let previousC = 0;
    let previousValue = evaluate(l, 0);
    for (let column = 1; column <= columns; column += 1) {
      const c = (cMax * column) / columns;
      const value = evaluate(l, c);
      if (previousValue < 0 !== value < 0) {
        let lo = previousC;
        let hi = c;
        let loValue = previousValue;
        for (let step = 0; step < 30; step += 1) {
          const mid = (lo + hi) / 2;
          const midValue = evaluate(l, mid);
          if (midValue < 0 === loValue < 0) {
            lo = mid;
            loValue = midValue;
          } else {
            hi = mid;
          }
        }
        crossings.push({ l, c: (lo + hi) / 2 });
      }
      previousC = c;
      previousValue = value;
    }
  }
  return crossings;
}

function distanceToPaths(
  point: { l: number; c: number },
  paths: Array<Array<{ l: number; c: number }>>,
): number {
  let best = Number.POSITIVE_INFINITY;
  for (const path of paths) {
    for (let index = 1; index < path.length; index += 1) {
      const a = path[index - 1];
      const b = path[index];
      const dl = b.l - a.l;
      const dc = b.c - a.c;
      const length = dl * dl + dc * dc;
      const t =
        length > 0
          ? Math.max(
              0,
              Math.min(
                1,
                ((point.l - a.l) * dl + (point.c - a.c) * dc) / length,
              ),
            )
          : 0;
      best = Math.min(
        best,
        Math.hypot(point.l - (a.l + t * dl), point.c - (a.c + t * dc)),
      );
    }
  }
  return best;
}

function inspectHybrid(testCase: RegressionCase) {
  return inspectPlaneQuery(definePlane({ fixed: { h: testCase.hue } }), {
    kind: 'contrastRegion',
    reference: testCase.reference,
    hue: testCase.hue,
    metric: testCase.metric,
    threshold: testCase.threshold,
  });
}

describe('hybrid contrast engine regressions', () => {
  // Contours with nearly constant lightness jump more than the branch join
  // distance in chroma between lightness samples. Before the root-jump
  // split these left gaps of more than 0.03 against the brute-force
  // boundary.
  const resolved: RegressionCase[] = [
    {
      name: 'WCAG 3 at h180 on a dark teal reference (ContrastRegionLayer repro)',
      reference: DARK_TEAL,
      hue: 180,
      metric: 'wcag',
      threshold: 3,
    },
    {
      name: 'WCAG 4.5 at h330 on a dark teal reference',
      reference: DARK_TEAL,
      hue: 330,
      metric: 'wcag',
      threshold: 4.5,
    },
    {
      name: 'WCAG 4.5 at h0 on white',
      reference: parse('#ffffff'),
      hue: 0,
      metric: 'wcag',
      threshold: 4.5,
    },
    {
      name: 'WCAG 3 at h150 on #767676',
      reference: parse('#767676'),
      hue: 150,
      metric: 'wcag',
      threshold: 3,
    },
    {
      name: 'WCAG 7 at h150 on black',
      reference: parse('#000000'),
      hue: 150,
      metric: 'wcag',
      threshold: 7,
    },
    {
      name: 'APCA 0.6 at h330 on a dark teal reference',
      reference: DARK_TEAL,
      hue: 330,
      metric: 'apca',
      threshold: 0.6,
    },
  ];

  it.each(resolved.map((testCase) => [testCase.name, testCase] as const))(
    'traces %s close to the brute-force boundary',
    (_name, testCase) => {
      const inspection = inspectHybrid(testCase);
      const paths = inspection.result.paths;
      expect(paths.length).toBeGreaterThan(0);
      expect(inspection.trace.summary.degradedReason).toBeUndefined();

      const crossings = bruteForceCrossings(testCase);
      expect(crossings.length).toBeGreaterThan(0);
      let maxGap = 0;
      for (const crossing of crossings) {
        maxGap = Math.max(maxGap, distanceToPaths(crossing, paths));
      }
      expect(maxGap).toBeLessThan(0.01);
    },
  );

  // Regions that are a thin sliver at the top of the lightness range (every
  // in-gamut chroma passes above some L > 0.98) have a vertical boundary
  // and no chroma roots. The hybrid engine used to report them as degraded
  // with no paths; it now traces the boundary from the chroma axis to the
  // gamut edge where the zero-chroma and gamut-edge margins change sign.
  const thinTop: RegressionCase[] = [
    ...[0, 60, 120, 180, 240, 300].map((hue) => ({
      name: `WCAG 7 at h${hue} on #595959`,
      reference: parse('#595959'),
      hue,
      metric: 'wcag' as const,
      threshold: 7,
    })),
    {
      name: 'APCA 0.75 at h260 on #767676',
      reference: parse('#767676'),
      hue: 260,
      metric: 'apca',
      threshold: 0.75,
    },
    {
      name: 'APCA 0.6 at h260 on #949494',
      reference: parse('#949494'),
      hue: 260,
      metric: 'apca',
      threshold: 0.6,
    },
    {
      name: 'APCA 0.6 at h260 on #22aa55',
      reference: parse('#22aa55'),
      hue: 260,
      metric: 'apca',
      threshold: 0.6,
    },
  ];

  it.each(thinTop.map((testCase) => [testCase.name, testCase] as const))(
    'traces %s as a vertical boundary that matches the legacy engine',
    (_name, testCase) => {
      const evaluate = margin(testCase);
      expect(evaluate(1, 0)).toBeGreaterThan(0);

      const hybrid = inspectHybrid(testCase);
      expect(hybrid.trace.summary.degradedReason).toBeUndefined();
      expect(hybrid.result.paths).toHaveLength(1);
      const [path] = hybrid.result.paths;
      const boundaryL = Math.min(...path.map((point) => point.l));
      expect(
        Math.max(...path.map((point) => point.l)) - boundaryL,
      ).toBeLessThan(1e-4);
      const chromas = path.map((point) => point.c);
      expect(Math.min(...chromas)).toBe(0);
      expect(Math.max(...chromas)).toBeCloseTo(
        maxChromaAt(boundaryL, testCase.hue, { gamut: 'srgb', maxChroma: 0.4 }),
        5,
      );
      // Just below the boundary nothing passes; just above, the axis does.
      expect(evaluate(boundaryL - 1e-4, 0)).toBeLessThan(0);
      expect(evaluate(boundaryL + 1e-4, 0)).toBeGreaterThan(0);

      const legacy = inspectPlaneQuery(
        definePlane({ fixed: { h: testCase.hue } }),
        {
          kind: 'contrastRegion',
          reference: testCase.reference,
          hue: testCase.hue,
          metric: testCase.metric,
          threshold: testCase.threshold,
          engine: 'legacy',
        },
      );
      expect(legacy.result.paths.length).toBeGreaterThan(0);
      for (const point of legacy.result.paths.flat()) {
        expect(point.l).toBeGreaterThan(0.98);
      }
      const legacyL = Math.min(
        ...legacy.result.paths.flat().map((point) => point.l),
      );
      expect(Math.abs(legacyL - boundaryL)).toBeLessThan(1e-3);
    },
  );
});
