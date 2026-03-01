import type { Color } from '../types.js';
import {
  maxChromaAt,
  maxChromaForHue,
  toP3Gamut,
  toSrgbGamut,
  type GamutTarget,
} from '../gamut/index.js';
import { toRgb } from '../conversion/index.js';
import { oklabToLinearRgb } from '../conversion/oklab.js';
import { oklchToOklab } from '../conversion/oklch.js';
import { srgbToLinearChannel, simplifyPolyline } from '../utils/index.js';

/**
 * Calculate relative luminance of a color per WCAG 2.1.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(color: Color): number {
  const rgb = toRgb(color);
  const r = srgbToLinearChannel(rgb.r / 255);
  const g = srgbToLinearChannel(rgb.g / 255);
  const b = srgbToLinearChannel(rgb.b / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate WCAG 2.1 contrast ratio between two colors.
 * Returns a value between 1 and 21.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function contrastRatio(color1: Color, color2: Color): number {
  const l1 = relativeLuminance(color1);
  const l2 = relativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Calculate APCA (Advanced Perceptual Contrast Algorithm) contrast.
 * Returns a value roughly between -108 and 106.
 * Positive values = light text on dark background.
 * Negative values = dark text on light background.
 *
 * Based on APCA-W3 0.0.98G-4g.
 * https://github.com/Myndex/SAPC-APCA
 */
export function contrastAPCA(textColor: Color, bgColor: Color): number {
  const txtRgb = toRgb(textColor);
  const bgRgb = toRgb(bgColor);

  // Linearize with sRGB TRC
  const txtR = srgbToLinearChannel(txtRgb.r / 255);
  const txtG = srgbToLinearChannel(txtRgb.g / 255);
  const txtB = srgbToLinearChannel(txtRgb.b / 255);

  const bgR = srgbToLinearChannel(bgRgb.r / 255);
  const bgG = srgbToLinearChannel(bgRgb.g / 255);
  const bgB = srgbToLinearChannel(bgRgb.b / 255);

  // APCA luminance coefficients
  const txtY = 0.2126729 * txtR + 0.7151522 * txtG + 0.072175 * txtB;
  const bgY = 0.2126729 * bgR + 0.7151522 * bgG + 0.072175 * bgB;

  // APCA contrast calculation (simplified)
  const normBg = 0.56;
  const normTxt = 0.57;
  const revTxt = 0.62;
  const revBg = 0.65;

  const scale = 1.25;
  const threshold = 0.022;
  const loClip = 0.1;

  // Soft clamp
  const txtYc = txtY > threshold ? txtY : txtY + (threshold - txtY) ** 1.414;
  const bgYc = bgY > threshold ? bgY : bgY + (threshold - bgY) ** 1.414;

  let contrast: number;

  if (bgYc > txtYc) {
    // Dark text on light bg (normal polarity)
    contrast = (bgYc ** normBg - txtYc ** normTxt) * scale;
  } else {
    // Light text on dark bg (reverse polarity)
    contrast = (bgYc ** revBg - txtYc ** revTxt) * scale;
  }

  if (Math.abs(contrast) < loClip) {
    return 0;
  }

  return contrast > 0 ? contrast - loClip : contrast + loClip;
}

