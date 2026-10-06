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
      lightnessSteps: 24,
      chromaSteps: 24,
    });
    const second = contrastRegionPaths(reference, 210, {
      level: 'AA',
      gamut: 'srgb',
      lightnessSteps: 24,
      chromaSteps: 24,
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

  it('supports linear edge interpolation for higher contour precision', () => {
    const reference = fromHex('#ffffff');

    const midpoint = contrastRegionPaths(reference, 203, {
      level: 'AA',
      gamut: 'srgb',
      lightnessSteps: 24,
      chromaSteps: 24,
      engine: 'legacy',
      edgeInterpolation: 'midpoint',
    });
    const linear = contrastRegionPaths(reference, 203, {
      level: 'AA',
      gamut: 'srgb',
      lightnessSteps: 24,
      chromaSteps: 24,
      engine: 'legacy',
      edgeInterpolation: 'linear',
    });

    expect(midpoint.length).toBeGreaterThan(0);
    expect(linear.length).toBeGreaterThan(0);

    const midpointPath = midpoint[0] ?? [];
    const linearPath = linear[0] ?? [];
    const count = Math.min(midpointPath.length, linearPath.length);
    let maxDelta = 0;
    for (let index = 0; index < count; index += 1) {
      const deltaL = Math.abs(midpointPath[index].l - linearPath[index].l);
      const deltaC = Math.abs(midpointPath[index].c - linearPath[index].c);
      maxDelta = Math.max(maxDelta, deltaL, deltaC);
    }

    expect(maxDelta).toBeGreaterThan(0.0001);
  });

  it('tightens the region for stricter WCAG levels', () => {
    const reference = fromHex('#ffffff');

    const aa = contrastRegionPaths(reference, 145, {
      level: 'AA',
      lightnessSteps: 28,
      chromaSteps: 28,
    });
    const aaa = contrastRegionPaths(reference, 145, {
      level: 'AAA',
      lightnessSteps: 28,
      chromaSteps: 28,
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
      lightnessSteps: 16,
      chromaSteps: 16,
    });

    expect(paths).toEqual([]);
  });

  it('uses unclamped luminance for display-p3 sampling', () => {
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
      lightnessSteps: 2,
      chromaSteps: 2,
      maxChroma,
    });

    const maxL = Math.max(...flattenLightness(paths));
    expect(maxL).toBeGreaterThan(0.25);
  });

  it('exposes a convenience helper for the largest contour path', () => {
    const reference = fromHex('#111827');

    const paths = contrastRegionPaths(reference, 320, {
      level: 'AA',
      lightnessSteps: 22,
      chromaSteps: 22,
    });
    const largest = contrastRegionPath(reference, 320, {
      level: 'AA',
      lightnessSteps: 22,
      chromaSteps: 22,
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
        lightnessSteps: 1,
      }),
    ).toThrow('contrastRegionPaths() lightnessSteps must be an integer >= 2');

    expect(() =>
      contrastRegionPaths(reference, 200, {
        engine: 'legacy',
        edgeInterpolation: 'nearest' as unknown as 'linear',
      }),
    ).toThrow(
      "contrastRegionPaths() edgeInterpolation must be 'linear' or 'midpoint'",
    );
  });

  it.each([
    ['samplingMode', 'adaptive'],
    ['edgeInterpolation', 'linear'],
    ['adaptiveBaseSteps', 12],
    ['adaptiveMaxDepth', 2],
  ])(
    'rejects the legacy-only %s option without engine: legacy',
    (name, value) => {
      const options = { level: 'AA', [name]: value } as unknown as Parameters<
        typeof contrastRegionPaths
      >[2];
      expect(() =>
        contrastRegionPaths(fromHex('#ffffff'), 200, options),
      ).toThrow(
        new TypeError(
          `contrastRegionPaths() option "${name}" requires engine: 'legacy' (the default hybrid engine is tuned with lightnessSteps, chromaSteps, hybridMaxDepth, and hybridErrorTolerance)`,
        ),
      );
    },
  );

  it.each([
    ['hybridMaxDepth', 6],
    ['hybridErrorTolerance', 0.001],
  ])('rejects the hybrid-only %s option with engine: legacy', (name, value) => {
    const options = {
      engine: 'legacy',
      level: 'AA',
      [name]: value,
    } as unknown as Parameters<typeof contrastRegionPaths>[2];
    expect(() => contrastRegionPaths(fromHex('#ffffff'), 200, options)).toThrow(
      TypeError,
    );
  });

  it('rejects unknown engines and legacy sampling modes', () => {
    const reference = fromHex('#ffffff');
    expect(() =>
      contrastRegionPaths(reference, 200, {
        engine: 'marching' as unknown as 'legacy',
      }),
    ).toThrow(
      new TypeError(
        "contrastRegionPaths() engine must be 'hybrid' or 'legacy'",
      ),
    );
    expect(() =>
      contrastRegionPaths(reference, 200, {
        engine: 'legacy',
        samplingMode: 'hybrid' as unknown as 'uniform',
      }),
    ).toThrow(TypeError);
  });

  it('rejects mixed-engine options at the type level', () => {
    const reference = fromHex('#ffffff');
    expect(() =>
      // @ts-expect-error samplingMode requires engine: 'legacy'
      contrastRegionPaths(reference, 200, { samplingMode: 'adaptive' }),
    ).toThrow(TypeError);
    expect(() =>
      contrastRegionPaths(reference, 200, {
        engine: 'legacy',
        // @ts-expect-error hybridMaxDepth only applies to the hybrid engine
        hybridMaxDepth: 6,
      }),
    ).toThrow(TypeError);
  });

  it('runs the selected engine and records it in the trace', () => {
    const plane = definePlane({ fixed: { h: 200 } });
    const base = {
      kind: 'contrastRegion' as const,
      reference: fromHex('#ffffff'),
      level: 'AA' as const,
    };
    expect(inspectPlaneQuery(plane, base).trace.summary.solver).toBe(
      'contrast-hybrid',
    );
    expect(
      inspectPlaneQuery(plane, { ...base, engine: 'legacy' }).trace.summary
        .solver,
    ).toBe('contrast-legacy-uniform');
    expect(
      inspectPlaneQuery(plane, {
        ...base,
        engine: 'legacy',
        adaptiveBaseSteps: 12,
      }).trace.summary.solver,
    ).toBe('contrast-legacy-adaptive');
  });

  it('validates plane query engine options like direct calls', () => {
    const plane = definePlane({ fixed: { h: 200 } });
    const query = {
      kind: 'contrastRegion',
      reference: fromHex('#ffffff'),
      samplingMode: 'adaptive',
    } as unknown as Parameters<typeof inspectPlaneQuery>[1];
    expect(() => inspectPlaneQuery(plane, query)).toThrow(
      /option "samplingMode" requires engine: 'legacy'/,
    );
    const legacyWithHybridOption = {
      reference: fromHex('#ffffff'),
      engine: 'legacy',
      hybridErrorTolerance: 0.001,
    } as const;
    expect(() =>
      // @ts-expect-error hybridErrorTolerance only applies to the hybrid engine
      sense(plane).contrastBoundary(legacyWithHybridOption),
    ).toThrow(TypeError);
  });

  it('simplifyTolerance reduces contour point count', () => {
    const reference = fromHex('#ffffff');
    const raw = contrastRegionPaths(reference, 200, {
      level: 'AA',
      gamut: 'srgb',
      lightnessSteps: 32,
      chromaSteps: 32,
    });
    const simplified = contrastRegionPaths(reference, 200, {
      level: 'AA',
      gamut: 'srgb',
      lightnessSteps: 32,
      chromaSteps: 32,
      simplifyTolerance: 0.002,
    });
    expect(simplified.length).toBe(raw.length);
    const rawTotal = raw.reduce((s, p) => s + p.length, 0);
    const simplifiedTotal = simplified.reduce((s, p) => s + p.length, 0);
    expect(simplifiedTotal).toBeLessThanOrEqual(rawTotal);
    if (rawTotal > 4) expect(simplifiedTotal).toBeLessThan(rawTotal);
  });

  it('adaptive sampling returns deterministic contour paths', () => {
    const reference = fromHex('#ffffff');
    const first = contrastRegionPaths(reference, 150, {
      level: 'AA',
      gamut: 'srgb',
      engine: 'legacy',
      samplingMode: 'adaptive',
      adaptiveBaseSteps: 12,
      adaptiveMaxDepth: 2,
    });
    const second = contrastRegionPaths(reference, 150, {
      level: 'AA',
      gamut: 'srgb',
      engine: 'legacy',
      samplingMode: 'adaptive',
      adaptiveBaseSteps: 12,
      adaptiveMaxDepth: 2,
    });
    expect(first.length).toBe(second.length);
    for (let i = 0; i < first.length; i += 1) {
      expect(first[i].length).toBe(second[i].length);
      for (let j = 0; j < first[i].length; j += 1) {
        expect(first[i][j].l).toBe(second[i][j].l);
        expect(first[i][j].c).toBe(second[i][j].c);
      }
    }
  });

  it('adaptive contours are bounded and non-empty when threshold is attainable', () => {
    const reference = fromHex('#ffffff');
    const paths = contrastRegionPaths(reference, 200, {
      level: 'AA',
      gamut: 'srgb',
      engine: 'legacy',
      samplingMode: 'adaptive',
      adaptiveBaseSteps: 16,
      adaptiveMaxDepth: 2,
    });
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.length).toBeGreaterThan(1);
      for (const point of path) {
        expect(point.l).toBeGreaterThanOrEqual(0);
        expect(point.l).toBeLessThanOrEqual(1);
        expect(point.c).toBeGreaterThanOrEqual(0);
        expect(point.c).toBeLessThanOrEqual(0.4);
      }
    }
  });

  it('adaptive mode produces stitched contours with shared vertices within tolerance', () => {
    const reference = fromHex('#ffffff');
    const paths = contrastRegionPaths(reference, 200, {
      level: 'AA',
      gamut: 'srgb',
      engine: 'legacy',
      samplingMode: 'adaptive',
      adaptiveBaseSteps: 12,
      adaptiveMaxDepth: 3,
      edgeInterpolation: 'linear',
    });
    expect(paths.length).toBeGreaterThan(0);
    const totalPoints = paths.reduce((s, p) => s + p.length, 0);
    expect(totalPoints).toBeGreaterThan(2);
    for (const path of paths) {
      for (const point of path) {
        expect(point.l).toBeGreaterThanOrEqual(0);
        expect(point.l).toBeLessThanOrEqual(1);
        expect(point.c).toBeGreaterThanOrEqual(0);
        expect(point.c).toBeLessThanOrEqual(0.4);
      }
    }
  });

  it('adaptive sampling keeps high-fidelity detail near sharp gamut edges', () => {
    const reference = { l: 0.0839, c: 0.0158, h: 9, alpha: 1 };
    const adaptive = contrastRegionPaths(reference, 9, {
      gamut: 'srgb',
      threshold: 3,
      engine: 'legacy',
      samplingMode: 'adaptive',
      adaptiveBaseSteps: 8,
      adaptiveMaxDepth: 2,
      edgeInterpolation: 'linear',
    });
    const uniform = contrastRegionPaths(reference, 9, {
      gamut: 'srgb',
      threshold: 3,
      engine: 'legacy',
      samplingMode: 'uniform',
      lightnessSteps: 8,
      chromaSteps: 8,
      edgeInterpolation: 'linear',
    });

    const adaptivePoints = adaptive.reduce((sum, path) => sum + path.length, 0);
    const uniformPoints = uniform.reduce((sum, path) => sum + path.length, 0);
    expect(adaptivePoints).toBeGreaterThan(uniformPoints * 4);
  });

  it('supports APCA criteria in hybrid mode', () => {
    const reference = fromHex('#ffffff');
    const paths = contrastRegionPaths(reference, 210, {
      metric: 'apca',
      threshold: 0.6,
      apcaPolarity: 'absolute',
      lightnessSteps: 48,
      chromaSteps: 48,
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

  it('respects APCA legacy samplingMode overrides', () => {
    const reference = fromHex('#ffffff');
    const uniformMidpoint = contrastRegionPaths(reference, 210, {
      metric: 'apca',
      threshold: 0.45,
      apcaPolarity: 'absolute',
      engine: 'legacy',
      samplingMode: 'uniform',
      lightnessSteps: 22,
      chromaSteps: 22,
      edgeInterpolation: 'midpoint',
    });
    const uniformLinear = contrastRegionPaths(reference, 210, {
      metric: 'apca',
      threshold: 0.45,
      apcaPolarity: 'absolute',
      engine: 'legacy',
      samplingMode: 'uniform',
      lightnessSteps: 22,
      chromaSteps: 22,
      edgeInterpolation: 'linear',
    });
    const adaptiveMidpoint = contrastRegionPaths(reference, 210, {
      metric: 'apca',
      threshold: 0.45,
      apcaPolarity: 'absolute',
      engine: 'legacy',
      samplingMode: 'adaptive',
      adaptiveBaseSteps: 12,
      adaptiveMaxDepth: 2,
      edgeInterpolation: 'midpoint',
    });
    const adaptiveLinear = contrastRegionPaths(reference, 210, {
      metric: 'apca',
      threshold: 0.45,
      apcaPolarity: 'absolute',
      engine: 'legacy',
      samplingMode: 'adaptive',
      adaptiveBaseSteps: 12,
      adaptiveMaxDepth: 2,
      edgeInterpolation: 'linear',
    });

    expect(uniformMidpoint.length).toBeGreaterThan(0);
    expect(uniformLinear.length).toBeGreaterThan(0);
    expect(adaptiveMidpoint.length).toBeGreaterThan(0);
    expect(adaptiveLinear.length).toBeGreaterThan(0);
    expect(uniformMidpoint).not.toEqual(uniformLinear);
    expect(adaptiveMidpoint).not.toEqual(adaptiveLinear);
  });

  it('supports APCA polarity-specific regions', () => {
    const reference = fromHex('#ffffff');
    const positive = contrastRegionPaths(reference, 210, {
      metric: 'apca',
      threshold: 0.45,
      apcaPolarity: 'positive',
      lightnessSteps: 40,
      chromaSteps: 40,
    });
    const negative = contrastRegionPaths(reference, 210, {
      metric: 'apca',
      threshold: 0.45,
      apcaPolarity: 'negative',
      lightnessSteps: 40,
      chromaSteps: 40,
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

  it('hybrid tracing remains deterministic with explicit refinement controls', () => {
    const reference = fromHex('#f9fafb');
    const options = {
      metric: 'wcag' as const,
      threshold: 4.5,
      lightnessSteps: 88,
      chromaSteps: 180,
      hybridMaxDepth: 8,
      hybridErrorTolerance: 0.0009,
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
