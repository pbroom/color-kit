import type { Color } from '../types.js';
import {
  LINEAR_P3_TO_LINEAR_SRGB,
  LMS_TO_LINEAR_P3,
  LMS_TO_LINEAR_SRGB,
  OKLAB_TO_LMS,
} from '../conversion/matrices.js';
import { inP3Gamut, inSrgbGamut } from '../gamut/index.js';
import { GAMUT_LINEAR_MAX, GAMUT_LINEAR_MIN } from '../gamut/linear-bounds.js';
import {
  incrementTraceSummary,
  limitTracePaths,
  recordTraceStage,
  setTraceSummaryField,
  type InternalPlaneTraceContext,
} from '../trace/context.js';
import { linearToSrgbChannel, simplifyPolyline } from '../utils/index.js';
import { apcaLuminanceOfEncoded, wcagLuminanceOfLinear } from './metrics.js';
import {
  CONTRAST_REGION_DEFAULTS,
  resolveContrastCriterion,
  resolveContrastSampling,
  toTracePaths,
} from './region-shared.js';
import type {
  ContrastRegionPathOptions,
  ContrastRegionPoint,
} from './types.js';

/*
 * Contrast-region solver.
 *
 * Both contrast metrics see a sample only through one displayed luminance
 * (WCAG relative luminance, APCA screen luminance), measured exactly as
 * `contrastRatio` / `contrastAPCA` measure it: target-gamut channels clipped
 * to [0, 1]. A sample passes on the dark side at or below one luminance and
 * on the light side at or above another, so each side of the region boundary
 * is one level curve of that luminance.
 *
 * The solver traces those curves in columns of fixed chroma-to-lightness
 * ratio: rays from black, `(l, c) = r (cos θ, sin θ)` at the query hue.
 * Along a ray every linear channel is `r³` times a constant, so:
 *
 * - the in-gamut part of a ray is `[0, R(θ)]`, where `R(θ)³` is the smallest
 *   ratio of a channel bound (`GAMUT_LINEAR_MIN` / `GAMUT_LINEAR_MAX`, the
 *   bounds behind `inSrgbGamut` / `inP3Gamut`) to that channel's constant;
 * - the displayed luminance never decreases along the in-gamut part, so each
 *   side crosses a ray at most once, found by a bracketed 1-D solve;
 * - a side's curve is visible exactly where the gamut-edge point of the ray
 *   is past its luminance target. That edge point is explicit, so the
 *   visibility function is cheap to evaluate and its sign changes (where a
 *   contour piece starts or ends on the gamut edge) are located on a fixed
 *   internal scan, independent of the caller's sampling options. The scan
 *   includes every angle where the edge changes shape (where two channel
 *   bounds meet, a channel's constant changes sign, or clipping starts),
 *   which are roots of cubics, and checks every local extremum near zero for
 *   a pair of crossings between scan points.
 *
 * Paths are graphs over θ: they never fold or close, so no branch matching
 * or topology repair is needed, and the solver cannot degrade.
 */

/** Fixed number of uniform scan intervals for gamut-edge events over θ. */
const EVENT_SCAN_STEPS = 256;
/**
 * Extra halvings allowed, beyond `maxDepth`, while a chord between two path
 * points leaves the gamut.
 */
const GAMUT_SPLIT_EXTRA_DEPTH = 8;
/** Iteration cap for every bracketed 1-D solve. */
const SOLVE_ITERATIONS = 100;
/** Width (radians) at which gamut-edge event solves stop. */
const ANGLE_TOLERANCE = 1e-14;
/**
 * Width, relative to the ray's in-gamut extent in `r³`, at which a path
 * point's solve stops (about 3e-13 in lightness and chroma).
 */
const POINT_TOLERANCE = 1e-12;
/**
 * Relative luminance margin kept between a returned point and the target,
 * and between a piece end and the gamut edge, so the public checks (which
 * reach the same numbers by a different rounding path) agree on every point.
 */
const AGREEMENT_MARGIN = 1e-12;
/**
 * Contrast margin (relative to the threshold, at least 1) kept at each
 * side's target luminance where the side allows it.
 */
const MARGIN_FLOOR = 1e-14;
/** Linear-light slack for chord gamut checks (rounding at chord ends). */
const CHORD_SLACK = 1e-16;
/** Inward nudges tried when a piece end fails a public check. */
const END_NUDGE_ATTEMPTS = 24;
const HALF_PI = Math.PI / 2;

/** Work counters, for benchmarks and tests. */
export interface ContrastSolverStats {
  /** Displayed-luminance evaluations. */
  luminance: number;
  /** Contrast-margin evaluations (side targets and piece-end checks). */
  contrast: number;
  /**
   * Contour pieces dropped because no candidate end point passed the public
   * checks (the trace reports it as `droppedPieceCount`).
   */
  droppedPieces: number;
}

