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
- **Verify Graphite PR metadata after no-edit submit**: On existing multi-commit branches, `gt submit --no-edit --no-interactive` can reuse stale earlier commit text for the PR title/body; follow with `gh pr view` and `gh pr edit` when the published metadata does not match the final branch scope.
- **Prefer Bash 3-compatible script primitives**: Avoid Bash 4+ built-ins (for example `mapfile`) so scripts run in both CI Linux images and default macOS Bash.
- **React Compiler disallows ref-driven render state**: Do not read/mutate refs in render to drive UI branching; keep render inputs in state and update via effects when needed.
- **Source-branch discovery beats assumptions**: Verify whether a requested helper branch still exists before proceeding; if it does not, use the nearest equivalent AGENTS source branch to keep guidance updates moving without guessing.
- **2026-03-01 — Keep API demos snippet-aligned**: When docs include runnable API demos, derive demo inputs from the adjacent code example and render raw outputs (SVG/JSON) so docs stay implementation-accurate even if UI wrapper components drift.
- **2026-03-01 — Use iframe srcDoc for self-contained docs demos**: For API pages, package each demo as a standalone HTML/CSS/JS sandbox in `srcDoc` and inject only local runtime bindings; this keeps demos isolated without drifting to stale CDN versions.
- **2026-03-01 — Centralize Sandpack demo shell**: Put Sandpack setup (theme, panel options, borders, init mode) in one reusable docs component so adding new API demos is copy-free and style/perf defaults stay consistent.
- **2026-03-01 — Use viewport-aware clamp sizing for demos**: For wide doc widgets like Sandpack, prefer `min(80rem, max(100%, calc(100vw - 6rem)))` so they break prose constraints while preserving large-screen limits and minimum section width.
- **Use centering fallback for over-width docs widgets**: When a container can exceed parent width, combine percentage/viewport sizing with `left:50%` and `translateX(-50%)` so it remains centered instead of clinging to the left.
- **Lazy-split heavy docs runtimes at component boundary**: Keep the shell component tiny and dynamically import Sandpack runtime plus theme in a separate module; this shrinks route chunks dramatically while preserving interactive demos.
- **Sandpack template changes need stable remount keys**: When switching template/entry/dependency combinations in docs demos, pass a derived `key` to `Sandpack` so runtime state resets and template changes actually apply.
- **Static Sandpack serves CSS as stylesheet, not JS module**: In `template="static"` demos, link styles via `<link rel="stylesheet">` in HTML and avoid `import './styles.css'` from JS to prevent MIME errors and blank previews.
- **Prefer local-rendered API demos when external runtimes flake**: If sandbox connectivity blocks docs iteration, fall back to deterministic in-repo React demo panels plus code blocks so API docs stay shippable and testable offline.
- **Preserve in-progress visual tweaks when simplifying demos**: When trimming docs demos, retain user-edited geometry/styling params (for example axis inversion, open paths, and color tuning) and only remove explicitly unwanted sections.
- **Avoid function/variable name collisions during API renames**: When introducing concise exported names like `plane()`, rename local variables (`resolvedPlane`) immediately to avoid accidental symbol shadowing in call sites such as query loops.
- **Introduce concise type aliases before broad type renames**: When API function names are simplified (`plane`, `planeHue`), add aligned aliases (`Plane`, `PlaneQueries`) and migrate internals first; this keeps external typing stable while converging naming.
- **Document query helpers where behavior diverges by axis support**: In plane query docs, call out empty-result behavior for non-lightness/chroma axes so API consumers understand intentional no-op outputs.
- **Encode defaults directly on API input fields**: For discoverability in editor hovers, put `@default`-style guidance on input interface properties (for example `PlaneDefinition`/`PlaneAxis`) in addition to function-level docs.
- **Keep plane multi-model support adapter-first**: Expand models by converting at `colorToPlane`/`planeToColor` boundaries while keeping LC query kernels and packed/WASM payloads canonical; add explicit non-OKLCH tests to lock schema stability.
- **Fallback preflight when Turbo is unavailable**: If `pnpm turbo` fails due missing `turbo.json`, run equivalent checks with `pnpm lint`, `pnpm -r exec tsc --noEmit`, and `pnpm build` before submitting stacks.
- **2026-03-03 — Remove Sandpack migrations completely**: When replacing docs Sandpack demos, delete the runtime wrapper and its raw demo/parser companions (`*sandpack*`, `quick-start-source`, `plane-api-quick-start.demo.*`) so old artifacts do not linger unreferenced.
- **2026-03-03 — Complete export renames through barrels**: When renaming a core API symbol, update both local and root barrel exports in the same change so downstream package builds do not fail on missing named exports.
- **2026-03-03 — Pre-launch API renames should be hard cutovers**: If compatibility aliases are unnecessary, remove the old symbol and migrate every internal caller/docs check in one pass to avoid ambiguous mixed API usage.
- **2026-03-03 — Rename fluent helpers with their API types**: For fluent API renames (for example `createPlaneQuery` → `sense`), also rename exported helper interfaces/types (`PlaneSense*`) and refresh docs snippets so naming stays coherent across code and references.
- **2026-03-04 — Document nested options at call sites**: For APIs that accept an `options` object, add `@param options.*` tags on the exported function (not just interface field docs) so IntelliSense parameter help exposes option members where callers type arguments.
- **2026-03-04 — Prefer focused query param docs**: For large query objects, document the highest-signal fields (`reference`, `hue`, `metric`, `level`, `threshold`, `gamut`) in function JSDoc to improve IntelliSense without overwhelming hovers.
- **2026-03-04 — Document fallback order in JSDoc**: For resolver helpers (for example hue resolution), include the precedence chain in the function comment so callers can predict behavior without reading implementation details.
- **2026-03-29 — Check log-failed for true CI cause**: GitHub Actions summary annotations can mention warnings that look severe; confirm the real failing command with `gh run view --log-failed` before deciding the fix.
- **2026-03-30 — Map VS Code themes onto Sandpack surfaces**: Sandpack only exposes three surface tokens, so mirror VS Code themes by mapping `editor.background` to `surface1`, divider/control colors to `surface2` and `surface3`, and pulling syntax hues from the inherited VS Code theme chain instead of guessing.
- **2026-03-30 — Reuse Shiki theme dist files for Sandpack palettes**: When docs already depend on Shiki themes, read the installed `@shikijs/themes/dist/*` files to source real GitHub UI backgrounds and token colors instead of reconstructing them from screenshots or memory.
- **2026-03-31 — Treat pasted DOM as external until proven local**: When a user shares DOM from a page, confirm whether it belongs to the current repo before tracing source files; for library detection, trust DOM markers like Sandpack `sp-*` wrappers more than repo similarity.
- **Sandpack JS tabs on TS templates**: To present `App.js` in docs while still loading hidden TypeScript sources, keep the TypeScript Sandpack template and override the entry file plus sandbox `tsconfig` (`allowJs`) instead of switching the whole template to plain JS.
- **Use local bridge modules for shared demos**: When a docs example must run both in the app and in Sandpack, import through a colocated re-export file so the authored demo and visible sandbox code stay identical while each environment can swap in its own backing implementation.
- **Mirror real package names in Sandpack via hidden node_modules**: If a docs demo should show the published import path, add hidden `/node_modules/<pkg>/package.json` and entry files inside the sandbox that re-export local workspace sources; this preserves runnable demos without teaching fake imports.
- **2026-04-01 — Copy dist subtrees for facade packages**: When consolidating multiple published packages behind one consumer package, copy each source package's built `dist/` subtree into stable subfolders and rewrite internal specifiers in `.js`, `.cjs`, `.d.ts`, and `.d.cts`; barrel re-exports alone break worker-relative URLs and wasm sidecars.
