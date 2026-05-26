import { describe, expect, it } from 'vitest';
import { unpackPlaneQueryResults } from '@color-kit/core';
import {
  createWasmPlaneComputeBackendFromKernel,
  WASM_CONTRAST_KERNEL_ABI_VERSION,
  WASM_CONTRAST_KERNEL_BACKEND,
  WASM_CONTRAST_KERNEL_OPERATION,
  type WasmContrastKernelBindings,
} from '../src/index.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function createEchoKernel(): WasmContrastKernelBindings {
  return {
    contrast_region_paths_v1: (input: Uint8Array) => {
      const request = JSON.parse(textDecoder.decode(input)) as {
        abiVersion: number;
        operation: string;
        queries: Array<{
          kind: 'contrastBoundary' | 'contrastRegion';
          hue: number;
          paths: Array<Array<[number, number]>>;
        }>;
      };
      return textEncoder.encode(
        JSON.stringify({
          abiVersion: WASM_CONTRAST_KERNEL_ABI_VERSION,
          operation: WASM_CONTRAST_KERNEL_OPERATION,
          backend: WASM_CONTRAST_KERNEL_BACKEND,
          results: request.queries,
        }),
      );
    },
  };
}

describe('createWasmPlaneComputeBackendFromKernel()', () => {
  it('maps normalized contrast payloads back into packed plane results', () => {
    const backend = createWasmPlaneComputeBackendFromKernel(createEchoKernel());
    const response = backend.run({
      plane: {
        model: 'oklch',
        x: { channel: 'l', range: [0, 1] },
        y: { channel: 'c', range: [0, 0.4] },
        fixed: { h: 275, alpha: 1 },
      },
      queries: [
        {
          kind: 'contrastRegion',
          reference: { l: 0.58, c: 0.15, h: 275, alpha: 1 },
          metric: 'wcag',
          threshold: 4.5,
          samplingMode: 'hybrid',
          hue: 275,
        },
      ],
      priority: 'drag',
      quality: 'high',
      performanceProfile: 'balanced',
    });

    expect(response.backend).toBe('wasm');
    const unpacked = unpackPlaneQueryResults(response.result);
    const contrastResult = unpacked.find(
      (entry): entry is Extract<typeof entry, { kind: 'contrastRegion' }> =>
        entry.kind === 'contrastRegion',
    );
    const gamutResult = unpacked.find(
      (entry): entry is Extract<typeof entry, { kind: 'gamutBoundary' }> =>
        entry.kind === 'gamutBoundary',
    );
    expect(contrastResult).toBeDefined();
    expect((contrastResult?.paths[0] ?? []).length).toBeGreaterThan(0);
    expect(gamutResult).toBeUndefined();
  });

  it('advertises support only for contrast kernel requests', () => {
    const backend = createWasmPlaneComputeBackendFromKernel(createEchoKernel());
    const baseRequest = {
      plane: {
        model: 'oklch' as const,
        x: { channel: 'l' as const, range: [0, 1] as [number, number] },
        y: { channel: 'c' as const, range: [0, 0.4] as [number, number] },
        fixed: { h: 275, alpha: 1 },
      },
      priority: 'drag' as const,
      quality: 'high' as const,
      performanceProfile: 'balanced' as const,
    };
    const contrastQuery = {
      kind: 'contrastRegion' as const,
      reference: { l: 0.58, c: 0.15, h: 275, alpha: 1 },
      metric: 'wcag' as const,
      threshold: 4.5,
      samplingMode: 'hybrid' as const,
      hue: 275,
    };
    const contrastBoundaryQuery = {
      kind: 'contrastBoundary' as const,
      reference: { l: 0.58, c: 0.15, h: 275, alpha: 1 },
      metric: 'wcag' as const,
      threshold: 4.5,
      samplingMode: 'hybrid' as const,
      hue: 275,
    };
    const gamutQuery = {
      kind: 'gamutBoundary' as const,
      gamut: 'srgb' as const,
      hue: 275,
      samplingMode: 'adaptive' as const,
      steps: 48,
    };

    expect(
      backend.supportsRequest?.({
        ...baseRequest,
        queries: [contrastQuery],
      }),
    ).toBe(true);
    expect(
      backend.supportsRequest?.({
        ...baseRequest,
        queries: [contrastBoundaryQuery],
      }),
    ).toBe(true);
    expect(
      backend.supportsRequest?.({
        ...baseRequest,
        queries: [gamutQuery],
      }),
    ).toBe(false);
    expect(
      backend.supportsRequest?.({
        ...baseRequest,
        queries: [contrastQuery, gamutQuery],
      }),
    ).toBe(false);
  });

  it('throws when the kernel reports an error payload', () => {
    const backend = createWasmPlaneComputeBackendFromKernel({
      contrast_region_paths_v1: () =>
        textEncoder.encode(
          JSON.stringify({
            abiVersion: WASM_CONTRAST_KERNEL_ABI_VERSION,
            operation: WASM_CONTRAST_KERNEL_OPERATION,
            backend: WASM_CONTRAST_KERNEL_BACKEND,
            results: [],
            error: 'kernel rejected contrast payload',
          }),
        ),
    });

    expect(() =>
      backend.run({
        plane: {
          model: 'oklch',
          x: { channel: 'l', range: [0, 1] },
          y: { channel: 'c', range: [0, 0.4] },
          fixed: { h: 275, alpha: 1 },
        },
        queries: [
          {
            kind: 'contrastRegion',
            reference: { l: 0.58, c: 0.15, h: 275, alpha: 1 },
            metric: 'wcag',
            threshold: 4.5,
            samplingMode: 'hybrid',
            hue: 275,
          },
        ],
      }),
    ).toThrow('kernel rejected contrast payload');
  });
});