type Rows = readonly (readonly number[])[];

interface Kernel {
  /** Target-gamut linear channels per unit `r³` along ray `theta`. */
  direction: (theta: number) => void;
  /** Output of `direction`. */
  readonly tau: Float64Array;
  /** `R(θ)³` for the last `direction` call: the ray's in-gamut extent. */
  edgeCubed: (theta: number) => number;
  /** Displayed luminance of `u` times the last direction. */
  luminanceAt: (u: number) => number;
  /**
   * Smallest gamut margin (linear light) anywhere on the straight chord
   * between two `(l, c)` points: each channel is a cubic along it, checked
   * at its ends and turning points.
   */
  chordMargin: (a: ContrastRegionPoint, b: ContrastRegionPoint) => number;
  /** Polynomials in `tan θ` / `cot θ` of the channel constants, per row. */
  polynomials: (half: 0 | 1) => number[][];
}

function clip(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function createKernel(
  hue: number,
  gamutRows: Rows,
  displayLuminance: (r: number, g: number, b: number) => number,
  maxChromaCubed: number,
  stats: ContrastSolverStats,
): Kernel {
  const radians = (hue * Math.PI) / 180;
  const cosHue = Math.cos(radians);
  const sinHue = Math.sin(radians);
  // Non-linear LMS of oklch(l c h) is l + c * k[j].
  const k = OKLAB_TO_LMS.map((row) => row[1] * cosHue + row[2] * sinHue);
  const tau = new Float64Array(3);
  let sinCubed = 0;
  const direction = (theta: number): void => {
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    sinCubed = sin * sin * sin;
    const x0 = (cos + k[0] * sin) ** 3;
    const x1 = (cos + k[1] * sin) ** 3;
    const x2 = (cos + k[2] * sin) ** 3;
    for (let m = 0; m < 3; m += 1) {
      const row = gamutRows[m];
      tau[m] = row[0] * x0 + row[1] * x1 + row[2] * x2;
    }
  };
  const edgeCubed = (theta: number): number => {
    direction(theta);
    let edge = Number.POSITIVE_INFINITY;
    for (let m = 0; m < 3; m += 1) {
      const value = tau[m];
      if (value > 0) edge = Math.min(edge, GAMUT_LINEAR_MAX / value);
      else if (value < 0) edge = Math.min(edge, GAMUT_LINEAR_MIN / value);
    }
    if (sinCubed > 0 && Number.isFinite(maxChromaCubed)) {
      edge = Math.min(edge, maxChromaCubed / sinCubed);
    }
    return edge;
  };
  const luminanceAt = (u: number): number => {
    stats.luminance += 1;
    return displayLuminance(u * tau[0], u * tau[1], u * tau[2]);
  };
  const chordMargin = (
    a: ContrastRegionPoint,
    b: ContrastRegionPoint,
  ): number => {
    // LMS' along the chord is p_j + q_j t; channel m is Σ row (p + q t)³.
    const coefficients = [0, 0, 0, 0];
    let margin = Number.POSITIVE_INFINITY;
    for (let m = 0; m < 3; m += 1) {
      coefficients.fill(0);
      for (let j = 0; j < 3; j += 1) {
        const p = a.l + a.c * k[j];
        const q = b.l - a.l + (b.c - a.c) * k[j];
        const w = gamutRows[m][j];
        coefficients[0] += w * p * p * p;
        coefficients[1] += w * 3 * p * p * q;
        coefficients[2] += w * 3 * p * q * q;
        coefficients[3] += w * q * q * q;
      }
      const [c0, c1, c2, c3] = coefficients;
      const at = (t: number) => c0 + t * (c1 + t * (c2 + t * c3));
      const ts = [0, 1];
      // Turning points: roots of c1 + 2 c2 t + 3 c3 t².
      const qa = 3 * c3;
      const qb = 2 * c2;
      if (qa !== 0) {
        const disc = qb * qb - 4 * qa * c1;
        if (disc >= 0) {
          const sq = Math.sqrt(disc);
          ts.push((-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa));
        }
      } else if (qb !== 0) {
        ts.push(-c1 / qb);
      }
      for (const t of ts) {
        if (!(t >= 0 && t <= 1)) continue;
        const value = at(t);
        margin = Math.min(
          margin,
          value - GAMUT_LINEAR_MIN,
          GAMUT_LINEAR_MAX - value,
        );
      }
    }
    return margin;
  };
  const polynomials = (half: 0 | 1): number[][] =>
    gamutRows.map((row) => {
      // half 0: Σ row[j] (1 + k x)³ with x = tan θ;
      // half 1: Σ row[j] (x + k)³ with x = cot θ. Coefficients low to high.
      const out = [0, 0, 0, 0];
      for (let j = 0; j < 3; j += 1) {
        const kj = k[j];
        const terms =
          half === 0
            ? [1, 3 * kj, 3 * kj * kj, kj * kj * kj]
            : [kj * kj * kj, 3 * kj * kj, 3 * kj, 1];
        for (let p = 0; p < 4; p += 1) out[p] += row[j] * terms[p];
      }
      return out;
    });
  return {
    direction,
    tau,
    edgeCubed,
    luminanceAt,
    chordMargin,
    polynomials,
  };
}

/**
 * Displayed luminance of target-gamut linear channels, measured as the
 * public metric measures it: channels clipped to [0, 1] in the target gamut,
 * then WCAG relative luminance or APCA screen luminance of the sRGB result.
 */
function createDisplayLuminance(
  gamut: 'srgb' | 'display-p3',
  metric: 'wcag' | 'apca',
): (r: number, g: number, b: number) => number {
  if (gamut === 'display-p3') {
    const [sr, sg, sb] = LINEAR_P3_TO_LINEAR_SRGB;
    return (r, g, b) => {
      const pr = clip(r);
      const pg = clip(g);
      const pb = clip(b);
      const lr = sr[0] * pr + sr[1] * pg + sr[2] * pb;
      const lg = sg[0] * pr + sg[1] * pg + sg[2] * pb;
      const lb = sb[0] * pr + sb[1] * pg + sb[2] * pb;
      return metric === 'apca'
        ? apcaLuminanceOfEncoded(
            linearToSrgbChannel(lr),
            linearToSrgbChannel(lg),
            linearToSrgbChannel(lb),
          )
        : wcagLuminanceOfLinear(lr, lg, lb);
    };
  }
  return metric === 'apca'
    ? (r, g, b) =>
        apcaLuminanceOfEncoded(
          linearToSrgbChannel(clip(r)),
          linearToSrgbChannel(clip(g)),
          linearToSrgbChannel(clip(b)),
        )
    : (r, g, b) => wcagLuminanceOfLinear(clip(r), clip(g), clip(b));
}

/**
 * Shrinks `[a, b]`, where `fn` is `>= 0` at exactly one end, around where
 * that changes (Illinois regula falsi with bisection fallback). Returns the
 * final end where `fn >= 0`.
 */
function solveNonNegativeEnd(
  fn: (x: number) => number,
  a: number,
  fa: number,
  b: number,
  fb: number,
  tolerance: number,
): number {
  const keepA = fa >= 0;
  let side = 0;
  for (
    let index = 0;
    index < SOLVE_ITERATIONS && Math.abs(b - a) > tolerance;
    index += 1
  ) {
    let x = index % 6 === 5 ? (a + b) / 2 : b - (fb * (b - a)) / (fb - fa);
    if (!(x > Math.min(a, b) && x < Math.max(a, b))) x = (a + b) / 2;
    if (x === a || x === b) break;
    const fx = fn(x);
    if (fx >= 0 === fa >= 0) {
      a = x;
      fa = fx;
      if (side === -1) fb /= 2;
      side = -1;
    } else {
      b = x;
      fb = fx;
      if (side === 1) fa /= 2;
      side = 1;
    }
  }
  // `a` only ever takes points of its own class, so it is the end to return
  // exactly when it started non-negative.
  return keepA ? a : b;
}

/**
 * Real roots in `[0, 1]` of the cubic `c0 + c1 x + c2 x² + c3 x³`, pushed to
 * `out`.
 */
function unitCubicRoots(
  c0: number,
  c1: number,
  c2: number,
  c3: number,
  out: number[],
): void {
  const scale = Math.max(
    Math.abs(c0),
    Math.abs(c1),
    Math.abs(c2),
    Math.abs(c3),
  );
  if (!(scale > 0) || !Number.isFinite(scale)) return;
  const p = (x: number) => c0 + x * (c1 + x * (c2 + x * c3));
  // Split [0, 1] at the derivative's roots so each piece is monotone.
  let cut1 = Number.NaN;
  let cut2 = Number.NaN;
  const a = 3 * c3;
  const b = 2 * c2;
  if (Math.abs(a) > scale * 1e-14) {
    const disc = b * b - 4 * a * c1;
    if (disc > 0) {
      const sq = Math.sqrt(disc);
      const q = -0.5 * (b + (b < 0 ? -sq : sq));
      cut1 = q / a;
      cut2 = q !== 0 ? c1 / q : Number.NaN;
    }
  } else if (Math.abs(b) > scale * 1e-14) {
    cut1 = -c1 / b;
  }
  if (cut2 < cut1) [cut1, cut2] = [cut2, cut1];
  let lo = 0;
  let flo = p(0);
  for (const hi of [cut1, cut2, 1]) {
    if (!(hi > lo && hi <= 1)) continue;
    const fhi = p(hi);
    if (flo === 0) out.push(lo);
    else if (flo > 0 !== fhi > 0 && fhi !== 0) {
      out.push(solveNonNegativeEnd(p, lo, flo, hi, fhi, 1e-15));
    }
    lo = hi;
    flo = fhi;
  }
  if (flo === 0) out.push(1);
}

/**
 * Angles in `[0, π/2]` where the gamut edge of a ray changes shape: a
 * channel constant changes sign, two channel bounds (or a bound and the
 * `maxChroma` cap) give the same extent, or a channel reaches 1 (where
 * clipping starts) on the edge. Every condition is a cubic in `tan θ` (or
 * `cot θ`), solved exactly.
 */
function edgeBreakpoints(kernel: Kernel, maxChromaCubed: number): number[] {
  const out: number[] = [];
  const bounds = [GAMUT_LINEAR_MIN, GAMUT_LINEAR_MAX];
  const roots: number[] = [];
  const capped = Number.isFinite(maxChromaCubed);
  for (const half of [0, 1] as const) {
    const poly = kernel.polynomials(half);
    // Roots of `x·τ_m - y·τ_n - z·sin³θ`, where sin³θ is x³ in tan θ and 1
    // in cot θ (after dividing out the common cos³θ / sin³θ).
    const solve = (m: number, x: number, n: number, y: number, z: number) => {
      const pm = poly[m];
      const pn = poly[n];
      unitCubicRoots(
        x * pm[0] - y * pn[0] - (half === 1 ? z : 0),
        x * pm[1] - y * pn[1],
        x * pm[2] - y * pn[2],
        x * pm[3] - y * pn[3] - (half === 0 ? z : 0),
        roots,
      );
    };
    for (let m = 0; m < 3; m += 1) {
      // Channel m's constant changes sign.
      solve(m, 1, m, 0, 0);
      for (let n = 0; n < 3; n += 1) {
        if (n === m) continue;
        // Bounds of m and n give the same extent: B_m τ_n = B_n τ_m.
        if (n > m) {
          for (const bm of bounds) {
            for (const bn of bounds) solve(n, bm, m, bn, 0);
          }
        }
        // Channel n reaches 1 on the edge of m's upper bound.
        solve(n, GAMUT_LINEAR_MAX, m, 1, 0);
      }
      if (capped) {
        // Bound of m meets the maxChroma cap, or channel m reaches 1 on it.
        for (const level of [GAMUT_LINEAR_MIN, GAMUT_LINEAR_MAX, 1]) {
          solve(m, maxChromaCubed, m, 0, level);
        }
      }
    }
    for (const x of roots) {
      out.push(half === 0 ? Math.atan(x) : HALF_PI - Math.atan(x));
    }
    roots.length = 0;
  }
  return out;
}

interface Piece {
  start: number;
  end: number;
}

interface Sample {
  theta: number;
  point: ContrastRegionPoint | null;
}

/**
 * Contour paths of a contrast region at a fixed hue. See
 * `contrastRegionPaths` for the public contract.
 */
export function solveContrastRegionPaths(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions,
  trace?: InternalPlaneTraceContext | null,
  stats: ContrastSolverStats = { luminance: 0, contrast: 0, droppedPieces: 0 },
): ContrastRegionPoint[][] {
  const criterion = resolveContrastCriterion(options);
  const sampling = resolveContrastSampling(options);
  const gamut = options.gamut ?? 'srgb';
  const maxChroma = options.maxChroma ?? CONTRAST_REGION_DEFAULTS.maxChroma;
  const alpha = options.alpha ?? 1;
  const simplifyTolerance = options.simplifyTolerance;

  setTraceSummaryField(trace, 'solver', 'contrast-rays');
  setTraceSummaryField(trace, 'samplingMode', 'adaptive');
  setTraceSummaryField(trace, 'fidelity', {
    simplifyTolerance,
    resolution: sampling.initialSamples,
    maxDepth: sampling.maxDepth,
    errorTolerance: sampling.errorTolerance,
  });
  recordTraceStage(trace, {
    kind: 'solver',
    solver: 'contrast-rays',
    samplingMode: 'adaptive',
  });

  const startLuminance = stats.luminance;
  const startContrast = stats.contrast;
  const startDropped = stats.droppedPieces;
  const paths: ContrastRegionPoint[][] = [];
  if (Number.isFinite(hue) && maxChroma > 0) {
    tracePaths(
      reference,
      hue,
      gamut,
      criterion,
      sampling,
      maxChroma,
      alpha,
      simplifyTolerance != null &&
        Number.isFinite(simplifyTolerance) &&
        simplifyTolerance > 0
        ? simplifyTolerance
        : 0,
      stats,
      paths,
    );
  }

  const result = paths.sort((a, b) => b.length - a.length);

  if (trace) {
    const evaluations =
      stats.luminance - startLuminance + stats.contrast - startContrast;
    const pointCount = result.reduce((total, path) => total + path.length, 0);
    incrementTraceSummary(trace, 'sampleCount', evaluations);
    incrementTraceSummary(trace, 'scalarEvaluationCount', evaluations);
    setTraceSummaryField(trace, 'pathCount', result.length);
    setTraceSummaryField(
      trace,
      'droppedPieceCount',
      stats.droppedPieces - startDropped,
    );
    setTraceSummaryField(trace, 'pointCount', pointCount);
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'contrast-region-paths',
      pathCount: result.length,
      pointCount,
      paths: limitTracePaths(trace, toTracePaths(result)),
    });
  }
  return result;
}

