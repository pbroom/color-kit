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
  ContrastRegionPathOptions,
  ContrastRegionPoint,
} from './types.js';

const DEFAULT_HYBRID_MAX_DEPTH = 7;
const DEFAULT_HYBRID_ERROR_TOLERANCE = 0.0015;
const DEFAULT_HYBRID_ROOT_ITERATIONS = 28;
const DEFAULT_HYBRID_LIGHTNESS_STEPS = 72;
const DEFAULT_HYBRID_CHROMA_BRACKETS = 96;
const HYBRID_LIGHTNESS_EPSILON = 1e-6;
/** Chroma bracket width at which root bisection stops. */
const HYBRID_ROOT_EPSILON = 1e-7;
/** Lightness bracket width at which axis and gamut-edge bisection stops. */
const HYBRID_LIGHTNESS_TOLERANCE = 1e-9;
/**
 * Cost of leaving a strip crossing unmatched. Larger than any matching
 * distance in the l/c plane. Roots are placed at pass/fail class changes,
 * so every strip has an even number of crossings and none stay unmatched;
 * the cost only keeps the matching total if that invariant ever breaks.
 */
const HYBRID_UNMATCHED_COST = 10;

interface HybridLightnessSample {
  l: number;
  cMax: number;
  roots: number[];
  /** Pass/fail class of the contrast margin at chroma 0 (1 or -1). */
  zeroSign: number;
  /** Pass/fail class of the contrast margin at the gamut edge `cMax`. */
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

/**
 * Pass/fail class of a contrast margin: `1` when it meets the threshold
 * (`>= 0`), otherwise `-1`. Roots are placed only where this class changes,
 * so the roots of a lightness sample always agree in parity with its
 * `zeroSign` and `topSign`. Accepting near-zero values as roots instead
 * (a value tolerance) duplicated or dropped roots where the field is flat
 * in chroma, at fold tips and along the gamut edge, which split contours.
 */
function marginClass(value: number): 1 | -1 {
  return value >= 0 ? 1 : -1;
}

/**
 * Bisects `evaluate` over chroma for the pass/fail class change inside
 * `[loStart, hiStart]`. Stops on bracket width rather than on a small
 * value, so a flat field cannot stop it far from the crossing.
 */
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
  const loClass = marginClass(vLoStart);
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
  for (
    let index = 0;
    index < DEFAULT_HYBRID_ROOT_ITERATIONS && hi - lo > HYBRID_ROOT_EPSILON;
    index += 1
  ) {
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
    if (marginClass(vMid) === loClass) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return finish((lo + hi) / 2);
}

/**
 * Bisects `evaluate` over lightness for the pass/fail class change between
 * `loStart` and `hiStart` (either order), given the class at `loStart`.
 */
function bisectHybridLightness(
  evaluate: (lightness: number) => number,
  loStart: number,
  hiStart: number,
  classLo: number,
): number {
  let lo = loStart;
  let hi = hiStart;
  for (
    let index = 0;
    index < DEFAULT_HYBRID_ROOT_ITERATIONS &&
    Math.abs(hi - lo) > HYBRID_LIGHTNESS_TOLERANCE;
    index += 1
  ) {
    const mid = (lo + hi) / 2;
    if (marginClass(evaluate(mid)) === classLo) {
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
  // Keyed by exact lightness: gamut-edge bisection resolves lightness finer
  // than a rounded key, and a rounded key could return the gamut edge from
  // the other side of a step in `maxChromaAt`.
  const maxChromaCache = new Map<number, number>();
  const getMaxInGamut = (lightness: number): number => {
    const normalized = Math.max(0, Math.min(1, lightness));
    const cached = maxChromaCache.get(normalized);
    if (typeof cached === 'number') {
      return cached;
    }
    const resolved = Math.max(
      0,
      Math.min(maxChroma, maxChromaAt(normalized, hue, maxChromaAtOptions)),
    );
    maxChromaCache.set(normalized, resolved);
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
      const sign = marginClass(evaluateAt(lightness, 0));
      return { roots: [], zeroSign: sign, topSign: sign };
    }
    const evaluateChroma = (chroma: number) => evaluateAt(lightness, chroma);
    const stepCount = Math.max(8, chromaBrackets);
    // One root per bracket whose ends differ in class: roots are strictly
    // increasing and their count matches the zeroSign/topSign parity.
    const roots: number[] = [];
    let prevC = 0;
    let prevV = evaluateChroma(0);
    const zeroSign = marginClass(prevV);
    for (let index = 1; index <= stepCount; index += 1) {
      const c = (index / stepCount) * cMax;
      const v = evaluateChroma(c);
      if (marginClass(prevV) !== marginClass(v)) {
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
    if (roots.length > 6) {
      hasComplexTopology.value = true;
    }
    return { roots, zeroSign, topSign: marginClass(prevV) };
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
  // Two roots on the same side of a strip that match each other are a fold:
  // the contour turns back inside the strip. Rather than closing it with a
  // chord along the sample, place a turning point where the line midway
  // between the two roots leaves the region, so the fold tip is kept.
  const findFoldTip = (
    from: number,
    to: number,
    left: HybridLightnessSample,
    right: HybridLightnessSample,
    leftNodes: number[],
    rightNodes: number[],
  ): number => {
    const onLeft = leftNodes.includes(from) && leftNodes.includes(to);
    const onRight = rightNodes.includes(from) && rightNodes.includes(to);
    if (!onLeft && !onRight) return -1;
    const chroma = (nodes[from].c + nodes[to].c) / 2;
    const [near, far] = onLeft ? [left, right] : [right, left];
    if (chroma > far.cMax) return -1;
    const nearClass = marginClass(evaluateAt(near.l, chroma));
    if (marginClass(evaluateAt(far.l, chroma)) === nearClass) return -1;
    return addNode({
      l: bisectHybridLightness(
        (lightness) => evaluateAt(lightness, chroma),
        near.l,
        far.l,
        nearClass,
      ),
      c: chroma,
    });
  };
  const edges: Array<[number, number]> = [];
  for (let index = 0; index < refinedSamples.length - 1; index += 1) {
    const left = refinedSamples[index];
    const right = refinedSamples[index + 1];
    const leftNodes = rootNodes[index];
    const rightNodes = rootNodes[index + 1];
    const axisNode =
      left.zeroSign !== right.zeroSign
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
    if (left.topSign !== right.topSign) {
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
      const from = boundary[a];
      const to = boundary[b];
      const tip = findFoldTip(from, to, left, right, leftNodes, rightNodes);
      if (tip >= 0) {
        edges.push([from, tip], [tip, to]);
      } else {
        edges.push([from, to]);
      }
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
