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

## Parallel Work

- Use `git worktree` isolation for parallel or potentially conflicting development tracks.
- Skip worktrees for read-only exploration and trivial, low-conflict edits.

## Reflection and Learnings

- At the end of non-trivial tasks, record reusable lessons in `## Agent Learnings`.
- Add only non-duplicative, broadly useful entries.
- Format:
  - `- **YYYY-MM-DD — Short title**: One or two sentence actionable lesson.`

## Agent Learnings

- **2026-02-08 — Align eslint majors**: Keep `eslint` and `@eslint/js` on the same major version to avoid peer dependency warnings when adding linting to the workspace root.
- **2026-02-08 — Gamut check must use unclamped values**: `inSrgbGamut`/`inP3Gamut` must bypass clamping functions (`linearToSrgb`, `linearP3ToP3`) and check raw linear channel values directly. Clamped conversion pipelines silently mask out-of-gamut colors.
- **2026-02-08 — TypeScript strict mode catches unused imports in DTS**: `tsup` DTS builds fail on unused imports that esbuild silently ignores. Fix unused imports before assuming a build is clean — run the full build (including DTS) not just the ESM/CJS step.
- **2026-02-08 — HTML attribute name conflicts in React props**: Extending `HTMLAttributes<HTMLDivElement>` brings in a `color` attribute (string). If your component has a `color?: Color` prop, you must `Omit<..., 'color'>` from the HTML attributes to avoid type conflicts.
- **2026-02-08 — Parallel subagents need consolidated barrel exports**: When dispatching multiple subagents that each append to the same barrel file (`index.ts`), the last writer wins. Always do a final read + rewrite of the barrel after all agents complete to ensure consistent ordering and no duplicates.
- **2026-02-08 — Graphite requires repo sync before submit**: `gt submit --stack` fails if the repo isn't synced in Graphite settings. Fall back to `gh pr create` and `git push` when Graphite sync isn't configured yet.
- **2026-02-08 — Add epsilon tolerance to gamut boundary checks**: Floating-point rounding in color space matrix math means in-gamut colors can produce linear values like -0.00003. Use a small epsilon (~0.000075) in gamut boundary comparisons to avoid false negatives.
- **2026-02-09 — Keep Codex guidance reusable**: Maintain a clean `AGENTS.template.md` and install script separate from repo-specific learnings so guidance can be copied across repos without dragging local history along.
- **2026-02-09 — Rule file visibility**: User rules live in Cursor settings, but project rules must be `.mdc` files with frontmatter under `.cursor/rules` to appear in workspace context.