/** Check if contrast ratio meets WCAG AA for normal text (>= 4.5:1) */
export function meetsAA(
  color1: Color,
  color2: Color,
  largeText: boolean = false,
): boolean {
  const ratio = contrastRatio(color1, color2);
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/** Check if contrast ratio meets WCAG AAA for normal text (>= 7:1) */
export function meetsAAA(
  color1: Color,
  color2: Color,
  largeText: boolean = false,
): boolean {
  const ratio = contrastRatio(color1, color2);
  return largeText ? ratio >= 4.5 : ratio >= 7;
}

export type ContrastRegionLevel = 'AA' | 'AAA' | 'AA-large';
export type ContrastMetric = 'wcag' | 'apca';
export type ContrastApcaPolarity = 'absolute' | 'positive' | 'negative';
export type ContrastApcaRole = 'sample-text' | 'sample-background';
export type ContrastApcaPreset = 'body' | 'large-text' | 'ui';

export interface ContrastRegionPoint {
  l: number;
  c: number;
}

export interface ContrastRegionPathOptions {
  gamut?: GamutTarget;
  /**
   * Contrast metric used when evaluating region membership.
   * @default 'wcag'
   */
  metric?: ContrastMetric;
  /**
   * Explicit contrast threshold. If provided it overrides `level`.
   * For metric='wcag' this is ratio threshold (>= 1).
   * For metric='apca' this is Lc threshold (>= 0).
   */
  threshold?: number;
  /**
   * WCAG threshold preset.
   * @default 'AA' (4.5:1)
   */
  level?: ContrastRegionLevel;
  /**
   * APCA threshold preset used when metric='apca' and threshold is omitted.
   * @default 'body' (Lc 60)
   */
  apcaPreset?: ContrastApcaPreset;
  /**
   * APCA polarity test mode used when metric='apca':
   * - absolute: abs(Lc) >= threshold
   * - positive: Lc >= threshold
   * - negative: Lc <= -threshold
   * @default 'absolute'
   */
  apcaPolarity?: ContrastApcaPolarity;
  /**
   * APCA sample/reference role used when metric='apca':
   * - sample-text: Lc = APCA(sample, reference)
   * - sample-background: Lc = APCA(reference, sample)
   * @default 'sample-text'
   */
  apcaRole?: ContrastApcaRole;
  /**
   * Number of sampled lightness cells.
   * The lightness axis has `lightnessSteps + 1` points.
   *
   * Legacy fallback hint. Hybrid mode uses this as an initial density guide.
   */
  lightnessSteps?: number;
  /**
   * Number of sampled chroma cells.
   * The chroma axis has `chromaSteps + 1` points.
   *
   * Legacy fallback hint. Hybrid mode uses this for root-bracketing density.
   */
  chromaSteps?: number;
  /**
   * Upper chroma bound used for sampling.
   */
  maxChroma?: number;
  /**
   * Shared search precision forwarded to `maxChromaAt`.
   */
  tolerance?: number;
  /**
   * Shared search iteration cap forwarded to `maxChromaAt`.
   */
  maxIterations?: number;
  /**
   * Alpha channel used while sampling.
   */
  alpha?: number;
  /**
   * Edge placement strategy for marching-squares contours.
   * `linear` uses threshold interpolation and improves contour precision.
   * `midpoint` keeps legacy midpoint edge placement.
   * @default 'linear'
   *
   * Legacy fallback option; ignored by the hybrid solver.
   */
  edgeInterpolation?: 'linear' | 'midpoint';
  /**
   * If set, run Ramer-Douglas-Peucker simplification on each contour path.
   * Tolerance is in normalized (l, c) space; e.g. 0.001–0.002.
   * Omit or 0 to disable.
   */
  simplifyTolerance?: number;
  /**
   * Sampling mode selection.
   * - hybrid: direct implicit tracing with adaptive refinement (default)
   * - uniform/adaptive: legacy marching-squares fallback modes
   * @default 'hybrid'
   */
  samplingMode?: 'hybrid' | 'uniform' | 'adaptive';
  /**
   * In adaptive mode, base grid size per axis (subdivided where contour crosses).
   * @default 16
   */
  adaptiveBaseSteps?: number;
  /**
   * In adaptive mode, max subdivision depth.
   * @default 3
   */
  adaptiveMaxDepth?: number;
  /**
   * Hybrid solver: maximum adaptive lightness refinement depth.
   * @default 7
   */
  hybridMaxDepth?: number;
  /**
   * Hybrid solver: maximum midpoint root deviation before splitting.
   * Value is in chroma units.
   * @default 0.0015
   */
  hybridErrorTolerance?: number;
}

const DEFAULT_LIGHTNESS_STEPS = 64;
const DEFAULT_CHROMA_STEPS = 64;
const DEFAULT_HYBRID_MAX_DEPTH = 7;
const DEFAULT_HYBRID_ERROR_TOLERANCE = 0.0015;
const DEFAULT_HYBRID_ROOT_ITERATIONS = 28;
const DEFAULT_HYBRID_LIGHTNESS_STEPS = 72;
const DEFAULT_HYBRID_CHROMA_BRACKETS = 96;
const HYBRID_LIGHTNESS_EPSILON = 1e-6;
const HYBRID_ROOT_EPSILON = 1e-7;
const HYBRID_BRANCH_JOIN_EPSILON = 0.06;

const APCA_PRESET_THRESHOLDS: Record<ContrastApcaPreset, number> = {
  body: 0.6,
  'large-text': 0.45,
  ui: 0.3,
};

interface ResolvedContrastCriterion {
  metric: ContrastMetric;
  threshold: number;
  evaluate: (sample: Color, reference: Color) => number;
}

interface HybridLightnessSample {
  l: number;
  cMax: number;
  roots: number[];
}

function mapToGamut(color: Color, gamut: GamutTarget): Color {
  return gamut === 'display-p3' ? toP3Gamut(color) : toSrgbGamut(color);
}

/**
 * Relative luminance from unclamped linear channels.
 *
 * This keeps P3-only colors accurate instead of implicitly clipping
 * through an sRGB conversion path.
 */
function relativeLuminanceUnclamped(color: Color): number {
  const lab = oklchToOklab({
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  });
  const linear = oklabToLinearRgb(lab);
  return 0.2126 * linear.r + 0.7152 * linear.g + 0.0722 * linear.b;
}

function contrastRatioUnclamped(color1: Color, color2: Color): number {
  const l1 = relativeLuminanceUnclamped(color1);
  const l2 = relativeLuminanceUnclamped(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function resolveContrastThreshold(options: ContrastRegionPathOptions): number {
  if (typeof options.threshold === 'number') {
    return options.threshold;
  }

  switch (options.level ?? 'AA') {
    case 'AAA':
      return 7;
    case 'AA-large':
      return 3;
    case 'AA':
    default:
      return 4.5;
  }
}

function resolveContrastCriterion(
  options: ContrastRegionPathOptions,
): ResolvedContrastCriterion {
  const metric = options.metric ?? 'wcag';
  if (metric === 'apca') {
    const preset = options.apcaPreset ?? 'body';
    const threshold =
      typeof options.threshold === 'number'
        ? options.threshold
        : APCA_PRESET_THRESHOLDS[preset];
    if (!Number.isFinite(threshold) || threshold <= 0) {
      throw new Error('contrastRegionPaths() APCA threshold must be > 0');
    }
    const polarity = options.apcaPolarity ?? 'absolute';
    const role = options.apcaRole ?? 'sample-text';
    return {
      metric,
      threshold,
      evaluate: (sample, reference) => {
        const lc =
          role === 'sample-background'
            ? contrastAPCA(reference, sample)
            : contrastAPCA(sample, reference);
        if (polarity === 'positive') {
          return lc - threshold;
        }
        if (polarity === 'negative') {
          return -lc - threshold;
        }
        return Math.abs(lc) - threshold;
      },
    };
  }

  const threshold = resolveContrastThreshold(options);
  if (!Number.isFinite(threshold) || threshold <= 1) {
    throw new Error('contrastRegionPaths() requires threshold > 1');
  }
  return {
    metric,
    threshold,
    evaluate: (sample, reference) =>
      contrastRatioUnclamped(sample, reference) - threshold,
  };
}

function validateSteps(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 2) {
    throw new Error(`${name} must be an integer >= 2`);
  }
  return value;
}

function pointKey(point: ContrastRegionPoint): string {
  return `${point.l.toFixed(6)}:${point.c.toFixed(6)}`;
}

/** Canonicalize point so segments from adjacent adaptive cells share the same vertex. */
function canonicalizePoint(
  p: ContrastRegionPoint,
  tolerance: number = 1e-6,
): ContrastRegionPoint {
  const round = (x: number) => Math.round(x / tolerance) * tolerance;
  return { l: round(p.l), c: round(p.c) };
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function edgePoint(
  edge: 0 | 1 | 2 | 3,
  l0: number,
  l1: number,
  c0: number,
  c1: number,
  values: {
    v0: number;
    v1: number;
    v2: number;
    v3: number;
  },
  interpolation: 'linear' | 'midpoint',
): ContrastRegionPoint {
  const interpolate = (a: number, b: number): number => {
    if (interpolation === 'midpoint') {
      return 0.5;
    }
    const denom = a - b;
    if (!Number.isFinite(denom) || Math.abs(denom) <= 1e-12) {
      return 0.5;
    }
    const t = a / denom;
    if (!Number.isFinite(t)) return 0.5;
    if (t < 0) return 0;
    if (t > 1) return 1;
    return t;
  };

  switch (edge) {
    case 0: {
      const t = interpolate(values.v0, values.v1);
      return { l: l0 + (l1 - l0) * t, c: c0 };
    }
    case 1: {
      const t = interpolate(values.v1, values.v2);
      return { l: l1, c: c0 + (c1 - c0) * t };
    }
    case 2: {
      const t = interpolate(values.v3, values.v2);
      return { l: l0 + (l1 - l0) * t, c: c1 };
    }
    case 3: {
      const t = interpolate(values.v0, values.v3);
      return { l: l0, c: c0 + (c1 - c0) * t };
    }
    default:
      return { l: l0, c: c0 };
  }
}

function buildContourPaths(
  segments: Array<[ContrastRegionPoint, ContrastRegionPoint]>,
  canonicalTolerance: number = 1e-6,
): ContrastRegionPoint[][] {
  if (segments.length === 0) return [];

  const pointByKey = new Map<string, ContrastRegionPoint>();
  const adjacency = new Map<string, Set<string>>();
  const visitedEdges = new Set<string>();

  for (const [a, b] of segments) {
    const aCanon = canonicalizePoint(a, canonicalTolerance);
    const bCanon = canonicalizePoint(b, canonicalTolerance);
    const aKey = pointKey(aCanon);
    const bKey = pointKey(bCanon);
    pointByKey.set(aKey, aCanon);
    pointByKey.set(bKey, bCanon);

    if (!adjacency.has(aKey)) adjacency.set(aKey, new Set());
    if (!adjacency.has(bKey)) adjacency.set(bKey, new Set());
    adjacency.get(aKey)?.add(bKey);
    adjacency.get(bKey)?.add(aKey);
  }

  function tracePath(start: string, closeLoop: boolean): string[] {
    const path = [start];
    let current = start;
    let guard = 0;

    while (guard < 20000) {
      guard += 1;
      const neighbors = adjacency.get(current);
      if (!neighbors || neighbors.size === 0) break;

      let next: string | null = null;
      for (const candidate of neighbors) {
        if (!visitedEdges.has(edgeKey(current, candidate))) {
          next = candidate;
          break;
        }
      }

      if (!next) break;

      visitedEdges.add(edgeKey(current, next));
      current = next;
      path.push(current);

      if (closeLoop && current === start) {
        break;
      }
    }

    return path;
  }

  const paths: ContrastRegionPoint[][] = [];

  for (const [node, neighbors] of adjacency) {
    if (neighbors.size !== 1) continue;
    const traced = tracePath(node, false);
    if (traced.length > 1) {
      paths.push(
        traced
          .map((key) => pointByKey.get(key))
          .filter(Boolean) as ContrastRegionPoint[],
      );
    }
  }

  for (const [node, neighbors] of adjacency) {
    for (const neighbor of neighbors) {
      if (visitedEdges.has(edgeKey(node, neighbor))) continue;
      const traced = tracePath(node, true);
      if (traced.length > 2) {
        paths.push(
          traced
            .map((key) => pointByKey.get(key))
            .filter(Boolean) as ContrastRegionPoint[],
        );
      }
    }
  }

  return paths.sort((a, b) => b.length - a.length);
}

function segmentEdgesForCell(
  mask: number,
): Array<[0 | 1 | 2 | 3, 0 | 1 | 2 | 3]> {
  switch (mask) {
    case 0:
    case 15:
      return [];
    case 1:
      return [[3, 0]];
    case 2:
      return [[0, 1]];
    case 3:
      return [[3, 1]];
    case 4:
      return [[1, 2]];
    case 5:
      return [
        [3, 2],
        [0, 1],
      ];
    case 6:
      return [[0, 2]];
    case 7:
      return [[3, 2]];
    case 8:
      return [[2, 3]];
    case 9:
      return [[0, 2]];
    case 10:
      return [
        [0, 3],
        [1, 2],
      ];
    case 11:
      return [[1, 2]];
    case 12:
      return [[3, 1]];
    case 13:
      return [[0, 1]];
    case 14:
      return [[3, 0]];
    default:
      return [];
  }
}

/**
 * Generate contour paths for the region that meets or exceeds
 * a WCAG contrast threshold at a fixed hue.
 */
function contrastRegionPathsLegacy(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions = {},
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
  let segments: Array<[ContrastRegionPoint, ContrastRegionPoint]>;

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

    const scoreGrid: number[][] = [];
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
          continue;
        }

        const sample: Color = { l, c, h: hue, alpha };
        const mappedSample = mapToGamut(sample, gamut);
        row.push(criterion.evaluate(mappedSample, mappedReference));
      }
      scoreGrid.push(row);
    }

    segments = [];
    for (
      let lightnessIndex = 0;
      lightnessIndex < lightnessSteps;
      lightnessIndex += 1
    ) {
      const l0 = lightnessIndex / lightnessSteps;
      const l1 = (lightnessIndex + 1) / lightnessSteps;

      for (let chromaIndex = 0; chromaIndex < chromaSteps; chromaIndex += 1) {
        const c0 = (chromaIndex / chromaSteps) * maxChroma;
        const c1 = ((chromaIndex + 1) / chromaSteps) * maxChroma;

        const v0 = scoreGrid[lightnessIndex][chromaIndex];
        const v1 = scoreGrid[lightnessIndex + 1][chromaIndex];
        const v2 = scoreGrid[lightnessIndex + 1][chromaIndex + 1];
        const v3 = scoreGrid[lightnessIndex][chromaIndex + 1];

        const b0 = v0 >= 0;
        const b1 = v1 >= 0;
        const b2 = v2 >= 0;
        const b3 = v3 >= 0;

        const mask = (b0 ? 1 : 0) | (b1 ? 2 : 0) | (b2 ? 4 : 0) | (b3 ? 8 : 0);
        const edgePairs = segmentEdgesForCell(mask);
        if (edgePairs.length === 0) continue;

        for (const [fromEdge, toEdge] of edgePairs) {
          const from = edgePoint(
            fromEdge,
            l0,
            l1,
            c0,
            c1,
            { v0, v1, v2, v3 },
            edgeInterpolation,
          );
          const to = edgePoint(
            toEdge,
            l0,
            l1,
            c0,
            c1,
            { v0, v1, v2, v3 },
            edgeInterpolation,
          );
          segments.push([from, to]);
        }
      }
    }
  }

  const rawPaths = buildContourPaths(segments, 1e-5);
  const tol = options.simplifyTolerance;
  if (tol != null && Number.isFinite(tol) && tol > 0) {
    return rawPaths.map((p) => simplifyPolyline(p, tol, true));
  }
  return rawPaths;
}

