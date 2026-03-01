import type { PlaneQueryWorkerWasmParityResult } from './plane-query.worker.types.js';

export type WasmParityGateMode = 'warn' | 'strict';

export interface WasmParityGateDecision {
  mode: WasmParityGateMode;
  status: 'pass' | 'warn' | 'fail';
  reason:
    | 'no-parity-data'
    | 'parity-ok'
    | 'no-wasm-backend'
    | 'shape-mismatch'
    | 'numeric-mismatch'
    | 'backend-error';
}

export function evaluateWasmParityGate(
  parity: PlaneQueryWorkerWasmParityResult | undefined,
  mode: WasmParityGateMode = 'warn',
): WasmParityGateDecision {
  if (!parity) {
    return {
      mode,
      status: 'pass',
      reason: 'no-parity-data',
    };
  }
  if (parity.status === 'ok') {
    return {
      mode,
      status: 'pass',
      reason: 'parity-ok',
    };
  }
  if (parity.status === 'no-wasm') {
    return {
      mode,
      status: 'pass',
      reason: 'no-wasm-backend',
    };
  }
  if (parity.status === 'shape-mismatch') {
    return {
      mode,
      status: mode === 'strict' ? 'fail' : 'warn',
      reason: 'shape-mismatch',
    };
  }
  if (parity.status === 'numeric-mismatch') {
    return {
      mode,
      status: mode === 'strict' ? 'fail' : 'warn',
      reason: 'numeric-mismatch',
    };
  }
  return {
    mode,
    status: mode === 'strict' ? 'fail' : 'warn',
    reason: 'backend-error',
  };
}
