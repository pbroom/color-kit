import {
  colorToPlane,
  createJsPlaneComputeBackend,
  createPlaneComputeScheduler,
  packPlaneQueryResults,
  resolvePlaneDefinition,
  runPlaneQuery,
  type Color,
  type PlaneComputeBackend,
  type PlaneComputeRequest,
  type PlaneComputeResponse,
  type PlaneComputeScheduler,
  type PlaneComputeSchedulerOptions,
  type PlaneContrastBoundaryResult,
  type PlaneContrastRegionResult,
  type PlaneQueryResult,
  type ResolvedPlaneDefinition,
} from '@color-kit/core';
import {
  decodeContrastKernelResponse,
  encodeContrastKernelRequest,
  WASM_CONTRAST_KERNEL_ABI_VERSION,
  WASM_CONTRAST_KERNEL_OPERATION,
  type WasmContrastKernelPoint,
  type WasmContrastKernelQueryPayload,
} from './contrast-kernel-abi.js';

export {
  WASM_CONTRAST_KERNEL_ABI_VERSION,
  WASM_CONTRAST_KERNEL_BACKEND,
  WASM_CONTRAST_KERNEL_OPERATION,
} from './contrast-kernel-abi.js';
export type {
  WasmContrastKernelPoint,
  WasmContrastKernelQueryPayload,
  WasmContrastKernelQueryResult,
  WasmContrastKernelRequest,
  WasmContrastKernelResponse,
} from './contrast-kernel-abi.js';

export type WasmPlaneComputeBackendFactory = () => PlaneComputeBackend | null;

export interface WasmContrastKernelBindings {
  contrast_region_paths_v1: (input: Uint8Array) => Uint8Array;
  wasm_backend_version?: () => string | undefined;
}

interface WasmGeneratedKernelModule extends WasmContrastKernelBindings {
  default?: (
    input?:
      | RequestInfo
      | URL
      | Response
      | BufferSource
      | WebAssembly.Module
      | { module_or_path?: BufferSource | WebAssembly.Module },
  ) => Promise<unknown>;
}

interface WasmBackendGlobal {
  __COLOR_KIT_WASM_PLANE_BACKEND__?: PlaneComputeBackend;
}

interface WasmContrastResultMapping {
  rawResultIndex: number;
  kind: 'contrastBoundary' | 'contrastRegion';
  hue: number;
}

const GENERATED_KERNEL_MODULE_PATH = './generated/color_kit_core_wasm.js';

let registeredWasmBackendFactory: WasmPlaneComputeBackendFactory | null = null;
let defaultWasmAwareScheduler: PlaneComputeScheduler | null = null;
let loadedWasmBackendPromise: Promise<PlaneComputeBackend | null> | null = null;
let loadedKernelBindingsPromise: Promise<WasmContrastKernelBindings | null> | null =
  null;
let loadedWasmBackendVersion: string | undefined;

function isNodeRuntime(): boolean {
  const maybeProcess = (
    globalThis as {
      process?: {
        versions?: {
          node?: string;
        };
      };
    }
  ).process;
  return typeof maybeProcess?.versions?.node === 'string';
}

async function loadNodeWasmBytes(): Promise<Uint8Array | null> {
  if (!isNodeRuntime()) {
    return null;
  }
  try {
    const nodeFsModuleSpecifier = 'node:fs/promises';
    const fsModule = (await import(nodeFsModuleSpecifier)) as {
      readFile: (path: URL) => Promise<Uint8Array>;
    };
    return await fsModule.readFile(
      new URL('./generated/color_kit_core_wasm_bg.wasm', import.meta.url),
    );
  } catch {
    return null;
  }
}

async function initializeGeneratedKernelModule(
  module: WasmGeneratedKernelModule,
): Promise<void> {
  if (typeof module.default !== 'function') {
    return;
  }
  try {
    await module.default();
  } catch (initializationError) {
    const wasmBytes = await loadNodeWasmBytes();
    if (!wasmBytes) {
      throw initializationError;
    }
    await module.default({ module_or_path: wasmBytes });
  }
}

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function getDefaultWasmAwareScheduler(): PlaneComputeScheduler {
  if (!defaultWasmAwareScheduler) {
    defaultWasmAwareScheduler = createWasmAwarePlaneComputeScheduler();
  }
  return defaultWasmAwareScheduler;
}

function toKernelPointTuple(
  points: Array<{ l: number; c: number }>,
): WasmContrastKernelPoint[] {
  return points.map((point) => [point.l, point.c]);
}

