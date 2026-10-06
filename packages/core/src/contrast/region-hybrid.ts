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
} from '../trace/context.js';
import { buildAxisAnchors } from '../sampling/adaptive1d.js';
import { simplifyPolyline } from '../utils/index.js';
import {
  ADAPTIVE_EDGE_PROBES,
  mapToGamut,
  resolveContrastCriterion,
  toTracePaths,
} from './region-shared.js';
import type {
  ContrastHybridDegradedReason,
  ContrastRegionHybridOptions,
  ContrastRegionPoint,
} from './types.js';

const DEFAULT_HYBRID_MAX_DEPTH = 7;
const DEFAULT_HYBRID_ERROR_TOLERANCE = 0.0015;
const DEFAULT_HYBRID_ROOT_ITERATIONS = 28;
const DEFAULT_HYBRID_LIGHTNESS_STEPS = 72;
const DEFAULT_HYBRID_CHROMA_BRACKETS = 96;
const HYBRID_LIGHTNESS_EPSILON = 1e-6;
const HYBRID_ROOT_EPSILON = 1e-7;
/**
 * Cost of leaving a strip crossing unmatched. Larger than any matching
 * distance in the l/c plane, so crossings stay unmatched only when root
 * parity is broken (for example two roots merged by deduplication).
 */
const HYBRID_UNMATCHED_COST = 10;

interface HybridLightnessSample {
  l: number;
  cMax: number;
  roots: number[];
  /** Sign of the contrast margin at chroma 0 (-1, 0, or 1). */
  zeroSign: number;
  /** Sign of the contrast margin at the gamut edge `cMax` (-1, 0, or 1). */
  topSign: number;
}

/**
 * Extra bisection depth allowed, beyond `hybridMaxDepth`, to locate a
 * contour that crosses between two lightness samples without producing a
 * chroma root at either (a near-vertical boundary in the l/c plane).
 */
const HYBRID_CROSSING_EXTRA_DEPTH = 10;
/**
 * Extra bisection depth allowed to localize where a contour branch ends
 * between two lightness samples, so a branch is not reduced to one point.
 */
const HYBRID_ENDPOINT_EXTRA_DEPTH = 2;
/**
 * Chroma distance between index-matched roots of neighbouring lightness
 * samples above which an interval keeps splitting, so a contour with
 * nearly constant lightness is not drawn as one long chord.
 */
const HYBRID_ROOT_JUMP = 0.03;

