# @color-kit/core-wasm

WebAssembly acceleration package for `@color-kit/core` plane-query compute.

This package provides the scheduler integration surface and a versioned Rust
kernel ABI for contrast-query path normalization.

## Status

- JS fallback remains available as a safety path.
- WASM backend registration is deterministic in worker runtime bootstrap.
- Rust kernel uses a versioned ABI (`v1`) with explicit operation names.

## ABI contract (`v1`)

Kernel entrypoint: `contrast_region_paths_v1(input: &[u8]) -> Vec<u8>`

- Encoding: UTF-8 JSON bytes.
- Request:
  - `abiVersion: 1`
  - `operation: "normalize-contrast-paths"`
  - `queries: Array<{ kind, hue, paths }>`
- Response:
  - `abiVersion: 1`
  - `operation: "normalize-contrast-paths"`
  - `backend: "wasm-contrast-v1"`
  - `results: Array<{ kind, hue, paths }>`
  - `error?: string`

The contract is intentionally strict and versioned so TypeScript and Rust can
fail closed if payloads drift.

## Rollout guardrails

Use this checklist before enabling strict parity in release pipelines:

1. Build `@color-kit/core-wasm` and wasm artifacts (`pnpm --filter @color-kit/core-wasm check:wasm`).
2. Run strict parity tests (`pnpm --filter @color-kit/react test:wasm-parity:strict`).
3. Confirm worker telemetry exposes:
   - scheduler backend/schedule reason
   - wasm circuit state
   - wasm init status (`ready`, `unavailable`, `error`)
   - parity status (`ok`, `shape-mismatch`, `numeric-mismatch`, `no-wasm`, `error`)
4. Keep JS scheduler fallback enabled so backend/bootstrap failures degrade
   safely instead of breaking interactions.

## Build

```bash
pnpm --filter @color-kit/core-wasm build
pnpm --filter @color-kit/core-wasm build:wasm
```