const DEFAULT_ADAPTIVE_BASE_STEPS = 16;
const DEFAULT_ADAPTIVE_MAX_DEPTH_CONTRAST = 3;
const ADAPTIVE_LIGHTNESS_DEDUPE_EPSILON = 1e-6;
const ADAPTIVE_CHROMA_DEDUPE_EPSILON = 1e-6;
const ADAPTIVE_EDGE_PROBES = [0.02, 0.05] as const;

function appendUniqueAdaptiveAxis(
  values: number[],
  value: number,
  min: number,
  max: number,
  epsilon: number,
): void {
  if (!Number.isFinite(value)) {
    return;
  }
  const normalized = Math.max(min, Math.min(max, value));
  for (const current of values) {
    if (Math.abs(current - normalized) <= epsilon) {
      return;
    }
  }
  values.push(normalized);
}

function buildAdaptiveLightnessAnchors(
  baseSteps: number,
  cuspLightness: number,
): number[] {
  const anchors: number[] = [];
  appendUniqueAdaptiveAxis(anchors, 0, 0, 1, ADAPTIVE_LIGHTNESS_DEDUPE_EPSILON);
  appendUniqueAdaptiveAxis(anchors, 1, 0, 1, ADAPTIVE_LIGHTNESS_DEDUPE_EPSILON);
  appendUniqueAdaptiveAxis(
    anchors,
    cuspLightness,
    0,
    1,
    ADAPTIVE_LIGHTNESS_DEDUPE_EPSILON,
  );
  for (const probe of ADAPTIVE_EDGE_PROBES) {
    appendUniqueAdaptiveAxis(
      anchors,
      probe,
      0,
      1,
      ADAPTIVE_LIGHTNESS_DEDUPE_EPSILON,
    );
    appendUniqueAdaptiveAxis(
      anchors,
      1 - probe,
      0,
      1,
      ADAPTIVE_LIGHTNESS_DEDUPE_EPSILON,
    );
  }
  for (let index = 1; index < baseSteps; index += 1) {
    appendUniqueAdaptiveAxis(
      anchors,
      index / baseSteps,
      0,
      1,
      ADAPTIVE_LIGHTNESS_DEDUPE_EPSILON,
    );
  }
  anchors.sort((a, b) => a - b);
  return anchors;
}

