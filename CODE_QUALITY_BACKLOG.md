# Code Quality Backlog

Source: thermo-nuclear code quality review on 2026-05-24 against `main` at `db2c0f9`.

This backlog tracks structural maintainability work that is too large to treat as incidental cleanup. Prefer small reviewable branches, but keep each branch pointed at one of these durable items so the cleanup does not dissolve into local nits.

## Priority Guide

- `P1`: Structural debt that blocks healthy feature work or invites repeated drift.
- `P2`: Important maintainability debt with a clear decomposition path.

## Backlog

### CQ-001 - Split the Lab route into page modules

- Priority: P1
- Status: Open
- Evidence:
  - `apps/docs/src/routes/lab.tsx` is 4,604 lines.
  - `LabPage` owns every page state cluster starting around `apps/docs/src/routes/lab.tsx:2764`.
  - Preview routing is a long `activePage` chain around `apps/docs/src/routes/lab.tsx:3077`.
  - Properties-panel routing repeats the same page dispatch around `apps/docs/src/routes/lab.tsx:3254`.
- Problem: The Lab route has become the entire Lab architecture. Every new Lab feature edits one giant file and touches shared state, previews, and panels in one place.
- Target shape: Introduce page descriptors. Each Lab page should own its state/controller hook, preview stage, and properties panel. The route shell should render the selected descriptor.
- Suggested slices:
  1. Extract the page registry into typed descriptors while preserving current rendering.
  2. Move one low-risk page, such as checkbox or tooltip, into its own module.
  3. Move input, multi-input, menu/select, and color plane pages in separate branches.
  4. Delete the duplicated `activePage` dispatch once all pages are descriptor-backed.
- Acceptance criteria:
  - `lab.tsx` becomes a route shell, not the page implementation.
  - Adding a Lab page requires adding one descriptor/module, not editing multiple ternary chains.
  - Existing Lab behavior remains visually and functionally unchanged.

### CQ-002 - Make numeric input behavior canonical

- Priority: P1
- Status: Open
- Evidence:
  - `packages/control-kit/src/primitive-value-input.tsx:44` owns primitive normalize/format/parse helpers.
  - `packages/control-kit/src/primitive-value-input.tsx:168` owns focus, keyboard, selection, pointer-lock, and scrub behavior.
  - `packages/react/src/color-input.tsx:102` keeps a parallel color input engine.
  - `packages/react/src/api/color-input.ts:269` duplicates normalization/format/parsing helper logic.
- Problem: Numeric input behavior is implemented in multiple places. Keyboard stepping, parsing, clamping/wrapping, scrubbing, and tests can drift.
- Target shape: Make `ColorInput` a color-domain adapter over `PrimitiveValueInput`, or extract one canonical `usePrimitiveValueInput` state machine into `control-kit`.
- Suggested slices:
  1. Define the shared primitive input contract and move behavior tests to that contract.
  2. Route `ColorInput` through the primitive engine without changing the public API.
  3. Remove duplicated formatting/parsing helpers from React once behavior parity is proven.
- Acceptance criteria:
  - One implementation owns numeric editing and scrubbing behavior.
  - React color inputs only adapt color channel metadata and value mapping.
  - Shared tests cover keyboard, blur, parse, clamp/wrap, disabled/readOnly, and scrub interactions.

### CQ-003 - Extract canonical contour/marching-squares utilities

- Priority: P1
- Status: Open
- Evidence:
  - `packages/core/src/contrast/index.ts:454` has contour path stitching.
  - `packages/core/src/contrast/index.ts:541` has a marching-squares edge table.
  - `packages/core/src/plane/gamut-region.ts:314` repeats marching-squares edge logic.
  - `packages/core/src/plane/gamut-region.ts:401` repeats segment-to-path stitching.
  - `packages/core/src/plane/operations.ts:100` has another edge table for boolean regions.
- Problem: The math layer repeats topology logic across contrast, gamut, and plane boolean operations. Fixes to contour traversal, edge masks, interpolation, and path stitching can diverge.
- Target shape: Add a focused core contour module that owns edge masks, segment stitching, adaptive scalar sampling, and path canonicalization. Existing domains should adapt their scalar fields and point shapes into it.
- Suggested slices:
  1. Extract the pure edge table and segment stitching with no behavior changes.
  2. Migrate gamut-region callers.
  3. Migrate contrast-region callers.
  4. Decide whether plane boolean rasterization can use the same contour path builder or needs a thin adapter.
- Acceptance criteria:
  - Marching-squares edge masks are defined once.
  - Path stitching/canonicalization is defined once.
  - Existing plane, gamut, and contrast tests pass without snapshot churn.

