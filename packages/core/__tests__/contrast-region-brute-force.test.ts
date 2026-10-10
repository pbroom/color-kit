import { describe, expect, it } from 'vitest';
import {
  contrastAPCA,
  contrastRatio,
  contrastRegionPaths,
  maxChromaAt,
  parse,
  type ContrastMetric,
  type GamutTarget,
} from '../src/index.js';

/**
 * Contrast regions checked against a brute-force grid of the public
 * `contrastRatio` / `contrastAPCA` checks. The grid runs over lightness rows
 * and gamut-relative chroma columns, so the gamut edge is a grid line.
 * Crossings are bisected along rows and columns; contour pieces are the
 * 8-connected components of grid cells the contour crosses.
 */

const MAX_CHROMA = 0.4;
/** Largest allowed distance between the solver's paths and the truth. */
const AGREEMENT = 0.001;

interface Query {
  hex: string;
  hue: number;
  metric: ContrastMetric;
  threshold: number;
  gamut: GamutTarget;
}

interface Point {
  l: number;
  c: number;
}

interface Truth {
  crossings: Point[];
  pieces: number;
}

function marginOf(query: Query): (l: number, c: number) => number {
  const reference = parse(query.hex);
  const options = { gamut: query.gamut };
  return query.metric === 'apca'
    ? (l, c) =>
        Math.abs(
          contrastAPCA({ l, c, h: query.hue, alpha: 1 }, reference, options),
        ) - query.threshold
    : (l, c) =>
        contrastRatio({ l, c, h: query.hue, alpha: 1 }, reference, options) -
        query.threshold;
}

function cMaxAt(query: Query, l: number): number {
  return Math.min(
    MAX_CHROMA,
    maxChromaAt(l, query.hue, { gamut: query.gamut, maxChroma: MAX_CHROMA }),
  );
}