function tracePaths(
  reference: Color,
  hue: number,
  gamut: 'srgb' | 'display-p3',
  criterion: ReturnType<typeof resolveContrastCriterion>,
  sampling: ReturnType<typeof resolveContrastSampling>,
  maxChroma: number,
  alpha: number,
  simplifyTolerance: number,
  stats: ContrastSolverStats,
  paths: ContrastRegionPoint[][],
): void {
  // Measured unmapped, like the public checks: they clip an out-of-gamut
  // reference to the display gamut rather than chroma-reducing it.
  const maxChromaCubed = maxChroma ** 3;
  const displayLuminance = createDisplayLuminance(gamut, criterion.metric);
  const kernel = createKernel(
    hue,
    gamut === 'display-p3' ? LMS_TO_LINEAR_P3 : LMS_TO_LINEAR_SRGB,
    displayLuminance,
    maxChromaCubed,
    stats,
  );
  const inGamut = gamut === 'display-p3' ? inP3Gamut : inSrgbGamut;

  // Pass/fail is a function of the sample's displayed luminance only, and
  // never improves toward the reference's: each side passes up to (dark) or
  // from (light) one target luminance. Bisect for them with the public
  // metric's own arithmetic.
  const referenceY = criterion.luminance(reference);
  const marginAt = (y: number): number => {
    stats.contrast += 1;
    return criterion.evaluateLuminance(y, referenceY);
  };
  kernel.direction(0);
  const whiteY = kernel.luminanceAt(GAMUT_LINEAR_MAX);
  // Near black the metrics change by less than one ulp across wide
  // luminance ranges, so the public margin is not monotone at the ulp level
  // there. Targets keep a small margin (`MARGIN_FLOOR` times the threshold)
  // where the side allows it, and sit a hair inside the passing side in
  // luminance, so points on them pass the public check whatever rounding it
  // meets on the way.
  const floor = MARGIN_FLOOR * Math.max(1, criterion.threshold);
  /** The passing end of the luminance bisection from `pass` toward `fail`. */
  const bisect = (pass: number, fail: number): number => {
    const needed = marginAt(pass) >= floor ? floor : 0;
    for (let index = 0; index < 4 * SOLVE_ITERATIONS; index += 1) {
      const mid = (pass + fail) / 2;
      if (mid === pass || mid === fail) break;
      if (marginAt(mid) >= needed) pass = mid;
      else fail = mid;
    }
    return pass;
  };
  const sides: Array<{ dark: boolean; target: number }> = [];
  if (referenceY >= 0 && referenceY <= whiteY && marginAt(referenceY) < 0) {
    if (marginAt(0) >= 0) {
      const target = bisect(0, referenceY);
      sides.push({ dark: true, target: target * (1 - AGREEMENT_MARGIN) });
    }
    if (marginAt(whiteY) >= 0) {
      const target = bisect(whiteY, referenceY);
      const nudged = target * (1 + AGREEMENT_MARGIN);
      sides.push({
        dark: false,
        target: nudged < whiteY ? nudged : target,
      });
    }
  }
  if (sides.length === 0) return;

  const breakpoints = edgeBreakpoints(kernel, maxChromaCubed);
  const scan: number[] = [...breakpoints];
  for (let index = 0; index <= EVENT_SCAN_STEPS; index += 1) {
    scan.push((HALF_PI * index) / EVENT_SCAN_STEPS);
  }
  scan.sort((a, b) => a - b);
  const angles = scan.filter(
    (value, index) =>
      value >= 0 &&
      value <= HALF_PI &&
      (index === 0 || value > scan[index - 1]),
  );
  // Where the edge function has corners: breakpoints and the domain ends.
  const breakpointSet = new Set(breakpoints);
  const corners = angles.map(
    (theta, index) =>
      index === 0 || index === angles.length - 1 || breakpointSet.has(theta),
  );

  // Displayed luminance at each scanned ray's gamut edge (shared by both
  // sides), and the gamut's chroma extent at this hue (capped by
  // maxChroma), the scale `initialSamples` spreads over.
  const edgeLuminance = new Float64Array(angles.length);
  let chromaExtent = 0;
  angles.forEach((theta, index) => {
    const edge = kernel.edgeCubed(theta);
    if (Number.isFinite(edge)) {
      edgeLuminance[index] = kernel.luminanceAt(edge);
      chromaExtent = Math.max(chromaExtent, Math.cbrt(edge) * Math.sin(theta));
    } else {
      edgeLuminance[index] = Number.NaN;
    }
  });
  if (!(chromaExtent > 0)) chromaExtent = CONTRAST_REGION_DEFAULTS.maxChroma;

  for (const { dark, target } of sides) {
    // Visible where the ray's gamut-edge point is past the target, by a
    // small margin so piece ends are robustly inside the gamut.
    const margin = AGREEMENT_MARGIN * target;
    const visibility = (theta: number): number => {
      const edge = kernel.edgeCubed(theta);
      if (!Number.isFinite(edge)) return -1;
      return kernel.luminanceAt(edge) - target - margin;
    };
    const pieces = findPieces(
      angles,
      corners,
      Array.from(edgeLuminance, (luminance) =>
        Number.isNaN(luminance) ? -1 : luminance - target - margin,
      ),
      visibility,
    );
    if (pieces.length === 0) {
      // A side whose target is the extreme luminance (a threshold equal to
      // the contrast against white or black) passes only at that extreme:
      // white or black itself, returned as a one-point path.
      const extreme = dark
        ? target <= 0
        : target * (1 + 2 * AGREEMENT_MARGIN) >= whiteY;
      const point = { l: dark ? 0 : 1, c: 0 };
      const color = { ...point, h: hue, alpha };
      if (
        extreme &&
        inGamut(color) &&
        criterion.evaluate(color, reference) >= 0
      ) {
        paths.push([point]);
      }
      continue;
    }

    /** Path point on ray `theta`, or null when the ray has none. */
    const pointAt = (theta: number): ContrastRegionPoint | null => {
      const edge = kernel.edgeCubed(theta);
      if (!Number.isFinite(edge) || !(edge > 0)) return null;
      const offset = (u: number) => kernel.luminanceAt(u) - target;
      const atEdge = offset(edge);
      // Black's displayed luminance is 0.
      const atBlack = -target;
      if (
        dark ? !(atEdge > 0) || atBlack > 0 : !(atEdge >= 0) || atBlack >= 0
      ) {
        return null;
      }
      // Dark side passes at or below the target, light side at or above.
      const u = dark
        ? solveNonNegativeEnd(
            (x) => -offset(x),
            0,
            -atBlack,
            edge,
            -atEdge,
            edge * POINT_TOLERANCE,
          )
        : solveNonNegativeEnd(
            offset,
            edge,
            atEdge,
            0,
            atBlack,
            edge * POINT_TOLERANCE,
          );
      const r = Math.cbrt(u);
      return { l: r * Math.cos(theta), c: r * Math.sin(theta) };
    };
    // Chords may graze a gamut edge their end points sit on by rounding.
    const chordInGamut = (
      a: ContrastRegionPoint,
      b: ContrastRegionPoint,
    ): boolean => kernel.chordMargin(a, b) >= -CHORD_SLACK;
    /**
     * The same exact check for a simplified chord, which may not leave the
     * gamut by more than its own end points (path points, on the gamut edge
     * up to rounding) already do; checking `chordInGamut` alone would keep
     * every point next to an end that rounds a hair outside.
     */
    const simplifiedChordInGamut = (
      a: ContrastRegionPoint,
      b: ContrastRegionPoint,
    ): boolean =>
      kernel.chordMargin(a, b) >=
      Math.min(0, kernel.chordMargin(a, a), kernel.chordMargin(b, b)) -
        CHORD_SLACK;
    /**
     * The point at a piece end, checked with the public checks. They reach
     * it by a different rounding path, so if they reject it the end moves
     * inward, by steps growing from 1e-13 up to `limit` radians; `point` is
     * null if no candidate passes.
     */
    const endPoint = (theta: number, inward: number, limit: number): Sample => {
      let step = 0;
      for (let attempt = 0; attempt < END_NUDGE_ATTEMPTS; attempt += 1) {
        const current = theta + inward * Math.min(step, limit);
        const point = pointAt(current);
        if (point) {
          stats.contrast += 1;
          const color = { l: point.l, c: point.c, h: hue, alpha };
          if (inGamut(color) && criterion.evaluate(color, reference) >= 0) {
            return { theta: current, point };
          }
        }
        if (step >= limit) break;
        step = step === 0 ? 1e-13 : step * 4;
      }
      return { theta, point: null };
    };

    for (const piece of pieces) {
      const half = (piece.end - piece.start) / 2;
      const first = endPoint(piece.start, 1, half);
      const last = endPoint(piece.end, -1, half);
      if (!first.point || !last.point || !(last.theta > first.theta)) {
        stats.droppedPieces += 1;
        continue;
      }
      // Initial samples: `initialSamples` per gamut chroma extent of this
      // hue along the piece, or per quarter turn of ray angle it sweeps
      // (short pieces near black can turn a lot), whichever is more.
      const center = pointAt((first.theta + last.theta) / 2);
      const length = center
        ? distance(first.point, center) + distance(center, last.point)
        : distance(first.point, last.point);
      const intervals = Math.max(
        1,
        Math.min(
          4 * sampling.initialSamples,
          Math.ceil(
            Math.max(
              length / chromaExtent,
              (last.theta - first.theta) / HALF_PI,
            ) * sampling.initialSamples,
          ),
        ),
      );
      const samples: Array<{ theta: number; point: ContrastRegionPoint }> = [
        { theta: first.theta, point: first.point },
      ];
      for (let index = 1; index < intervals; index += 1) {
        const theta =
          first.theta + ((last.theta - first.theta) * index) / intervals;
        const point = pointAt(theta);
        if (point) samples.push({ theta, point });
      }
      samples.push({ theta: last.theta, point: last.point });

      const path: ContrastRegionPoint[] = [samples[0].point];
      const refine = (
        left: { theta: number; point: ContrastRegionPoint },
        right: { theta: number; point: ContrastRegionPoint },
        depth: number,
      ): void => {
        const theta = (left.theta + right.theta) / 2;
        const mid =
          theta > left.theta && theta < right.theta ? pointAt(theta) : null;
        if (!mid) {
          path.push(right.point);
          return;
        }
        // Split while the curve is too far from its chord, and (a little
        // deeper) while either half chord leaves the gamut.
        const split =
          (depth < sampling.maxDepth &&
            chordDeviation(left.point, mid, right.point) >
              sampling.errorTolerance) ||
          (depth < sampling.maxDepth + GAMUT_SPLIT_EXTRA_DEPTH &&
            (!chordInGamut(left.point, mid) ||
              !chordInGamut(mid, right.point)));
        if (split) {
          const middle = { theta, point: mid };
          refine(left, middle, depth + 1);
          refine(middle, right, depth + 1);
          return;
        }
        path.push(mid, right.point);
      };
      for (let index = 1; index < samples.length; index += 1) {
        refine(samples[index - 1], samples[index], 0);
      }
      const finished = finishPath(path);
      if (finished.length > 1) {
        // Simplification keeps the segment guarantee: a span collapses to
        // one chord only when that chord passes the exact gamut check.
        paths.push(
          simplifyTolerance > 0
            ? simplifyPolyline(
                finished,
                simplifyTolerance,
                false,
                simplifiedChordInGamut,
              )
            : finished,
        );
      }
    }
  }
}

