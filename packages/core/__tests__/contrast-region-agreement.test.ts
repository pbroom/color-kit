import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  contrastRegionPaths,
  inP3Gamut,
  inSrgbGamut,
  maxChromaAt,
  parse,
  type GamutTarget,
} from '../src/index.js';

/**
 * Contrast regions checked against a brute-force grid of the public
 * `contrastRatio` (with the region's gamut), clipped to the gamut with
 * `maxChromaAt`.
 */

const MAX_CHROMA = 0.4;
const THRESHOLD = 4.5;

interface Point {
  l: number;
  c: number;
}

interface BruteForce {
  /** Threshold crossings between neighbouring in-gamut grid samples. */
  crossings: Point[];
  /** 4-connected components of the passing grid samples. */
  components: number;
}

function bruteForce(
  hue: number,
  referenceHex: string,
  gamut: GamutTarget,
  size = 400,
  threshold = THRESHOLD,
): BruteForce {
  const reference = parse(referenceHex);
  const margins: Array<Array<number | null>> = [];
  for (let row = 0; row <= size; row += 1) {
    const l = row / size;
    const cMax = maxChromaAt(l, hue, { gamut, maxChroma: MAX_CHROMA });
    const line: Array<number | null> = [];
    for (let column = 0; column <= size; column += 1) {
      const c = (column / size) * MAX_CHROMA;
      line.push(
        c > cMax
          ? null
          : contrastRatio({ l, c, h: hue, alpha: 1 }, reference, { gamut }) -
              threshold,
      );
    }
    margins.push(line);
  }

  const crossings: Point[] = [];
  const addCrossing = (
    a: number | null,
    b: number | null,
    at: (t: number) => Point,
  ) => {
    if (a == null || b == null || a >= 0 === b >= 0) return;
    crossings.push(at(a / (a - b)));
  };
  for (let row = 0; row <= size; row += 1) {
    for (let column = 0; column <= size; column += 1) {
      const value = margins[row][column];
      if (column < size) {
        addCrossing(value, margins[row][column + 1], (t) => ({
          l: row / size,
          c: ((column + t) / size) * MAX_CHROMA,
        }));
      }
      if (row < size) {
        addCrossing(value, margins[row + 1][column], (t) => ({
          l: (row + t) / size,
          c: (column / size) * MAX_CHROMA,
        }));
      }
    }
  }

  let components = 0;
  const seen = new Set<number>();
  for (let row = 0; row <= size; row += 1) {
    for (let column = 0; column <= size; column += 1) {
      const start = row * (size + 1) + column;
      if ((margins[row][column] ?? -1) < 0 || seen.has(start)) continue;
      components += 1;
      seen.add(start);
      const stack = [start];
      while (stack.length > 0) {
        const index = stack.pop()!;
        const r = Math.floor(index / (size + 1));
        const k = index % (size + 1);
        for (const [dr, dk] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nr = r + dr;
          const nk = k + dk;
          if (nr < 0 || nk < 0 || nr > size || nk > size) continue;
          const next = nr * (size + 1) + nk;
          if ((margins[nr][nk] ?? -1) < 0 || seen.has(next)) continue;
          seen.add(next);
          stack.push(next);
        }
      }
    }
  }
  return { crossings, components };
}

