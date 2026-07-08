# Color Kit Intent Execution Gap Matrix (2026-02-10)

This document translates intent in `notes.md` into implementation status, with evidence and concrete follow-up work.

## Snapshot

- Branch used for this audit: `codex/notes-intent-gap-matrix`
- Verification run on 2026-02-10:
  - `pnpm build` ✅
  - `pnpm test` ✅
  - `pnpm format:check` ✅
- Status labels:
  - `REALIZED`: implemented and covered by tests/docs.
  - `PARTIAL`: implemented baseline exists, but release-gate intent is incomplete.
  - `MISSING`: no implementation evidence yet.
  - `DEFERRED`: intentionally out of active delivery scope.

## Intent Matrix

| Intent (notes anchor)                                                                            | Current Evidence                                                                                                                                                                                                                                                                                                                                               | Status   | Unrealized Intent                                                                                                                              | Next Action                                                                                 |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Canonical dual-state `ColorState` and event contract (`notes.md:95`, `notes.md:128`)             | `packages/react/src/color-state.ts:19`, `packages/react/src/use-color.ts:93`, `packages/react/__tests__/requested-displayed.test.tsx:1`                                                                                                                                                                                                                        | REALIZED | None blocking                                                                                                                                  | Keep as compatibility contract for v1 releases.                                             |
| Requested vs displayed interaction semantics (`notes.md:142`)                                    | `packages/react/src/color-area.tsx:90`, `packages/react/src/color-slider.tsx:92`, `packages/react/src/color-display.tsx:57`, `packages/react/src/swatch.tsx:67`                                                                                                                                                                                                | PARTIAL  | Baseline semantics are present, but appendix-level divergence indicators (requested vs mapped markers) are not consistently verified by tests. | Add scenario tests for divergence marker behavior and no-jump invariants.                   |
| M1/M2 test gates (`notes.md:264`, `notes.md:270`)                                                | `packages/react/__tests__/color-area.test.tsx:1`, `packages/react/__tests__/color-slider.test.tsx:1`, `packages/react/__tests__/wrapper-sliders.test.tsx:1`, `packages/react/__tests__/color-display.test.tsx:1`, `packages/react/__tests__/swatch.test.tsx:1`, `packages/core/__tests__/roundtrip.test.ts:1`, `packages/core/__tests__/persistence.test.ts:1` | REALIZED | `notes.md` milestone text has not been fully reconciled to reflect completion status for M1/M2.                                                | Update milestone status lines in `notes.md` to match repo reality.                          |
| Multi-color state manager (`notes.md:168`, `notes.md:194`)                                       | `packages/react/src/use-multi-color.ts:24`, `packages/react/__tests__/multi-color-state.test.tsx:1`                                                                                                                                                                                                                                                            | REALIZED | None blocking                                                                                                                                  | Keep API stable; add docs examples as usage patterns mature.                                |
| Geometry APIs (`notes.md:169`, `notes.md:170`, `notes.md:199`)                                   | `packages/core/src/gamut/index.ts:83`, `packages/core/src/gamut/index.ts:137`, `packages/core/__tests__/max-chroma.test.ts:1`, `packages/core/__tests__/gamut-boundary.test.ts:1`                                                                                                                                                                              | REALIZED | None blocking                                                                                                                                  | Maintain deterministic behavior with tolerance-controlled tests.                            |
| Contrast/chroma band APIs (`notes.md:171`, `notes.md:172`, `notes.md:206`, `notes.md:209`)       | `packages/core/src/contrast/index.ts:379`, `packages/core/src/gamut/index.ts:161`, `packages/core/__tests__/contrast-regions.test.ts:1`, `packages/core/__tests__/chroma-band.test.ts:1`                                                                                                                                                                       | REALIZED | None blocking                                                                                                                                  | Maintain API stability and docs examples.                                                   |
| Accessibility contract and CI a11y release gate (`notes.md:243`, `notes.md:297`, `notes.md:309`) | Semantic roles present in controls: `packages/react/src/color-area.tsx:170`, `packages/react/src/color-slider.tsx:175`; CI only runs build/test/format: `.github/workflows/ci.yml:9`                                                                                                                                                                           | MISSING  | No automated a11y suite in CI; no explicit manual SR checklist artifact.                                                                       | Add React a11y tests and a CI `a11y` job; add manual SR sanity checklist doc.               |
| Performance budgets + regression checks in CI (`notes.md:217`, `notes.md:238`)                   | No benchmark/perf scripts or CI perf job; current CI has build/test/format only: `.github/workflows/ci.yml:30`                                                                                                                                                                                                                                                 | MISSING  | Budget targets are defined but not measured or enforced.                                                                                       | Add benchmark harness + non-blocking perf CI; promote to blocking after calibration window. |
| Implementation-first docs and migration path (`notes.md:314`)                                    | `apps/docs/src/content/migration-dual-state.mdx:1`, `apps/docs/src/content/multi-color-state.mdx:1`, `apps/docs/src/content/docs-registry.ts:56`, `README.md:72`                                                                                                                                                                                               | PARTIAL  | Docs cover APIs and migration, but operational guidance for divergence debugging and release-gate policies is thin.                            | Add a troubleshooting page and release-gate docs section (a11y/perf expectations).          |
| Open product decisions (`notes.md:337`)                                                          | Decision list exists; no ADR/decision file evidence in repo                                                                                                                                                                                                                                                                                                    | MISSING  | Alias strategy and HCT dependency strategy are still open, blocking downstream roadmap certainty.                                              | Record decisions in ADR(s) and link from `notes.md`.                                        |
| HCT/CMYK/advanced UI backlog (`notes.md:50`, `notes.md:212`, `notes.md:324`)                     | Not implemented in core/react; explicitly deferred in notes                                                                                                                                                                                                                                                                                                    | DEFERRED | No gap for current v1 target.                                                                                                                  | Keep deferred; do not pull into active scope until release gates are consistently green.    |