function buildAdaptiveChromaAnchors(
  baseSteps: number,
  maxChroma: number,
  cuspChroma: number,
): number[] {
  const anchors: number[] = [];
  appendUniqueAdaptiveAxis(
    anchors,
    0,
    0,
    maxChroma,
    ADAPTIVE_CHROMA_DEDUPE_EPSILON,
  );
  appendUniqueAdaptiveAxis(
    anchors,
    maxChroma,
    0,
    maxChroma,
    ADAPTIVE_CHROMA_DEDUPE_EPSILON,
  );
  appendUniqueAdaptiveAxis(
    anchors,
    cuspChroma,
    0,
    maxChroma,
    ADAPTIVE_CHROMA_DEDUPE_EPSILON,
  );
  for (const probe of ADAPTIVE_EDGE_PROBES) {
    appendUniqueAdaptiveAxis(
      anchors,
      probe * maxChroma,
      0,
      maxChroma,
      ADAPTIVE_CHROMA_DEDUPE_EPSILON,
    );
    appendUniqueAdaptiveAxis(
      anchors,
      (1 - probe) * maxChroma,
      0,
      maxChroma,
      ADAPTIVE_CHROMA_DEDUPE_EPSILON,
    );
  }
  for (let index = 1; index < baseSteps; index += 1) {
    appendUniqueAdaptiveAxis(
      anchors,
      (index / baseSteps) * maxChroma,
      0,
      maxChroma,
      ADAPTIVE_CHROMA_DEDUPE_EPSILON,
    );
  }
  anchors.sort((a, b) => a - b);
  return anchors;
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
): Array<[ContrastRegionPoint, ContrastRegionPoint]> {
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
    if (c > maxChroma) return -1;
    const maxInGamut = maxChromaAt(l, hue, maxChromaAtOpts);
    if (c > maxInGamut) return -1;
    const sample: Color = { l, c, h: hue, alpha };
    const mappedSample = mapToGamut(sample, gamut);
    return contrastRatioUnclamped(mappedSample, mappedReference) - threshold;
  };

  const segments: Array<[ContrastRegionPoint, ContrastRegionPoint]> = [];
  const cusp = maxChromaForHue(hue, {
    gamut,
    method: 'direct',
  });
  const lightnessAnchors = buildAdaptiveLightnessAnchors(baseSteps, cusp.l);
  const chromaAnchors = buildAdaptiveChromaAnchors(
    baseSteps,
    maxChroma,
    cusp.c,
  );

  const processCell = (
    l0: number,
    l1: number,
    c0: number,
    c1: number,
    v00: number,
    v10: number,
    v11: number,
    v01: number,
    depth: number,
  ): void => {
    const b0 = v00 >= 0;
    const b1 = v10 >= 0;
    const b2 = v11 >= 0;
    const b3 = v01 >= 0;
    const mask = (b0 ? 1 : 0) | (b1 ? 2 : 0) | (b2 ? 4 : 0) | (b3 ? 8 : 0);
    if (depth >= maxDepth) {
      if (mask === 0 || mask === 15) {
        return;
      }
      const edgePairs = segmentEdgesForCell(mask);
      for (const [fromEdge, toEdge] of edgePairs) {
        const from = edgePoint(
          fromEdge,
          l0,
          l1,
          c0,
          c1,
          { v0: v00, v1: v10, v2: v11, v3: v01 },
          edgeInterpolation,
        );
        const to = edgePoint(
          toEdge,
          l0,
          l1,
          c0,
          c1,
          { v0: v00, v1: v10, v2: v11, v3: v01 },
          edgeInterpolation,
        );
        segments.push([from, to]);
      }
      return;
    }

    const lMid = (l0 + l1) / 2;
    const cMid = (c0 + c1) / 2;
    const vMidBottom = getValue(lMid, c0);
    const vMidRight = getValue(l1, cMid);
    const vMidTop = getValue(lMid, c1);
    const vMidLeft = getValue(l0, cMid);
    const vCenter = getValue(lMid, cMid);

    if (mask === 0 || mask === 15) {
      const cornerSign = b0;
      const hasInteriorSignChange =
        vMidBottom >= 0 !== cornerSign ||
        vMidRight >= 0 !== cornerSign ||
        vMidTop >= 0 !== cornerSign ||
        vMidLeft >= 0 !== cornerSign ||
        vCenter >= 0 !== cornerSign;
      let hasBoundarySignChange = false;
      if (!hasInteriorSignChange) {
        const boundaryProbes = [
          { l: l0, c: maxChromaAt(l0, hue, maxChromaAtOpts) },
          { l: lMid, c: maxChromaAt(lMid, hue, maxChromaAtOpts) },
          { l: l1, c: maxChromaAt(l1, hue, maxChromaAtOpts) },
        ];
        for (const probe of boundaryProbes) {
          if (probe.c <= c0 + 1e-7 || probe.c >= c1 - 1e-7) {
            continue;
          }
          const boundaryValue = getValue(probe.l, probe.c);
          if (boundaryValue >= 0 !== cornerSign) {
            hasBoundarySignChange = true;
            break;
          }
        }
      }
      if (!hasInteriorSignChange && !hasBoundarySignChange) {
        return;
      }
    }

    processCell(
      l0,
      lMid,
      c0,
      cMid,
      v00,
      vMidBottom,
      vCenter,
      vMidLeft,
      depth + 1,
    );
    processCell(
      lMid,
      l1,
      c0,
      cMid,
      vMidBottom,
      v10,
      vMidRight,
      vCenter,
      depth + 1,
    );
    processCell(
      lMid,
      l1,
      cMid,
      c1,
      vCenter,
      vMidRight,
      v11,
      vMidTop,
      depth + 1,
    );
    processCell(l0, lMid, cMid, c1, vMidLeft, vCenter, vMidTop, v01, depth + 1);
  };

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
      processCell(l0, l1, c0, c1, v00, v10, v11, v01, 0);
    }
  }

  return segments;
}

