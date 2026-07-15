import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContrastHybridFallbackReason } from '../src/contrast/types.js';
import type { InternalPlaneTraceContext } from '../src/plane/trace.js';

afterEach(() => {
  vi.doUnmock('../src/gamut/index.js');
  vi.doUnmock('../src/contrast/region-hybrid.js');
  vi.resetModules();
});

describe('contrastRegionPaths() hybrid fallback', () => {
  it('falls back to legacy adaptive tracing when hybrid sees complex topology', async () => {
    vi.resetModules();
    vi.doMock('../src/gamut/index.js', async () => {
      const actual = await vi.importActual<
        typeof import('../src/gamut/index.js')
      >('../src/gamut/index.js');
      const clamp = (value: number, min: number, max: number): number =>
        Math.min(max, Math.max(min, value));
      const warpLightness = (chroma: number): number =>
        0.5 + 0.22 * Math.sin(chroma * 240);
      const remap = (color: {
        l: number;
        c: number;
        h: number;
        alpha: number;
      }) =>
        color.c <= 0.01
          ? color
          : {
              ...color,
              l: clamp(warpLightness(color.c), 0, 1),
            };
      return {
        ...actual,
        maxChromaAt: () => 0.4,
        maxChromaForHue: () => ({ l: 0.5, c: 0.4 }),
        toSrgbGamut: remap,
        toP3Gamut: remap,
      };
    });

    const { fromHex } = await import('../src/conversion/index.js');
    const { definePlane, inspectPlaneQuery } =
      await import('../src/plane/index.js');
    const reference = fromHex('#ffffff');
    const options = {
      metric: 'wcag' as const,
      threshold: 4.5,
      samplingMode: 'hybrid' as const,
      lightnessSteps: 64,
      chromaSteps: 256,
      hybridMaxDepth: 7,
      hybridErrorTolerance: 0.0006,
    };

    const plane = definePlane({
      fixed: { h: 210 },
    });
    const query = {
      kind: 'contrastRegion' as const,
      reference,
      hue: 210,
      ...options,
    };
    const inspection = inspectPlaneQuery(plane, query);
    const legacyInspection = inspectPlaneQuery(plane, {
      ...query,
      samplingMode: 'adaptive',
    });
    const hybridAuto = inspection.result.paths.map((path) =>
      path.map(({ l, c }) => ({ l, c })),
    );
    const explicitLegacy = legacyInspection.result.paths.map((path) =>
      path.map(({ l, c }) => ({ l, c })),
    );
    const expectedCounters = {
      sampleCount: legacyInspection.trace.summary.sampleCount,
      scalarEvaluationCount:
        legacyInspection.trace.summary.scalarEvaluationCount,
      cellCount: legacyInspection.trace.summary.cellCount,
      segmentCount: legacyInspection.trace.summary.segmentCount,
      pathCount: legacyInspection.trace.summary.pathCount,
      pointCount: legacyInspection.trace.summary.pointCount,
    };

    expect(hybridAuto.length).toBeGreaterThan(0);
    expect(hybridAuto).toEqual(explicitLegacy);
    expect(inspection.trace.summary.solver).toBe('contrast-legacy-adaptive');
    expect(inspection.trace.summary.fallbackReason).toBe('complex-topology');
    expect(inspection.trace.summary).toMatchObject(expectedCounters);
    expect(
      inspection.trace.stages
        .filter((stage) => stage.kind === 'solver')
        .map((stage) => stage.solver),
    ).toEqual(['contrast-hybrid', 'contrast-legacy-adaptive']);
    expect(
      inspection.trace.stages.find((stage) => stage.kind === 'metrics'),
    ).toMatchObject({
      kind: 'metrics',
      summary: expectedCounters,
    });
  });

  it.each<ContrastHybridFallbackReason>([
    'branch-reconstruction-empty',
    'unresolved-sign-change',
  ])(
    'restores work counters for $fallbackReason fallback',
    async (fallbackReason) => {
      vi.resetModules();
      vi.doMock('../src/contrast/region-hybrid.js', async () => {
        const actual = await vi.importActual(
          '../src/contrast/region-hybrid.js',
        );
        return {
          ...actual,
          contrastRegionPathsHybrid: (
            _reference: unknown,
            _hue: unknown,
            _options: unknown,
            trace: InternalPlaneTraceContext | null | undefined,
          ) => {
            if (trace) {
              Object.assign(trace.summary, {
                sampleCount: trace.summary.sampleCount + 11,
                scalarEvaluationCount: trace.summary.scalarEvaluationCount + 13,
                cellCount: trace.summary.cellCount + 17,
                segmentCount: trace.summary.segmentCount + 19,
                pathCount: trace.summary.pathCount + 23,
                pointCount: trace.summary.pointCount + 29,
              });
            }
            return { status: 'fallback' as const, fallbackReason };
          },
        };
      });

      const { fromHex } = await import('../src/conversion/index.js');
      const { definePlane, inspectPlaneQuery } =
        await import('../src/plane/index.js');
      const reference = fromHex('#ffffff');
      const options = {
        metric: 'wcag' as const,
        threshold: 4.5,
        samplingMode: 'hybrid' as const,
        lightnessSteps: 32,
        chromaSteps: 64,
      };
      const plane = definePlane({
        fixed: { h: 210 },
      });
      const inspection = inspectPlaneQuery(plane, {
        kind: 'contrastRegion',
        reference,
        hue: 210,
        ...options,
      });
      const explicitLegacyInspection = inspectPlaneQuery(plane, {
        kind: 'contrastRegion',
        reference,
        hue: 210,
        ...options,
        samplingMode: 'adaptive',
      });

      expect(inspection.result.paths).toEqual(
        explicitLegacyInspection.result.paths,
      );
      expect(inspection.trace.summary.solver).toBe('contrast-legacy-adaptive');
      expect(inspection.trace.summary.fallbackReason).toBe(fallbackReason);
      expect(inspection.trace.summary).toMatchObject({
        sampleCount: explicitLegacyInspection.trace.summary.sampleCount,
        scalarEvaluationCount:
          explicitLegacyInspection.trace.summary.scalarEvaluationCount,
        cellCount: explicitLegacyInspection.trace.summary.cellCount,
        segmentCount: explicitLegacyInspection.trace.summary.segmentCount,
        pathCount: explicitLegacyInspection.trace.summary.pathCount,
        pointCount: explicitLegacyInspection.trace.summary.pointCount,
      });
    },
  );
});