function toKernelPayloadFromResult(
  result: PlaneContrastBoundaryResult | PlaneContrastRegionResult,
): WasmContrastKernelQueryPayload {
  return {
    kind: result.kind,
    hue: result.hue,
    paths:
      result.kind === 'contrastBoundary'
        ? [toKernelPointTuple(result.points)]
        : result.paths.map((path) => toKernelPointTuple(path)),
  };
}

function toPlaneRegionPoint(
  plane: ResolvedPlaneDefinition,
  hue: number,
  point: WasmContrastKernelPoint,
): { x: number; y: number; l: number; c: number } {
  const color: Color = {
    ...plane.fixed,
    l: point[0],
    c: point[1],
    h: hue,
    alpha: plane.fixed.alpha,
  };
  const projected = colorToPlane(plane, color);
  return {
    x: projected.x,
    y: projected.y,
    l: point[0],
    c: point[1],
  };
}

function applyKernelNormalizationToResults(
  plane: ResolvedPlaneDefinition,
  rawResults: PlaneQueryResult[],
  mappings: WasmContrastResultMapping[],
  normalized: WasmContrastKernelQueryPayload[],
): void {
  if (mappings.length !== normalized.length) {
    throw new Error(
      `WASM contrast kernel returned ${normalized.length} normalized queries, expected ${mappings.length}.`,
    );
  }
  for (let index = 0; index < mappings.length; index += 1) {
    const mapping = mappings[index];
    const normalizedQuery = normalized[index];
    if (normalizedQuery.kind !== mapping.kind) {
      throw new Error(
        `WASM contrast kernel query kind mismatch at index ${index}: got ${normalizedQuery.kind}, expected ${mapping.kind}.`,
      );
    }
    if (mapping.kind === 'contrastBoundary') {
      const firstPath = normalizedQuery.paths[0] ?? [];
      rawResults[mapping.rawResultIndex] = {
        kind: 'contrastBoundary',
        hue: mapping.hue,
        points: firstPath.map((point) =>
          toPlaneRegionPoint(plane, mapping.hue, point),
        ),
      };
      continue;
    }
    rawResults[mapping.rawResultIndex] = {
      kind: 'contrastRegion',
      hue: mapping.hue,
      paths: normalizedQuery.paths.map((path) =>
        path.map((point) => toPlaneRegionPoint(plane, mapping.hue, point)),
      ),
    };
  }
}

async function loadGeneratedKernelBindings(): Promise<WasmContrastKernelBindings | null> {
  if (!loadedKernelBindingsPromise) {
    loadedKernelBindingsPromise = (async () => {
      try {
        const imported = (await import(
          GENERATED_KERNEL_MODULE_PATH
        )) as unknown as WasmGeneratedKernelModule;
        await initializeGeneratedKernelModule(imported);
        if (typeof imported.contrast_region_paths_v1 !== 'function') {
          return null;
        }
        loadedWasmBackendVersion =
          typeof imported.wasm_backend_version === 'function'
            ? imported.wasm_backend_version()
            : undefined;
        return {
          contrast_region_paths_v1:
            imported.contrast_region_paths_v1.bind(imported),
          wasm_backend_version: () => loadedWasmBackendVersion,
        };
      } catch {
        loadedWasmBackendVersion = undefined;
        return null;
      }
    })();
  }
  return loadedKernelBindingsPromise;
}

