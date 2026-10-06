# Contributing to color-kit

Thanks for your interest in color-kit. This is a short, human-oriented guide; deeper design rationale lives in [DESIGN.md](DESIGN.md), and agent-oriented workflow rules live in [AGENTS.md](AGENTS.md).

## What this project is

color-kit is an API-first, UI-agnostic color engine: conversion, contrast, harmony, manipulation, gamut mapping, and — its differentiator — a queryable model of color-space geometry (plane queries, gamut boundaries, contrast regions). React bindings exist as one consumer of that engine, not as the product itself. UI primitives that aren't color-specific belong in [control-kit](https://github.com/pbroom/control-kit).

## Repository layout

| Path                 | What it is                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `packages/core`      | The engine: OKLCH-canonical conversion, contrast, harmony, manipulation, gamut, plane queries |
| `packages/driver`    | Framework-agnostic interaction driver (`ColorApi`, dual requested/displayed state)            |
| `packages/react`     | React bindings and components                                                                 |
| `packages/color-kit` | The published umbrella package (`color-kit` on npm)                                           |
| `apps/docs`          | Docs site (Vite + MDX)                                                                        |

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
- If the change is visible to people who install `color-kit`, add a changeset (see [Changesets](#changesets)).

## Testing

- Core math (gamut boundaries, plane queries, contrast regions) is the most test-critical surface — changes there need tests.
- `pnpm --filter @color-kit/core test` for engine-only runs.
- New public API needs docs: an MDX page under `apps/docs` and, where useful, a runnable demo.

## Changesets

Versions and release notes are managed with [Changesets](https://github.com/changesets/changesets). Only the published `color-kit` package is versioned. The workspace packages (`@color-kit/core`, `@color-kit/driver`, `@color-kit/react`, and the docs app) are private, so Changesets ignores them.

To record a user-visible change, run `pnpm changeset` and commit the generated `.changeset/*.md` file with your PR. Or write the file by hand:

```md
---
'color-kit': minor
---

What changed, written for people who use the package. Include migration steps for breaking changes.
```

- **Target `color-kit` only**, even when the change lives in `packages/core`, `packages/driver`, or `packages/react`. Their code ships through the `color-kit` facade.
- **Choose the bump for 0.x:** use `minor` for breaking changes and new features, and `patch` for fixes. Never use `major`: it would take the package to 1.0.0.
- `pnpm check:preprod` (which runs in CI) rejects changesets that target another package or use `major`.
- Internal-only changes (tests, tooling, docs site, refactors with no API or behavior change) don't need a changeset.

## Releases

The project is pre-1.0. `color-kit` stays on `0.x.y`, breaking changes land in minor releases, and npm publishes use the `next` dist-tag. Changesets runs in normal mode, not prerelease mode, so versions stay plain `0.x.y` with no `-next.N` suffix.

1. **Version PR (automated).** On every push to `main`, the [Version Packages workflow](.github/workflows/version-packages.yml) runs `changesets/action`. When unreleased changesets exist, it opens or updates a `chore: version packages` PR. That PR runs `pnpm version-packages` (`changeset version`, then `pnpm check:preprod`), which bumps `packages/color-kit/package.json`, writes `packages/color-kit/CHANGELOG.md`, and deletes the consumed changesets.
2. **Review and merge** the version PR like any other. PRs opened with the default `GITHUB_TOKEN` don't trigger other workflows, so CI won't start on it automatically. Re-run CI on it, for example by closing and reopening the PR or pushing an empty commit, before you merge.
3. **Publish (manual).** From an up-to-date `main`, a maintainer runs `pnpm publish:next:dry` and then `pnpm publish:next`. These run `release:verify` (preprod guard, build, artifact checks, tests, lint) and publish `color-kit` to npm with the `next` tag. CI never publishes and holds no npm token.

The workflow needs **Allow GitHub Actions to create and approve pull requests** turned on under repository Settings > Actions > General.