### CQ-004 - Unify Lab menu/select rendering

- Priority: P1
- Status: Open
- Evidence:
  - `apps/docs/src/routes/lab.tsx:1838` defines `LabMenuContent`.
  - `apps/docs/src/routes/lab.tsx:2034` defines `InlineConfigurableMenuContent`.
  - `apps/docs/src/routes/lab.tsx:2172` defines `InlineLabMenuContent`.
  - Similar submenu keyboard handling appears around `apps/docs/src/routes/lab.tsx:1898`, `apps/docs/src/routes/lab.tsx:2089`, and `apps/docs/src/routes/lab.tsx:2290`.
- Problem: Menu and select Lab demos repeat the same submenu, hover-delay, keyboard, item-layout, and inline-vs-popup concerns in parallel renderers.
- Target shape: Define one typed Lab menu model plus one renderer that can target dropdown portal content or inline panel content.
- Suggested slices:
  1. Introduce a shared item model for labels, leading/trailing slots, disabled state, on/off state, and submenu children.
  2. Move keyboard and hover submenu behavior behind one renderer/controller.
  3. Rebuild Select and Menu demos from the shared model.
- Acceptance criteria:
  - Menu and Select demos share one rendering path for item rows.
  - Submenu open/hover/key behavior has one implementation.
  - Lab menu alignment preferences remain covered by tests or runtime checks.

### CQ-005 - Move Lab-only UI3 helpers out of the shared dropdown primitive

- Priority: P2
- Status: Open
- Evidence:
  - `apps/docs/src/components/ui/dropdown-menu.tsx:692` contains custom keyboard/typeahead controller logic.
  - `apps/docs/src/components/ui/dropdown-menu.tsx:1457` exports `DropdownMenuPanel`.
  - `apps/docs/src/components/ui/dropdown-menu.tsx:1504` exports `DropdownMenuItemButton`.
  - `apps/docs/src/components/ui/dropdown-menu.tsx:1535` exports `DropdownMenuItemContent`.
  - `apps/docs/src/components/ui/dropdown-menu.tsx:1654` exports `SelectList`.
- Problem: A shared UI primitive file now contains Lab-specific UI3 composition, inline menu panels, select-list behavior, and Base UI adapter code. That makes the shared primitive harder to reuse and reason about.
- Target shape: Keep the shared dropdown file focused on the Base UI adapter and generic dropdown components. Move UI3 Lab composition to a Lab-specific module.
- Suggested slices:
  1. Usage-search all exported helpers and confirm Lab-only scope.
  2. Move panel/item/select-list helpers into a Lab menu module.
  3. Leave `dropdown-menu.tsx` with generic dropdown wrappers and any truly shared keyboard behavior.
- Acceptance criteria:
  - Shared dropdown primitives no longer export Lab-only inline panel/select-list helpers.
  - Lab imports come from a Lab-specific menu module.
  - Existing menu/select behavior is unchanged.

### CQ-006 - Correlate color input model and channel types

- Priority: P2
- Status: Open
- Evidence:
  - `packages/react/src/api/color-input.ts:4` defines `ColorInputModel` and `ColorInputChannel` as uncorrelated unions.
  - Tables around `packages/react/src/api/color-input.ts:47` and `packages/react/src/api/color-input.ts:83` must tolerate impossible pairs.
  - Public helpers cast through the mismatch around `packages/react/src/api/color-input.ts:281` and `packages/react/src/api/color-input.ts:299`.
- Problem: Invalid combinations such as an RGB model with an OKLCH-only channel are representable, so the implementation relies on fallback and casts instead of a clean contract.
- Target shape: Use a discriminated `ColorInputSpec` or `ChannelFor<Model>` generic so invalid model/channel pairs are unrepresentable at compile time.
- Suggested slices:
  1. Add type-level tests for invalid model/channel pairs.
  2. Introduce the correlated type shape while preserving existing public helpers.
  3. Remove casts and fallback branches made unnecessary by the stronger model.
- Acceptance criteria:
  - Invalid model/channel pairs fail at compile time.
  - Runtime helper tables no longer need broad impossible-key coverage.
  - Public docs and examples still type-check.

### CQ-007 - Make multi-input segments atomic

- Priority: P2
- Status: Open
- Evidence:
  - `packages/control-kit/src/multi-input-control.tsx:17` defines field metadata separately from config/value maps.
  - `packages/control-kit/src/multi-input-control.tsx:121` accepts independent `values`, `config`, and `fields`.
  - Rendering indexes `config[field.value]` and `values[field.value]` around `packages/control-kit/src/multi-input-control.tsx:181`.