function bisectHybridRoot(
  evaluate: (chroma: number) => number,
  loStart: number,
  hiStart: number,
  vLoStart: number,
  vHiStart: number,
): number {
  let lo = loStart;
  let hi = hiStart;
  let vLo = vLoStart;
  let vHi = vHiStart;
  for (let index = 0; index < DEFAULT_HYBRID_ROOT_ITERATIONS; index += 1) {
    const mid = (lo + hi) / 2;
    const vMid = evaluate(mid);
    if (
      Math.abs(vMid) <= HYBRID_ROOT_EPSILON ||
      hi - lo <= HYBRID_ROOT_EPSILON
    ) {
      return mid;
    }
    if ((vLo < 0 && vMid > 0) || (vLo > 0 && vMid < 0)) {
      hi = mid;
      vHi = vMid;
    } else {
      lo = mid;
      vLo = vMid;
    }
    if (Math.abs(vLo) <= HYBRID_ROOT_EPSILON) return lo;
    if (Math.abs(vHi) <= HYBRID_ROOT_EPSILON) return hi;
  }
  return (lo + hi) / 2;
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
  const anchors: number[] = [];
  appendUniqueAdaptiveAxis(anchors, 0, 0, 1, HYBRID_LIGHTNESS_EPSILON);
  appendUniqueAdaptiveAxis(anchors, 1, 0, 1, HYBRID_LIGHTNESS_EPSILON);
  appendUniqueAdaptiveAxis(
    anchors,
    cuspLightness,
    0,
    1,
    HYBRID_LIGHTNESS_EPSILON,
  );
  for (const probe of ADAPTIVE_EDGE_PROBES) {
    appendUniqueAdaptiveAxis(anchors, probe, 0, 1, HYBRID_LIGHTNESS_EPSILON);
    appendUniqueAdaptiveAxis(
      anchors,
      1 - probe,
      0,
      1,
      HYBRID_LIGHTNESS_EPSILON,
    );
  }
  for (let index = 1; index < targetSteps; index += 1) {
    appendUniqueAdaptiveAxis(
      anchors,
      index / targetSteps,
      0,
      1,
      HYBRID_LIGHTNESS_EPSILON,
    );
  }
  anchors.sort((a, b) => a - b);
  return anchors;
}

