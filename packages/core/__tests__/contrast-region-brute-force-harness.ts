import { expect } from 'vitest';
import {
  contrastAPCA,
  contrastRatio,
  contrastRegionPaths,
  inP3Gamut,
  inSrgbGamut,
  maxChromaAt,
  parse,
  type Color,
  type ContrastMetric,
  type ContrastRegionPathOptions,
  type GamutTarget,
} from '../src/index.js';

/**
 * Brute-force truth for contrast regions, shared by the contrast-region
 * solver tests.
 *
 * Contrast regions are checked against a brute-force grid of the public
 * `contrastRatio` / `contrastAPCA` checks. The grid runs over lightness rows
 * and gamut-relative chroma columns, so the gamut edge is a grid line.
 * Crossings are bisected along rows and columns; contour pieces are the
 * 8-connected components of grid cells the contour crosses.
 */

const MAX_CHROMA = 0.4;
/** Largest allowed distance between the solver's paths and the truth. */
export const AGREEMENT = 0.001;
/**
 * `ContrastRegionLayer`'s interactive sampling (its defaults at high
 * quality), and the largest gap allowed at it.
 */
export const INTERACTIVE: ContrastRegionPathOptions = {
  initialSamples: 8,
  errorTolerance: 0.004,
  maxDepth: 3,
};
export const INTERACTIVE_AGREEMENT = 0.01;