## Prioritized Execution Backlog

## P0 (Release-gate completion)

1. Add automated accessibility checks for React primitives.
   - Deliverables:
     - New test coverage focused on keyboard interaction, role/value semantics, and constrained-state cues.
     - CI `a11y` job in `.github/workflows/ci.yml`.
   - Done when:
     - a11y suite runs in CI and is required for merge.
2. Add performance benchmarking and CI reporting.
   - Deliverables:
     - Core throughput benchmark (`>= 100k conversions/sec` target tracking).
     - React interaction benchmark harness (initially non-blocking).
     - Perf results artifact/logging in CI.
   - Done when:
     - CI records benchmark metrics on every PR and compares against baseline thresholds.

## P1 (Intent fidelity + plan correctness)

1. Close scenario-level requested/displayed gaps with explicit tests.
   - Deliverables:
     - Tests for no-jump behavior (`l=0/1`, `c=0`, out-of-gamut drag points).
     - Tests for gradient/model correctness assertions tied to OKLCH behavior.
2. Reconcile planning doc status drift.
   - Deliverables:
     - Update M1/M2 completion lines in `notes.md`.
     - Link this matrix from `notes.md` as the audit artifact.

## P2 (Documentation + decision closure)

1. Expand implementation-first docs around operational workflows.
   - Deliverables:
     - “Requested vs displayed troubleshooting” page.
     - “Release gates” page documenting a11y/perf expectations and local commands.
2. Resolve open decisions via ADRs.
   - Deliverables:
     - ADR for package alias strategy.
     - ADR for HCT dependency strategy.
     - `notes.md` updated with explicit decision outcomes and dates.

## Suggested PR Slice

1. `chore(notes): add intent execution gap matrix and milestone status reconciliation`
2. `test(a11y): add accessibility suite and CI gate`
3. `perf(ci): add benchmark harness and non-blocking perf reporting`
4. `docs: add troubleshooting/release-gate guidance and ADR links`

## Docs Overhaul Plan (Durable Copy)

This section captures the docs-site overhaul intent as a standalone execution artifact so it survives chat compaction.