- Problem: A segment is conceptually one unit, but the API lets field metadata, value, and config drift apart. Missing keys become runtime failures.
- Target shape: Collapse field metadata, value, and config into one typed segment array or a typed builder that proves all maps are complete before rendering.
- Suggested slices:
  1. Add tests for missing config/value keys to capture current failure mode.
  2. Introduce a segment builder for existing call sites.
  3. Move render code to consume normalized atomic segments.
- Acceptance criteria:
  - Render code no longer blindly indexes potentially missing config/value maps.
  - Existing multi-input Lab and ColorPlane integrations still behave the same.
  - TypeScript helps prevent incomplete segment definitions.

### CQ-008 - Replace brittle primitive markup assertions with contract tests

- Priority: P2
- Status: Open
- Evidence:
  - `packages/control-kit/__tests__/primitive-value-input.test.tsx:156` asserts private Tailwind class details such as `cursor-ew-resize`.
  - `packages/control-kit/__tests__/primitive-value-input.test.tsx:162` asserts `w-[5px]`.
  - `packages/control-kit/__tests__/primitive-value-input.test.tsx:172` asserts `pl-1`.
- Problem: Some tests pin private markup details while behavior coverage is split across primitive and React input suites. This makes refactors noisy without fully protecting the real contract.
- Target shape: Keep a small number of styling/variant tests where needed, but move the bulk of coverage to behavior contracts shared by primitive and color-domain adapters.
- Suggested slices:
  1. Define the primitive behavior test matrix.
  2. Add shared tests for keyboard, blur, parse, clamp/wrap, disabled/readOnly, and scrub behavior.
  3. Remove markup-only assertions that are no longer meaningful.
- Acceptance criteria:
  - Tests protect user-facing behavior rather than private class names.
  - Styling expectations that matter are covered by targeted visual or variant tests.
  - Refactoring the primitive DOM shape is possible without rewriting behavior tests.

### CQ-009 - Decompose docs right rail feature panels

- Priority: P2
- Status: Open
- Evidence:
  - `apps/docs/src/components/docs-right-rail.tsx` is 1,632 lines.
  - `ColorAreaPropertiesPanel` begins around `apps/docs/src/components/docs-right-rail.tsx:465`.
  - The shared rail knows the route-to-panel mapping around `apps/docs/src/components/docs-right-rail.tsx:1561`.
- Problem: The shared right rail owns feature-specific panels and nested update logic. The shell is coupled to each component page.
- Target shape: Put feature panels beside their component docs or demo modules, and have the right rail render a registered panel for the active page.
- Suggested slices:
  1. Extract one component panel behind a panel registry.
  2. Move nested update helpers into typed actions owned by the inspector/demo state.
  3. Repeat for the remaining large panels.
- Acceptance criteria:
  - `docs-right-rail.tsx` is a shell, not a feature-panel container.
  - Component-specific controls live with the component demo/docs they configure.
  - Adding a new panel does not require growing the shared rail file.

### CQ-010 - Model contrast overlay tiers once

- Priority: P2
- Status: Open
- Evidence:
  - `apps/docs/src/components/component-demos.tsx:657`, `:733`, and `:791` repeat contrast overlay rendering branches.
  - Matching controls are repeated in `apps/docs/src/components/docs-right-rail.tsx:1150` and `apps/docs/src/components/docs-right-rail.tsx:1212`.
- Problem: Contrast overlay labels, thresholds, controls, and rendering behavior are split across demo rendering and right-rail controls.
- Target shape: Add a shared `CONTRAST_TIERS` or `OVERLAY_DESCRIPTORS` table that drives both rendering and controls.
- Suggested slices:
  1. Extract descriptor data without changing rendering.
  2. Drive the demo renderer from descriptors.
  3. Drive right-rail controls from the same descriptors.
- Acceptance criteria:
  - Overlay tiers are declared once.
  - Control labels and render behavior cannot drift independently.
  - Existing contrast overlay demos remain visually unchanged.

## Suggested Execution Order

1. CQ-001: Split the Lab route shell from page modules.
2. CQ-004 and CQ-005: Unify Lab menu/select rendering and move Lab-only helpers behind a Lab boundary.
3. CQ-002 and CQ-008: Canonicalize numeric input behavior and replace brittle tests.
4. CQ-007: Make multi-input segments atomic after the primitive input boundary is cleaner.
5. CQ-003: Extract contour/marching-squares utilities.
6. CQ-006: Tighten color input model/channel typing.
7. CQ-009 and CQ-010: Decompose right rail panels and descriptor-drive contrast tiers.