export function createWasmPlaneComputeBackendFromKernel(
  kernel: WasmContrastKernelBindings,
): PlaneComputeBackend {
  if (typeof kernel.contrast_region_paths_v1 !== 'function') {
    throw new Error(
      'createWasmPlaneComputeBackendFromKernel() requires contrast_region_paths_v1().',
    );
  }
  return {
    kind: 'wasm',
    run(request) {
      const plane = resolvePlaneDefinition(request.plane);
      const computeStart = nowMs();
      const rawResults: PlaneQueryResult[] = [];
      const contrastQueries: WasmContrastKernelQueryPayload[] = [];
      const contrastMappings: WasmContrastResultMapping[] = [];
      for (const query of request.queries) {
        const result = runPlaneQuery(plane, query);
        const rawResultIndex = rawResults.length;
        rawResults.push(result);
        if (
          result.kind !== 'contrastBoundary' &&
          result.kind !== 'contrastRegion'
        ) {
          continue;
        }
        contrastQueries.push(toKernelPayloadFromResult(result));
        contrastMappings.push({
          rawResultIndex,
          kind: result.kind,
          hue: result.hue,
        });
      }

      if (contrastQueries.length > 0) {
        const encoded = encodeContrastKernelRequest({
          abiVersion: WASM_CONTRAST_KERNEL_ABI_VERSION,
          operation: WASM_CONTRAST_KERNEL_OPERATION,
          queries: contrastQueries,
        });
        const normalized = decodeContrastKernelResponse(
          kernel.contrast_region_paths_v1(encoded),
        );
        if (normalized.error) {
          throw new Error(
            `WASM contrast kernel normalization failed: ${normalized.error}`,
          );
        }
        applyKernelNormalizationToResults(
          plane,
          rawResults,
          contrastMappings,
          normalized.results,
        );
      }

      const computeEnd = nowMs();
      const marshalStart = nowMs();
      const result = packPlaneQueryResults(rawResults);
      const marshalEnd = nowMs();

      return {
        backend: 'wasm',
        computeTimeMs: computeEnd - computeStart,
        marshalTimeMs: marshalEnd - marshalStart,
        result,
      };
    },
  };
}

export async function createWasmPlaneComputeBackend(): Promise<PlaneComputeBackend | null> {
  const bindings = await loadGeneratedKernelBindings();
  if (!bindings) {
    return null;
  }
  return createWasmPlaneComputeBackendFromKernel(bindings);
}

export function registerWasmPlaneComputeBackendFactory(
  factory: WasmPlaneComputeBackendFactory,
): void {
  registeredWasmBackendFactory = factory;
  defaultWasmAwareScheduler = null;
}

export function clearWasmPlaneComputeBackendFactory(): void {
  registeredWasmBackendFactory = null;
  defaultWasmAwareScheduler = null;
  loadedWasmBackendPromise = null;
  loadedKernelBindingsPromise = null;
  loadedWasmBackendVersion = undefined;
}

export function getRegisteredWasmPlaneComputeBackend(): PlaneComputeBackend | null {
  if (!registeredWasmBackendFactory) {
    return null;
  }
  try {
    return registeredWasmBackendFactory();
  } catch {
    return null;
  }
}

export async function loadWasmPlaneComputeBackend(): Promise<PlaneComputeBackend | null> {
  const registered = getRegisteredWasmPlaneComputeBackend();
  if (registered) {
    return registered;
  }
  if (!loadedWasmBackendPromise) {
    loadedWasmBackendPromise = createWasmPlaneComputeBackend();
  }
  return loadedWasmBackendPromise;
}

export function getLoadedWasmBackendVersion(): string | undefined {
  return loadedWasmBackendVersion;
}

export function installWasmPlaneComputeBackendOnGlobal(
  backend: PlaneComputeBackend | null,
  target: typeof globalThis = globalThis,
): void {
  const targetWithBackend = target as unknown as WasmBackendGlobal;
  if (backend) {
    targetWithBackend.__COLOR_KIT_WASM_PLANE_BACKEND__ = backend;
    return;
  }
  delete targetWithBackend.__COLOR_KIT_WASM_PLANE_BACKEND__;
}

export function installRegisteredWasmPlaneComputeBackendOnGlobal(
  target: typeof globalThis = globalThis,
): PlaneComputeBackend | null {
  const backend = getRegisteredWasmPlaneComputeBackend();
  installWasmPlaneComputeBackendOnGlobal(backend, target);
  return backend;
}

export async function installLoadedWasmPlaneComputeBackendOnGlobal(
  target: typeof globalThis = globalThis,
): Promise<PlaneComputeBackend | null> {
  const backend = await loadWasmPlaneComputeBackend();
  installWasmPlaneComputeBackendOnGlobal(backend, target);
  return backend;
}

export function createWasmAwarePlaneComputeScheduler(
  options?: PlaneComputeSchedulerOptions,
): PlaneComputeScheduler {
  const jsBackend = createJsPlaneComputeBackend();
  const wasmBackend = getRegisteredWasmPlaneComputeBackend();
  return createPlaneComputeScheduler({
    backends: {
      js: jsBackend,
      wasm: wasmBackend ?? undefined,
    },
    options,
  });
}

export function runWasmAwarePlaneCompute(
  request: PlaneComputeRequest,
  scheduler?: PlaneComputeScheduler,
): PlaneComputeResponse {
  return (scheduler ?? getDefaultWasmAwareScheduler()).run(request);
}
