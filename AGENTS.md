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
- Treat general requests to create, open, or draft a PR as the same workflow as “stack PR”: use the repo Graphite stack path (`pnpm pr:stack` / `gt submit`) and pass draft-preserving flags when the user asks for draft, rather than creating PRs directly with `gh`.
- If Graphite is unavailable or unsynced, fall back to plain `git` + `gh`.
- For any code-editing task, run `pnpm lint` before final validation.
- For React/TSX work, proactively resolve `react-hooks/*` findings (including React Compiler rules) in touched files before final validation.

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
- **2026-04-01 — Sandpack tab-bar actions need `FileTabs` plus `sp-editor` sizing**: To place custom controls inside Sandpack's file tab strip without breaking layout sizing, render the runtime `FileTabs` export in a custom header and keep the editor column wrapped in a `sp-stack sp-editor` container so `SandpackLayout` still treats it like a first-class editor pane.
- **Prefer Bash 3-compatible script primitives**: Avoid Bash 4+ built-ins (for example `mapfile`) so scripts run in both CI Linux images and default macOS Bash.
- **React Compiler disallows ref-driven render state**: Do not read/mutate refs in render to drive UI branching; keep render inputs in state and update via effects when needed.
- **Source-branch discovery beats assumptions**: Verify whether a requested helper branch still exists before proceeding; if it does not, use the nearest equivalent AGENTS source branch to keep guidance updates moving without guessing.
- **2026-03-01 — Keep API demos snippet-aligned**: When docs include runnable API demos, derive demo inputs from the adjacent code example and render raw outputs (SVG/JSON) so docs stay implementation-accurate even if UI wrapper components drift.
- **2026-03-01 — Use iframe srcDoc for self-contained docs demos**: For API pages, package each demo as a standalone HTML/CSS/JS sandbox in `srcDoc` and inject only local runtime bindings; this keeps demos isolated without drifting to stale CDN versions.
- **2026-03-01 — Centralize Sandpack demo shell**: Put Sandpack setup (theme, panel options, borders, init mode) in one reusable docs component so adding new API demos is copy-free and style/perf defaults stay consistent.
- **2026-04-02 — Wide docs widgets use column bleed, not viewport breakout**: Put Sandpack/playgrounds in `ck-docs-content-bleed` with `w-full min-w-0` so they span the article’s `1fr | ~700px | 1fr` row; use `max-w-none` on the inner shell when the playground should fill those side lanes, or `max-w-7xl mx-auto` when you want a centered cap. Add `w-full min-w-0` on `SandpackLayout` so flex children shrink. Avoid `max(100%, calc(100vw - …))` plus `left-1/2 -translate-x-1/2`, which forces near-viewport width and overlaps sidebars.
- **2026-04-02 — Docs shell: right rail from 2xl, Panels sheet below**: Default the outer docs grid to nav + main until `2xl`, then add the fixed right column; keep the Panels sheet trigger `2xl:hidden` so outline/inspector stays reachable between xl and 2xl.
- **2026-04-02 — Right-rail tabs in narrow columns**: For ~260px outline/property tabs, prefer a flex `TabsList` with `min-w-0`, equal-width triggers, and wrapping labels (`whitespace-normal`, tight padding) over a rigid `grid-cols-2` so text does not overflow the rail.
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
- **2026-04-01 — Build type producers before DTS consumers**: In umbrella package prebuild scripts, build workspace packages that provide exported types before dependent packages that emit `.d.ts`; clean CI runners will surface missing-type failures that local cached `dist/` folders hide.
- **2026-04-01 — Gate heavy facade artifacts behind CI intent**: When a unified package can optionally bundle generated WASM assets, keep the default full build strict but add an explicit env-gated path for generic build/test jobs so matrix CI stays toolchain-free while dedicated WASM jobs still validate the real binaries.
- **2026-04-01 — Warm expensive LUT caches outside test bodies**: If a correctness test depends on a large cached LUT build, prewarm it in `beforeAll` (with an explicit hook timeout if needed) so CI CPU contention does not consume the per-test timeout budget and create flakes.
- **2026-04-01 — Add local `vite-env.d.ts` for Vite globals**: In nested Vite apps, keep a colocated `vite-env.d.ts` with `/// <reference types="vite/client" />`; relying on `tsconfig` `types` alone can still leave editor diagnostics like `import.meta.glob` unresolved.
- **2026-04-02 — Put key helper docs under interactive quick starts**: On API pages with a playground, document the 2-3 primary entry points immediately below it so readers can connect the live demo to the exact functions before the broader reference sections.
- **2026-04-02 — Pair API helper examples with parameter tables**: For top-level docs helpers like `definePlane()` or `toSvgPath()`, add a small Markdown table for inputs/options next to the example so defaults and nested option names are scannable without reading the type definitions.
- **2026-04-02 — Use plain shadcn tables in narrative MDX sections**: When an API docs page already provides layout rhythm, prefer inline shadcn `Table` primitives over card-wrapped helper components so examples and prop tables read as one continuous section.
- **2026-04-02 — Rename plane models separately from gamut targets**: In plane APIs, model strings (for example `p3`) and gamut strings (for example `display-p3`) are distinct surfaces. When improving DX for model names, update `PlaneModel` callers/docs/tests without changing gamut query APIs.
- **2026-04-02 — Keep workspace `dist` outputs during watch-mode DTS builds**: For packages that emit `.d.ts` against sibling workspace packages, avoid `clean: true` in `tsup --watch`. Temporarily emptying `dist/` can make downstream DTS builds resolve package exports against missing declarations and leave the dev app in a half-built state.
- **2026-04-04 — Normalize shorthand plane inputs before caching**: When `PlaneDefinition` gains helper fields like color anchors or relies on omitted defaults, build cache keys from `definePlane(plane)` so equivalent inputs share entries instead of fragmenting the query cache.
- **2026-04-04 — Separate strict overloads from dynamic config resolvers**: If a public API should reject invalid object literals at compile time but internals still pass broad config objects around, keep the strict overloads on the public function and route internal/dynamic callers through a separate broad resolver instead of adding a catch-all overload that weakens the surface.
- **2026-04-04 — `h/c` slices need a hue sweep, not `gamutBoundary()`**: Plane `gamutBoundary()` is the fixed-hue LC contour (`maxChromaAt(l, hue)`), so non-`l/c` planes intentionally return empty geometry. For hue/chroma visuals at fixed lightness, sample `maxChromaAt(fixedL, h)` across hue instead of projecting the existing query.
- **2026-04-04 — Separate offscreen contours from viewport clips**: For zoomed plane views, do not clamp projected contour points into `[0,1]` before deciding visibility. Return explicit viewport-intersection metadata so a fully in-gamut window can be distinguished from a true boundary crossing.
- **2026-04-04 — Track Graphite branches before submit**: If `gt submit --stack` reports the current branch as untracked, run `gt track --parent <base>` first; having a git remote branch is not enough for Graphite to publish the PR.
- **2026-04-04 — Keep Sandpack-visible demo sources snippet-aligned**: If a `*.demo.tsx` file feeds the visible Sandpack/App.js tab, treat it as source-of-truth example code and move docs-only preview styling into surrounding docs wrappers or shared app CSS. Only put essential styling on the demo file itself when that same component is intentionally rendered outside Sandpack; otherwise iframe-only `/styles.css` changes or docs-only inline styling can desync the shown snippet and static preview.
- **2026-04-04 — New plane queries need distinct packed path ranges**: When a `PlaneQuery` returns multiple geometry groups, extend `PackedPlaneQueryDescriptor` with separate metadata for each group and update scheduler bucket keys at the same time; reusing only the existing `pathStart/pathCount` pair loses viewport-region context in worker round-trips.
- **2026-04-04 — Split stable docs demos from experimental Sandpack sources**: When a docs page needs both a canonical quick-start snippet and a mutable playground, keep separate raw `*.demo.tsx` sources and feed them into one shared Sandpack wrapper via props. That preserves the teaching example while still giving the team a safe sandbox to iterate in.
- **2026-04-04 — Keep plane query tracing in a sidecar**: When instrumenting expensive plane solvers, return `{ result, trace }` from dedicated inspection helpers and pass scheduler/backend timings through optional `debugTrace` metadata. Leaving `PlaneQueryResult` and packed geometry unchanged keeps worker transport stable while still exposing rich diagnostics to docs tooling.
- **2026-04-04 — TS-heavy sandbox demos should mount as `App.tsx`**: If a Sandpack-visible demo file contains real TypeScript syntax, switch that sandbox instance to an `App.tsx` entry instead of stripping types or using `@ts-nocheck`. Keep `App.js` only for examples that are already valid plain JS/JSX.
- **2026-04-04 — Adaptive implicit contours should refine on a dyadic grid**: Start implicit `gamutRegion` marching squares from a coarse root grid and cache midpoint samples so sparse views evaluate far fewer points, while the worst case still caps at the old full-grid sample count. Keep any fallback fill/visible-region pass on a lower cache-aligned grid to preserve result shapes without giving back the performance win.
- **2026-04-09 — Route-split docs demos before deeper tuning**: On the docs app, the biggest load-time win came from lazy route entrypoints plus viewport-gated demo mounting. Move consumers off eager demo imports first, then trim heavy Sandpack inputs once the main route chunk is already smaller.
- **2026-04-19 — Gamut-region telemetry buckets need plane signatures**: For `PlaneComputeScheduler`, bucket `gamutRegion` workloads by gamut plus resolved plane model and x/y channels, not just `scope`, or cheap domain-edge requests can skew backend decisions for heavier implicit-contour planes.
- **2026-04-19 — Default-branch required checks are ruleset-backed**: This repo enforces merge-blocking checks through GitHub repository rulesets, not legacy branch protection. When a new job like `lint` must become mandatory, update the active ruleset’s `required_status_checks` instead of looking for branch protection settings.

## Learned User Preferences

- The user prefers incubating the input primitive in the docs playground with the repo's own documentation and testing tooling rather than moving immediately to Storybook.
- The user prefers playground page navigation to use minimal side-nav-like list items with active state shown through lightness and font weight, not button treatments, cards, or multiline descriptions.
- The user prefers explicit control labels over ambiguous labels like `Auto` when showing defaults such as input precision.
- The user prefers border-box based outlines for input defaults because borders are expected across use cases, while inset shadows are more of a styling decision.

## Learned Workspace Facts

- The Input Primitive Lab is intended to be color-agnostic: it should refine, test, and visualize a standalone input component primitive independently from ColorPlane state.
- The Input Primitive Lab should keep the standalone input directly on the page without decorative wrappers such as cards or background gradients.
- The standalone input should inherit the default spacing, sizing, font, and cursor treatment refined in the color plane playground while remaining state-independent from the color plane.
- Invalid raw input content should not automatically trigger a visible error state in the Input Primitive Lab.
