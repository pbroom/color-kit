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
        {
          kind: 'gamutBoundary',
          gamut: 'srgb',
          hue: 275,
          samplingMode: 'adaptive',
          steps: 48,
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
    expect(gamutResult).toBeDefined();
    expect((gamutResult?.points ?? []).length).toBeGreaterThan(0);
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
