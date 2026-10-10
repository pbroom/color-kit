import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  contrastRegionPath,
  contrastRegionPaths,
  definePlane,
  fromHex,
  inP3Gamut,
  inSrgbGamut,
  inspectPlaneQuery,
  sense,
} from '../src/index.js';

function flattenLightness(paths: Array<Array<{ l: number }>>): number[] {
  return paths.flatMap((path) => path.map((point) => point.l));
}

describe('contrastRegionPaths()', () => {
  it('returns deterministic, bounded contour paths', () => {
    const reference = fromHex('#ffffff');

    const first = contrastRegionPaths(reference, 210, {
      level: 'AA',
      gamut: 'srgb',
      initialSamples: 24,
    });
    const second = contrastRegionPaths(reference, 210, {
      level: 'AA',
      gamut: 'srgb',
      initialSamples: 24,
    });

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);

    for (const path of first) {
      expect(path.length).toBeGreaterThan(1);
      for (const point of path) {
        expect(point.l).toBeGreaterThanOrEqual(0);
        expect(point.l).toBeLessThanOrEqual(1);
        expect(point.c).toBeGreaterThanOrEqual(0);
        expect(point.c).toBeLessThanOrEqual(0.4);
      }
    }
  });

  it('tightens the region for stricter WCAG levels', () => {
    const reference = fromHex('#ffffff');

    const aa = contrastRegionPaths(reference, 145, {
      level: 'AA',
      initialSamples: 28,
    });
    const aaa = contrastRegionPaths(reference, 145, {
      level: 'AAA',
      initialSamples: 28,
    });

    expect(aa.length).toBeGreaterThan(0);
    expect(aaa.length).toBeGreaterThan(0);

    const aaMaxL = Math.max(...flattenLightness(aa));
    const aaaMaxL = Math.max(...flattenLightness(aaa));
    expect(aaaMaxL).toBeLessThanOrEqual(aaMaxL + 1e-6);
  });

  it('returns no contours when the threshold is unattainable', () => {
    const reference = fromHex('#ffffff');

    const paths = contrastRegionPaths(reference, 200, {
      threshold: 22,
      initialSamples: 16,
    });

    expect(paths).toEqual([]);
  });

  it('measures luminance in the display-p3 gamut for display-p3 regions', () => {
    const reference = { l: 0.9, c: 0.03, h: 95, alpha: 1 };
    const sample = {
      l: 0.5,
      c: 0.22809734908482968,
      h: 24.864352050672835,
      alpha: 1,
    };
    const threshold = 4.8;

    expect(inP3Gamut(sample)).toBe(true);
    expect(inSrgbGamut(sample)).toBe(false);
    expect(contrastRatio(sample, reference)).toBeLessThan(threshold);

    const maxChroma = sample.c * 2;
    const paths = contrastRegionPaths(reference, sample.h, {
      gamut: 'display-p3',
      threshold,
      initialSamples: 2,
      maxChroma,
    });

    const maxL = Math.max(...flattenLightness(paths));
    expect(maxL).toBeGreaterThan(0.25);
  });

  it('exposes a convenience helper for the largest contour path', () => {
    const reference = fromHex('#111827');

    const paths = contrastRegionPaths(reference, 320, {
      level: 'AA',
      initialSamples: 22,
    });
    const largest = contrastRegionPath(reference, 320, {
      level: 'AA',
      initialSamples: 22,
    });

    expect(largest).toEqual(paths[0] ?? []);
  });

  it('validates threshold and sampling options', () => {
    const reference = fromHex('#ffffff');

    expect(() =>
      contrastRegionPaths(reference, 200, {
        threshold: 1,
      }),
    ).toThrow('contrastRegionPaths() requires threshold > 1');

    expect(() =>
      contrastRegionPaths(reference, 200, {
        initialSamples: 1,
      }),
    ).toThrow('contrastRegionPaths() initialSamples must be an integer >= 2');
    expect(() =>
      contrastRegionPaths(reference, 200, {
        initialSamples: 2.5,
      }),
    ).toThrow('contrastRegionPaths() initialSamples must be an integer >= 2');
    expect(() =>
      contrastRegionPaths(reference, 200, {
        maxDepth: -1,
      }),
    ).toThrow('contrastRegionPaths() maxDepth must be an integer >= 0');
    expect(() =>
      contrastRegionPaths(reference, 200, {
        errorTolerance: 0,
      }),
    ).toThrow(
      'contrastRegionPaths() errorTolerance must be a finite number > 0',
    );
    expect(() =>
      contrastRegionPaths(reference, 200, {
        errorTolerance: Number.NaN,
      }),
    ).toThrow(
      'contrastRegionPaths() errorTolerance must be a finite number > 0',
    );
  });

  it('clamps oversized sampling options', () => {
    const reference = fromHex('#767676');
    const started = performance.now();
    const huge = contrastRegionPaths(reference, 30, {
      threshold: 3,
      initialSamples: 2_000_000,
      maxDepth: 40,
      errorTolerance: 1e-15,
    });
    expect(performance.now() - started).toBeLessThan(2000);
    const clamped = contrastRegionPaths(reference, 30, {
      threshold: 3,
      initialSamples: 512,
      maxDepth: 12,
      errorTolerance: 1e-6,
    });
    expect(huge).toEqual(clamped);
  });

  it.each([
    ['engine', 'legacy'],
    ['engine', 'hybrid'],
    ['samplingMode', 'adaptive'],
    ['edgeInterpolation', 'linear'],
    ['adaptiveBaseSteps', 12],
    ['adaptiveMaxDepth', 2],
  ])('rejects the removed legacy-engine option %s', (name, value) => {
    const options = { level: 'AA', [name]: value } as unknown as Parameters<
      typeof contrastRegionPaths
    >[2];
    expect(() => contrastRegionPaths(fromHex('#ffffff'), 200, options)).toThrow(
      new TypeError(
        `contrastRegionPaths() option "${name}" was removed with the legacy contrast-region engine; tune the solver with initialSamples, errorTolerance, and maxDepth`,
      ),
    );
  });

  it.each([
    ['lightnessSteps', 72],
    ['chromaSteps', 96],
    ['hybridMaxDepth', 7],
    ['hybridErrorTolerance', 0.0015],
    ['tolerance', 1e-4],
    ['maxIterations', 30],
  ])('rejects the removed hybrid-solver option %s', (name, value) => {
    const options = { level: 'AA', [name]: value } as unknown as Parameters<
      typeof contrastRegionPaths
    >[2];
    expect(() => contrastRegionPaths(fromHex('#ffffff'), 200, options)).toThrow(
      new TypeError(
        `contrastRegionPaths() option "${name}" was removed with the hybrid contrast-region solver; tune the solver with initialSamples, errorTolerance, and maxDepth`,
      ),
    );
  });

  it('rejects removed legacy-engine options at the type level', () => {
    const reference = fromHex('#ffffff');
    expect(() =>
      // @ts-expect-error engine was removed with the legacy engine
      contrastRegionPaths(reference, 200, { engine: 'legacy' }),
    ).toThrow(TypeError);
    expect(() =>
      // @ts-expect-error samplingMode was removed with the legacy engine
      contrastRegionPaths(reference, 200, { samplingMode: 'adaptive' }),
    ).toThrow(TypeError);
    expect(() =>
      // @ts-expect-error hybridMaxDepth was removed with the hybrid solver
      contrastRegionPaths(reference, 200, { hybridMaxDepth: 7 }),
    ).toThrow(TypeError);
    expect(() =>
      // @ts-expect-error lightnessSteps was removed with the hybrid solver
      contrastRegionPaths(reference, 200, { lightnessSteps: 72 }),
    ).toThrow(TypeError);
  });

  it('records the solver and its sampling in the trace', () => {
    const plane = definePlane({ fixed: { h: 200 } });
    const inspection = inspectPlaneQuery(plane, {
      kind: 'contrastRegion',
      reference: fromHex('#ffffff'),
      level: 'AA',
      initialSamples: 12,
      errorTolerance: 0.002,
      maxDepth: 4,
      simplifyTolerance: 0.0005,
    });
    const { summary, stages } = inspection.trace;
    expect(summary.solver).toBe('contrast-rays');
    expect(summary.samplingMode).toBe('adaptive');
    expect(summary.fidelity).toEqual({
      simplifyTolerance: 0.0005,
      resolution: 12,
      maxDepth: 4,
      errorTolerance: 0.002,
    });
    expect(summary).not.toHaveProperty('degradedReason');
    expect(summary.droppedPieceCount).toBe(0);
    expect(summary.sampleCount).toBeGreaterThan(0);
    expect(summary.pathCount).toBe(inspection.result.paths.length);
    expect(stages[0]).toEqual({
      kind: 'solver',
      solver: 'contrast-rays',
      samplingMode: 'adaptive',
    });
    expect(
      stages.some(
        (stage) =>
          stage.kind === 'paths' &&
          stage.label === 'contrast-region-paths' &&
          stage.pathCount === inspection.result.paths.length,
      ),
    ).toBe(true);
  });

  it('records the clamped sampling it ran with', () => {
    const plane = definePlane({ fixed: { h: 200 } });
    const { summary } = inspectPlaneQuery(plane, {
      kind: 'contrastRegion',
      reference: fromHex('#ffffff'),
      initialSamples: 5000,
      maxDepth: 30,
      errorTolerance: 1e-9,
    }).trace;
    expect(summary.fidelity).toMatchObject({
      resolution: 512,
      maxDepth: 12,
      errorTolerance: 1e-6,
    });
  });

  it('rejects removed options in plane queries like direct calls', () => {
    const plane = definePlane({ fixed: { h: 200 } });
    const query = {
      kind: 'contrastRegion',
      reference: fromHex('#ffffff'),
      samplingMode: 'adaptive',
    } as unknown as Parameters<typeof inspectPlaneQuery>[1];
    expect(() => inspectPlaneQuery(plane, query)).toThrow(
      /option "samplingMode" was removed with the legacy contrast-region engine/,
    );
    expect(() =>
      sense(plane).contrastBoundary({
        reference: fromHex('#ffffff'),
        // @ts-expect-error engine was removed with the legacy engine
        engine: 'hybrid',
      }),
    ).toThrow(TypeError);
    expect(() =>
      sense(plane).contrastRegion({
        reference: fromHex('#ffffff'),
        // @ts-expect-error hybridErrorTolerance was removed with the hybrid solver
        hybridErrorTolerance: 0.003,
      }),
    ).toThrow(
      /option "hybridErrorTolerance" was removed with the hybrid contrast-region solver/,
    );
  });

  it('validates options on planes that return no geometry', () => {
    // An RGB plane is not lightness × chroma, so it returns empty geometry
    // without running the solver, but must reject what an L×C plane rejects.
    const rgbPlane = definePlane({ model: 'rgb' });
    const reference = fromHex('#ffffff');
    const invalid: Array<[Record<string, unknown>, RegExp]> = [
      [{ initialSamples: 1 }, /initialSamples must be an integer >= 2/],
      [{ maxDepth: -1 }, /maxDepth must be an integer >= 0/],
      [{ errorTolerance: 0 }, /errorTolerance must be a finite number > 0/],
      [{ threshold: 1 }, /requires threshold > 1/],
      [
        { lightnessSteps: 72 },
        /option "lightnessSteps" was removed with the hybrid contrast-region solver/,
      ],
      [
        { samplingMode: 'adaptive' },
        /option "samplingMode" was removed with the legacy contrast-region engine/,
      ],
    ];
    for (const [options, message] of invalid) {
      for (const kind of ['contrastRegion', 'contrastBoundary'] as const) {
        const query = { kind, reference, ...options } as unknown as Parameters<
          typeof inspectPlaneQuery
        >[1];
        expect(() => inspectPlaneQuery(rgbPlane, query), kind).toThrow(message);
      }
    }
    // Valid options still return empty geometry there.
    expect(
      sense(rgbPlane).contrastRegion({ reference, initialSamples: 1000 }).paths,
    ).toEqual([]);
    expect(
      sense(rgbPlane).contrastBoundary({ reference, maxDepth: 20 }).points,
    ).toEqual([]);
  });

  it('simplifyTolerance reduces contour point count', () => {
    const reference = fromHex('#ffffff');
    const raw = contrastRegionPaths(reference, 200, {
      level: 'AA',
      gamut: 'srgb',
      initialSamples: 32,
    });
    const simplified = contrastRegionPaths(reference, 200, {
      level: 'AA',
      gamut: 'srgb',
      initialSamples: 32,
      simplifyTolerance: 0.002,
    });
    expect(simplified.length).toBe(raw.length);
    const rawTotal = raw.reduce((s, p) => s + p.length, 0);
    const simplifiedTotal = simplified.reduce((s, p) => s + p.length, 0);
    expect(simplifiedTotal).toBeLessThanOrEqual(rawTotal);
    if (rawTotal > 4) expect(simplifiedTotal).toBeLessThan(rawTotal);
  });

  it('supports APCA criteria', () => {
    const reference = fromHex('#ffffff');
    const paths = contrastRegionPaths(reference, 210, {
      metric: 'apca',
      threshold: 0.6,
      apcaPolarity: 'absolute',
      initialSamples: 48,
    });
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      for (const point of path) {
        expect(point.l).toBeGreaterThanOrEqual(0);
        expect(point.l).toBeLessThanOrEqual(1);
        expect(point.c).toBeGreaterThanOrEqual(0);
        expect(point.c).toBeLessThanOrEqual(0.4);
      }
    }
  });

  it('supports APCA polarity-specific regions', () => {
    const reference = fromHex('#ffffff');
    const positive = contrastRegionPaths(reference, 210, {
      metric: 'apca',
      threshold: 0.45,
      apcaPolarity: 'positive',
      initialSamples: 40,
    });
    const negative = contrastRegionPaths(reference, 210, {
      metric: 'apca',
      threshold: 0.45,
      apcaPolarity: 'negative',
      initialSamples: 40,
    });
    const positivePoints = positive.reduce((sum, path) => sum + path.length, 0);
    const negativePoints = negative.reduce((sum, path) => sum + path.length, 0);
    expect(positivePoints).toBeGreaterThan(0);
    expect(negativePoints).toBe(0);
  });

  it('validates APCA threshold constraints', () => {
    const reference = fromHex('#ffffff');
    expect(() =>
      contrastRegionPaths(reference, 220, {
        metric: 'apca',
        threshold: 0,
      }),
    ).toThrow('contrastRegionPaths() APCA threshold must be > 0');
  });

  it('tracing remains deterministic with explicit refinement controls', () => {
    const reference = fromHex('#f9fafb');
    const options = {
      metric: 'wcag' as const,
      threshold: 4.5,
      initialSamples: 88,
      maxDepth: 8,
      errorTolerance: 0.0009,
    };
    const first = contrastRegionPaths(reference, 230, options);
    const second = contrastRegionPaths(reference, 230, options);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    for (const path of first) {
      expect(path.length).toBeGreaterThan(1);
      for (let index = 1; index < path.length; index += 1) {
        const prev = path[index - 1];
        const next = path[index];
        expect(prev.l === next.l && prev.c === next.c).toBe(false);
      }
      // Open paths start at their lower-lightness end. (A contour can fold
      // back in lightness, so points are not monotonic in between.)
      expect(path[0].l).toBeLessThanOrEqual(path[path.length - 1].l);
    }
  });
});
