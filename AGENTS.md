## Agent Learnings

- **2026-02-08 — Align eslint majors**: Keep `eslint` and `@eslint/js` on the same major version to avoid peer dependency warnings when adding linting to the workspace root.
# Agents

## Agent Learnings

- **2026-02-08 — Gamut check must use unclamped values**: `inSrgbGamut`/`inP3Gamut` must bypass clamping functions (`linearToSrgb`, `linearP3ToP3`) and check raw linear channel values directly. Clamped conversion pipelines silently mask out-of-gamut colors.
- **2026-02-08 — TypeScript strict mode catches unused imports in DTS**: `tsup` DTS builds fail on unused imports that esbuild silently ignores. Fix unused imports before assuming a build is clean — run the full build (including DTS) not just the ESM/CJS step.
- **2026-02-08 — HTML attribute name conflicts in React props**: Extending `HTMLAttributes<HTMLDivElement>` brings in a `color` attribute (string). If your component has a `color?: Color` prop, you must `Omit<..., 'color'>` from the HTML attributes to avoid type conflicts.
- **2026-02-08 — Parallel subagents need consolidated barrel exports**: When dispatching multiple subagents that each append to the same barrel file (`index.ts`), the last writer wins. Always do a final read + rewrite of the barrel after all agents complete to ensure consistent ordering and no duplicates.
- **2026-02-08 — Graphite requires repo sync before submit**: `gt submit --stack` fails if the repo isn't synced in Graphite settings. Fall back to `gh pr create` and `git push` when Graphite sync isn't configured yet.
- **2026-02-08 — Add epsilon tolerance to gamut boundary checks**: Floating-point rounding in color space matrix math means in-gamut colors can produce linear values like -0.00003. Use a small epsilon (~0.000075) in gamut boundary comparisons to avoid false negatives.
