import { describe, expect, it } from 'vitest';
import {
  chromaBand,
  contrastAPCA,
  contrastRatio,
  contrastRegionPaths,
  definePlane,
  fromHex,
  gamutBoundaryPath,
  generateScale,
  interpolate,
  interpolateInto,
  maxChromaAt,
  maxChromaForHue,
  mix,
  mixInto,
  packColors,
  parse,
  runPlaneQueries,
  toCss,
  unpackColors,
  type Color,
  type PlaneQuery,
} from '../src/index.js';

const HINT = "use 'display-p3'";
const EXACT_HINT = "'p3' is not supported; use 'display-p3'";

const a = parse('#3b82f6');
const b = parse('#ef4444');
const out: Color = { l: 0, c: 0, h: 0, alpha: 1 };
const plane = definePlane({ model: 'oklch' });
const reference = fromHex('#111827');

// Every public entry point that takes a space, gamut, model or format must
// reject the removed `'p3'` spelling with a TypeError that points at
// `'display-p3'`.
const ENTRY_POINTS: ReadonlyArray<readonly [string, () => unknown]> = [
  // format
  ['toCss format', () => toCss(a, 'p3' as never)],
  // interpolation space
  ['mix', () => mix(a, b, 0.5, { space: 'p3' as never })],
  ['mixInto', () => mixInto(out, a, b, 0.5, { space: 'p3' as never })],
  ['interpolate', () => interpolate(a, b, 0.5, { space: 'p3' as never })],
  [
    'interpolateInto',
    () => interpolateInto(out, a, b, 0.5, { space: 'p3' as never }),
  ],
  ['generateScale', () => generateScale(a, b, 4, { space: 'p3' as never })],
  // plane model
  ['definePlane model', () => definePlane({ model: 'p3' as never })],
  // array interop space
  ['packColors', () => packColors([a], 'p3' as never)],
  ['unpackColors', () => unpackColors(new Float32Array(3), 'p3' as never)],
  // gamut target
  ['maxChromaAt', () => maxChromaAt(0.5, 200, { gamut: 'p3' as never })],
  ['maxChromaForHue', () => maxChromaForHue(200, { gamut: 'p3' as never })],
  [
    'maxChromaForHue (direct)',
    () => maxChromaForHue(200, { gamut: 'p3' as never, method: 'direct' }),
  ],
  ['chromaBand', () => chromaBand(200, 0.1, { gamut: 'p3' as never })],
  ['gamutBoundaryPath', () => gamutBoundaryPath(200, { gamut: 'p3' as never })],
  [
    'gamutBoundaryPath (adaptive)',
    () =>
      gamutBoundaryPath(200, {
        gamut: 'p3' as never,
        samplingMode: 'adaptive',
      }),
  ],
  [
    'contrastRatio',
    () => contrastRatio(a, reference, { gamut: 'p3' as never }),
  ],
  ['contrastAPCA', () => contrastAPCA(a, reference, { gamut: 'p3' as never })],
  [
    'contrastRegionPaths',
    () =>
      contrastRegionPaths(reference, 200, {
        threshold: 4.5,
        gamut: 'p3' as never,
      }),
  ],
];

const PLANE_QUERIES: ReadonlyArray<readonly [string, PlaneQuery]> = [
  ['gamutBoundary', { kind: 'gamutBoundary', gamut: 'p3' as never }],
  ['gamutRegion', { kind: 'gamutRegion', gamut: 'p3' as never }],
  ['fallbackPoint', { kind: 'fallbackPoint', color: a, gamut: 'p3' as never }],
  [
    'chromaBand',
    {
      kind: 'chromaBand',
      hue: 200,
      requestedChroma: 0.1,
      gamut: 'p3' as never,
    },
  ],
  [
    'contrastBoundary',
    {
      kind: 'contrastBoundary',
      reference,
      hue: 200,
      threshold: 4.5,
      gamut: 'p3' as never,
    },
  ],
  [
    'contrastRegion',
    {
      kind: 'contrastRegion',
      reference,
      hue: 200,
      gamut: 'p3' as never,
    },
  ],
];

describe("the removed 'p3' spelling", () => {
  it.each(ENTRY_POINTS)('%s throws a TypeError with the hint', (_name, run) => {
    expect(run).toThrow(TypeError);
    expect(run).toThrow(HINT);
    expect(run).toThrow(EXACT_HINT);
  });

  it.each(PLANE_QUERIES)(
    'plane %s query throws a TypeError with the hint',
    (_name, query) => {
      const run = () => runPlaneQueries(plane, [query]);
      expect(run).toThrow(TypeError);
      expect(run).toThrow(EXACT_HINT);
    },
  );

  it('rejects other unknown gamuts without the p3 hint', () => {
    const run = () => maxChromaAt(0.5, 200, { gamut: 'rec2020' as never });
    expect(run).toThrow(TypeError);
    expect(run).toThrow(/unknown gamut "rec2020"/);
    expect(run).not.toThrow(HINT);
  });

  it("keeps accepting 'display-p3' everywhere 'p3' is rejected", () => {
    expect(toCss(a, 'display-p3')).toMatch(/^color\(display-p3 /);
    expect(mix(a, b, 0.5, { space: 'display-p3' })).toBeDefined();
    expect(definePlane({ model: 'display-p3' }).model).toBe('display-p3');
    expect(packColors([a], 'linearP3')).toHaveLength(3);
    expect(maxChromaAt(0.5, 200, { gamut: 'display-p3' })).toBeGreaterThan(0);
  });
});