function contrastRegionPathsHybrid(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions,
): ContrastRegionPoint[][] | null {
  const criterion = resolveContrastCriterion(options);
  const maxChroma = Math.max(0, options.maxChroma ?? 0.4);
  if (maxChroma <= 0) return [];
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
        roots.push(bisectHybridRoot(evaluateChroma, prevC, c, prevV, v));
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
  const anchors = buildHybridLightnessAnchors(initialLightnessSteps, cusp.l);
  const seedSamples = anchors.map((anchor) => getLightnessSample(anchor));

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
  const refineInterval = (
    left: HybridLightnessSample,
    right: HybridLightnessSample,
    depth: number,
  ): void => {
    const midLightness = (left.l + right.l) / 2;
    const midpoint = getLightnessSample(midLightness);
    if (shouldSplitHybridInterval(left, right, midpoint, depth)) {
      refineInterval(left, midpoint, depth + 1);
      refineInterval(midpoint, right, depth + 1);
      return;
    }
    refinedSamples.push(right);
  };
  for (let index = 0; index < seedSamples.length - 1; index += 1) {
    refineInterval(seedSamples[index], seedSamples[index + 1], 0);
  }

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

  if (hasComplexTopology.value) {
    return null;
  }

  const hasRoots = refinedSamples.some((sample) => sample.roots.length > 0);
  if (hasRoots && cleaned.length === 0) {
    return null;
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
      return null;
    }
  }

  const simplifyTolerance = options.simplifyTolerance;
  const maybeSimplified =
    simplifyTolerance != null &&
    Number.isFinite(simplifyTolerance) &&
    simplifyTolerance > 0
      ? cleaned.map((path) => simplifyPolyline(path, simplifyTolerance, false))
      : cleaned;

  return maybeSimplified.sort((a, b) => b.length - a.length);
}

