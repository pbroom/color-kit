# Agent Workspace Guidance

color-kit is a queryable color engine. The workspace packages `@color-kit/core`, `@color-kit/driver` (framework-agnostic interaction state) and `@color-kit/react` (state and plane hooks only; no UI components) are private and ship through one published package, `@pbroom/color-kit`, the facade in `packages/color-kit`. `apps/docs` is the API docs site. Design rationale lives in [DESIGN.md](DESIGN.md).

## Branch and PR Workflow

- Never commit directly to `main`; check `git branch --show-current` and branch first (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`).
- One logical change per branch; Conventional Commit messages (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
- Open PRs through the Graphite stack workflow (`pnpm pr:stack` / `gt submit`), passing draft flags when asked; fall back to `git` + `gh` only if Graphite is unavailable.
- Before submit: `gt track --parent <base>` for untracked branches, `gt submit --dry-run` to check scope, then confirm `baseRefName` and the PR title/body with `gh pr view`.
- Rebase diverged branches before pushing so pushes fast-forward.
- Use `git worktree` isolation for parallel or potentially conflicting work.
- A user-visible change needs a changeset targeting `@pbroom/color-kit` (see [CONTRIBUTING.md](CONTRIBUTING.md#changesets)).

## Validation

- Run `pnpm lint`, `pnpm format:check`, `pnpm build` and `pnpm test`; `pnpm pr:validate` picks the checks for the changed files.
- Resolve `react-hooks/*` and React Compiler findings in touched React/TSX files; never read or mutate refs in render to drive UI.
- Run the full build including DTS: `tsup` DTS fails on unused imports and missing sibling types that esbuild ignores.
- Rebuild (`pnpm build`) before `pnpm test` when adding core exports; `@color-kit/react` resolves core through package exports.
- If CI fails, confirm the real failing command with `gh run view --log-failed`.

## Engineering Rules

- Gamut checks (`inSrgbGamut`/`inP3Gamut`, and the plane gamut-region field) must read unclamped linear channel values. `GAMUT_EPSILON` (0.000075) applies to the gamma-encoded channels (CSS Color 4 / colorjs.io), i.e. linear bounds `[-ε/12.92, linearize(1+ε)]`; share `packages/core/src/gamut/linear-bounds.ts` rather than re-deriving them.
- Multi-entry hooks (`useMultiColor`) compute next state from the latest snapshot (`setState(prev => ...)`).
- Keep `eslint` and `@eslint/js` on the same major version.
- When renaming a public symbol pre-launch, hard-cut over: update local and root barrel exports, internal callers, and docs in one pass.
- In the `@pbroom/color-kit` facade build, copy each package's built `dist/` subtree and rewrite specifiers in `.js`, `.cjs`, `.d.ts`, `.d.cts`; build type producers before DTS consumers.
- Before calling a CSS selector dead, search class-name prefixes and template interpolation, not just exact literals.
