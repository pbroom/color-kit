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

## Reflection and Learnings

- At the end of non-trivial tasks, record reusable lessons in `AGENTS.learnings.archive.md`.
- Add every new reusable learning to archive first; only promote to Active if it is evergreen and broadly useful; keep Active capped at 10 and demote displaced entries to archive.
- Format:
  - `- **YYYY-MM-DD — Short title**: One or two sentence actionable lesson.`

## Active Agent Learnings (Top 10 Evergreen)

- Full history lives in `AGENTS.learnings.archive.md`.

- **2026-02-08 — Align eslint majors**: Keep `eslint` and `@eslint/js` on the same major version to avoid peer dependency warnings when adding linting to the workspace root.
- **2026-02-08 — Gamut check must use unclamped values**: `inSrgbGamut`/`inP3Gamut` must bypass clamping functions (`linearToSrgb`, `linearP3ToP3`) and check raw linear channel values directly. Clamped conversion pipelines silently mask out-of-gamut colors.
- **2026-02-08 — TypeScript strict mode catches unused imports in DTS**: `tsup` DTS builds fail on unused imports that esbuild silently ignores. Fix unused imports before assuming a build is clean - run the full build (including DTS) not just the ESM/CJS step.
- **2026-02-08 — HTML attribute name conflicts in React props**: Extending `HTMLAttributes<HTMLDivElement>` brings in a `color` attribute (string). If your component has a `color?: Color` prop, you must `Omit<..., 'color'>` from the HTML attributes to avoid type conflicts.
- **2026-02-08 — Parallel subagents need consolidated barrel exports**: When dispatching multiple subagents that each append to the same barrel file (`index.ts`), the last writer wins. Always do a final read + rewrite of the barrel after all agents complete to ensure consistent ordering and no duplicates.
- **2026-02-08 — Add epsilon tolerance to gamut boundary checks**: Floating-point rounding in color space matrix math means in-gamut colors can produce linear values like -0.00003. Use a small epsilon (~0.000075) in gamut boundary comparisons to avoid false negatives.
- **2026-02-09 — MDX + Vite React plugin ordering**: `@mdx-js/rollup` must use `enforce: 'pre'` when combined with `@vitejs/plugin-react` so MDX->JSX transformation runs before Babel tries to parse raw `.mdx` files.
- **2026-02-09 — Share docs nav and route registries**: Drive docs sidebar items and page module resolution from one registry file so new MDX pages are added once and cannot drift into broken links.
- **2026-02-10 — Rebuild core before react tests on new exports**: `@color-kit/react` tests resolve `@color-kit/core` through package exports, so adding new core exports requires a fresh `pnpm build` (or at least `@color-kit/core` build) before `pnpm test` to avoid stale-dist runtime misses.
- **2026-02-10 — Use functional updates for collection hooks**: Multi-entry hooks (`useMultiColor`) must compute next state from the latest snapshot (functional `setState`) to keep batched operations deterministic; closure-based snapshots drop sequential edits in a single event.

## Agent Learnings

- **2026-02-17 — Pin exploration subagent model explicitly**: For codebase discovery workflows, set `model: gpt-5.3-codex-high` in subagent frontmatter and repeat the model preference in the prompt body so delegation stays consistent.
- **2026-02-23 — Keep branch returns simple**: When a PR branch is done and no longer needed, switch to `main` first and then delete the feature branch to avoid confusing residual state in subsequent work.
- **2026-02-23 — Rebase before push on diverged branch**: If your feature branch reports ahead/behind status, rebase onto the current remote branch first so push is a fast-forward and your local fixes stay on top of teammates' latest updates.
- **2026-02-23 — Lock demo grid tracks against live text**: In centered preview shells, implicit grid columns can grow from `white-space: nowrap` telemetry text and make interactive demos appear to resize while dragging; force `grid-template-columns: minmax(0, 1fr)` and `min-width: 0` on the demo grid and its direct children.
- **2026-02-23 — Dry-run Graphite submit before publish**: Use `gt submit --dry-run` to verify which branches will be included; if unrelated descendants exist, submit without `--stack` so only trunk-to-current branches are published.
- **2026-02-23 — Strip Card component defaults for flat layout goals**: When you need a non-card container, remove the `Card` abstraction entirely (or fully override its defaults) so hidden rounded/background/shadow defaults can’t reintroduce card styling.
- **2026-02-23 — Fix CI by formatting full file set once**: When CI fails `prettier --check .` on many files, run `prettier --write` on all reported files in one pass (including lockfiles if listed) to avoid missing files and minimize CI feedback loops.