/**
 * Generate contour paths for the region that meets/exceeds
 * the configured contrast criterion at a fixed hue.
 */
export function contrastRegionPaths(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions = {},
): ContrastRegionPoint[][] {
  if (options.lightnessSteps != null) {
    validateSteps(
      'contrastRegionPaths() lightnessSteps',
      options.lightnessSteps,
    );
  }
  if (options.chromaSteps != null) {
    validateSteps('contrastRegionPaths() chromaSteps', options.chromaSteps);
  }
  if (
    options.edgeInterpolation != null &&
    options.edgeInterpolation !== 'linear' &&
    options.edgeInterpolation !== 'midpoint'
  ) {
    throw new Error(
      "contrastRegionPaths() edgeInterpolation must be 'linear' or 'midpoint'",
    );
  }

  const mode = options.samplingMode ?? 'hybrid';
  const requestedLegacySamplingMode = mode === 'uniform' || mode === 'adaptive';
  const usesLegacyControls =
    requestedLegacySamplingMode ||
    options.edgeInterpolation != null ||
    options.adaptiveBaseSteps != null ||
    options.adaptiveMaxDepth != null;
  if (usesLegacyControls) {
    return contrastRegionPathsLegacy(reference, hue, {
      ...options,
      samplingMode: requestedLegacySamplingMode
        ? mode
        : options.adaptiveBaseSteps != null || options.adaptiveMaxDepth != null
          ? 'adaptive'
          : 'uniform',
    });
  }

  const hybridPaths = contrastRegionPathsHybrid(reference, hue, options);
  if (hybridPaths) {
    return hybridPaths;
  }
  return contrastRegionPathsLegacy(reference, hue, {
    ...options,
    samplingMode: 'adaptive',
  });
}

/**
 * Convenience helper that returns the largest detected contour path.
 */
export function contrastRegionPath(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions = {},
): ContrastRegionPoint[] {
  const paths = contrastRegionPaths(reference, hue, options);
  return paths[0] ?? [];
}
