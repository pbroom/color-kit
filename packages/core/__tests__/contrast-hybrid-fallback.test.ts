import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('../src/gamut/index.js');
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

    const { contrastRegionPaths } = await import('../src/contrast/index.js');
    const { fromHex } = await import('../src/conversion/index.js');
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

    const hybridAuto = contrastRegionPaths(reference, 210, options);
    const explicitLegacy = contrastRegionPaths(reference, 210, {
      ...options,
      samplingMode: 'adaptive',
    });

    expect(hybridAuto.length).toBeGreaterThan(0);
    expect(hybridAuto).toEqual(explicitLegacy);
  });
});