### Direction lock (2026-02-10)

1. Docs must explicitly position both product tracks:
   - React primitives library (`@color-kit/react`)
   - shadcn registry distribution path
2. Home page is a product showcase and test harness:
   - interactive component grid
   - useful for perf observation and visual consistency checks
3. Component docs should mirror Radix-style information architecture:
   - installation
   - feature summary
   - demo
   - anatomy
   - usage
   - API reference
   - accessibility
   - helpers
4. Right column should support dual tabs:
   - `On this page` outline
   - `Properties` panel for live demo controls
5. `ColorArea` properties panel behavior follows Figma intent:
   - reference: `https://www.figma.com/design/LsKRJGa3DdtITEfQ5d8H7v/Plexiform?node-id=830-4146`

### Implemented in current branch (2026-02-10)

1. New interactive landing grid + stronger product hero.
2. Unified component-doc template and data registry for component pages.
3. Right-rail tabs with heading outline and live properties controls.
4. Inspector-driven `ColorArea` demo controls for gamut/axes/overlays.
5. New docs pages for React primitives and shadcn registry.
6. Visual system refresh across docs shell, tables, previews, and demos.

### Remaining gaps after current implementation

1. Properties panel coverage exists only for `ColorArea`; additional components still need schemas.
2. Right-rail outline uses runtime heading extraction; no explicit MDX heading metadata pipeline yet.
3. Landing grid lacks formal perf telemetry overlays and thresholds.
4. Component pages are structurally aligned to Radix style, but still need deeper per-component edge-case narratives.

### Phase plan (next slices)

#### Phase A — Properties panel expansion (P0 docs)

1. Add inspector schemas for:
   - `ColorSlider`
   - `ColorInput`
   - `SwatchGroup`
   - `ContrastBadge`
2. Wire each schema to demo state via shared docs inspector context.
3. Ensure all controls are keyboard-operable and screen-reader labeled.

Done when:

1. At least 5 component pages expose non-placeholder `Properties` content.
2. Demo state updates are deterministic and reflected live in the preview.

#### Phase B — Component docs depth (P1 docs)

1. Add edge-case guidance to each component page:
   - requested vs displayed behavior
   - gamut constraints
   - keyboard semantics
   - migration notes from previous API usage
2. Add copy-ready example snippets for:
   - provider composition
   - standalone controlled mode
   - registry-installed usage patterns

Done when:

1. Every component page contains practical examples beyond baseline usage.
2. `On this page` contains stable section anchors for all standard sections.

#### Phase C — Perf harness integration (P0 release support)

1. Add non-blocking docs perf instrumentation:
   - frame/update timing sampling on interactive demos
   - lightweight event counters for drag-intensive controls
2. Show optional perf overlay on landing grid cards.
3. Persist periodic summaries as CI artifact in a docs/perf job.

Done when:

1. Demos produce comparable timing snapshots between PRs.
2. Perf output can be reviewed without opening local profiler tools.

#### Phase D — A11y hardening for docs demos (P0 release support)

1. Add docs-focused a11y checks:
   - tab/rail navigation semantics
   - properties controls labels and focus order
   - non-color-only indicators in showcase cards
2. Add a manual SR checklist for the docs shell and interactive demos.

Done when:

1. Automated a11y checks pass in CI.
2. Manual checklist exists and is linked from docs contribution guidance.

### Proposed PR stack for remaining docs work

1. `feat(docs): expand properties panel schemas beyond color area`
2. `docs(components): deepen radix-style component guidance and examples`
3. `perf(docs): add landing-grid instrumentation and CI artifact reporting`
4. `test(docs-a11y): add rail/properties accessibility checks and checklist`

### Operational guardrails

1. Keep docs controls and demo state in shared context to avoid route coupling.
2. Avoid introducing visual drift between landing cards and component docs demos.
3. Keep performance instrumentation lightweight and disabled by default in production UI paths.
4. Preserve deterministic requested/displayed behavior in every inspector-controlled demo.