export interface Query {
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

export interface Truth {
  crossings: Point[];
  pieces: number;
  /** Where open paths may end; defaults to the `maxChromaAt` gamut edge. */
  endsOnBoundary?: (point: Point) => boolean;
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

export function bruteForce(
  query: Query,
  rowCount: number,
  columns: number,
): Truth {
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

/**
 * Every vertex passes the public check and is in the region's gamut per
 * `inSrgbGamut` / `inP3Gamut`, exactly (no tolerance).
 */
export function expectVerticesPass(
  query: Query,
  paths: Point[][],
  reference: Color = parse(query.hex),
): void {
  const options = { gamut: query.gamut };
  const inGamut = query.gamut === 'display-p3' ? inP3Gamut : inSrgbGamut;
  for (const path of paths) {
    for (const point of path) {
      const sample = { l: point.l, c: point.c, h: query.hue, alpha: 1 };
      const value =
        query.metric === 'apca'
          ? Math.abs(contrastAPCA(sample, reference, options))
          : contrastRatio(sample, reference, options);
      expect(value, JSON.stringify(point)).toBeGreaterThanOrEqual(
        query.threshold,
      );
      expect(inGamut(sample), JSON.stringify(point)).toBe(true);
    }
  }
}

export function checkAgreement(
  query: Query,
  truth: Truth,
  expectedPaths = truth.pieces,
  sampling: ContrastRegionPathOptions = {},
  tolerance = AGREEMENT,
): void {
  const paths = contrastRegionPaths(parse(query.hex), query.hue, {
    metric: query.metric,
    threshold: query.threshold,
    gamut: query.gamut,
    ...sampling,
  });
  const onBoundary =
    truth.endsOnBoundary ?? ((point: Point) => endsOnBoundary(query, point));
  expect(paths).toHaveLength(expectedPaths);
  for (const path of paths) {
    // Closed paths have no ends to check, but their points must still lie
    // on the contrast boundary.
    if (!isClosed(path)) {
      for (const end of [path[0], path[path.length - 1]]) {
        expect(onBoundary(end), JSON.stringify(end)).toBe(true);
      }
    }
    for (const point of path) {
      expect(distanceToContour(query, point)).toBeLessThan(AGREEMENT);
    }
  }
  expectVerticesPass(query, paths);
  let gap = 0;
  for (const crossing of truth.crossings) {
    gap = Math.max(gap, distanceToPaths(crossing, paths));
  }
  expect(gap).toBeLessThan(tolerance);
}

export const apca = (
  hex: string,
  threshold: number,
  hue: number,
  gamut: GamutTarget,
): Query => ({ hex, hue, metric: 'apca', threshold, gamut });
export const wcag = (
  hex: string,
  threshold: number,
  hue: number,
  gamut: GamutTarget,
): Query => ({ hex, hue, metric: 'wcag', threshold, gamut });

/**
 * Brute force on an absolute lightness x chroma grid with the public gamut
 * membership test, for hues where the in-gamut set is not one chroma
 * interval per lightness (the sRGB blue fold near h 264, where a thin
 * in-gamut fin runs beside the main body). Crossings are bisected between
 * neighbouring in-gamut nodes; pieces are the 8-connected components of
 * cells whose in-gamut corners disagree. Open paths may end on the axis, the
 * lightness bounds, or next to an out-of-gamut color.
 */
export function bruteForceAbsolute(
  query: Query,
  rowCount: number,
  columns: number,
): Truth {
  const margin = marginOf(query);
  const inGamut = (l: number, c: number) =>
    (query.gamut === 'display-p3' ? inP3Gamut : inSrgbGamut)({
      l,
      c,
      h: query.hue,
      alpha: 1,
    });
  const rows = Array.from(
    { length: rowCount - 1 },
    (_, i) => (i + 1) / rowCount,
  );
  const step = MAX_CHROMA / columns;
  const width = columns + 1;
  const value = new Float64Array(rows.length * width);
  const inside = new Uint8Array(rows.length * width);
  rows.forEach((l, row) => {
    for (let column = 0; column <= columns; column += 1) {
      if (!inGamut(l, column * step)) continue;
      inside[row * width + column] = 1;
      value[row * width + column] = margin(l, column * step);
    }
  });
  const crossings: Point[] = [];
  const pass = (index: number) => value[index] >= 0;
  rows.forEach((l, row) => {
    for (let column = 0; column < columns; column += 1) {
      const a = row * width + column;
      if (!inside[a] || !inside[a + 1] || pass(a) === pass(a + 1)) continue;
      crossings.push({
        l,
        c: bisect(
          (c) => margin(l, c),
          column * step,
          (column + 1) * step,
          pass(a),
        ),
      });
    }
  });
  for (let row = 0; row < rows.length - 1; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const a = row * width + column;
      const b = a + width;
      if (!inside[a] || !inside[b] || pass(a) === pass(b)) continue;
      const c = column * step;
      crossings.push({
        l: bisect((l) => margin(l, c), rows[row], rows[row + 1], pass(a)),
        c,
      });
    }
  }
  const crossed = (row: number, column: number): boolean => {
    let passing = false;
    let failing = false;
    for (const index of [
      row * width + column,
      row * width + column + 1,
      (row + 1) * width + column,
      (row + 1) * width + column + 1,
    ]) {
      if (!inside[index]) continue;
      if (pass(index)) passing = true;
      else failing = true;
    }
    return passing && failing;
  };
  const cellRows = rows.length - 1;
  const seen = new Uint8Array(cellRows * columns);
  let pieces = 0;
  for (let start = 0; start < seen.length; start += 1) {
    if (seen[start] || !crossed(Math.floor(start / columns), start % columns)) {
      continue;
    }
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
          if (r < 0 || k < 0 || r >= cellRows || k >= columns) continue;
          const next = r * columns + k;
          if (seen[next] || !crossed(r, k)) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
  }
  const near = 2e-4;
  return {
    crossings,
    pieces,
    endsOnBoundary: (point) =>
      point.c <= 1e-6 ||
      point.l <= 1e-4 ||
      point.l >= 1 - 1e-4 ||
      [
        [0, near],
        [0, -near],
        [near, 0],
        [-near, 0],
      ].some(([dl, dc]) => !inGamut(point.l + dl, Math.max(0, point.c + dc))),
  };
}

/**
 * A low contour that folds back in lightness. An earlier solver, which
 * bracketed chroma roots at lightness samples, split it at the fold tip.
 * Each has two contour pieces.
 */
export const FOLDED_REPROS: Query[] = [
  apca('#949494', 0.45, 10, 'srgb'),
  apca('#949494', 0.45, 350, 'srgb'),
  apca('#949494', 0.45, 350, 'display-p3'),
];

/**
 * Contours that meet the gamut edge where the field is flat in chroma. A
 * near-zero margin at the edge was taken as an extra root, so the main path
 * stopped short of the edge or split off a stub there.
 */
export const EDGE_REPROS: Array<Query & { paths: number }> = [
  { ...apca('#22aa55', 0.6, 130, 'srgb'), paths: 1 },
  { ...apca('#595959', 0.75, 160, 'display-p3'), paths: 1 },
  { ...apca('#22aa55', 0.45, 210, 'display-p3'), paths: 2 },
  { ...apca('#767676', 0.45, 240, 'srgb'), paths: 1 },
  { ...apca('#0000ff', 0.45, 210, 'display-p3'), paths: 1 },
];

/**
 * A representative subset of the full agreement sweep: folds near the axis
 * and the gamut edge, near-vertical boundaries, APCA polarity splits, and
 * both gamuts.
 */
export const REPRESENTATIVE: Query[] = [
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
];

const SPREAD_REFERENCES = [
  '#ffffff',
  '#000000',
  '#767676',
  '#595959',
  '#949494',
  '#ff0000',
  '#0000ff',
  '#22aa55',
];
const SPREAD_CRITERIA: Array<[ContrastMetric, number]> = [
  ['wcag', 3],
  ['wcag', 4.5],
  ['wcag', 7],
  ['apca', 0.45],
  ['apca', 0.6],
  ['apca', 0.75],
];

/** One query per reference and criterion, spread over hues and gamuts. */
export const SPREAD: Query[] = SPREAD_REFERENCES.flatMap((hex, refIndex) =>
  SPREAD_CRITERIA.map(
    ([metric, threshold], criterionIndex): Query => ({
      hex,
      metric,
      threshold,
      hue: (refIndex * 70 + criterionIndex * 50) % 360,
      gamut: (refIndex + criterionIndex) % 2 === 0 ? 'srgb' : 'display-p3',
    }),
  ),
);

/**
 * The sRGB blue fold: near h 264 a thin in-gamut fin runs beside the main
 * body, so a contour can cross it as a separate short piece. The C
 * prototype missed these fins (gaps of 0.0149 and 0.0140) because its fin
 * probe stopped at the end of its bracket.
 */
export const FIN_REPROS: Query[] = [
  apca('#22aa55', 0.45, 264.16, 'srgb'),
  apca('#767676', 0.3, 264.17, 'srgb'),
];

/**
 * Blue-fold contours the prototype got wrong at coarse (interactive)
 * sampling: a missed 0.013-long fin, and chords through out-of-gamut colors
 * that merged two pieces into one.
 */
export const COARSE_FOLD_REPROS: Query[] = [
  apca('#767676', 0.15, 264.18, 'srgb'),
  apca('#22aa55', 0.45, 264.18, 'srgb'),
  apca('#22aa55', 0.45, 264.19, 'srgb'),
  apca('#767676', 0.2, 264.2, 'srgb'),
];

/** A spread of the blue-fold band, checked at both sampling settings. */
export const FOLD_BAND: Query[] = [
  wcag('#000000', 2, 263.8, 'srgb'),
  wcag('#ffffff', 10, 264.05, 'srgb'),
  wcag('#767676', 3, 264.25, 'srgb'),
  wcag('#0000ff', 2, 264.1, 'srgb'),
  apca('#949494', 0.45, 264.0, 'srgb'),
  apca('#000000', 0.15, 264.3, 'srgb'),
  apca('#ff0000', 0.3, 263.95, 'srgb'),
  apca('#595959', 0.6, 264.15, 'srgb'),
];

/**
 * Gamut notches: near h 264.206 the sRGB edge switches from blue > 1 to the
 * red < 0 slack bound and back within one internal scan step, so a contour
 * crossing the notch is two pieces. The samples around the notch show no
 * turn, and the first solver bridged it with a chord up to 0.0019 out of
 * gamut. WCAG on black, each with two pieces (from the review's notch
 * attack).
 */
export const NOTCH_REPROS: Query[] = [
  [264.2062, 2.262490765278987],
  [264.2062, 2.4476474451527093],
  [264.2062, 2.6328041250264316],
  [264.2063, 2.3363733251208494],
  [264.2063, 2.493574537603399],
  [264.2063, 2.650775750085948],
  [264.2064, 2.4193069899550648],
  [264.2064, 2.5386700399923123],
  [264.2064, 2.6580330900295595],
  [264.2065, 2.51587427813999],
  [264.2065, 2.5952479141133065],
  [264.2065, 2.674621550086622],
  [264.2066, 2.6278442502989727],
  [264.2066, 2.6580240354164353],
  [264.2066, 2.6882038205338987],
].map(([hue, threshold]) => wcag('#000000', threshold, hue, 'srgb'));

/**
 * Every chord between consecutive path points stays in the gamut per
 * `inSrgbGamut` / `inP3Gamut`, sampled at `samples` interior points.
 */
export function expectChordsInGamut(
  paths: Point[][],
  hue: number,
  gamut: GamutTarget,
  samples = 32,
): void {
  const inGamut = gamut === 'display-p3' ? inP3Gamut : inSrgbGamut;
  for (const path of paths) {
    for (let index = 1; index < path.length; index += 1) {
      const a = path[index - 1];
      const b = path[index];
      for (let k = 1; k < samples; k += 1) {
        const t = k / samples;
        const color = {
          l: a.l + t * (b.l - a.l),
          c: a.c + t * (b.c - a.c),
          h: hue,
          alpha: 1,
        };
        expect(inGamut(color), JSON.stringify({ a, b, t })).toBe(true);
      }
    }
  }
}
