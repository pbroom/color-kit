# @color-kit/core-wasm

WebAssembly acceleration package for `@color-kit/core` plane-query compute.

This package provides the scheduler integration surface and a versioned Rust
kernel ABI for contrast-query path normalization.

## Status

**Parked.** The JS backend is the default everywhere; the WASM path is
opt-in until the Rust kernel covers compute that is actually hot (the
current `v1` kernel only normalizes contrast path tuples — the expensive
work such as gamut-region contouring and chroma search still runs in JS).

What "parked" means in practice:

- The plane-query worker does not auto-load the WASM backend. Hosts opt in
  by setting `globalThis.__COLOR_KIT_ENABLE_WASM_AUTO_BOOTSTRAP__ = true`
  before the worker boots, or by installing a backend directly on
  `globalThis.__COLOR_KIT_WASM_PLANE_BACKEND__`.
- The Rust CI jobs (`wasm-build`, `wasm-parity-gate`) run from
  `.github/workflows/wasm.yml` only on WASM-relevant path changes, a weekly
  schedule, and manual dispatch — not on every PR.
- `pnpm pr:validate` runs the WASM matrix only when WASM-relevant files
  change. `pnpm release:verify` still runs the full strict parity gate
  before any publish.
- Rust kernel uses a versioned ABI (`v1`) with explicit operation names.

Unparking should start by pointing the kernel at the hot loops the
`plane-bench` CI job measures (gamut-region sampling, chroma search) and
then reverting the auto-bootstrap default.

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
