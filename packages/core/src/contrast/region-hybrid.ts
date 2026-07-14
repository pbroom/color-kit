import type { Color } from '../types.js';
import { maxChromaAt, maxChromaForHue } from '../gamut/index.js';
import {
  incrementTraceSummary,
  limitTraceEntries,
  limitTracePaths,
  recordTraceStage,
  setTraceSummaryField,
  shouldTraceFull,
  type InternalPlaneTraceContext,
} from '../plane/trace.js';
import { buildAxisAnchors } from '../sampling/adaptive1d.js';
import { simplifyPolyline } from '../utils/index.js';
import {
  ADAPTIVE_EDGE_PROBES,
  mapToGamut,
  resolveContrastCriterion,
  toTracePaths,
} from './region-shared.js';
import type {
  ContrastRegionPathOptions,
  ContrastRegionPoint,
} from './types.js';

const DEFAULT_HYBRID_MAX_DEPTH = 7;
const DEFAULT_HYBRID_ERROR_TOLERANCE = 0.0015;
const DEFAULT_HYBRID_ROOT_ITERATIONS = 28;
const DEFAULT_HYBRID_LIGHTNESS_STEPS = 72;
const DEFAULT_HYBRID_CHROMA_BRACKETS = 96;
const HYBRID_LIGHTNESS_EPSILON = 1e-6;
const HYBRID_ROOT_EPSILON = 1e-7;
const HYBRID_BRANCH_JOIN_EPSILON = 0.06;

/**
 * Reasons the hybrid solver declines to produce a result and asks the
 * router to fall back to the legacy adaptive solver.
 */
export type ContrastHybridFallbackReason =
  /** More simultaneous chroma roots than the branch tracker can join reliably. */
  | 'complex-topology'
  /** Roots were found but no branch could be reconstructed into a path. */
  | 'branch-reconstruction-empty'
  /** No roots traced, yet probing detected a sign change in the field. */
  | 'unresolved-sign-change';

/**
 * Explicit solver outcome: either usable paths or a fallback request with
 * a reason, replacing the previous silent `null` control flow.
 */
export type ContrastSolverOutcome =
  | { status: 'ok'; paths: ContrastRegionPoint[][] }
  | { status: 'fallback'; fallbackReason: ContrastHybridFallbackReason };

interface HybridLightnessSample {
  l: number;
  cMax: number;
  roots: number[];
}

function bisectHybridRoot(
  evaluate: (chroma: number) => number,
  loStart: number,
  hiStart: number,
  vLoStart: number,
  vHiStart: number,
  trace?: InternalPlaneTraceContext | null,
  lightness?: number,
): number {
  let lo = loStart;
  let hi = hiStart;
  let vLo = vLoStart;
  let vHi = vHiStart;
  const iterations: Array<{
    lo: number;
    hi: number;
    mid: number;
    value: number;
  }> = [];
  const finish = (root: number): number => {
    recordTraceStage(trace, {
      kind: 'rootBisection',
      lightness: lightness ?? 0,
      loStart,
      hiStart,
      valueLoStart: vLoStart,
      valueHiStart: vHiStart,
      root,
      iterations: shouldTraceFull(trace)
        ? limitTraceEntries(trace, iterations)
        : undefined,
    });
    return root;
  };
  for (let index = 0; index < DEFAULT_HYBRID_ROOT_ITERATIONS; index += 1) {
    const mid = (lo + hi) / 2;
    const vMid = evaluate(mid);
    if (shouldTraceFull(trace)) {
      iterations.push({
        lo,
        hi,
        mid,
        value: vMid,
      });
    }
    if (
      Math.abs(vMid) <= HYBRID_ROOT_EPSILON ||
      hi - lo <= HYBRID_ROOT_EPSILON
    ) {
      return finish(mid);
    }
    if ((vLo < 0 && vMid > 0) || (vLo > 0 && vMid < 0)) {
      hi = mid;
      vHi = vMid;
    } else {
      lo = mid;
      vLo = vMid;
    }
    if (Math.abs(vLo) <= HYBRID_ROOT_EPSILON) return finish(lo);
    if (Math.abs(vHi) <= HYBRID_ROOT_EPSILON) return finish(hi);
  }
  return finish((lo + hi) / 2);
}

function dedupeSortedRoots(values: number[]): number[] {
  if (values.length === 0) return values;
  const sorted = values.slice().sort((a, b) => a - b);
  const deduped: number[] = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    if (Math.abs(sorted[index] - deduped[deduped.length - 1]) > 2e-5) {
      deduped.push(sorted[index]);
    }
  }
  return deduped;
}

