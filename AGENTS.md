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
- **2026-02-09 — MDX + Vite React plugin ordering**: `@mdx-js/rollup` must use `enforce: 'pre'` when combined with `@vitejs/plugin-react` so MDX→JSX transformation runs before Babel tries to parse raw `.mdx` files.
- **2026-02-09 — Share docs nav and route registries**: Drive docs sidebar items and page module resolution from one registry file so new MDX pages are added once and cannot drift into broken links.
- **2026-02-09 — Audit codebase before refining planning docs**: When refining a planning/design document, explore the actual codebase first to ground status tracking (done/planned) in reality rather than guessing from the notes alone.
- **2026-02-10 — Execution-first planning docs**: For roadmap notes, define V1 scope, layer-specific status (core/react/docs), milestone ordering, and definition-of-done gates up front so planning can convert directly into PR-sized work.
- **2026-02-10 — Lock strategy with explicit decision logs**: When product direction is clarified in conversation, capture it as a dated “Direction Lock” section in the plan and use it to reorder milestones and release gates before adding new scope.
- **2026-02-10 — Centralize requested/displayed mapping**: Define one shared `ColorState` constructor that computes gamut mapping and metadata, then have hooks/components consume it directly; this keeps control geometry tied to requested values while display surfaces stay deterministic.
- **2026-02-10 — Use functional updates for collection hooks**: Multi-entry hooks (`useMultiColor`) must compute next state from the latest snapshot (functional `setState`) to keep batched operations deterministic; closure-based snapshots drop sequential edits in a single event.
- **2026-02-10 — Prefer background override over layered P3 fallback**: For Display-P3 swatches with transparency, use an sRGB `backgroundColor` fallback plus a single `background` P3 override. Layering translucent fallback and P3 image (`backgroundImage`) double-composites in capable browsers.
- **2026-02-10 — Geometry primitives need shared search controls**: Implement gamut geometry APIs with shared `tolerance`/`maxIterations` options and reuse them across boundary sampling so precision tuning is centralized and boundary tests stay deterministic.
