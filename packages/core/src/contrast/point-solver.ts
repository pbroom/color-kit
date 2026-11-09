import { isInTargetGamut } from '../gamut/membership.js';
import type { GamutTarget } from '../gamut/types.js';
import type { Color } from '../types.js';
import { contrastAPCA, contrastRatio } from './metrics.js';
import { resolveContrastCriterion } from './region-shared.js';
import type { ContrastRegionPathOptions } from './types.js';

/**
 * The contrast target shared by the contrast point solvers
 * ({@link ensureContrast}, {@link tryEnsureContrast} and the plane
 * `contrastPoint` query): the metric, threshold and APCA options of
 * `ContrastRegionPathOptions`, with the same defaults and validation, plus
 * the gamut contrast is measured in.
 */
export type ContrastTargetOptions = Pick<
  ContrastRegionPathOptions,
  | 'metric'
  | 'threshold'
  | 'level'
  | 'apcaPreset'
  | 'apcaPolarity'
  | 'apcaRole'
  | 'gamut'
>;

/** A resolved contrast target, as a pass/fail test and a measurement. */
export interface ContrastTest {
  /**
   * Whether `color` meets the threshold against the reference and, when the
   * test is gamut-constrained, is inside the gamut. The contrast part is the
   * region solver's own criterion, so it agrees with `contrastRegionPaths`
   * and with `contrastRatio` / `contrastAPCA` exactly.
   */
  passes(color: Color): boolean;
  /**
   * The contrast of `color` against the reference: `contrastRatio` for WCAG,
   * signed `contrastAPCA` (with `apcaRole` applied) for APCA.
   */
  measure(color: Color): number;
}

/**
 * Resolves a contrast target into a {@link ContrastTest}.
 *
 * @param reference - Color every sample is measured against.
 * @param options - Metric, threshold and measurement gamut.
 * @param constrainTo - Gamut samples must also be inside, or `undefined` for
 * no gamut constraint. Membership reads unclamped linear channels through
 * the shared gamut helpers.
 * @param caller - Public function name used as the error-message prefix.
 */
export function createContrastTest(
  reference: Color,
  options: ContrastTargetOptions,
  constrainTo: GamutTarget | undefined,
  caller: string,
): ContrastTest {
  const criterion = resolveContrastCriterion(options, caller);
  const metricOptions = { gamut: options.gamut ?? 'srgb' };
  const sampleIsBackground = options.apcaRole === 'sample-background';
  return {
    passes: (color) =>
      criterion.evaluate(color, reference) >= 0 &&
      (constrainTo === undefined || isInTargetGamut(color, constrainTo)),
    measure: (color) => {
      if (criterion.metric !== 'apca') {
        return contrastRatio(color, reference, metricOptions);
      }
      return sampleIsBackground
        ? contrastAPCA(reference, color, metricOptions)
        : contrastAPCA(color, reference, metricOptions);
    },
  };
}

/**
 * Finds the first passing position along a line: the solver core shared by
 * the lightness-only and plane contrast point solvers.
 *
 * Marches `steps` equal steps from `from` (which must fail; it is not
 * tested) to `to` (tested exactly), and bisects the first step that ends on
 * a passing position. The returned position passes; the position
 * `tolerance` before it fails. A passing stretch shorter than one step that
 * starts and ends between two samples is not seen.
 *
 * @returns The passing position, or `NaN` when no sampled position passes.
 */
export function firstPassingBetween(
  passesAt: (position: number) => boolean,
  from: number,
  to: number,
  steps: number,
  tolerance: number,
): number {
  let failing = from;
  for (let step = 1; step <= steps; step += 1) {
    const position = step === steps ? to : from + ((to - from) * step) / steps;
    if (passesAt(position)) {
      return bisectFirstPassing(passesAt, failing, position, tolerance);
    }
    failing = position;
  }
  return Number.NaN;
}

/** Narrows a failing/passing bracket to `tolerance`; returns the passing end. */
function bisectFirstPassing(
  passesAt: (position: number) => boolean,
  failing: number,
  passing: number,
  tolerance: number,
): number {
  while (Math.abs(passing - failing) > tolerance) {
    const middle = (failing + passing) / 2;
    if (middle === failing || middle === passing) break;
    if (passesAt(middle)) {
      passing = middle;
    } else {
      failing = middle;
    }
  }
  return passing;
}

/**
 * Samples per axis of the scan that seeds {@link nearestPassingPoint}: the
 * unit square is tested at `(GRID + 1)²` points, edges and corners included.
 */
export const NEAREST_POINT_GRID = 64;
/** Positional tolerance of {@link nearestPassingPoint}, in unit-square units. */
export const NEAREST_POINT_TOLERANCE = 1e-9;

const SECTORS = 16;
const UNIT_SLACK = 1e-12;
const MAX_ANGLE_STEP = Math.PI / 4;
const MAX_REFINE_ITERATIONS = 240;

/** Result of {@link nearestPassingPoint}. */
export interface NearestPassingPoint {
  x: number;
  y: number;
  /** Euclidean distance from the origin, in unit-square units. */
  distance: number;
}

