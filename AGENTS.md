# Codex Workspace Guidance

This file defines top-level guidance for Codex in this repository.

## Branch Safety

- Never commit directly to `main` or `master`.
- Before commit-worthy changes, verify the branch with `git branch --show-current`.
- If you are on `main`/`master`, create a feature branch before proceeding (prefer `codex/<topic>` naming in Codex).

## Branch / PR Workflow

- Prefer one logical change per branch and keep branches reviewable.
- Use Conventional Commit style messages (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
- If Graphite is configured, prefer `gt` workflow (`gt create`, `gt modify`, `gt submit --stack`).
- If Graphite is unavailable or unsynced, fall back to plain `git` + `gh`.
- For React/TSX work, run `pnpm lint` and proactively resolve `react-hooks/*` findings (including React Compiler rules) in touched files before final validation.

## Parallel Work

- Use `git worktree` isolation for parallel or potentially conflicting development tracks.
- Skip worktrees for read-only exploration and trivial, low-conflict edits.

## Subagents

- Use subagents liberally to preserve the agent context window and run tasks in parallel.
- Always include subagent utilization strategy as part of plans.

## Reflection and Learnings

- At the end of non-trivial tasks, record reusable lessons in `AGENTS.learnings.archive.md` by default.
- Only mirror a learning into `AGENTS.md` when it is critical frontmatter guidance that should influence nearly every agent run.
- Archive first, then selectively promote; keep mirrored learnings high-signal and compact.
- Format:
  - `- **Short title**: One or two sentence actionable lesson.`

## Active Agent Learnings (Top 10 Evergreen)

- Full history lives in `AGENTS.learnings.archive.md`.

- **Align eslint majors**: Keep `eslint` and `@eslint/js` on the same major version to avoid peer dependency warnings when adding linting to the workspace root.
- **Gamut checks must use unclamped values**: `inSrgbGamut`/`inP3Gamut` must bypass clamping functions (`linearToSrgb`, `linearP3ToP3`) and check raw linear channel values directly. Clamped conversion pipelines silently mask out-of-gamut colors.
- **TypeScript strict mode catches unused imports in DTS**: `tsup` DTS builds fail on unused imports that esbuild silently ignores. Run the full build (including DTS), not just ESM/CJS output, before considering a build clean.
- **HTML attribute name conflicts in React props**: Extending `HTMLAttributes<HTMLDivElement>` brings in a `color` attribute (string). If your component has a `color?: Color` prop, `Omit<..., 'color'>` from inherited HTML attributes.
- **Parallel subagents need consolidated barrel exports**: When multiple subagents append to the same barrel file (`index.ts`), do a final read + rewrite after all agents complete to avoid missing or duplicated exports.
- **Add epsilon tolerance to gamut boundary checks**: Floating-point matrix math can produce near-zero negatives for in-gamut colors; use a small epsilon (~0.000075) to avoid false out-of-gamut flags.
- **MDX + Vite React plugin ordering**: `@mdx-js/rollup` must use `enforce: 'pre'` with `@vitejs/plugin-react` so MDX transforms before Babel parses files.
- **Share docs nav and route registries**: Drive docs sidebar items and page module resolution from one registry so new MDX pages are added once and links cannot drift.
- **Rebuild core before react tests on new exports**: `@color-kit/react` tests resolve `@color-kit/core` through package exports, so new core exports require a fresh `pnpm build` (or at least `@color-kit/core` build) before `pnpm test`.
- **Use functional updates for collection hooks**: Multi-entry hooks (`useMultiColor`) should compute next state from the latest snapshot (`setState(prev => ...)`) so batched edits remain deterministic.

## Agent Learnings

- **Keep AGENTS memory high-signal**: Prefer compact, hard-to-rediscover lessons; archive or remove low-leverage run history and avoid metadata-only prefixes like dates.
- **Rebase before push on diverged branch**: If your branch is ahead/behind remote, rebase first so push is fast-forward and your fixes stay on top of the latest upstream work.
- **Dry-run Graphite submit before publish**: Use `gt submit --dry-run` to verify included branches; if unrelated descendants appear, submit without `--stack`.
- **Stage all intended files before gt submit**: If `gt submit --stack --no-interactive` says the branch has no changes, run `git add`/`gt modify` first so the current work is actually committed and included.
- **Reparent merged Graphite ancestors before submit**: If `gt submit` reports a merged parent branch as empty and blocks your branch, run `gt track --parent main` (or the correct live parent) so submission scopes to the active diff.
- **Confirm stacked PR base targets parent branch**: After `gt submit --stack`, verify `baseRefName` with `gh pr view <branch> --json baseRefName` so stacked PRs review in dependency order instead of accidentally targeting `main`.
- **Prefer Bash 3-compatible script primitives**: Avoid Bash 4+ built-ins (for example `mapfile`) so scripts run in both CI Linux images and default macOS Bash.
- **React Compiler disallows ref-driven render state**: Do not read/mutate refs in render to drive UI branching; keep render inputs in state and update via effects when needed.
- **Source-branch discovery beats assumptions**: Verify whether a requested helper branch still exists before proceeding; if it does not, use the nearest equivalent AGENTS source branch to keep guidance updates moving without guessing.