/**
 * Maximal runs of angles where `visibility >= 0` (`scanned` holds its values
 * at `angles`; `corners` marks where it may have a corner), with ends solved
 * to `ANGLE_TOLERANCE`. Between scan points, every extremum of `visibility`
 * that turns toward zero (shown by the samples, or by one-sided slopes next
 * to a corner) is searched for a sign change, so a run (or a gap) that starts
 * and ends between two scan points is still found.
 */
function findPieces(
  angles: number[],
  corners: boolean[],
  scanned: number[],
  visibility: (theta: number) => number,
): Piece[] {
  const thetas = angles.slice();
  const values = scanned;
  // Extremum search: insert the extremum of each local min/max that might
  // cross zero.
  const extra: Array<[number, number]> = [];
  const search = (a: number, b: number, positive: boolean): void => {
    const found = extremum(visibility, a, b, positive);
    if (found && found[1] >= 0 !== positive) extra.push(found);
  };
  // Next to a corner the samples need not show a turn (the edge can switch
  // binding channel and back within one scan step, a notch), so test the
  // one-sided slopes at both ends of every interval that touches one.
  for (let index = 0; index + 1 < thetas.length; index += 1) {
    if (!corners[index] && !corners[index + 1]) continue;
    const a = thetas[index];
    const b = thetas[index + 1];
    const positive = values[index] >= 0;
    if (values[index + 1] >= 0 !== positive || !(b - a > 1e-12)) continue;
    const step = (b - a) * 1e-4;
    const leaving = visibility(a + step) - values[index];
    const arriving = values[index + 1] - visibility(b - step);
    if (positive ? leaving < 0 && arriving > 0 : leaving > 0 && arriving < 0) {
      search(a, b, positive);
    }
  }
  for (let index = 1; index < thetas.length - 1; index += 1) {
    const left = values[index - 1];
    const mid = values[index];
    const right = values[index + 1];
    const positive = mid >= 0;
    if (left >= 0 !== positive || right >= 0 !== positive) continue;
    // Local extremum toward zero: a min of positive values or a max of
    // negative ones.
    const towardZero = positive
      ? mid <= left && mid <= right
      : mid >= left && mid >= right;
    if (!towardZero) continue;
    const spread = Math.max(Math.abs(left - mid), Math.abs(right - mid));
    if (Math.abs(mid) > 8 * spread) continue;
    search(thetas[index - 1], thetas[index + 1], positive);
  }
  if (extra.length) {
    for (const [theta, value] of extra) {
      thetas.push(theta);
      values.push(value);
    }
    const order = thetas.map((_, index) => index);
    order.sort((a, b) => thetas[a] - thetas[b]);
    const sortedThetas = order.map((index) => thetas[index]);
    const sortedValues = order.map((index) => values[index]);
    thetas.splice(0, thetas.length, ...sortedThetas);
    values.splice(0, values.length, ...sortedValues);
  }
  const pieces: Piece[] = [];
  let start = values[0] >= 0 ? thetas[0] : Number.NaN;
  for (let index = 1; index < thetas.length; index += 1) {
    const was = values[index - 1] >= 0;
    const is = values[index] >= 0;
    if (was === is) continue;
    const edge = solveNonNegativeEnd(
      visibility,
      thetas[index - 1],
      values[index - 1],
      thetas[index],
      values[index],
      ANGLE_TOLERANCE,
    );
    if (is) {
      start = edge;
    } else {
      pieces.push({ start, end: edge });
      start = Number.NaN;
    }
  }
  if (!Number.isNaN(start)) {
    pieces.push({ start, end: thetas[thetas.length - 1] });
  }
  return pieces;
}

