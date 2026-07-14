import type { Color } from '../types.js';
import {
  maxChromaAt,
  maxChromaForHue,
  type GamutTarget,
} from '../gamut/index.js';
import {
  buildContourPaths as stitchContourSegments,
  extractAdaptiveContourSegments as extractAdaptiveContourSegmentsGeneric,
  extractGridContourSegments,
  type AdaptiveContourCell,
  type ContourSegment,
} from '../contour/index.js';
import {
  incrementTraceSummary,
  limitTraceEntries,
  limitTracePaths,
  recordTraceStage,
  setTraceSummaryField,
  shouldTraceFull,
  shouldTraceScalarGrid,
  type InternalPlaneTraceContext,
} from '../plane/trace.js';
import type { PlanePoint } from '../plane/types.js';
import { buildAxisAnchors } from '../sampling/adaptive1d.js';
import { simplifyPolyline } from '../utils/index.js';
import { contrastRatioUnclamped } from './metrics.js';
import {
  ADAPTIVE_EDGE_PROBES,
  mapToGamut,
  resolveContrastCriterion,
  toTracePaths,
  validateSteps,
} from './region-shared.js';
import type {
  ContrastRegionPathOptions,
  ContrastRegionPoint,
} from './types.js';

const DEFAULT_LIGHTNESS_STEPS = 64;
const DEFAULT_CHROMA_STEPS = 64;

interface ContrastContourPoint {
  x: number;
  y: number;
  l: number;
  c: number;
}

function toContrastContourPoint(point: PlanePoint): ContrastContourPoint {
  return {
    x: point.x,
    y: point.y,
    l: point.x,
    c: point.y,
  };
}

function buildContrastContourPaths(
  segments: Array<ContourSegment<ContrastContourPoint>>,
  canonicalTolerance: number = 1e-6,
): ContrastRegionPoint[][] {
  return stitchContourSegments(segments, {
    canonicalTolerance,
    stopOpenPathsAtStart: false,
    sortPaths: (a, b) => b.length - a.length,
  }).map((path) => path.map((point) => ({ l: point.x, c: point.y })));
}

/**
 * Generate contour paths for the region that meets or exceeds
 * a WCAG contrast threshold at a fixed hue.
 */
