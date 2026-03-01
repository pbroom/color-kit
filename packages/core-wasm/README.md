# @color-kit/core-wasm

Experimental WebAssembly acceleration package for `@color-kit/core`.

This package provides the scheduling hooks and runtime registration surface for
WASM plane-query backends. The initial Rust kernel scaffold is under
`./rust/src/contrast_region.rs` and is intended to evolve behind feature flags
before default rollout.

## Status

- JS fallback remains the default and source of truth.
- WASM backend registration is opt-in.
- Rust kernel I/O format is currently scaffold-level and subject to change.

## Build

```bash
pnpm --filter @color-kit/core-wasm build
pnpm --filter @color-kit/core-wasm build:wasm
```