function distanceToPaths(point: Point, paths: Point[][]): number {
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

function maxGap(truth: BruteForce, paths: Point[][]): number {
  return truth.crossings.reduce(
    (gap, crossing) => Math.max(gap, distanceToPaths(crossing, paths)),
    0,
  );
}

const references = ['#ffffff', '#000000'] as const;
const gamuts: GamutTarget[] = ['srgb', 'display-p3'];

describe('contrast regions agree with a brute-force grid', () => {
  // The README hero query (OKLCH plane, WCAG AA) at hue 150. The passing set
  // is one connected region whose contrast contour runs from the chroma axis
  // to the gamut edge. An earlier solver split it into two pieces with
  // nothing between chroma 0.049 and 0.114.
  describe.each(
    references.flatMap((reference) =>
      gamuts.map((gamut) => [reference, gamut] as const),
    ),
  )('WCAG AA at h150 on %s in %s', (reference, gamut) => {
    const truth = bruteForce(150, reference, gamut);

    it('has one passing region', () => {
      expect(truth.components).toBe(1);
      expect(truth.crossings.length).toBeGreaterThan(100);
    });

    it('traces one contour from the axis to the gamut edge', () => {
      const paths = contrastRegionPaths(parse(reference), 150, {
        level: 'AA',
        gamut,
      });
      expect(paths).toHaveLength(1);
      expect(maxGap(truth, paths)).toBeLessThan(0.002);

      const [path] = paths;
      const ends = [path[0], path[path.length - 1]].sort((a, b) => a.c - b.c);
      expect(ends[0].c).toBe(0);
      // The outer end is on the gamut edge: in gamut, and out of gamut a
      // hair further out in chroma.
      const inGamut = gamut === 'display-p3' ? inP3Gamut : inSrgbGamut;
      const outer = { l: ends[1].l, c: ends[1].c, h: 150, alpha: 1 };
      expect(inGamut(outer)).toBe(true);
      expect(inGamut({ ...outer, c: outer.c + 1e-7 })).toBe(false);
      // Every vertex is on the contrast threshold, on its passing side.
      for (const point of path) {
        const ratio = contrastRatio(
          { l: point.l, c: point.c, h: 150, alpha: 1 },
          parse(reference),
          { gamut },
        );
        expect(ratio).toBeGreaterThanOrEqual(THRESHOLD);
        expect(ratio - THRESHOLD).toBeLessThan(1e-9);
      }
    });
  });

  // Hues from a 36-hue AA sweep where the contour folds back in lightness
  // near the axis or the gamut edge. An earlier branch tracker left these as
  // two pieces or stopped short of the gamut edge (gaps up to 0.027).
  it.each([
    [90, '#ffffff'],
    [100, '#ffffff'],
    [100, '#000000'],
    [240, '#000000'],
    [250, '#000000'],
    [260, '#000000'],
  ] as const)(
    'keeps the folded WCAG AA contour at h%i on %s connected',
    (hue, reference) => {
      const truth = bruteForce(hue, reference, 'display-p3', 200);
      expect(truth.components).toBe(1);
      const paths = contrastRegionPaths(parse(reference), hue, {
        level: 'AA',
        gamut: 'display-p3',
      });
      expect(paths).toHaveLength(1);
      expect(maxGap(truth, paths)).toBeLessThan(0.002);
    },
  );

  // A mid-gray reference at 3:1 passes in two separate regions: one darker
  // and one lighter than the reference. Their contours must stay apart
  // instead of joining across the failing band.
  describe.each(
    [30, 150, 264].flatMap((hue) =>
      gamuts.map((gamut) => [hue, gamut] as const),
    ),
  )('WCAG 3:1 at h%i on #767676 in %s', (hue, gamut) => {
    const reference = '#767676';
    const threshold = 3;
    const truth = bruteForce(hue, reference, gamut, 200, threshold);

    it('has two passing regions', () => {
      expect(truth.components).toBe(2);
    });

    it('traces two separate contours', () => {
      const paths = contrastRegionPaths(parse(reference), hue, {
        threshold,
        gamut,
      });
      expect(paths).toHaveLength(2);
      expect(maxGap(truth, paths)).toBeLessThan(0.002);

      // One contour bounds the darker region and one the lighter region;
      // neither crosses the failing band around the reference lightness.
      const referenceL = parse(reference).l;
      const sides = paths
        .map((path) => {
          const below = path.every((point) => point.l < referenceL);
          const above = path.every((point) => point.l > referenceL);
          return below ? 'below' : above ? 'above' : 'both';
        })
        .sort();
      expect(sides).toEqual(['above', 'below']);
    });
  });
});