export function contrastRegionPathsLegacy(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions = {},
  trace?: InternalPlaneTraceContext | null,
): ContrastRegionPoint[][] {
  const criterion = resolveContrastCriterion(options);

  const maxChroma = Math.max(0, options.maxChroma ?? 0.4);
  if (maxChroma === 0) return [];

  const alpha = options.alpha ?? 1;
  const gamut = options.gamut ?? 'srgb';
  const edgeInterpolation = options.edgeInterpolation ?? 'linear';
  if (edgeInterpolation !== 'linear' && edgeInterpolation !== 'midpoint') {
    throw new Error(
      "contrastRegionPaths() edgeInterpolation must be 'linear' or 'midpoint'",
    );
  }
  const mappedReference = mapToGamut(reference, gamut);

  const mode = options.samplingMode ?? 'uniform';
  const legacySolver =
    mode === 'adaptive' && criterion.metric === 'wcag'
      ? 'contrast-legacy-adaptive'
      : 'contrast-legacy-uniform';
  const legacySamplingMode =
    legacySolver === 'contrast-legacy-adaptive' ? 'adaptive' : 'uniform';
  setTraceSummaryField(trace, 'solver', legacySolver);
  setTraceSummaryField(trace, 'samplingMode', legacySamplingMode);
  setTraceSummaryField(trace, 'fidelity', {
    simplifyTolerance: options.simplifyTolerance,
    resolution: options.lightnessSteps ?? DEFAULT_LIGHTNESS_STEPS,
    maxDepth: options.adaptiveMaxDepth,
  });
  recordTraceStage(trace, {
    kind: 'solver',
    solver: legacySolver,
    samplingMode: legacySamplingMode,
  });
  let segments: Array<ContourSegment<ContrastContourPoint>>;

  if (mode === 'adaptive' && criterion.metric === 'wcag') {
    segments = contrastRegionPathsAdaptive(
      hue,
      criterion.threshold,
      maxChroma,
      alpha,
      gamut,
      mappedReference,
      edgeInterpolation,
      options,
      trace,
    );
  } else {
    const lightnessSteps = validateSteps(
      'contrastRegionPaths() lightnessSteps',
      options.lightnessSteps ?? DEFAULT_LIGHTNESS_STEPS,
    );
    const chromaSteps = validateSteps(
      'contrastRegionPaths() chromaSteps',
      options.chromaSteps ?? DEFAULT_CHROMA_STEPS,
    );
    const sampleCount = (lightnessSteps + 1) * (chromaSteps + 1);
    incrementTraceSummary(trace, 'sampleCount', sampleCount);
    incrementTraceSummary(trace, 'scalarEvaluationCount', sampleCount);

    const scoreGrid: number[][] = [];
    let minScore = Number.POSITIVE_INFINITY;
    let maxScore = Number.NEGATIVE_INFINITY;
    for (
      let lightnessIndex = 0;
      lightnessIndex <= lightnessSteps;
      lightnessIndex += 1
    ) {
      const l = lightnessIndex / lightnessSteps;
      const maxInGamut = maxChromaAt(l, hue, {
        gamut,
        tolerance: options.tolerance,
        maxIterations: options.maxIterations,
        maxChroma,
        alpha,
      });

      const row: number[] = [];
      for (let chromaIndex = 0; chromaIndex <= chromaSteps; chromaIndex += 1) {
        const c = (chromaIndex / chromaSteps) * maxChroma;

        if (c > maxInGamut) {
          row.push(-1);
          minScore = Math.min(minScore, -1);
          maxScore = Math.max(maxScore, -1);
          continue;
        }

        const sample: Color = { l, c, h: hue, alpha };
        const mappedSample = mapToGamut(sample, gamut);
        const value = criterion.evaluate(mappedSample, mappedReference);
        row.push(value);
        minScore = Math.min(minScore, value);
        maxScore = Math.max(maxScore, value);
      }
      scoreGrid.push(row);
    }
    if (shouldTraceScalarGrid(trace)) {
      recordTraceStage(trace, {
        kind: 'scalarGrid',
        label: 'legacy-score-grid',
        bounds: {
          minX: 0,
          maxX: 1,
          minY: 0,
          maxY: maxChroma,
        },
        resolution: lightnessSteps,
        sampleCount,
        minValue: minScore,
        maxValue: maxScore,
        values: scoreGrid.map((row) => row.slice()),
      });
    }

    const contourGrid = Array.from({ length: chromaSteps + 1 }, (_, cIndex) =>
      Array.from(
        { length: lightnessSteps + 1 },
        (_, lIndex) => scoreGrid[lIndex][cIndex],
      ),
    );
    const extraction = extractGridContourSegments<ContrastContourPoint>(
      {
        minX: 0,
        maxX: 1,
        minY: 0,
        maxY: maxChroma,
        resolution: lightnessSteps,
        xSteps: lightnessSteps,
        ySteps: chromaSteps,
        values: contourGrid,
      },
      {
        interpolation: edgeInterpolation,
        collectCellEvents: shouldTraceFull(trace),
        mapPoint: toContrastContourPoint,
      },
    );
    segments = extraction.segments;
    incrementTraceSummary(trace, 'cellCount', extraction.cellCount);
    incrementTraceSummary(trace, 'segmentCount', extraction.segmentCount);
    recordTraceStage(trace, {
      kind: 'marchingSquares',
      label: 'legacy-uniform',
      resolution: lightnessSteps,
      cellCount: extraction.cellCount,
      segmentCount: extraction.segmentCount,
      cells: limitTraceEntries(trace, extraction.cellEvents),
    });
  }

  const rawPaths = buildContrastContourPaths(segments, 1e-5);
  recordTraceStage(trace, {
    kind: 'paths',
    label: 'contrast-raw-paths',
    pathCount: rawPaths.length,
    pointCount: rawPaths.reduce((total, path) => total + path.length, 0),
    paths: limitTracePaths(trace, toTracePaths(rawPaths)),
  });
  const tol = options.simplifyTolerance;
  if (tol != null && Number.isFinite(tol) && tol > 0) {
    const simplified = rawPaths.map((path) =>
      simplifyPolyline(path, tol, true),
    );
    setTraceSummaryField(trace, 'pathCount', simplified.length);
    setTraceSummaryField(
      trace,
      'pointCount',
      simplified.reduce((total, path) => total + path.length, 0),
    );
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'contrast-simplified-paths',
      pathCount: simplified.length,
      pointCount: simplified.reduce((total, path) => total + path.length, 0),
      paths: limitTracePaths(trace, toTracePaths(simplified)),
    });
    return simplified;
  }
  setTraceSummaryField(trace, 'pathCount', rawPaths.length);
  setTraceSummaryField(
    trace,
    'pointCount',
    rawPaths.reduce((total, path) => total + path.length, 0),
  );
  return rawPaths;
}

