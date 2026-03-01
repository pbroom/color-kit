export const WASM_CONTRAST_KERNEL_ABI_VERSION = 1 as const;
export const WASM_CONTRAST_KERNEL_OPERATION =
  'normalize-contrast-paths' as const;
export const WASM_CONTRAST_KERNEL_BACKEND = 'wasm-contrast-v1' as const;

export type WasmContrastKernelQueryKind = 'contrastBoundary' | 'contrastRegion';

export type WasmContrastKernelPoint = [number, number];

export interface WasmContrastKernelQueryPayload {
  kind: WasmContrastKernelQueryKind;
  hue: number;
  paths: WasmContrastKernelPoint[][];
}

export interface WasmContrastKernelRequest {
  abiVersion: typeof WASM_CONTRAST_KERNEL_ABI_VERSION;
  operation: typeof WASM_CONTRAST_KERNEL_OPERATION;
  queries: WasmContrastKernelQueryPayload[];
}

export interface WasmContrastKernelQueryResult {
  kind: WasmContrastKernelQueryKind;
  hue: number;
  paths: WasmContrastKernelPoint[][];
}

export interface WasmContrastKernelResponse {
  abiVersion: typeof WASM_CONTRAST_KERNEL_ABI_VERSION;
  operation: typeof WASM_CONTRAST_KERNEL_OPERATION;
  backend: typeof WASM_CONTRAST_KERNEL_BACKEND;
  results: WasmContrastKernelQueryResult[];
  error?: string;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function isFinitePointTuple(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1])
  );
}

function isKernelQueryKind(
  value: unknown,
): value is WasmContrastKernelQueryKind {
  return value === 'contrastBoundary' || value === 'contrastRegion';
}

function isKernelQueryPayload(
  value: unknown,
): value is WasmContrastKernelQueryPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as {
    kind?: unknown;
    hue?: unknown;
    paths?: unknown;
  };
  if (!isKernelQueryKind(candidate.kind)) {
    return false;
  }
  if (typeof candidate.hue !== 'number' || !Number.isFinite(candidate.hue)) {
    return false;
  }
  if (!Array.isArray(candidate.paths)) {
    return false;
  }
  return candidate.paths.every(
    (path) =>
      Array.isArray(path) && path.every((point) => isFinitePointTuple(point)),
  );
}

export function encodeContrastKernelRequest(
  request: WasmContrastKernelRequest,
): Uint8Array {
  return textEncoder.encode(JSON.stringify(request));
}

export function decodeContrastKernelResponse(
  bytes: Uint8Array,
): WasmContrastKernelResponse {
  const decoded = JSON.parse(textDecoder.decode(bytes)) as unknown;
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid wasm contrast kernel response payload.');
  }
  const candidate = decoded as {
    abiVersion?: unknown;
    operation?: unknown;
    backend?: unknown;
    results?: unknown;
    error?: unknown;
  };
  if (candidate.abiVersion !== WASM_CONTRAST_KERNEL_ABI_VERSION) {
    throw new Error(
      `Unsupported wasm contrast kernel ABI version: ${String(candidate.abiVersion)}`,
    );
  }
  if (candidate.operation !== WASM_CONTRAST_KERNEL_OPERATION) {
    throw new Error(
      `Unexpected wasm contrast kernel operation: ${String(candidate.operation)}`,
    );
  }
  if (candidate.backend !== WASM_CONTRAST_KERNEL_BACKEND) {
    throw new Error(
      `Unexpected wasm contrast kernel backend: ${String(candidate.backend)}`,
    );
  }
  if (!Array.isArray(candidate.results)) {
    throw new Error('Invalid wasm contrast kernel results payload.');
  }
  if (!candidate.results.every((entry) => isKernelQueryPayload(entry))) {
    throw new Error('Invalid wasm contrast kernel query result payload.');
  }
  if (candidate.error != null && typeof candidate.error !== 'string') {
    throw new Error('Invalid wasm contrast kernel error payload.');
  }
  return {
    abiVersion: WASM_CONTRAST_KERNEL_ABI_VERSION,
    operation: WASM_CONTRAST_KERNEL_OPERATION,
    backend: WASM_CONTRAST_KERNEL_BACKEND,
    results: candidate.results,
    error: candidate.error ?? undefined,
  };
}
