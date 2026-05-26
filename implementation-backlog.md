# Implementation Backlog

Source: thermo-nuclear code quality review on 2026-05-25 against `main` at `b7b6c21`, with follow-up findings merged after `implementation-backlog.md` landed on `main` at `5a48582`.

This backlog tracks structural maintainability work that is too large to treat as incidental cleanup. Prefer small reviewable branches, but keep each branch pointed at one durable item so cleanup does not dissolve into local nits.

Replaces `CODE_QUALITY_BACKLOG.md` (CQ-001 through CQ-010 — all completed; see [Prior backlog completion](#prior-backlog-completion)).

## Priority guide

| Priority | Meaning                                                                  |
| -------- | ------------------------------------------------------------------------ |
| **P0**   | Active drift, duplicated logic, or debt that blocks healthy feature work |
| **P1**   | High structural debt with a clear decomposition path                     |
| **P2**   | Important maintainability debt; tackle after P0/P1 gates                 |

## Approval bar (for large features)

Do not green-light large features on these surfaces without a decomposition plan:

- No god-file growth past 1k lines without a split plan (eight production files already exceed it)
- No feature logic in shared paths without a dedicated abstraction
- No manual registry forks diverging from `@color-kit/react` + `@color-kit/control-kit`
- No inverted package layering (e.g. contrast ↔ plane type cycles)
- No compute backend should report a backend it did not truly execute
- No worker/WASM ABI should silently manufacture geometry from missing payload fields
- No dual docs source of truth for the same routed page

---

## Backlog

### IB-001 — Stop registry drift: thin wrappers + CI parity gate

- **Priority:** P0
- **Status:** Completed 2026-05-25
- **Evidence:**
  - `registry/components/color-input.tsx` now mirrors the canonical `packages/react/src/color-input.tsx` adapter and delegates parsing/scrubbing to `color-kit/react` + `color-kit/control-kit`.
  - `scripts/check-registry-sync.mjs` runs through `pnpm check:preprod` so CI rejects color-input registry drift, missing registry dependencies, or a reintroduced local parser/scrub fork.
  - `registry/components/color-area.tsx` remains an intentional standalone registry subset; known gaps are performance profiles, worker-backed queries, and Legend State integration from `@color-kit/react`.
  - `packages/react/src/color-input.tsx` (303 lines) is the canonical thin adapter over `usePrimitiveValueInput` + `api/color-input.ts`.
- **Problem:** Shadcn/registry consumers had a stale second color-input implementation. Bug fixes in `control-kit` and `react` did not flow to registry without manual copy-paste.
- **Target shape:** Registry color-input mirrors the published package adapter, CI fails when the registry surface drifts, and expression parsing lives in `packages/react/src/api/color-input.ts`.
- **Suggested slices:**
  1. Rewrite `registry/components/color-input.tsx` as a thin mirror of `packages/react/src/color-input.tsx`; add `control-kit` as a registry dependency. Completed.
  2. Add `pnpm registry:sync` (copy + rewrite imports) or a CI contract test that diffs exported symbols against `@color-kit/react`. Completed with `pnpm registry:check`.
  3. Plan `color-area` generation from react modules (or document intentional subset with explicit gap list). Completed by documenting the current registry subset gaps above.
- **Acceptance criteria:**
  - Registry color-input delegates to `usePrimitiveValueInput` and `api/color-input` helpers.
  - CI catches registry/react API drift.
  - Duplicated expression parser and scrub engine removed from registry.
- **Completed:** Replaced the registry color-input fork with the package helper path, added the `color` registry dependency, and wired `pnpm check:preprod` to fail on color-input registry drift.

---

### IB-002 — Extract `usePlaneQueryLayer` and shared worker

- **Priority:** P0
- **Status:** Open
- **Evidence:**
  - `packages/react/src/gamut-boundary-layer.tsx`, `chroma-band-layer.tsx`, and `contrast-region-layer.tsx` each duplicate `resolveQuality`, `canUseWorkerOffload`, `rangeSpan`, adaptive tolerance/depth, ResizeObserver area measurement (~60 lines), and worker lifecycle (~65 lines).
  - Each layer calls `new Worker(plane-query.worker.js)` independently — three mounted layers = three schedulers + three WASM init paths.
  - `chroma-band-layer.tsx` imports `ColorAreaLayerQuality` from `gamut-boundary-layer.tsx` (sibling type coupling).
  - Layers rebuild `plane: { model, x, y, fixed }` inline instead of using `toPlaneDefinition()` from `api/color-area.ts`.
- **Problem:** ~600 lines triplicated across three files. Worker payload shape can drift from the API facade. Runtime pays N× scheduler/WASM cost.
- **Target shape:** One `usePlaneQueryLayer<T>()` hook + `buildPlaneQueryRequest()` in `api/color-area.ts` + one module-level worker singleton with multiplexed request IDs. Each layer: build queries → hook → render `<Line>`.
- **Suggested slices:**
  1. Extract shared quality/resize helpers into `layer-quality-utils.ts`.
  2. Add `buildPlaneQueryRequest()` to `api/color-area.ts`.
  3. Implement `usePlaneQueryLayer` and migrate `gamut-boundary-layer` + `chroma-band-layer`.
  4. Migrate `contrast-region-layer` (adds frozen step counts, `lastStablePaths`, metrics).
  5. Replace per-layer Worker instances with a singleton/pool.
- **Acceptance criteria:**
  - Worker payload construction has one source of truth.
  - Gamut/chroma/contrast layers share one hook for sync/worker/drag state machine.
  - Single worker instance serves all mounted query layers.
  - Existing layer behavior and tests unchanged.

---

### IB-003 — Decompose `contrast-region-layer.tsx` god module

- **Priority:** P0
- **Status:** Open
- **Evidence:**
  - `packages/react/src/contrast-region-layer.tsx` — 1,735 lines.
  - Four subsystems in one file: fill/dot-pattern UI (~270), quality helpers (~85), LC geometry + contrast scoring (~480), worker orchestration + metrics + SVG shell (~900).
  - Geometry block (lines ~355–835) has zero React dependency but lives in a React module, untested in isolation.
  - Sync path uses `api/color-area.ts`; post-processing and worker paths bypass it.
- **Problem:** File crosses 1k lines without structural justification. Geometry changes require editing a React god file. Hardest state machine in the package (`lastStablePaths`, `rawPathsAreFresh`, worker fallback metrics).
- **Target shape:**
  - `contrast-region-geometry.ts` — pure LC polygon ops, boundary snap, validity scoring.
  - `useContrastRegionPaths()` — all state/effects.
  - `ContrastRegionLayer` — thin shell (~80 lines): `<Layer>` + context + `<Line>` map.
  - `ContrastRegionFill` — already well-factored; keep as-is.
- **Suggested slices:**
  1. Extract geometry module + unit tests (no React).
  2. Extract hook from component shell.
  3. Optionally promote contrast scoring to `@color-kit/core` if reused outside React.
- **Acceptance criteria:**
  - No production react file exceeds 1k lines for contrast region work.
  - Geometry is unit-testable without React.
  - Public `ContrastRegionLayer` API unchanged.

---

### IB-004 — Split lab `shared.tsx` god file

- **Priority:** P1
- **Status:** Open
- **Evidence:**
  - `apps/docs/src/routes/lab/shared.tsx` — 2,927 lines.
  - Mega barrel: pages import primitives, react components, Lucide icons, fixtures, menu demos, color-plane helpers, panel wrappers, and 10 playground stages from one module.
  - Six near-identical `*ConfigField` wrappers (~1477–1821) duplicate ~40 `PrimitiveValueInput` props each.
  - Menu/select demo subsystem (~900 lines) mixed with input lab config.
  - `apps/docs/src/routes/lab/types.ts` imports `LabPageKey` from `shared.tsx` (inverted dependency).
- **Problem:** Every lab edit touches a 3k-line import graph. Cross-domain coupling (menu demos, color-plane math, input config, layout shell) slows iteration.
- **Target shape:**
  ```
  apps/docs/src/routes/lab/
    components/frame.tsx
    components/panel/          # PanelSection, SegmentedField, config fields
    components/playgrounds/    # one file per *PlaygroundStage
    fixtures/                  # SELECT_OPTIONS, MULTI_INPUT_FIELDS
    color/slider-rail.ts       # getOklchSliderRail, normalizeAxes
    hooks/use-submenu-hover-timer.ts
  ```
  Pages import `@color-kit/react` and `@color-kit/control-kit` directly; `shared` exports only lab-local UI.
- **Suggested slices:**
  1. Move fixtures and Lucide icon lists out of `shared.tsx`.
  2. Extract panel primitives and config fields.
  3. Extract playground stages one at a time.
  4. Move `LabPageKey` to `types.ts`; kill the mega re-export barrel.
- **Acceptance criteria:**
  - `shared.tsx` deleted or reduced to a thin compatibility shim.
  - Adding a lab page does not require editing a 2k+ line file.
  - `types.ts` does not depend on implementation modules.

---

### IB-005 — Break plane ↔ contrast type cycle in core

- **Priority:** P1
- **Status:** Open
- **Evidence:**
  - `packages/core/src/contrast/index.ts` imports `InternalPlaneTraceContext` from `../plane/trace.js` and `PlanePoint` from `../plane/types.js`.
  - `packages/core/src/plane/types.ts` imports contrast types from `../contrast/index.js`.
  - `ContrastRegionPathOptions` and `PlaneContrastRegionQuery` duplicate legacy option semantics.
  - Shared contrast option/point types now live in `packages/core/src/contrast/types.ts`, and plane query types import from that sidecar instead of the contrast implementation barrel.
- **Problem:** Contrast — a domain module — depends on plane diagnostics internals. Circular type pressure prevents using contrast without plane trace types. Release cycles are coupled.
- **Target shape:** Neutral `trace/` module or callback interface. Contrast imports only types, not plane implementation. Shared contrast option types in `contrast/types.ts`.
- **Suggested slices:**
  1. Extract shared types to `contrast/types.ts`; have `plane/types.ts` import types only. Completed.
  2. Replace direct `InternalPlaneTraceContext` import with optional trace callback interface.
  3. Collapse duplicated option shapes between contrast and plane query types.
- **Acceptance criteria:**
  - No import cycle between `contrast/` and `plane/`.
  - Contrast module usable without plane trace internals.
  - Existing plane/contrast tests pass.

---

### IB-006 — Split core multi-solver god modules

- **Priority:** P1
- **Status:** Open
- **Evidence:**
  - `packages/core/src/contrast/index.ts` (1,526 lines) — legacy marching squares, adaptive LC, hybrid root-tracing, and public router in one file.
  - `packages/core/src/plane/gamut-region.ts` (1,397 lines) — viewport geometry, `resolveGamutSolver` policy matrix, implicit contour, and orchestration tangled together.
  - `contrastRegionPaths()` silently falls back from hybrid to legacy adaptive through `null` control flow instead of returning an explicit fallback reason.
  - `getPlaneGamutRegion()` owns solver selection, trace summary fields, domain-edge handling, analytic solvers, implicit solvers, and result assembly in one orchestration path.
  - Adaptive 1D sampling duplicated in contrast (×2) and `gamut/index.ts` (~667–745).
  - Gamut epsilon `0.000075` defined in both `gamut/index.ts` and `gamut-region.ts`.
- **Problem:** Multi-solver routers are the highest maintenance surface. Bug fixes to adaptive sampling must land in three places. Combinatorial branching (`resolveGamutSolver`, `contrastRegionPaths` router) spread across modules, and fallback behavior is implicit instead of observable.
- **Target shape:**
  - `contrast/metrics.ts`, `contrast/region-legacy.ts`, `contrast/region-hybrid.ts`, `contrast/region.ts` (thin router).
  - `gamut-region/viewport-geometry.ts`, `gamut-region/gamut-solvers.ts`, `gamut-region/getPlaneGamutRegion.ts`.
  - Shared `adaptive1d.ts` for anchor dedupe, edge probes, perpendicular error.
  - Single `GAMUT_EPSILON` constant.
- **Suggested slices:**
  1. Extract shared adaptive 1D sampler + centralize epsilon.
  2. Split contrast along solver boundaries; keep router thin.
  3. Return explicit `SolverOutcome` values with fallback reasons instead of `null`.
  4. Split gamut-region geometry from solver dispatch.
- **Acceptance criteria:**
  - No core production file exceeds 1k lines without documented justification.
  - Adaptive sampling logic defined once.
  - Existing core tests pass without snapshot churn.

---

### IB-007 — Delete legacy contrast-region worker path

- **Priority:** P1
- **Status:** Completed 2026-05-25
- **Evidence:**
  - `packages/react/src/workers/contrast-region.worker.ts` (46 lines) wraps `getColorAreaContrastRegionPaths`.
  - `packages/react/tsup.config.ts` still builds `workers/contrast-region.worker`.
  - Runtime uses `plane-query.worker.js` only; contrast layer retains `hasLegacyWorkerPaths()` rollout branch.
- **Problem:** Dead code and permanent branch complexity from an incomplete migration cleanup.
- **Target shape:** Remove dead worker, tsup entry, `hasLegacyWorkerPaths`, and rollout comments.
- **Suggested slices:**
  1. Confirm no consumers of `contrast-region.worker` in docs, tests, or dist.
  2. Delete worker file, types, tsup entry, and legacy branch in contrast layer.
- **Acceptance criteria:**
  - Single worker path for contrast region compute.
  - No legacy payload handling in contrast layer.
- **Completed:** Removed the legacy worker entry/files and the rollout payload branch; tests now mock the current packed `plane-query.worker` response shape.

---

### IB-008 — Split `usePrimitiveValueInput` scrub engine

- **Priority:** P2
- **Status:** Open
- **Evidence:**
  - `packages/control-kit/src/primitive-value-input.tsx` — 1,123 lines total.
  - `usePrimitiveValueInput` hook (~667 lines, lines ~247–913) combines draft/edit, caret preservation, keyboard stepping, and full scrub engine (pointer capture, pointer lock, document listeners, rAF rate limit, modifier rebasing).
  - Tests in `__tests__/primitive-value-input.test.tsx` (~944 lines) are solid and split-friendly.
- **Problem:** Four subsystems with different change rates in one hook. Scrub engine changes risk regressions in keyboard/draft behavior.
- **Target shape:**
  ```
  packages/control-kit/src/
    primitive-value-format.ts
    primitive-value-stepping.ts
    use-primitive-scrub.ts
    use-primitive-value-input.ts   # composes above
    primitive-value-input.tsx      # presentation only (~120 lines)
  ```
- **Suggested slices:**
  1. Extract pure format/normalize/step helpers (already partially separable at lines 76–203).
  2. Extract `usePrimitiveScrub` with document listeners and rate limiting.
  3. Slim presentation component.
- **Acceptance criteria:**
  - Scrub subsystem testable in isolation.
  - Existing primitive contract tests pass unchanged.

---

### IB-009 — Collapse lab config field wrappers

- **Priority:** P2
- **Status:** Open
- **Evidence:**
  - `apps/docs/src/routes/lab/shared.tsx` (lines ~1477–1821): `NumberConfigField`, `PrecisionConfigInput`, `StepConfigInput`, `DragStepConfigInput`, `BoundsConfigInput`, `DragThresholdConfigInput` each duplicate the same scrub/commit/pointer-lock defaults.
  - `apps/docs/src/routes/lab/pages/input.tsx` (525 lines) repeats the full props block for the preview.
- **Problem:** ~40-prop `PrimitiveValueInput` blocks copied 7+ times. Lab-wide defaults (`scrubThreshold: 1`, `pointerLockEnabled: false`, etc.) scattered.
- **Target shape:** One `LabNumericField` with `{ label, value, onChange, min, max, step, precision, leadingElement?, parseExpression? }` and shared lab defaults. Shared `useLabPrimitiveConfig()` hook for input/multi/slider labs.
- **Suggested slices:**
  1. Introduce `LabNumericField` with lab defaults.
  2. Replace six config wrappers in shared/panel module.
  3. Extract `input-lab-properties.tsx` from `pages/input.tsx`.
- **Acceptance criteria:**
  - Lab numeric fields configured through one adapter.
  - No duplicated 40-prop blocks across lab pages.

---

### IB-010 — Split `api/color-input.ts` expression parser

- **Priority:** P2
- **Status:** Completed 2026-05-25
- **Evidence:**
  - `packages/react/src/api/color-input.ts` — 709 lines; hand-rolled expression tokenizer/parser (~250 lines) dominates file size.
  - File is otherwise cohesive pure API with zero React imports.
- **Problem:** Parser embedded in main API module makes navigation and testing harder. Registry duplication (IB-001) partially stems from this monolith.
- **Target shape:** `api/color-input-parser.ts` sibling module; public exports stable via re-export from `color-input.ts`.
- **Suggested slices:**
  1. Move tokenizer/parser to sibling file.
  2. Add focused parser unit tests.
- **Acceptance criteria:**
  - `color-input.ts` under ~500 lines.
  - Public import paths unchanged.
- **Completed:** Moved the tokenizer/parser into `api/color-input-parser.ts`, kept `parseColorInputExpression` exported through `api/color-input.ts`, and added focused parser coverage.

---

### IB-011 — Continue decomposing docs right-rail panels

- **Priority:** P2
- **Status:** Open
- **Evidence:**
  - CQ-009 moved panels from `docs-right-rail.tsx` (now 106-line shell) to `docs-right-rail-panels.tsx` (1,404 lines).
  - CQ-010 added `color-area-contrast-tiers.ts` descriptor table shared by demos and panels.
  - `component-docs-data.tsx` has `supportsPropertiesPanel`, `component-doc-page.tsx` injects `inspectorDriven`, demos read optional global inspector state, and `docs-right-rail-panels.tsx` keeps a separate pathname switch.
  - `component-docs-data.tsx` now owns `PropertiesPanel` entrypoints, and ColorSlider/ColorInput panels live in dedicated `components/panels/*-properties-panel.tsx` modules with shared segmented controls.
- **Problem:** Panel registry extraction started but stopped at one large panels file, and a single "component has properties" concept is spread across the doc descriptor, route page, demo implementation, global context, and rail switch.
- **Target shape:** One panel module per component demo, owned by the component descriptor. `docs-right-rail-panels.tsx` becomes a thin registry re-exporting panel entrypoints. Demos receive explicit state/adapters instead of reading optional global inspector state.
- **Suggested slices:**
  1. Add `PropertiesPanel`/demo adapter fields to the component descriptor. Completed.
  2. Extract ColorArea panel (largest) beside `component-demos.tsx` or the color-area demo module.
  3. Remove `supportsPropertiesPanel`, `inspectorDriven`, and the pathname switch once descriptors own panel lookup. Descriptor lookup and the pathname switch removal are complete; `inspectorDriven` cleanup remains.
  4. Repeat for remaining panels. ColorSlider and ColorInput extracted; ColorArea remains.
- **Acceptance criteria:**
  - No docs component file exceeds 1k lines for panel work.
  - Adding a panel requires one new module + registry entry.
  - Component demos do not read optional global inspector state as a hidden mode.

---

### IB-012 — Extract `useColorAreaPointerInteraction` and explicit thumb slot

- **Priority:** P2
- **Status:** Open
- **Evidence:**
  - `packages/react/src/color-area.tsx` — 813 lines; ~300 lines of pointer/RAF/coalesced-events logic in one narrative.
  - Adaptive quality from measured frame times; window-level drag continuation — cohesive but dense.
  - `ColorArea` recursively counts, finds, and prunes `<Thumb />` children by `child.type === Thumb`, then reinjects the first thumb; wrappers, memoized thumbs, or duplicate module instances can break this implicit slot contract.
  - `ColorArea` now accepts an explicit `thumb` slot and `showDefaultThumb` toggle, preserving existing `<Thumb />` child behavior while giving wrapped/memoized thumbs a stable composition path.
- **Problem:** Many refs/effects in one component reduce testability. Pointer pipeline is a distinct subsystem from context provisioning, and child surgery makes thumb composition magical instead of explicit.
- **Target shape:** `useColorAreaPointerInteraction()` hook; `ColorArea` becomes shell + context (~400 lines). Replace recursive thumb introspection with an explicit slot contract (`thumb`, `showDefaultThumb`, or a tiny registration component).
- **Suggested slices:**
  1. Extract hook with existing behavior tests as guard.
  2. Add explicit thumb slot API while preserving the existing child API temporarily if needed. Completed.
  3. Slim `ColorArea` to composition only.
- **Acceptance criteria:**
  - Pointer interaction testable without full ColorArea render tree.
  - Thumb composition works through wrappers/memoized components without type identity checks.
  - Public ColorArea API unchanged.

---

### IB-013 — Make plane compute backends capability-aware and honest

- **Priority:** P0
- **Status:** Open
- **Evidence:**
  - `packages/core-wasm/src/index.ts` calls `runPlaneQuery()` for every request before invoking the WASM kernel.
  - The WASM kernel receives already-computed contrast paths and normalizes/sorts payloads, but the response reports `backend: 'wasm'`.
  - `packages/react/src/workers/plane-query.worker.ts` owns WASM bootstrap, global backend state, compute selection, parity checks, telemetry, and protocol response emission in one file.
- **Problem:** Scheduler telemetry can benchmark "JS compute + WASM normalization" as if it were a real WASM compute backend. Backend capability, normalization, parity, and worker lifecycle are tangled enough that future backend choices will be hard to trust.
- **Target shape:** Backends advertise capabilities per query kind. If WASM only post-processes contrast paths, model it as a `contrastPathNormalizer` stage or report JS as the compute backend with normalization metadata. The worker orchestrates protocol only; backend loading, compute running, and parity checking live in separate modules.
- **Suggested slices:**
  1. Split WASM contrast normalization from `PlaneComputeBackend.run()` or make the backend refuse unsupported query kinds.
  2. Add backend capability checks to scheduler selection and telemetry.
  3. Extract `wasmBackendLoader`, `computeRunner`, and `parityChecker` from `plane-query.worker.ts`.
  4. Replace global backend side-channel reads with explicit worker init/factory wiring.
- **Acceptance criteria:**
  - Backend telemetry names the backend that actually performed the compute.
  - Scheduler never picks WASM for unsupported query kinds by accident.
  - Worker protocol code no longer owns backend lifecycle policy.

---

### IB-014 — Introduce `PlaneQuerySpec` and strict packed ABI

- **Priority:** P0
- **Status:** Open
- **Evidence:**
  - Query execution dispatch lives in `packages/core/src/plane/query.ts`.
  - Packing lives in `packages/core/src/compute/pack.ts`, unpacking in `packages/core/src/compute/unpack.ts`, trace geometry in `packages/core/src/plane/trace.ts`, scheduler budget/keying in `packages/core/src/compute/scheduler.ts`, and WASM filtering in `packages/core-wasm/src/index.ts`.
  - `PackedPlaneQueryDescriptor` is one optional-field interface for every query kind.
  - The unpacker defaults missing path ranges, coordinates, LC payloads, colors, gamut, scope, solver, viewport relation, and hue to plausible values.
- **Problem:** Adding or changing a query kind requires remembering every switch across execution, packing, unpacking, tracing, scheduling, and backend filtering. The transfer ABI is loose enough to turn corrupt or mismatched payloads into fake geometry instead of failing at the boundary.
- **Target shape:** A `PlaneQuerySpec` registry keyed by query kind owns `run`, `pack`, `unpack`, `traceGeometry`, `budget`, `telemetrySignature`, and `backendCapabilities`. Packed descriptors become a discriminated, versioned union with a decoder that validates array lengths/ranges before reconstructing results.
- **Suggested slices:**
  1. Introduce the spec registry beside existing switches and migrate one low-risk query kind.
  2. Replace `PackedPlaneQueryDescriptor` with a discriminated descriptor union.
  3. Add strict decoder validation and tests for missing/truncated payloads.
  4. Move scheduler bucket/keying and backend capability data into specs.
- **Acceptance criteria:**
  - New query kinds are registered once instead of patched through several switches.
  - Worker/WASM boundaries fail closed on malformed packed payloads.
  - Existing worker parity tests pass with no public result-shape changes.

---

### IB-015 — Choose one component-doc source of truth

- **Priority:** P0
- **Status:** Completed 2026-05-25
- **Evidence:**
  - `apps/docs/src/content/docs-registry.ts` explicitly excludes `src/content/components/*.mdx` from routed docs.
  - `/docs/components/:slug` uses `component-docs-data.tsx` through `routes/component-doc.tsx`.
  - The old component MDX files remain tracked and still import demo symbols from the monolithic `component-demos` module while the new registry imports split demo modules.
- **Problem:** Component docs now have two canonical-looking systems. One is routed and one is not, but both are editable and can drift in examples, API tables, and demo imports.
- **Target shape:** Delete/archive the stale MDX files, or make MDX the authoring source and generate `component-docs-data.tsx` from it. Do not keep two hand-edited sources for the same page.
- **Suggested slices:**
  1. Confirm every routed component page has migrated content coverage.
  2. Delete or archive the stale `src/content/components/*.mdx` files.
  3. Add a docs check that fails if excluded component MDX files reappear without generation wiring.
- **Acceptance criteria:**
  - Exactly one source owns each component docs page.
  - Component demo imports cannot drift between MDX and descriptor pages.
- **Completed:** Deleted the stale component MDX files and added a docs check that rejects new hand-authored component MDX files while keeping component navigation slugs aligned with `component-docs-data.tsx`.

---

### IB-016 — Split Sandpack file generation from playground UI

- **Priority:** P2
- **Status:** Open
- **Evidence:**
  - `apps/docs/src/components/plane-api-playground.sandpack.tsx` raw-globs selected `packages/core/src` files, rewrites imports with regexes, builds hidden support files, and renders the Sandpack UI.
  - `apps/docs/scripts/check-plane-quick-start-sync.mjs` validates broad text patterns rather than structured sandbox file resolution.
- **Problem:** A React UI component is also acting as a hand-rolled package bundler. Import rewrite mistakes are hard to test, and playground layout work risks touching sandbox generation.
- **Target shape:** Move sandbox file generation into a dedicated build-time/generated manifest or `lib/plane-sandbox-files.ts`; validate import resolution structurally. The React component receives `{ files, visibleFiles, entry }` and only renders UI.
- **Suggested slices:**
  1. Extract file collection/rewrite/build-support logic into a non-React module.
  2. Add structural tests for generated file paths, entrypoints, and rewritten imports.
  3. Slim `plane-api-playground.sandpack.tsx` to presentation.
- **Acceptance criteria:**
  - Sandpack generation can be tested without rendering React.
  - UI changes do not touch file rewrite logic.

---

### IB-017 — Simplify multi-color collection state

- **Priority:** P2
- **Status:** Completed 2026-05-25
- **Evidence:**
  - `packages/react/src/use-multi-color.ts` stores shared `activeGamut`/`activeView` on `MultiColorState`.
  - Each nested `ColorState` also stores `activeGamut`/`activeView`, forcing the hook to rebuild all entries when shared display context changes.
  - Collection operations such as remove/rename rebuild `ColorState` maps to keep the duplicated invariant aligned.
  - `useMultiColor` now stores requested colors plus one shared display context internally, then materializes the existing public `MultiColorState` shape at the hook boundary.
  - `packages/react/__tests__/multi-color-state.test.tsx` covers batched add/display-context/rename/remove flows so collection edits stay deterministic.
- **Problem:** The collection stores the same display invariant in two places. That makes updates more stateful and less atomic than the conceptual model: many requested colors plus one shared display context.
- **Target shape:** Store requested colors plus one shared display context. Derive per-entry `ColorState`s through selectors/helpers at the boundary where consumers need full color state.
- **Suggested slices:**
  1. Add tests around batched gamut/view changes, remove, rename, and selection. Completed.
  2. Introduce a normalized internal state model with requested colors + shared context. Completed.
  3. Preserve the public `MultiColorState` shape if needed via a compatibility selector, then evaluate a typed public model cleanup. Completed with public shape preserved.
- **Acceptance criteria:**
  - Shared gamut/view updates do not rebuild duplicated state by hand.
  - Batched multi-entry edits remain deterministic.
  - Public hook behavior remains unchanged.
- **Completed:** Normalized the hook's internal state to requested colors plus shared display context, preserved the exported `MultiColorState` shape, and added regression coverage for batched display-context and collection edits.

---

## Suggested execution order

1. **IB-001** — Stop registry drift (blocks consumer bug-fix flow).
2. **IB-013 + IB-014** — Make compute backend telemetry honest and harden the packed query ABI.
3. **IB-002 + IB-007** — Shared plane query layer + delete legacy worker (biggest react LOC + perf win).
4. **IB-003** — Decompose contrast-region god module.
5. **IB-004 + IB-009** — Split lab shared + lab numeric field wrappers.
6. **IB-015 + IB-011** — Collapse component-doc and properties-panel ownership to descriptors.
7. **IB-005 + IB-006** — Core type cycle + solver decomposition.
8. **IB-008, IB-010, IB-012, IB-016, IB-017** — Control-kit scrub split, parser split, color-area slot/interaction, Sandpack generation, multi-color state.

---

## Prior backlog completion

All items from `CODE_QUALITY_BACKLOG.md` (reviewed 2026-05-24) are complete:

| ID     | Title                                                           | Status                                           |
| ------ | --------------------------------------------------------------- | ------------------------------------------------ |
| CQ-001 | Split the Lab route into page modules                           | Completed 2026-05-24                             |
| CQ-002 | Make numeric input behavior canonical                           | Completed                                        |
| CQ-003 | Extract canonical contour/marching-squares utilities            | Completed (`packages/core/src/contour/index.ts`) |
| CQ-004 | Unify Lab menu/select rendering                                 | Completed                                        |
| CQ-005 | Move Lab-only UI3 helpers out of shared dropdown primitive      | Completed                                        |
| CQ-006 | Correlate color input model and channel types                   | Completed                                        |
| CQ-007 | Make multi-input segments atomic                                | Completed                                        |
| CQ-008 | Replace brittle primitive markup assertions with contract tests | Completed                                        |
| CQ-009 | Decompose docs right rail feature panels                        | Completed (shell extracted; follow-up: IB-011)   |
| CQ-010 | Model contrast overlay tiers once                               | Completed (`color-area-contrast-tiers.ts`)       |

---

## Healthy patterns to preserve

- **`packages/react/src/api/color-area.ts`** — thin, testable facade over `@color-kit/core`; extend this pattern to worker payloads (IB-002).
- **`packages/react/src/color-input.tsx`** — domain API + primitive hook; registry should mirror this (IB-001).
- **`packages/control-kit` tests** — broad scrub/keyboard/commit coverage; use as guard during IB-008.
- **`apps/docs/src/routes/lab/page-registry.tsx`** — clean descriptor pattern; extend decomposition into IB-004.
- **`packages/core/src/contour/index.ts`** — shared marching-squares; keep growing shared libs here, not in feature modules (CQ-003).