/**
 * Golden-section search on `[a, b]` for the minimum (`minimize`) or maximum
 * of `fn`, stopping early once it crosses zero. Returns `[x, fn(x)]`.
 */
function extremum(
  fn: (x: number) => number,
  a: number,
  b: number,
  minimize: boolean,
): [number, number] | null {
  const ratio = (Math.sqrt(5) - 1) / 2;
  const sign = minimize ? 1 : -1;
  let x1 = b - ratio * (b - a);
  let x2 = a + ratio * (b - a);
  let f1 = fn(x1);
  let f2 = fn(x2);
  for (let index = 0; index < 60 && b - a > ANGLE_TOLERANCE; index += 1) {
    if (f1 >= 0 !== minimize) return [x1, f1];
    if (f2 >= 0 !== minimize) return [x2, f2];
    if (sign * f1 < sign * f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = b - ratio * (b - a);
      f1 = fn(x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = a + ratio * (b - a);
      f2 = fn(x2);
    }
  }
  return sign * f1 < sign * f2 ? [x1, f1] : [x2, f2];
}

function distance(a: ContrastRegionPoint, b: ContrastRegionPoint): number {
  return Math.hypot(a.l - b.l, a.c - b.c);
}

/** Distance from `mid` to the chord `left`-`right` in the l/c plane. */
function chordDeviation(
  left: ContrastRegionPoint,
  mid: ContrastRegionPoint,
  right: ContrastRegionPoint,
): number {
  const dl = right.l - left.l;
  const dc = right.c - left.c;
  const length = Math.hypot(dl, dc);
  if (length === 0) return Math.hypot(mid.l - left.l, mid.c - left.c);
  return Math.abs(dl * (mid.c - left.c) - dc * (mid.l - left.l)) / length;
}

/** Drops repeated points and orients the path from its lower-l end. */
function finishPath(path: ContrastRegionPoint[]): ContrastRegionPoint[] {
  const out = [path[0]];
  for (const point of path) {
    const prev = out[out.length - 1];
    if (prev.l !== point.l || prev.c !== point.c) out.push(point);
  }
  return out[out.length - 1].l < out[0].l ? out.reverse() : out;
}
