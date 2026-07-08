# Contributing to color-kit

Thanks for your interest in color-kit. This is a short, human-oriented guide; deeper design rationale lives in [DESIGN.md](DESIGN.md), and agent-oriented workflow rules live in [AGENTS.md](AGENTS.md).

## What this project is

color-kit is an API-first, UI-agnostic color engine: conversion, contrast, harmony, manipulation, gamut mapping, and — its differentiator — a queryable model of color-space geometry (plane queries, gamut boundaries, contrast regions). React bindings exist as one consumer of that engine, not as the product itself. UI primitives that aren't color-specific belong in [control-kit](https://github.com/pbroom/control-kit).

## Repository layout

| Path                 | What it is                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `packages/core`      | The engine: OKLCH-canonical conversion, contrast, harmony, manipulation, gamut, plane queries |
| `packages/core-wasm` | Optional Rust/WASM kernel for hot compute paths                                               |
| `packages/driver`    | Framework-agnostic interaction driver (`ColorApi`, dual requested/displayed state)            |
| `packages/react`     | React bindings and components                                                                 |
| `packages/color-kit` | The published umbrella package (`color-kit` on npm)                                           |
| `apps/docs`          | Docs site (Vite + MDX)                                                                        |
| `registry`           | shadcn registry items                                                                         |
| `archive/`           | Historical planning notes, kept for reference                                                 |

## Getting started

```bash
pnpm install
pnpm build     # build all packages
pnpm test      # run all tests
pnpm dev       # docs dev server (reads workspace packages from source)
```

Node 20+ and pnpm are required.

## Making changes

- Never commit directly to `main`; work on a feature branch (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`).
- Use Conventional Commit messages.
- One logical change per branch; keep PRs reviewable.
- Before pushing: `pnpm lint`, `pnpm format:check`, and `pnpm test` should pass. `pnpm pr:validate` bundles the standard checks.

## Testing

- Core math (gamut boundaries, plane queries, contrast regions) is the most test-critical surface — changes there need tests.
- `pnpm --filter @color-kit/core test` for engine-only runs.
- New public API needs docs: an MDX page under `apps/docs` and, where useful, a runnable demo.

## Releases

Publishing is maintainer-driven (`pnpm publish:next`). The project is pre-1.0: public packages stay on `0.x.y` and breaking changes may land in minor releases.