function bisect(
  evaluate: (t: number) => number,
  lo: number,
  hi: number,
  passLo: boolean,
): number {
  for (let index = 0; index < 40; index += 1) {
    const mid = (lo + hi) / 2;
    if (evaluate(mid) >= 0 === passLo) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function bruteForce(query: Query, rowCount: number, columns: number): Truth {
  const margin = marginOf(query);
  // Uniform rows plus fine rows near both lightness ends, where regions can
  // be thinner than a uniform row.
  const rowSet = new Set<number>();
  for (let index = 1; index < rowCount; index += 1) {
    rowSet.add(index / rowCount);
  }
  for (let index = 1; index <= 100; index += 1) {
    rowSet.add(0.01 * (index / 100));
    rowSet.add(0.99 + 0.0099 * (index / 100));
  }
  const rows = [...rowSet].sort((a, b) => a - b);
  const cMax = rows.map((l) => cMaxAt(query, l));
  const width = columns + 1;
  const pass = rows.map((l, row) =>
    Array.from(
      { length: width },
      (_, column) => margin(l, (cMax[row] * column) / columns) >= 0,
    ),
  );

  const crossings: Point[] = [];
  rows.forEach((l, row) => {
    for (let column = 0; column < columns; column += 1) {
      if (pass[row][column] === pass[row][column + 1]) continue;
      const step = cMax[row] / columns;
      const c = bisect(
        (chroma) => margin(l, chroma),
        step * column,
        step * (column + 1),
        pass[row][column],
      );
      crossings.push({ l, c });
    }
  });
  for (let row = 0; row < rows.length - 1; row += 1) {
    const [l0, l1] = [rows[row], rows[row + 1]];
    for (let column = 0; column <= columns; column += 1) {
      if (pass[row][column] === pass[row + 1][column]) continue;
      const t = column / columns;
      const chromaAt = (l: number) =>
        t * (cMax[row] + ((cMax[row + 1] - cMax[row]) * (l - l0)) / (l1 - l0));
      const l = bisect(
        (lightness) => margin(lightness, chromaAt(lightness)),
        l0,
        l1,
        pass[row][column],
      );
      crossings.push({ l, c: chromaAt(l) });
    }
  }

  const cellCount = (rows.length - 1) * columns;
  const crossed = (cell: number): boolean => {
    const row = Math.floor(cell / columns);
    const column = cell % columns;
    const first = pass[row][column];
    return (
      pass[row][column + 1] !== first ||
      pass[row + 1][column] !== first ||
      pass[row + 1][column + 1] !== first
    );
  };
  const seen = new Uint8Array(cellCount);
  let pieces = 0;
  for (let start = 0; start < cellCount; start += 1) {
    if (seen[start] || !crossed(start)) continue;
    pieces += 1;
    seen[start] = 1;
    const stack = [start];
    while (stack.length > 0) {
      const cell = stack.pop()!;
      const row = Math.floor(cell / columns);
      const column = cell % columns;
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const r = row + dr;
          const k = column + dc;
          if (r < 0 || k < 0 || r >= rows.length - 1 || k >= columns) continue;
          const next = r * columns + k;
          if (seen[next] || !crossed(next)) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
  }
  return { crossings, pieces };
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

/** Distance from `point` to the contour, linearized from the margin. */
function distanceToContour(query: Query, point: Point): number {
  const margin = marginOf(query);
  const h = 1e-6;
  const value = margin(point.l, point.c);
  const gradientL =
    (margin(point.l + h, point.c) - margin(point.l - h, point.c)) / (2 * h);
  // One-sided in chroma, toward the inside of the gamut.
  const gradientC =
    point.c > h
      ? (value - margin(point.l, point.c - h)) / h
      : (margin(point.l, point.c + h) - value) / h;
  return Math.abs(value) / Math.max(1e-12, Math.hypot(gradientL, gradientC));
}

function isClosed(path: Point[]): boolean {
  const first = path[0];
  const last = path[path.length - 1];
  return path.length > 2 && first.l === last.l && first.c === last.c;
}

/** Where an open path may end: the chroma axis, gamut edge, or L bounds. */
function endsOnBoundary(query: Query, point: Point): boolean {
  return (
    point.c <= 1e-6 ||
    cMaxAt(query, point.l) - point.c <= 1e-4 ||
    point.l <= 1e-4 ||
    point.l >= 1 - 1e-4
  );
}

function checkAgreement(
  query: Query,
  truth: Truth,
  expectedPaths = truth.pieces,
): void {
  const paths = contrastRegionPaths(parse(query.hex), query.hue, {
    metric: query.metric,
    threshold: query.threshold,
    gamut: query.gamut,
  });
  expect(paths).toHaveLength(expectedPaths);
  for (const path of paths) {
    // Closed paths have no ends to check, but their points must still lie
    // on the contrast boundary.
    if (!isClosed(path)) {
      for (const end of [path[0], path[path.length - 1]]) {
        expect(endsOnBoundary(query, end), JSON.stringify(end)).toBe(true);
      }
    }
    for (const point of path) {
      expect(distanceToContour(query, point)).toBeLessThan(AGREEMENT);
    }
  }
  let gap = 0;
  for (const crossing of truth.crossings) {
    gap = Math.max(gap, distanceToPaths(crossing, paths));
  }
  expect(gap).toBeLessThan(AGREEMENT);
}

const apca = (
  hex: string,
  threshold: number,
  hue: number,
  gamut: GamutTarget,
): Query => ({ hex, hue, metric: 'apca', threshold, gamut });
const wcag = (
  hex: string,
  threshold: number,
  hue: number,
  gamut: GamutTarget,
): Query => ({ hex, hue, metric: 'wcag', threshold, gamut });

describe('contrast regions agree with brute force', () => {
  // A low contour that folds back in lightness. The fold tip is narrower
  // than a chroma bracket, and roots accepted by value tolerance there were
  // misplaced and merged, so the contour came back split at the tip.
  it.each([
    apca('#949494', 0.45, 10, 'srgb'),
    apca('#949494', 0.45, 350, 'srgb'),
    apca('#949494', 0.45, 350, 'display-p3'),
  ])(
    'keeps the folded $metric $threshold contour on $hex at h$hue in $gamut whole',
    (query) => {
      checkAgreement(query, bruteForce(query, 1200, 160), 2);
    },
  );

  // Contours that meet the gamut edge where the field is flat in chroma.
  // A near-zero margin at the edge was taken as an extra root, so the main
  // path stopped short of the edge or split off a stub there.
  it.each([
    { ...apca('#22aa55', 0.6, 130, 'srgb'), paths: 1 },
    { ...apca('#595959', 0.75, 160, 'display-p3'), paths: 1 },
    { ...apca('#22aa55', 0.45, 210, 'display-p3'), paths: 2 },
    { ...apca('#767676', 0.45, 240, 'srgb'), paths: 1 },
    { ...apca('#0000ff', 0.45, 210, 'display-p3'), paths: 1 },
  ])(
    'ends the $metric $threshold contour on $hex at h$hue in $gamut on the gamut edge',
    (query) => {
      checkAgreement(query, bruteForce(query, 600, 160), query.paths);
    },
  );

  // A representative subset of the full agreement sweep: folds near the
  // axis and the gamut edge, near-vertical boundaries, APCA polarity
  // splits, and both gamuts. Contour pieces must match brute force.
  it.each([
    wcag('#ffffff', 4.5, 100, 'display-p3'),
    wcag('#000000', 4.5, 250, 'display-p3'),
    wcag('#949494', 3, 270, 'display-p3'),
    wcag('#ff0000', 3, 140, 'display-p3'),
    wcag('#0000ff', 7, 130, 'srgb'),
    wcag('#767676', 4.5, 30, 'srgb'),
    apca('#ffffff', 0.75, 0, 'srgb'),
    apca('#000000', 0.45, 0, 'display-p3'),
    apca('#0000ff', 0.75, 140, 'display-p3'),
    apca('#949494', 0.6, 110, 'display-p3'),
    apca('#22aa55', 0.45, 280, 'srgb'),
    apca('#22aa55', 0.6, 260, 'srgb'),
    apca('#ff0000', 0.6, 120, 'display-p3'),
    apca('#595959', 0.45, 200, 'srgb'),
  ])('agrees on $metric $threshold on $hex at h$hue in $gamut', (query) => {
    checkAgreement(query, bruteForce(query, 400, 120));
  });

  // One query per reference and criterion, spread over hues and gamuts.
  const references = [
    '#ffffff',
    '#000000',
    '#767676',
    '#595959',
    '#949494',
    '#ff0000',
    '#0000ff',
    '#22aa55',
  ];
  const criteria: Array<[ContrastMetric, number]> = [
    ['wcag', 3],
    ['wcag', 4.5],
    ['wcag', 7],
    ['apca', 0.45],
    ['apca', 0.6],
    ['apca', 0.75],
  ];
  const spread = references.flatMap((hex, refIndex) =>
    criteria.map(
      ([metric, threshold], criterionIndex): Query => ({
        hex,
        metric,
        threshold,
        hue: (refIndex * 70 + criterionIndex * 50) % 360,
        gamut: (refIndex + criterionIndex) % 2 === 0 ? 'srgb' : 'display-p3',
      }),
    ),
  );
  it.each(spread)(
    'spread: $metric $threshold on $hex at h$hue in $gamut',
    (query) => {
      checkAgreement(query, bruteForce(query, 400, 120));
    },
  );
});