function hasHybridRootJump(left: number[], right: number[]): boolean {
  for (let index = 0; index < left.length; index += 1) {
    if (Math.abs(left[index] - right[index]) > HYBRID_ROOT_JUMP) {
      return true;
    }
  }
  return false;
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

function hasSignChange(a: number, b: number): boolean {
  return (a < 0 && b > 0) || (a > 0 && b < 0);
}

/** Bisects `evaluate` over lightness, given its sign at `loStart`. */
function bisectHybridLightness(
  evaluate: (lightness: number) => number,
  loStart: number,
  hiStart: number,
  signLo: number,
): number {
  let lo = loStart;
  let hi = hiStart;
  for (let index = 0; index < DEFAULT_HYBRID_ROOT_ITERATIONS; index += 1) {
    const mid = (lo + hi) / 2;
    const value = evaluate(mid);
    if (Math.abs(value) <= HYBRID_ROOT_EPSILON) return mid;
    if (value < 0 === signLo < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Minimum-cost non-crossing matching of contour crossings listed in order
 * around a strip boundary, by chroma distance. Each match has an even
 * number of crossings inside it, so the regions it separates keep their
 * signs. Returns index pairs into `points`.
 */
function matchStripCrossings(
  points: ContrastRegionPoint[],
): Array<[number, number]> {
  const count = points.length;
  if (count < 2) return [];
  // cost[start][end] covers points start..end-1.
  const cost = Array.from({ length: count + 1 }, () =>
    new Array<number>(count + 1).fill(0),
  );
  const partnerOf = Array.from({ length: count + 1 }, () =>
    new Array<number>(count + 1).fill(-1),
  );
  for (let length = 1; length <= count; length += 1) {
    for (let start = 0; start + length <= count; start += 1) {
      const end = start + length;
      let best = HYBRID_UNMATCHED_COST + cost[start + 1][end];
      let bestPartner = -1;
      for (let partner = start + 1; partner < end; partner += 2) {
        const value =
          Math.abs(points[partner].c - points[start].c) +
          cost[start + 1][partner] +
          cost[partner + 1][end];
        if (value < best) {
          best = value;
          bestPartner = partner;
        }
      }
      cost[start][end] = best;
      partnerOf[start][end] = bestPartner;
    }
  }
  const pairs: Array<[number, number]> = [];
  const pending: Array<[number, number]> = [[0, count]];
  while (pending.length > 0) {
    const [start, end] = pending.pop()!;
    if (start >= end) continue;
    const partner = partnerOf[start][end];
    if (partner < 0) {
      pending.push([start + 1, end]);
      continue;
    }
    pairs.push([start, partner]);
    pending.push([start + 1, partner], [partner + 1, end]);
  }
  return pairs;
}

/**
 * Chains matched crossings into paths. Every node has at most two edges
 * (one per neighbouring strip), so the graph is a set of simple chains and
 * loops. Open paths run from their lower-lightness end; loops repeat their
 * first point at the end.
 */
function chainHybridEdges(
  nodes: ContrastRegionPoint[],
  edges: Array<[number, number]>,
): ContrastRegionPoint[][] {
  const incident = nodes.map(() => [] as number[]);
  edges.forEach(([a, b], edgeIndex) => {
    incident[a].push(edgeIndex);
    incident[b].push(edgeIndex);
  });
  const usedEdges = new Set<number>();
  const walk = (start: number): number[] => {
    const chain = [start];
    let current = start;
    for (;;) {
      const edgeIndex = incident[current].find((edge) => !usedEdges.has(edge));
      if (edgeIndex === undefined) return chain;
      usedEdges.add(edgeIndex);
      const [a, b] = edges[edgeIndex];
      current = a === current ? b : a;
      chain.push(current);
    }
  };
  const paths: ContrastRegionPoint[][] = [];
  for (let node = 0; node < nodes.length; node += 1) {
    if (incident[node].length !== 1 || usedEdges.has(incident[node][0])) {
      continue;
    }
    const chain = walk(node).map((index) => nodes[index]);
    const first = chain[0];
    const last = chain[chain.length - 1];
    if (last.l < first.l || (last.l === first.l && last.c < first.c)) {
      chain.reverse();
    }
    paths.push(chain);
  }
  for (let node = 0; node < nodes.length; node += 1) {
    if (incident[node].some((edge) => !usedEdges.has(edge))) {
      paths.push(walk(node).map((index) => nodes[index]));
    }
  }
  return paths;
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
  options: ContrastRegionHybridOptions,
  trace?: InternalPlaneTraceContext | null,
): ContrastRegionPoint[][] {
  const criterion = resolveContrastCriterion(options);
  const maxChroma = Math.max(0, options.maxChroma ?? 0.4);
  if (maxChroma <= 0) return [];
  const alpha = options.alpha ?? 1;
  const gamut = options.gamut ?? 'srgb';
  // The criterion uses the public metric, which clips an out-of-gamut
  // reference to the display gamut; chroma-reducing it here instead would
  // move the boundary away from what `contrastRatio`/`contrastAPCA` report.
  const mappedReference = reference;
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
  const findRootsAtLightness = (
    lightness: number,
    cMax: number,
  ): { roots: number[]; zeroSign: number; topSign: number } => {
    if (cMax <= HYBRID_ROOT_EPSILON) {
      const sign = Math.sign(evaluateAt(lightness, 0));
      return { roots: [], zeroSign: sign, topSign: sign };
    }
    const evaluateChroma = (chroma: number) => evaluateAt(lightness, chroma);
    const stepCount = Math.max(8, chromaBrackets);
    const roots: number[] = [];
    let prevC = 0;
    let prevV = evaluateChroma(0);
    const zeroSign = Math.sign(prevV);
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
    return { roots: deduped, zeroSign, topSign: Math.sign(prevV) };
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
    const { roots, zeroSign, topSign } = findRootsAtLightness(normalized, cMax);
    const sample = {
      l: normalized,
      cMax,
      roots,
      zeroSign,
      topSign,
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
    if (Math.abs(right.l - left.l) <= HYBRID_LIGHTNESS_EPSILON * 2) {
      return false;
    }
    // Both ends root-free but on opposite sides of the threshold: the
    // contour crosses between them. Keep bisecting (with extra depth) until
    // a sample lands on it, so near-vertical boundaries are not skipped.
    if (
      left.roots.length === 0 &&
      right.roots.length === 0 &&
      midpoint.roots.length === 0 &&
      left.zeroSign !== right.zeroSign
    ) {
      return depth < maxDepth + HYBRID_CROSSING_EXTRA_DEPTH;
    }
    // A contour that only touches one side of the interval turns or ends
    // inside it. Localize that end (a little past maxDepth) so the strip
    // that closes it is narrow.
    if (
      (left.roots.length === 0) !== (right.roots.length === 0) &&
      depth >= maxDepth
    ) {
      return depth < maxDepth + HYBRID_ENDPOINT_EXTRA_DEPTH;
    }
    // A contour with nearly constant lightness moves a long way in chroma
    // between neighbouring lightness samples. Its midpoint can still look
    // linear, so keep splitting (with extra depth) until index-matched roots
    // are close, rather than joining them with one long chord.
    if (
      left.roots.length === right.roots.length &&
      hasHybridRootJump(left.roots, right.roots)
    ) {
      return depth < maxDepth + HYBRID_CROSSING_EXTRA_DEPTH;
    }
    if (depth >= maxDepth) {
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

  // Each pair of neighbouring samples bounds a strip of the l/c plane. The
  // contour enters and leaves a strip through its roots on either side, the
  // chroma axis (zero-chroma sign change), or the gamut edge (gamut-edge sign
  // change). Matching those crossings per strip, then chaining the matches,
  // keeps a contour connected through folds (roots born or dying in pairs)
  // and where it meets the axis or the gamut edge between samples.
  const nodes: ContrastRegionPoint[] = [];
  const addNode = (point: ContrastRegionPoint): number => {
    nodes.push(point);
    return nodes.length - 1;
  };
  const rootNodes = refinedSamples.map((sample) =>
    sample.roots.map((chroma) => addNode({ l: sample.l, c: chroma })),
  );
  const edges: Array<[number, number]> = [];
  for (let index = 0; index < refinedSamples.length - 1; index += 1) {
    const left = refinedSamples[index];
    const right = refinedSamples[index + 1];
    const leftNodes = rootNodes[index];
    const rightNodes = rootNodes[index + 1];
    const axisNode = hasSignChange(left.zeroSign, right.zeroSign)
      ? addNode({
          l: bisectHybridLightness(
            (lightness) => evaluateAt(lightness, 0),
            left.l,
            right.l,
            left.zeroSign,
          ),
          c: 0,
        })
      : -1;
    let edgeNode = -1;
    if (hasSignChange(left.topSign, right.topSign)) {
      const l = bisectHybridLightness(
        (lightness) => evaluateAt(lightness, getMaxInGamut(lightness)),
        left.l,
        right.l,
        left.topSign,
      );
      edgeNode = addNode({ l, c: getMaxInGamut(l) });
    }
    if (
      axisNode < 0 &&
      edgeNode < 0 &&
      leftNodes.length === rightNodes.length
    ) {
      leftNodes.forEach((node, rootIndex) => {
        edges.push([node, rightNodes[rootIndex]]);
      });
      continue;
    }
    // Strip boundary in order: axis, right side upward, gamut edge, left
    // side downward. Contours cannot cross, so matches are non-crossing.
    const boundary = [
      ...(axisNode >= 0 ? [axisNode] : []),
      ...rightNodes,
      ...(edgeNode >= 0 ? [edgeNode] : []),
      ...leftNodes.slice().reverse(),
    ];
    for (const [a, b] of matchStripCrossings(
      boundary.map((node) => nodes[node]),
    )) {
      edges.push([boundary[a], boundary[b]]);
    }
  }
  const finishedPaths = chainHybridEdges(nodes, edges);

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
    // Open paths end on the plane edge, the axis, or the gamut edge.
    activeCount: finishedPaths.filter(
      (path) => path[0] !== path[path.length - 1],
    ).length,
    finishedCount: finishedPaths.length,
    pathCount: cleaned.length,
    hasComplexTopology: hasComplexTopology.value,
    paths: limitTracePaths(trace, toTracePaths(cleaned)),
  });

  // The hybrid tracer is the only solver. When it cannot resolve the
  // field reliably it still returns its best-effort paths (possibly none)
  // and records why in the trace summary.
  let degradedReason: ContrastHybridDegradedReason | undefined;
  const hasRoots = refinedSamples.some((sample) => sample.roots.length > 0);
  if (hasComplexTopology.value) {
    degradedReason = 'complex-topology';
  } else if (hasRoots && cleaned.length === 0) {
    degradedReason = 'branch-reconstruction-empty';
  } else if (!hasRoots && cleaned.length === 0) {
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
      degradedReason = 'unresolved-sign-change';
    }
  }
  if (degradedReason) {
    setTraceSummaryField(trace, 'degradedReason', degradedReason);
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

  return maybeSimplified.sort((a, b) => b.length - a.length);
}
