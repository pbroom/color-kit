import { describe, expect, it } from 'vitest';
import { evaluateWasmParityGate } from '../src/workers/wasm-parity-gate.js';

describe('evaluateWasmParityGate()', () => {
  it('passes when no parity payload is available', () => {
    expect(evaluateWasmParityGate(undefined, 'strict')).toEqual({
      mode: 'strict',
      status: 'pass',
      reason: 'no-parity-data',
    });
  });

  it('passes when parity is ok or wasm is unavailable', () => {
    expect(
      evaluateWasmParityGate(
        {
          mode: 'shape',
          status: 'ok',
          wasmAvailable: true,
          attempted: true,
          pathCountDelta: 0,
          pointCountDelta: 0,
        },
        'strict',
      ),
    ).toEqual({
      mode: 'strict',
      status: 'pass',
      reason: 'parity-ok',
    });

    expect(
      evaluateWasmParityGate(
        {
          mode: 'shape',
          status: 'no-wasm',
          wasmAvailable: false,
          attempted: false,
        },
        'strict',
      ),
    ).toEqual({
      mode: 'strict',
      status: 'pass',
      reason: 'no-wasm-backend',
    });
  });

  it('warns on mismatch/error in warn mode and fails in strict mode', () => {
    const mismatch = {
      mode: 'shape' as const,
      status: 'shape-mismatch' as const,
      wasmAvailable: true,
      attempted: true,
      pathCountDelta: 1,
      pointCountDelta: 2,
    };
    const error = {
      mode: 'shape' as const,
      status: 'error' as const,
      wasmAvailable: true,
      attempted: true,
      error: 'backend crashed',
    };
    const numericMismatch = {
      mode: 'numeric' as const,
      status: 'numeric-mismatch' as const,
      wasmAvailable: true,
      attempted: true,
      numericTolerance: 1e-4,
      numericMismatchCount: 2,
      maxAbsDelta: 0.00031,
      meanAbsDelta: 0.00012,
    };

    expect(evaluateWasmParityGate(mismatch, 'warn')).toEqual({
      mode: 'warn',
      status: 'warn',
      reason: 'shape-mismatch',
    });
    expect(evaluateWasmParityGate(mismatch, 'strict')).toEqual({
      mode: 'strict',
      status: 'fail',
      reason: 'shape-mismatch',
    });
    expect(evaluateWasmParityGate(numericMismatch, 'warn')).toEqual({
      mode: 'warn',
      status: 'warn',
      reason: 'numeric-mismatch',
    });
    expect(evaluateWasmParityGate(numericMismatch, 'strict')).toEqual({
      mode: 'strict',
      status: 'fail',
      reason: 'numeric-mismatch',
    });

    expect(evaluateWasmParityGate(error, 'warn')).toEqual({
      mode: 'warn',
      status: 'warn',
      reason: 'backend-error',
    });
    expect(evaluateWasmParityGate(error, 'strict')).toEqual({
      mode: 'strict',
      status: 'fail',
      reason: 'backend-error',
    });
  });
});