function dedupeSequentialPath(
  path: ContrastRegionPoint[],
): ContrastRegionPoint[] {
  if (path.length < 2) return path;
  const next = [path[0]];
  for (let index = 1; index < path.length; index += 1) {
    const prev = next[next.length - 1];
    const point = path[index];
    if (
      Math.abs(prev.l - point.l) <= 1e-7 &&
      Math.abs(prev.c - point.c) <= 1e-7
    ) {
      continue;
    }
    next.push(point);
  }
  return next;
}

function hybridLightnessKey(lightness: number): string {
  return lightness.toFixed(8);
}

function buildHybridLightnessAnchors(
  targetSteps: number,
  cuspLightness: number,
): number[] {
  return buildAxisAnchors({
    min: 0,
    max: 1,
    epsilon: HYBRID_LIGHTNESS_EPSILON,
    extraAnchors: [cuspLightness],
    edgeProbes: ADAPTIVE_EDGE_PROBES,
    uniformSteps: targetSteps,
  });
}

export function contrastRegionPathsHybrid(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions,
  trace?: InternalPlaneTraceContext | null,
): ContrastSolverOutcome {
  const criterion = resolveContrastCriterion(options);
  const maxChroma = Math.max(0, options.maxChroma ?? 0.4);
  if (maxChroma <= 0) return { status: 'ok', paths: [] };
  const alpha = options.alpha ?? 1;
  const gamut = options.gamut ?? 'srgb';
  const mappedReference = mapToGamut(reference, gamut);
  const maxDepth = Math.max(
    0,
    Math.min(
      10,
      Number.isInteger(options.hybridMaxDepth) && options.hybridMaxDepth! >= 0
        ? options.hybridMaxDepth!
        : DEFAULT_HYBRID_MAX_DEPTH,
    ),
  );
  const errorTolerance =
    Number.isFinite(options.hybridErrorTolerance) &&
    options.hybridErrorTolerance! > 0
      ? options.hybridErrorTolerance!
      : DEFAULT_HYBRID_ERROR_TOLERANCE;
  const initialLightnessSteps = Math.max(
    12,
    Math.min(
      320,
      Number.isInteger(options.lightnessSteps) && options.lightnessSteps! > 0
        ? options.lightnessSteps!
        : DEFAULT_HYBRID_LIGHTNESS_STEPS,
    ),
  );
  const chromaBrackets = Math.max(
    16,
    Math.min(
      768,
      Number.isInteger(options.chromaSteps) && options.chromaSteps! > 0
        ? options.chromaSteps!
        : DEFAULT_HYBRID_CHROMA_BRACKETS,
    ),
  );
  setTraceSummaryField(trace, 'solver', 'contrast-hybrid');
  setTraceSummaryField(trace, 'samplingMode', 'hybrid');
  setTraceSummaryField(trace, 'fidelity', {
    simplifyTolerance: options.simplifyTolerance,
    resolution: initialLightnessSteps,
    maxDepth,
    errorTolerance,
  });
  recordTraceStage(trace, {
    kind: 'solver',
    solver: 'contrast-hybrid',
    samplingMode: 'hybrid',
  });
  const maxChromaAtOptions = {
    gamut,
    tolerance: options.tolerance,
    maxIterations: options.maxIterations,
    maxChroma,
    alpha,
  };
  const maxChromaCache = new Map<string, number>();
  const getMaxInGamut = (lightness: number): number => {
    const normalized = Math.max(0, Math.min(1, lightness));
    const key = hybridLightnessKey(normalized);
    const cached = maxChromaCache.get(key);
    if (typeof cached === 'number') {
      return cached;
    }
    const resolved = Math.max(
      0,
      Math.min(maxChroma, maxChromaAt(normalized, hue, maxChromaAtOptions)),
    );
    maxChromaCache.set(key, resolved);
    return resolved;
  };
  const evaluateAt = (lightness: number, chroma: number): number => {
    incrementTraceSummary(trace, 'sampleCount', 1);
    incrementTraceSummary(trace, 'scalarEvaluationCount', 1);
    const sample: Color = {
      l: lightness,
      c: chroma,
      h: hue,
      alpha,
    };
    const mappedSample = mapToGamut(sample, gamut);
    return criterion.evaluate(mappedSample, mappedReference);
  };
  const hasComplexTopology = { value: false };
  const findRootsAtLightness = (lightness: number, cMax: number): number[] => {
    if (cMax <= HYBRID_ROOT_EPSILON) return [];
    const evaluateChroma = (chroma: number) => evaluateAt(lightness, chroma);
    const stepCount = Math.max(8, chromaBrackets);
    const roots: number[] = [];
    let prevC = 0;
    let prevV = evaluateChroma(0);
    if (Math.abs(prevV) <= HYBRID_ROOT_EPSILON) {
      roots.push(0);
    }
    for (let index = 1; index <= stepCount; index += 1) {
      const c = (index / stepCount) * cMax;
      const v = evaluateChroma(c);
      if (Math.abs(v) <= HYBRID_ROOT_EPSILON) {
        roots.push(c);
      }
      if ((prevV < 0 && v > 0) || (prevV > 0 && v < 0)) {
        roots.push(
          bisectHybridRoot(
            evaluateChroma,
            prevC,
            c,
            prevV,
            v,
            trace,
            lightness,
          ),
        );
      }
      prevC = c;
      prevV = v;
    }
    const deduped = dedupeSortedRoots(roots);
    if (deduped.length > 6) {
      hasComplexTopology.value = true;
    }
    return deduped;
  };
  const lightnessSampleCache = new Map<string, HybridLightnessSample>();
  const getLightnessSample = (lightness: number): HybridLightnessSample => {
    const normalized = Math.max(0, Math.min(1, lightness));
    const key = hybridLightnessKey(normalized);
    const cached = lightnessSampleCache.get(key);
    if (cached) {
      return cached;
    }
    const cMax = getMaxInGamut(normalized);
    const roots = findRootsAtLightness(normalized, cMax);
    const sample = {
      l: normalized,
      cMax,
      roots,
    };
    lightnessSampleCache.set(key, sample);
    return sample;
  };

  const cusp = maxChromaForHue(hue, {
    gamut,
    method: 'direct',
  });
  recordTraceStage(trace, {
    kind: 'cusp',
    hue,
    lightness: cusp.l,
    chroma: cusp.c,
    gamut,
    method: 'direct',
  });
  const anchors = buildHybridLightnessAnchors(initialLightnessSteps, cusp.l);
  const seedSamples = anchors.map((anchor) => getLightnessSample(anchor));
  recordTraceStage(trace, {
    kind: 'hybridSamples',
    label: 'seed',
    samples:
      limitTraceEntries(
        trace,
        seedSamples.map((sample) => ({
          lightness: sample.l,
          maxChroma: sample.cMax,
          roots: sample.roots.slice(),
        })),
      ) ?? [],
  });

  const shouldSplitHybridInterval = (
    left: HybridLightnessSample,
    right: HybridLightnessSample,
    midpoint: HybridLightnessSample,
    depth: number,
  ): boolean => {
    if (depth >= maxDepth) {
      return false;
    }
    if (Math.abs(right.l - left.l) <= HYBRID_LIGHTNESS_EPSILON * 2) {
      return false;
    }
    if (
      left.roots.length !== right.roots.length ||
      left.roots.length !== midpoint.roots.length
    ) {
      return true;
    }
    const expectedCMid = (left.cMax + right.cMax) / 2;
    if (Math.abs(midpoint.cMax - expectedCMid) > errorTolerance * 4) {
      return true;
    }
    for (let index = 0; index < midpoint.roots.length; index += 1) {
      const expectedRoot = (left.roots[index] + right.roots[index]) / 2;
      if (Math.abs(midpoint.roots[index] - expectedRoot) > errorTolerance) {
        return true;
      }
    }
    return false;
  };

  const refinedSamples: HybridLightnessSample[] = [seedSamples[0]];
  const refinementDecisions: Array<{
    left: number;
    right: number;
    midpoint: number;
    depth: number;
    split: boolean;
  }> = [];
  const refineInterval = (
    left: HybridLightnessSample,
    right: HybridLightnessSample,
    depth: number,
  ): void => {
    const midLightness = (left.l + right.l) / 2;
    const midpoint = getLightnessSample(midLightness);
    const shouldSplit = shouldSplitHybridInterval(left, right, midpoint, depth);
    if (shouldTraceFull(trace)) {
      refinementDecisions.push({
        left: left.l,
        right: right.l,
        midpoint: midpoint.l,
        depth,
        split: shouldSplit,
      });
    }
    if (shouldSplit) {
      refineInterval(left, midpoint, depth + 1);
      refineInterval(midpoint, right, depth + 1);
      return;
    }
    refinedSamples.push(right);
  };
  for (let index = 0; index < seedSamples.length - 1; index += 1) {
    refineInterval(seedSamples[index], seedSamples[index + 1], 0);
  }
  recordTraceStage(trace, {
    kind: 'refinement',
    decisions: limitTraceEntries(trace, refinementDecisions) ?? [],
  });
  recordTraceStage(trace, {
    kind: 'hybridSamples',
    label: 'refined',
    samples:
      limitTraceEntries(
        trace,
        refinedSamples.map((sample) => ({
          lightness: sample.l,
          maxChroma: sample.cMax,
          roots: sample.roots.slice(),
        })),
      ) ?? [],
  });

  interface HybridBranch {
    points: ContrastRegionPoint[];
    lastC: number;
  }

  const finishedPaths: ContrastRegionPoint[][] = [];
  let activeBranches: HybridBranch[] = [];
  const matchThreshold = Math.max(
    HYBRID_BRANCH_JOIN_EPSILON,
    errorTolerance * 10,
  );

  for (
    let sampleIndex = 0;
    sampleIndex < refinedSamples.length;
    sampleIndex += 1
  ) {
    const sample = refinedSamples[sampleIndex];
    const rootPoints = sample.roots.map((chroma) => ({
      l: sample.l,
      c: chroma,
    }));
    if (sampleIndex === 0) {
      activeBranches = rootPoints.map((point) => ({
        points: [point],
        lastC: point.c,
      }));
      continue;
    }

    const usedRoots = new Set<number>();
    const nextActive: HybridBranch[] = [];
    const sortedBranches = activeBranches
      .slice()
      .sort((a, b) => a.lastC - b.lastC);

    for (const branch of sortedBranches) {
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let rootIndex = 0; rootIndex < rootPoints.length; rootIndex += 1) {
        if (usedRoots.has(rootIndex)) continue;
        const distance = Math.abs(rootPoints[rootIndex].c - branch.lastC);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = rootIndex;
        }
      }

      if (bestIndex >= 0 && bestDistance <= matchThreshold) {
        const nextPoint = rootPoints[bestIndex];
        usedRoots.add(bestIndex);
        branch.points.push(nextPoint);
        branch.lastC = nextPoint.c;
        nextActive.push(branch);
      } else if (branch.points.length > 1) {
        finishedPaths.push(branch.points);
      }
    }

    for (let rootIndex = 0; rootIndex < rootPoints.length; rootIndex += 1) {
      if (usedRoots.has(rootIndex)) continue;
      const point = rootPoints[rootIndex];
      nextActive.push({
        points: [point],
        lastC: point.c,
      });
    }

    activeBranches = nextActive;
  }

  for (const branch of activeBranches) {
    if (branch.points.length > 1) {
      finishedPaths.push(branch.points);
    }
  }

  const cleaned = finishedPaths
    .map((path) => dedupeSequentialPath(path))
    .filter((path) => path.length > 1)
    .filter((path) =>
      path.every(
        (point) =>
          Number.isFinite(point.l) &&
          Number.isFinite(point.c) &&
          point.l >= -1e-6 &&
          point.l <= 1 + 1e-6 &&
          point.c >= -1e-6 &&
          point.c <= maxChroma + 1e-6,
      ),
    );

  recordTraceStage(trace, {
    kind: 'branching',
    activeCount: activeBranches.length,
    finishedCount: finishedPaths.length,
    pathCount: cleaned.length,
    hasComplexTopology: hasComplexTopology.value,
    paths: limitTracePaths(trace, toTracePaths(cleaned)),
  });

  if (hasComplexTopology.value) {
    return { status: 'fallback', fallbackReason: 'complex-topology' };
  }

  const hasRoots = refinedSamples.some((sample) => sample.roots.length > 0);
  if (hasRoots && cleaned.length === 0) {
    return {
      status: 'fallback',
      fallbackReason: 'branch-reconstruction-empty',
    };
  }
  if (!hasRoots && cleaned.length === 0) {
    let minScore = Number.POSITIVE_INFINITY;
    let maxScore = Number.NEGATIVE_INFINITY;
    for (const sample of refinedSamples) {
      const probeChroma = [0, sample.cMax * 0.5, sample.cMax];
      for (const c of probeChroma) {
        const score = evaluateAt(sample.l, c);
        minScore = Math.min(minScore, score);
        maxScore = Math.max(maxScore, score);
      }
    }
    if (minScore < 0 && maxScore > 0) {
      return { status: 'fallback', fallbackReason: 'unresolved-sign-change' };
    }
  }

  const simplifyTolerance = options.simplifyTolerance;
  const maybeSimplified =
    simplifyTolerance != null &&
    Number.isFinite(simplifyTolerance) &&
    simplifyTolerance > 0
      ? cleaned.map((path) => simplifyPolyline(path, simplifyTolerance, false))
      : cleaned;

  setTraceSummaryField(trace, 'pathCount', maybeSimplified.length);
  setTraceSummaryField(
    trace,
    'pointCount',
    maybeSimplified.reduce((total, path) => total + path.length, 0),
  );
  recordTraceStage(trace, {
    kind: 'paths',
    label: 'contrast-hybrid-paths',
    pathCount: maybeSimplified.length,
    pointCount: maybeSimplified.reduce((total, path) => total + path.length, 0),
    paths: limitTracePaths(trace, toTracePaths(maybeSimplified)),
  });

  return {
    status: 'ok',
    paths: maybeSimplified.sort((a, b) => b.length - a.length),
  };
}