const DEFAULT_ADAPTIVE_BASE_STEPS = 16;
const DEFAULT_ADAPTIVE_MAX_DEPTH_CONTRAST = 3;
const ADAPTIVE_LIGHTNESS_DEDUPE_EPSILON = 1e-6;
const ADAPTIVE_CHROMA_DEDUPE_EPSILON = 1e-6;

function buildAdaptiveLightnessAnchors(
  baseSteps: number,
  cuspLightness: number,
): number[] {
  return buildAxisAnchors({
    min: 0,
    max: 1,
    epsilon: ADAPTIVE_LIGHTNESS_DEDUPE_EPSILON,
    extraAnchors: [cuspLightness],
    edgeProbes: ADAPTIVE_EDGE_PROBES,
    uniformSteps: baseSteps,
  });
}

function buildAdaptiveChromaAnchors(
  baseSteps: number,
  maxChroma: number,
  cuspChroma: number,
): number[] {
  return buildAxisAnchors({
    min: 0,
    max: maxChroma,
    epsilon: ADAPTIVE_CHROMA_DEDUPE_EPSILON,
    extraAnchors: [cuspChroma],
    edgeProbes: ADAPTIVE_EDGE_PROBES,
    uniformSteps: baseSteps,
  });
}

function contrastRegionPathsAdaptive(
  hue: number,
  threshold: number,
  maxChroma: number,
  alpha: number,
  gamut: GamutTarget,
  mappedReference: Color,
  edgeInterpolation: 'linear' | 'midpoint',
  options: ContrastRegionPathOptions,
  trace?: InternalPlaneTraceContext | null,
): Array<ContourSegment<ContrastContourPoint>> {
  const baseSteps = Math.max(
    2,
    Math.min(
      64,
      Number.isInteger(options.adaptiveBaseSteps) &&
        options.adaptiveBaseSteps! > 0
        ? options.adaptiveBaseSteps!
        : DEFAULT_ADAPTIVE_BASE_STEPS,
    ),
  );
  const maxDepth = Math.max(
    0,
    Math.min(
      6,
      Number.isInteger(options.adaptiveMaxDepth) &&
        options.adaptiveMaxDepth! >= 0
        ? options.adaptiveMaxDepth!
        : DEFAULT_ADAPTIVE_MAX_DEPTH_CONTRAST,
    ),
  );

  const maxChromaAtOpts = {
    gamut,
    tolerance: options.tolerance,
    maxIterations: options.maxIterations,
    maxChroma,
    alpha,
  };

  const getValue = (l: number, c: number): number => {
    incrementTraceSummary(trace, 'sampleCount', 1);
    incrementTraceSummary(trace, 'scalarEvaluationCount', 1);
    if (c > maxChroma) return -1;
    const maxInGamut = maxChromaAt(l, hue, maxChromaAtOpts);
    if (c > maxInGamut) return -1;
    const sample: Color = { l, c, h: hue, alpha };
    const mappedSample = mapToGamut(sample, gamut);
    return contrastRatioUnclamped(mappedSample, mappedReference) - threshold;
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
  const lightnessAnchors = buildAdaptiveLightnessAnchors(baseSteps, cusp.l);
  const chromaAnchors = buildAdaptiveChromaAnchors(
    baseSteps,
    maxChroma,
    cusp.c,
  );
  const cells: AdaptiveContourCell[] = [];

  for (let li = 0; li < lightnessAnchors.length - 1; li += 1) {
    const l0 = lightnessAnchors[li];
    const l1 = lightnessAnchors[li + 1];
    for (let ci = 0; ci < chromaAnchors.length - 1; ci += 1) {
      const c0 = chromaAnchors[ci];
      const c1 = chromaAnchors[ci + 1];
      if (l1 <= l0 || c1 <= c0) {
        continue;
      }
      const v00 = getValue(l0, c0);
      const v10 = getValue(l1, c0);
      const v11 = getValue(l1, c1);
      const v01 = getValue(l0, c1);
      cells.push({
        x0: l0,
        x1: l1,
        y0: c0,
        y1: c1,
        v0: v00,
        v1: v10,
        v2: v11,
        v3: v01,
      });
    }
  }

  const extraction =
    extractAdaptiveContourSegmentsGeneric<ContrastContourPoint>(
      cells,
      getValue,
      {
        maxDepth,
        interpolation: edgeInterpolation,
        collectCellEvents: shouldTraceFull(trace),
        mapPoint: toContrastContourPoint,
        getCellIndex: (cell) => ({
          xIndex: Math.round(cell.x0 * baseSteps),
          yIndex: Math.round((cell.y0 / Math.max(maxChroma, 1e-9)) * baseSteps),
        }),
        shouldRefineUniformCell: ({
          cell,
          cornerValues,
          midpointValues,
          sample,
        }) => {
          const cornerSign = cornerValues[0] >= 0;
          const hasInteriorSignChange = midpointValues.some(
            (value) => value >= 0 !== cornerSign,
          );
          let hasBoundarySignChange = false;
          if (!hasInteriorSignChange) {
            const lMid = (cell.x0 + cell.x1) / 2;
            const boundaryProbes = [
              { l: cell.x0, c: maxChromaAt(cell.x0, hue, maxChromaAtOpts) },
              { l: lMid, c: maxChromaAt(lMid, hue, maxChromaAtOpts) },
              { l: cell.x1, c: maxChromaAt(cell.x1, hue, maxChromaAtOpts) },
            ];
            for (const probe of boundaryProbes) {
              if (probe.c <= cell.y0 + 1e-7 || probe.c >= cell.y1 - 1e-7) {
                continue;
              }
              const boundaryValue = sample(probe.l, probe.c);
              if (boundaryValue >= 0 !== cornerSign) {
                hasBoundarySignChange = true;
                break;
              }
            }
          }
          return hasInteriorSignChange || hasBoundarySignChange;
        },
      },
    );

  incrementTraceSummary(trace, 'cellCount', extraction.cellCount);
  incrementTraceSummary(trace, 'segmentCount', extraction.segmentCount);
  recordTraceStage(trace, {
    kind: 'marchingSquares',
    label: 'legacy-adaptive',
    resolution: baseSteps,
    cellCount: extraction.cellCount,
    segmentCount: extraction.segmentCount,
    cells: limitTraceEntries(trace, extraction.cellEvents),
  });
  return extraction.segments;
}
