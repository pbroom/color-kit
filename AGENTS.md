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

- At the end of non-trivial tasks, record reusable lessons in `AGENTS.learnings.archive.md`.
- Add every new reusable learning to archive first; only promote to Active if it is evergreen and broadly useful; keep Active capped at 10 and demote displaced entries to archive.
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
- **Fix CI formatting in one pass**: When `prettier --check .` reports multiple files, run `prettier --write` once over the full reported set (including lockfiles) to avoid repeated CI loops.
- **Reuse existing PR worktrees for conflict fixes**: Before creating a new worktree for a conflicted branch, check for an existing clean worktree and resolve in-place to avoid branch drift.
- **Prefer Bash 3-compatible script primitives**: Avoid Bash 4+ built-ins (for example `mapfile`) so scripts run in both CI Linux images and default macOS Bash.
- **Post complex PR review comments via one JSON payload**: For `gh api .../pulls/<n>/reviews`, send body + event + inline comments in a single `--input` JSON payload so comments attach to one review and avoid zsh form/globbing pitfalls.
- **React Compiler disallows ref-driven render state**: Do not read/mutate refs in render to drive UI branching; keep render inputs in state and update via effects when needed.
- **Contrast-region fills need domain closure and exclusion invariants**: Close open contours against the domain loop (not direct endpoint joins), process all open paths, and enforce reference exclusion using the gamut-mapped reference color for out-of-gamut drags.
- **Preserve legacy props by consuming and mapping**: Keep deprecated props in component signatures, map them to new semantics, and let explicit modern props win so deprecated props do not leak to DOM attributes.
- **Treat checkout-canceled matrix jobs as transient first**: If multiple jobs fail in `actions/checkout` with cancellation errors, retrigger with a fresh commit before chasing code-level regressions.
- **Bridge new geometry APIs through adapter props first**: When introducing a new core geometry surface, add React adapter helpers and optional precomputed layer props (`points`/`paths`) so adoption can happen incrementally without breaking existing layer internals.
- **2026-02-28 — Scope runtime Shiki imports**: For browser-side code highlighting, load `shiki/core` plus only required language/theme modules via lazy imports; importing full `shiki` in app code can explode docs bundles.

- **2026-02-28 — Constrain sticky doc panels**: Set fixed viewport-based heights on sticky sidebar/right-rail containers before relying on ScrollArea internals, so vertical compression doesn’t disable internal scrolling.
- **2026-02-28 — Stage all intended files before gt submit**: If `gt submit --stack --no-interactive` says the branch has no changes, run `git add`/`gt modify` first so the current work is actually committed and included.
- **2026-03-01 — Validate contour closure in boolean geometry**: For marching-squares region ops, add a donut subtraction sanity check (`center` outside, ring inside) to catch open-contour regressions before shipping.
