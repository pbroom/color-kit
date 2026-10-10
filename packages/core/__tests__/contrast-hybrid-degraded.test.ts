import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('../src/gamut/index.js');
  vi.resetModules();
});

describe('contrastRegionPaths() degraded hybrid results', () => {
  it('returns best-effort paths and records complex topology in the trace', async () => {
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
    const plane = definePlane({
      fixed: { h: 210 },
    });
    const inspection = inspectPlaneQuery(plane, {
      kind: 'contrastRegion',
      reference: fromHex('#ffffff'),
      hue: 210,
      metric: 'wcag',
      threshold: 4.5,
      lightnessSteps: 64,
      chromaSteps: 256,
      hybridMaxDepth: 7,
      hybridErrorTolerance: 0.0006,
    });

    expect(inspection.result.paths.length).toBeGreaterThan(0);
    for (const path of inspection.result.paths) {
      for (const point of path) {
        expect(Number.isFinite(point.l)).toBe(true);
        expect(Number.isFinite(point.c)).toBe(true);
      }
    }
    expect(inspection.trace.summary.solver).toBe('contrast-hybrid');
    expect(inspection.trace.summary.degradedReason).toBe('complex-topology');
    expect(
      inspection.trace.stages
        .filter((stage) => stage.kind === 'solver')
        .map((stage) => stage.solver),
    ).toEqual(['contrast-hybrid']);
  });

  it('leaves degradedReason unset for well-formed fields', async () => {
    const { fromHex } = await import('../src/conversion/index.js');
    const { definePlane, inspectPlaneQuery } =
      await import('../src/plane/index.js');
    const inspection = inspectPlaneQuery(definePlane({ fixed: { h: 210 } }), {
      kind: 'contrastRegion',
      reference: fromHex('#ffffff'),
      hue: 210,
      level: 'AA',
    });
    expect(inspection.result.paths.length).toBeGreaterThan(0);
    expect(inspection.trace.summary.solver).toBe('contrast-hybrid');
    expect(inspection.trace.summary.degradedReason).toBeUndefined();
  });
});
