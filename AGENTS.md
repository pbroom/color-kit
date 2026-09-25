# Agent Workspace Guidance

color-kit is a queryable color engine: `@color-kit/core` (published via the `color-kit` facade) with `@color-kit/driver` and `@color-kit/react` as supported consumers. `apps/docs` is a lean API docs site for those packages.

## Branch and PR Workflow

- Never commit directly to `main`; verify with `git branch --show-current` and branch first (`codex/<topic>`, `chore/<topic>`, etc.).
- One logical change per branch; Conventional Commit messages (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
- Treat any request to create/open/draft a PR as the Graphite stack workflow (`pnpm pr:stack` / `gt submit`), passing draft flags when asked; fall back to `git` + `gh` only if Graphite is unavailable.
- Before submit: `gt track --parent <base>` for untracked branches, `gt submit --dry-run` to check scope, then confirm `baseRefName` and PR title/body with `gh pr view`.
- Rebase diverged branches before pushing so pushes fast-forward.
- Use `git worktree` isolation for parallel or potentially conflicting tracks; skip it for read-only or trivial edits.
- Use subagents liberally to preserve context and parallelize work, and include a subagent strategy in plans; after parallel agents edit a shared barrel (`index.ts`), re-read and consolidate it.

## Validation

- Run `pnpm lint` for every code-editing task, then `pnpm build` and `pnpm test`; `pnpm format:check` and `pnpm agents:check:strict` gate CI.
- Resolve `react-hooks/*` and React Compiler findings in touched React/TSX files; never read or mutate refs in render to drive UI.
- Run the full build including DTS: `tsup` DTS fails on unused imports and missing sibling types that esbuild ignores.
- Rebuild core (`pnpm build`) before `pnpm test` when adding core exports; `@color-kit/react` resolves core through package exports.
- If CI fails, confirm the real failing command with `gh run view --log-failed`.

## Engineering Rules

- Gamut checks (`inSrgbGamut`/`inP3Gamut`, and the plane gamut-region field) must read unclamped linear channel values. `GAMUT_EPSILON` (~0.000075) applies to the gamma-encoded channels (CSS Color 4 / colorjs.io), i.e. linear bounds `[-ε/12.92, linearize(1+ε)]`; share `gamut/linear-bounds.ts` rather than re-deriving them.
- Multi-entry hooks (`useMultiColor`) compute next state from the latest snapshot (`setState(prev => ...)`).
- Components with a `color?: Color` prop must `Omit<HTMLAttributes, 'color'>`.
- Keep `eslint` and `@eslint/js` on the same major version.
- When renaming a public symbol pre-launch, hard-cut over: update local and root barrel exports, internal callers, and docs in one pass.
- In the `color-kit` facade, copy each package's built `dist/` subtree and rewrite specifiers in `.js`, `.cjs`, `.d.ts`, `.d.cts`; build type producers before DTS consumers.
- Before calling a CSS selector dead, search class-name prefixes and template interpolation, not just exact literals.

## Learnings

- Record reusable lessons in `AGENTS.learnings.archive.md` (`pnpm agents:add`); promote here only if they should shape nearly every run.
- Format: `- **Short title**: One or two sentence actionable lesson.`

## Active Agent Learnings (Top 10 Evergreen)

- Full history lives in `AGENTS.learnings.archive.md`; the engineering rules above are the current evergreen set.
