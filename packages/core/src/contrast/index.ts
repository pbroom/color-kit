import type { Color } from '../types.js';
import {
  maxChromaAt,
  toP3Gamut,
  toSrgbGamut,
  type GamutTarget,
} from '../gamut/index.js';
import { toRgb } from '../conversion/index.js';
import { oklabToLinearRgb } from '../conversion/oklab.js';
import { oklchToOklab } from '../conversion/oklch.js';
import { srgbToLinearChannel } from '../utils/index.js';

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

export interface ContrastRegionPoint {
  l: number;
  c: number;
}

export interface ContrastRegionPathOptions {
  gamut?: GamutTarget;
  /**
   * Explicit contrast threshold. If provided it overrides `level`.
   */
  threshold?: number;
  /**
   * WCAG threshold preset.
   * @default 'AA' (4.5:1)
   */
  level?: ContrastRegionLevel;
  /**
   * Number of sampled lightness cells.
   * The lightness axis has `lightnessSteps + 1` points.
   */
  lightnessSteps?: number;
  /**
   * Number of sampled chroma cells.
   * The chroma axis has `chromaSteps + 1` points.
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
   */
  edgeInterpolation?: 'linear' | 'midpoint';
}

const DEFAULT_LIGHTNESS_STEPS = 64;
const DEFAULT_CHROMA_STEPS = 64;

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

function validateSteps(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 2) {
    throw new Error(`${name} must be an integer >= 2`);
  }
  return value;
}

function pointKey(point: ContrastRegionPoint): string {
  return `${point.l.toFixed(6)}:${point.c.toFixed(6)}`;
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
): ContrastRegionPoint[][] {
  if (segments.length === 0) return [];

  const pointByKey = new Map<string, ContrastRegionPoint>();
  const adjacency = new Map<string, Set<string>>();
  const visitedEdges = new Set<string>();

  for (const [a, b] of segments) {
    const aKey = pointKey(a);
    const bKey = pointKey(b);
    pointByKey.set(aKey, a);
    pointByKey.set(bKey, b);

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
export function contrastRegionPaths(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions = {},
): ContrastRegionPoint[][] {
  const threshold = resolveContrastThreshold(options);
  if (!Number.isFinite(threshold) || threshold <= 1) {
    throw new Error('contrastRegionPaths() requires threshold > 1');
  }

  const lightnessSteps = validateSteps(
    'contrastRegionPaths() lightnessSteps',
    options.lightnessSteps ?? DEFAULT_LIGHTNESS_STEPS,
  );
  const chromaSteps = validateSteps(
    'contrastRegionPaths() chromaSteps',
    options.chromaSteps ?? DEFAULT_CHROMA_STEPS,
  );

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
      row.push(
        contrastRatioUnclamped(mappedSample, mappedReference) - threshold,
      );
    }
    scoreGrid.push(row);
  }

  const segments: Array<[ContrastRegionPoint, ContrastRegionPoint]> = [];

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

  return buildContourPaths(segments);
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
