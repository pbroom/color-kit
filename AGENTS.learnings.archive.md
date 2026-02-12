# Agent Learnings Archive

## Purpose

This archive is the source of truth for reusable agent learnings in this repository.
`AGENTS.md` keeps only the top 10 active evergreen learnings for high-signal context.

## Entry Format

- `- **YYYY-MM-DD — Short title**: One or two sentence actionable lesson.`

## Entries

- **2026-02-12 — Bundle ESM-only deps for CJS exports**: If a package ships both `import` and `require` entrypoints, adding an ESM-only dependency can silently break the CJS build (`ERR_REQUIRE_ESM`); configure tsup/esbuild to bundle that dependency (for example via `noExternal`) and verify with a real `require()` smoke test.
- **2026-02-11 — Cache geometry outside pointer hot path**: In drag loops, cache `getBoundingClientRect()` on pointer start and refresh via resize/scroll observers instead of reading layout every move; repeated rect reads can force sync layout and tank INP.
- **2026-02-11 — RAF + coalesced events tame pointer pressure**: For high-frequency pointer input, batch updates to one commit per animation frame, consume the latest coalesced event, and skip no-op updates with a small epsilon to avoid redundant React/state churn.
- **2026-02-11 — Keep WebGL paths shader-native**: GPU renderers should synthesize pixels in fragment shaders from uniforms/UV coordinates rather than uploading CPU-rendered textures each frame; texture-blit “GPU” paths still pay CPU raster costs.
- **2026-02-11 — Profile harnesses need sample-count guards**: Automated interaction profiling should fail or flag runs with too few frame samples (for example `samples < 30`) so unrealistically “perfect” results from under-sampling do not mask regressions.
- **2026-02-11 — toRgb returns 0-255, not 0-1**: When writing to ImageData or canvas pixels, use `rgb.r`, `rgb.g`, `rgb.b` directly; `toRgb()` returns Rgb with channels in 0-255 range. Multiplying by 255 again produces blocky/wrong colors (values clamp to 255).
- **2026-02-08 — Align eslint majors**: Keep `eslint` and `@eslint/js` on the same major version to avoid peer dependency warnings when adding linting to the workspace root.
- **2026-02-08 — Gamut check must use unclamped values**: `inSrgbGamut`/`inP3Gamut` must bypass clamping functions (`linearToSrgb`, `linearP3ToP3`) and check raw linear channel values directly. Clamped conversion pipelines silently mask out-of-gamut colors.
- **2026-02-08 — TypeScript strict mode catches unused imports in DTS**: `tsup` DTS builds fail on unused imports that esbuild silently ignores. Fix unused imports before assuming a build is clean - run the full build (including DTS) not just the ESM/CJS step.
- **2026-02-08 — HTML attribute name conflicts in React props**: Extending `HTMLAttributes<HTMLDivElement>` brings in a `color` attribute (string). If your component has a `color?: Color` prop, you must `Omit<..., 'color'>` from the HTML attributes to avoid type conflicts.
- **2026-02-08 — Parallel subagents need consolidated barrel exports**: When dispatching multiple subagents that each append to the same barrel file (`index.ts`), the last writer wins. Always do a final read + rewrite of the barrel after all agents complete to ensure consistent ordering and no duplicates.
- **2026-02-08 — Graphite requires repo sync before submit**: `gt submit --stack` fails if the repo isn't synced in Graphite settings. Fall back to `gh pr create` and `git push` when Graphite sync isn't configured yet.
- **2026-02-08 — Add epsilon tolerance to gamut boundary checks**: Floating-point rounding in color space matrix math means in-gamut colors can produce linear values like -0.00003. Use a small epsilon (~0.000075) in gamut boundary comparisons to avoid false negatives.
- **2026-02-09 — Keep Codex guidance reusable**: Maintain a clean `AGENTS.template.md` and install script separate from repo-specific learnings so guidance can be copied across repos without dragging local history along.
- **2026-02-09 — Rule file visibility**: User rules live in Cursor settings, but project rules must be `.mdc` files with frontmatter under `.cursor/rules` to appear in workspace context.
- **2026-02-09 — MDX + Vite React plugin ordering**: `@mdx-js/rollup` must use `enforce: 'pre'` when combined with `@vitejs/plugin-react` so MDX->JSX transformation runs before Babel tries to parse raw `.mdx` files.
- **2026-02-09 — Share docs nav and route registries**: Drive docs sidebar items and page module resolution from one registry file so new MDX pages are added once and cannot drift into broken links.
- **2026-02-09 — Audit codebase before refining planning docs**: When refining a planning/design document, explore the actual codebase first to ground status tracking (done/planned) in reality rather than guessing from the notes alone.
- **2026-02-10 — Execution-first planning docs**: For roadmap notes, define V1 scope, layer-specific status (core/react/docs), milestone ordering, and definition-of-done gates up front so planning can convert directly into PR-sized work.
- **2026-02-10 — Lock strategy with explicit decision logs**: When product direction is clarified in conversation, capture it as a dated "Direction Lock" section in the plan and use it to reorder milestones and release gates before adding new scope.
- **2026-02-10 — Centralize requested/displayed mapping**: Define one shared `ColorState` constructor that computes gamut mapping and metadata, then have hooks/components consume it directly; this keeps control geometry tied to requested values while display surfaces stay deterministic.
- **2026-02-10 — Use functional updates for collection hooks**: Multi-entry hooks (`useMultiColor`) must compute next state from the latest snapshot (functional `setState`) to keep batched operations deterministic; closure-based snapshots drop sequential edits in a single event.
- **2026-02-10 — Prefer background override over layered P3 fallback**: For Display-P3 swatches with transparency, use an sRGB `backgroundColor` fallback plus a single `background` P3 override. Layering translucent fallback and P3 image (`backgroundImage`) double-composites in capable browsers.
- **2026-02-10 — Geometry primitives need shared search controls**: Implement gamut geometry APIs with shared `tolerance`/`maxIterations` options and reuse them across boundary sampling so precision tuning is centralized and boundary tests stay deterministic.
- **2026-02-10 — Automate stacked PR metadata after submit**: A single repo script that runs `gt track` (when needed), `gt submit --stack`, then normalizes PR title/body via `gh pr edit` removes repetitive manual cleanup and keeps PRs consistently reviewable.
- **2026-02-10 — Preserve vision details with doc dual-layering**: For execution-first rewrites, keep core milestones concise and move scenario-level UX behavior into a dedicated appendix plus a section-by-section preservation matrix so planning clarity improves without losing product intent.
- **2026-02-10 — Rebuild core before react tests on new exports**: `@color-kit/react` tests resolve `@color-kit/core` through package exports, so adding new core exports requires a fresh `pnpm build` (or at least `@color-kit/core` build) before `pnpm test` to avoid stale-dist runtime misses.
- **2026-02-10 — Proportional chroma bands need a lightness anchor**: For tonal strip generation, compute proportional mode from `requestedChroma / maxChromaAt(selectedLightness)` and reuse shared search options so proportional and clamped modes remain deterministic across gamuts.
- **2026-02-10 — Audit intent with evidence before roadmap execution**: Before implementing planning-doc follow-ups, create a notes-to-code matrix with concrete file evidence and status labels (`realized`/`partial`/`missing`) so execution work targets real gaps instead of stale plan text.
- **2026-02-10 — Bind docs property panels to live demos through shared context**: Put right-rail controls and demo state in one docs-level provider so component demos can opt into inspector-driven props without coupling route logic into the primitives themselves.
- **2026-02-10 — Suspense docs need observer-driven outline syncing**: For route-level heading outlines, avoid short fixed `requestAnimationFrame` retry loops and instead attach a `MutationObserver` so lazy-loaded MDX content reliably populates right-rail headings on slow loads.
- **2026-02-10 — Enforce pre-1.0 policy in CI for inception projects**: When a workspace is intentionally pre-production, codify it with a version guard (`<1.0.0`) and non-`latest` publish tags so teams can evolve APIs quickly without accidental stability signaling.
- **2026-02-10 — Use cached patch staging for mixed trees**: When files contain unrelated edits, stage only intended hunks with git apply --cached so user changes stay out of focused commits.
- **2026-02-10 — Use Corepack pnpm in fresh worktrees**: Fresh worktrees can pick up an older global `pnpm` and silently rewrite lockfiles or miss test peers. Run installs/validation with `corepack pnpm` so dependency resolution matches the repo-pinned package manager version.
- **2026-02-10 — Capture pointers on interactive roots**: In React pointer handlers, call `e.currentTarget.setPointerCapture(...)` instead of `e.target` so drag capture remains stable even when events originate from nested children.
- **2026-02-10 — Prevent theme flash with early theme bootstrap**: In Vite docs apps, set `data-theme` in `index.html` before React mounts and mirror preference state with `localStorage` + `matchMedia` so `system` mode tracks OS changes without first-paint flicker.