/**
 * Finds the passing point of the unit square nearest to a failing origin,
 * by Euclidean distance in the square's own coordinates.
 *
 * 1. Scan: `passes` is sampled on a `(GRID + 1)²` lattice. The nearest
 *    passing sample in each of 16 directions around the origin seeds the
 *    search; no passing sample means unreachable (`null`).
 * 2. Solve: for each seed within three cells of the nearest one,
 *    {@link firstPassingBetween} finds the first passing position on the
 *    segment from the origin to the seed. A pattern search over the
 *    direction then repeats two moves until the direction step is below the
 *    tolerance: turn to a neighbouring direction that passes at the current
 *    distance, and bisect inward along it. It stops at a point where the
 *    circle through it, centred on the origin, holds no passing point on
 *    either side: a local nearest point. The nearest of these is returned.
 *
 * The result always passes, and the point {@link NEAREST_POINT_TOLERANCE}
 * closer to the origin along the same direction fails. It is the global
 * nearest point as long as every passing area is wide enough to contain a
 * lattice sample; an area thinner than one cell (`1 / GRID`) that falls
 * between samples can be missed.
 *
 * @param passes - Membership test, called only with `x`, `y` in `[0, 1]`.
 * @param originX - Origin `x` in `[0, 1]`; `passes` must be `false` there.
 * @param originY - Origin `y` in `[0, 1]`.
 * @param onEvaluate - Called once per `passes` call (trace counters).
 */
export function nearestPassingPoint(
  passes: (x: number, y: number) => boolean,
  originX: number,
  originY: number,
  onEvaluate?: () => void,
): NearestPassingPoint | null {
  // Polar probe around the origin. Coordinates within rounding of the square
  // are snapped onto it so solutions on an edge stay reachable.
  let probeX = 0;
  let probeY = 0;
  const probe = (x: number, y: number): boolean => {
    if (
      x < -UNIT_SLACK ||
      x > 1 + UNIT_SLACK ||
      y < -UNIT_SLACK ||
      y > 1 + UNIT_SLACK
    ) {
      return false;
    }
    probeX = Math.min(1, Math.max(0, x));
    probeY = Math.min(1, Math.max(0, y));
    onEvaluate?.();
    return passes(probeX, probeY);
  };
  const probePolar = (angle: number, radius: number): boolean =>
    probe(
      originX + radius * Math.cos(angle),
      originY + radius * Math.sin(angle),
    );

  // 1. Scan.
  const seedDistance = new Array<number>(SECTORS).fill(Infinity);
  const seedX = new Array<number>(SECTORS).fill(0);
  const seedY = new Array<number>(SECTORS).fill(0);
  let nearestSeed = Infinity;
  for (let row = 0; row <= NEAREST_POINT_GRID; row += 1) {
    const y = row / NEAREST_POINT_GRID;
    for (let column = 0; column <= NEAREST_POINT_GRID; column += 1) {
      const x = column / NEAREST_POINT_GRID;
      const distance = Math.hypot(x - originX, y - originY);
      const sector =
        Math.floor(
          ((Math.atan2(y - originY, x - originX) + Math.PI) / (2 * Math.PI)) *
            SECTORS,
        ) % SECTORS;
      if (distance >= seedDistance[sector] || !probe(x, y)) continue;
      seedDistance[sector] = distance;
      seedX[sector] = x;
      seedY[sector] = y;
      nearestSeed = Math.min(nearestSeed, distance);
    }
  }
  if (nearestSeed === Infinity) return null;

  // 2. Solve from every seed that could hold the nearest point.
  let best = null as NearestPassingPoint | null;
  const pullInward = (angle: number, radius: number): number => {
    let passing = radius;
    let width = Math.max(radius * 1e-3, NEAREST_POINT_TOLERANCE);
    let failing = passing - width;
    while (failing > 0 && probePolar(angle, failing)) {
      passing = failing;
      width *= 2;
      failing = passing - width;
    }
    return bisectFirstPassing(
      (position) => probePolar(angle, position),
      Math.max(0, failing),
      passing,
      NEAREST_POINT_TOLERANCE,
    );
  };

  for (let sector = 0; sector < SECTORS; sector += 1) {
    const reach = seedDistance[sector];
    if (reach > nearestSeed + 3 / NEAREST_POINT_GRID) continue;
    const consider = (x: number, y: number): void => {
      const distance = Math.hypot(x - originX, y - originY);
      if (best === null || distance < best.distance) {
        best = { x, y, distance };
      }
    };
    let angle = Math.atan2(seedY[sector] - originY, seedX[sector] - originX);
    let radius = firstPassingBetween(
      (position) => probePolar(angle, position),
      0,
      reach,
      Math.max(1, Math.ceil(reach * NEAREST_POINT_GRID * 2)),
      NEAREST_POINT_TOLERANCE,
    );
    if (Number.isNaN(radius)) {
      // The seed passes only at its exact lattice coordinates; keep it as is.
      consider(seedX[sector], seedY[sector]);
      continue;
    }

    let step = MAX_ANGLE_STEP;
    for (
      let iteration = 0;
      iteration < MAX_REFINE_ITERATIONS &&
      step * radius > NEAREST_POINT_TOLERANCE;
      iteration += 1
    ) {
      let moved = false;
      for (const side of [step, -step]) {
        if (!probePolar(angle + side, radius)) continue;
        const pulled = pullInward(angle + side, radius);
        if (pulled < radius) {
          angle += side;
          radius = pulled;
          moved = true;
          break;
        }
      }
      step = moved ? Math.min(MAX_ANGLE_STEP, step * 2) : step / 2;
    }

    // Re-probe (same arguments as the accepted probe, so it passes) to read
    // back the snapped coordinates of the solution.
    if (probePolar(angle, radius)) consider(probeX, probeY);
  }
  return best;
}
