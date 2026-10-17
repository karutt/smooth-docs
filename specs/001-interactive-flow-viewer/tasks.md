---

description: "Actionable implementation tasks for the interactive flow viewer and editor"
---

# Tasks: Interactive Flow Viewer and Editor

**Input**: Design documents from `/specs/001-interactive-flow-viewer/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Tests are included because the specification defines independent acceptance tests,
measurable success criteria, safe-write guarantees, and keyboard/static-output requirements. Write
the listed tests before their corresponding implementation and confirm they fail for the intended
reason.

**Organization**: Tasks are grouped by user story so each increment can be implemented and
validated independently after the shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after the preceding phase gate because it changes different files
  and has no dependency on another incomplete task in the same group.
- **[Story]**: Maps the task to a user story in `spec.md` (`US1` through `US4`).
- Every checklist item names the exact source or test path it owns.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the approved runtime/test dependencies and establish the test harness without
changing generated artifacts.

- [X] T001 Add `@xyflow/react@^12.11.5`, `ajv@^8.20.0`, `elkjs@0.11.1`, `html-to-image@1.11.11`, Vitest, jsdom, React Testing Library, DOM Testing Library, user-event, and jest-dom plus `test:flow` and `test:flow-ui` scripts in `package.json` and `pnpm-lock.yaml`
- [X] T002 [P] Configure jsdom, repository aliases, jest-dom setup, and component-test inclusion in `vitest.config.ts` and `tests/docs-flow/setup.ts`
- [X] T003 [P] Copy the canonical authored-document contract byte-for-byte into the runtime mirror at `src/docs-flow/schema.json`

**Checkpoint**: Dependencies install and both new test commands start successfully, even if no
feature tests pass yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the shared authored/compiled contracts, restricted parser, validation,
deterministic layout, safe source primitives, generator integration, and minimum read-only renderer
needed by every user story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase passes its checkpoint.

### Foundational tests

- [X] T004 [P] Add schema parity, Ajv strict-compilation, valid-boundary, unknown-field, unsafe-value, and collection-limit tests in `tests/docs-flow/schema-contract.test.mjs` and `tests/docs-flow/schema.test.mjs`
- [X] T005 [P] Add restricted YAML, top-level backtick/tilde fence, mixed-shape, unsupported-version, duplicate-ID, dangling-reference, and line/column diagnostic tests in `tests/docs-flow/parse.test.mjs`
- [X] T006 [P] Add deterministic right/down, lane ordering, cycles, self-loop, disconnected graph, long-label, saved-position, and missing-position layout tests in `tests/docs-flow/layout.test.mjs`
- [X] T007 [P] Add raw-Markdown offset, CRLF, comment/key-order, reorder/add/delete, delimiter-lengthening, revision, and no-op round-trip tests in `tests/docs-flow/source-roundtrip.test.mjs`
- [X] T008 [P] Add traversal, absolute/UNC/drive path, bad extension, NUL, publish-root, symlink escape, and atomic-write cleanup tests in `tests/docs-flow/path-safety.test.mjs`

### Foundational implementation

- [X] T009 Define `FlowDocument`, lanes, nodes, links, edges, stories, diagnostics, compiled layout/view, source reference, editor session, and `DocPage.flows` contracts in `src/docs-flow/types.ts` and `src/types.ts`
- [X] T010 Implement Ajv strict structural validation, size prechecks, ID/reference/link semantics, finite-position checks, and stable diagnostics in `scripts/docs-flow/validate.mjs`
- [X] T011 Implement restricted YAML 1.2 parsing, complete-vs-reference discrimination, raw Markdown fence discovery, line offsets, and safe fallback extraction in `scripts/docs-flow/parse.mjs`
- [X] T012 Implement canonical ELK Layered inputs, fixed dimensions/ports/seed, saved-position precedence, missing-position layout, and deterministic lane normalization in `scripts/docs-flow/layout.mjs`
- [X] T013 Implement lexical/real-path containment, symlink checks, bounded reads, per-target queues, exclusive sibling temporary files, mode preservation, sync, rename, and cleanup in `scripts/docs-flow/files.mjs`
- [X] T014 Implement stable revision material, YAML AST reconciliation by ID, target-only inline splicing, line-ending preservation, delimiter expansion, and no-op detection in `scripts/docs-flow/source.mjs`
- [X] T015 Export the shared compiler, parser, validator, layout, source, and filesystem helpers with TypeScript declarations in `scripts/docs-flow/index.mjs` and `scripts/docs-flow/index.d.mts`
- [X] T016 Compile inline `smooth-flow` fences into validated `DocPage.flows`, inert markers, safe diagnostics/fallbacks, deterministic geometry, and appended search text while excluding `.docs-flow.yml` from generic asset copying in `scripts/generate-content.mjs`
- [X] T017 Implement controlled React Flow projection, five node variants, lane groups, and normal/error/async edges without color-only meaning in `themes/default/src/components/docs-flow/DocsFlowCanvas.tsx`, `themes/default/src/components/docs-flow/DocsFlowNode.tsx`, and `themes/default/src/components/docs-flow/DocsFlowEdge.tsx`
- [X] T018 Implement the lazy flow boundary, last-good compiled state, load-failure retry, and accessible semantic list fallback in `themes/default/src/components/docs-flow/DocsFlowBlock.tsx` and `themes/default/src/components/docs-flow/DocsFlowLinearView.tsx`
- [X] T019 Extend article block parsing and dispatch to resolve flow markers from `DocPage.flows` without regressing HTML or accordions in `themes/default/src/App.tsx`
- [X] T020 Add React Flow base CSS integration, semantic flow tokens, accessible focus/error/async styles, narrow-screen behavior, and reduced-motion defaults in `themes/default/src/styles.css`
- [X] T021 Run `pnpm test:flow`, `pnpm generate`, and `pnpm typecheck`, then resolve all foundational regressions in `tests/docs-flow/`, `scripts/docs-flow/`, and `themes/default/src/components/docs-flow/`

**Checkpoint**: A valid inline definition compiles deterministically into a lazy read-only flow and
an invalid definition remains readable with diagnostics; all shared tests pass.

---

## Phase 3: User Story 1 - ワークフローを視覚的に編集して保存する (Priority: P1) 🎯 MVP

**Goal**: Let a local author visually edit nodes, edges, lanes, properties, and positions; undo,
redo, validate, save, discard, and resolve conflicts; persist only the selected inline definition;
and keep the static build read-only.

**Independent Test**: Starting from one valid inline four-node definition, move and add a node,
change its properties and lane, reconnect an edge, undo/redo, save, and reload. The same diagram
must return, all bytes outside the selected fence must remain unchanged, a stale save must not
overwrite, and the static build must expose no edit controls or local metadata.

### Tests for User Story 1

- [X] T022 [P] [US1] Add failing reducer tests for node/edge/lane/property/position commands, dependent-reference deletion, 100-entry undo/redo, discard, and viewport-state exclusion in `tests/docs-flow/editor.test.tsx`
- [X] T023 [P] [US1] Add failing keyboard tests for opening edit mode, node and edge creation/change, lane assignment, undo/redo, save/discard, focus visibility, and live announcements in `tests/docs-flow/keyboard.test.tsx`
- [X] T024 [P] [US1] Add failing inline source/layout/save API tests for guards, size limits, server-derived targets, validation, no-op, atomic success, typed errors, and 409 draft preservation in `tests/docs-flow/dev-api.test.mjs`
- [X] T025 [P] [US1] Add failing static-build assertions for omitted source references, revisions, endpoints, edit labels, capability flags, and absolute paths in `tests/docs-flow/static-output.test.mjs`

### Implementation for User Story 1

- [X] T026 [US1] Implement immutable domain commands, generated stable IDs, dependent-reference cleanup, dirty state, and bounded undo/redo history in `themes/default/src/components/docs-flow/flow-editor-reducer.ts`
- [X] T027 [US1] Implement accessible forms for every v1 node, edge, lane, link, risk, status, owner, label, description, and position field with field-linked diagnostics in `themes/default/src/components/docs-flow/DocsFlowInspector.tsx`
- [X] T028 [US1] Add keyboard/form commands for adding, duplicating, editing, moving, reordering, reconnecting, and deleting nodes, edges, and lanes in `themes/default/src/components/docs-flow/DocsFlowLinearView.tsx`
- [X] T029 [US1] Project draft commands onto node dragging, handles, reconnection, lane grouping, selection, and accepted auto-layout positions without persisting viewport or measured UI state in `themes/default/src/components/docs-flow/DocsFlowCanvas.tsx`
- [X] T030 [US1] Implement editor load/clean/dirty/saving/conflict/error transitions, navigation confirmation, validation display, explicit save/discard, reload/reconcile actions, and draft retention on failure in `themes/default/src/components/docs-flow/DocsFlowEditor.tsx`
- [X] T031 [US1] Implement Edit, Add, Auto Layout, Undo, Redo, Save, Discard, and accessible status controls with correct disabled states in `themes/default/src/components/docs-flow/DocsFlowToolbar.tsx`
- [X] T032 [US1] Add development-only `GET /__smooth-docs/flow/source`, `POST /__smooth-docs/flow/layout`, and inline `POST /__smooth-docs/flow/save` routing with same-origin/content-type/body guards, typed status mapping, revision checks, one regeneration, and one HMR broadcast in `vite.config.ts`
- [X] T033 [US1] Lazy-load editor-only code in development, connect source/layout/save responses, adopt successful revisions, and preserve dirty drafts across content updates in `themes/default/src/components/docs-flow/DocsFlowBlock.tsx` and `themes/default/src/App.tsx`
- [X] T034 [US1] Strip `FlowSourceReference`, raw YAML, writable locators, revisions, and unsafe local source links during static generation while retaining the viewer and semantic content in `scripts/generate-content.mjs`
- [X] T035 [US1] Add an inline four-node workflow with comments, lanes, editable properties, saved positions, and neighboring Markdown preservation sentinels in `examples/basic/docs/interactive-flow.md`
- [X] T036 [US1] Execute the inline round-trip, no-op, conflict, keyboard-only, narrow-screen, and static-read-only scenarios from `specs/001-interactive-flow-viewer/quickstart.md` and resolve failures in the US1-owned files

**Checkpoint**: User Story 1 is a deployable MVP that is materially richer than Mermaid because
the diagram is visually editable and safely round-trips to readable text.

---

## Phase 4: User Story 2 - 複雑なワークフローを探索して理解する (Priority: P2)

**Goal**: Let readers navigate large workflows through pan/zoom/fit, search, details, direct
relationships, upstream/downstream focus, and equivalent keyboard/linear interaction.

**Independent Test**: On a valid workflow with at least 20 nodes, search by label and description,
move to each match, inspect attributes and safe links, focus upstream/downstream paths, restore the
whole graph, and repeat the core journey with only the keyboard.

### Tests for User Story 2

- [X] T037 [P] [US2] Add failing viewer tests for pan/zoom/fit commands, label/description search, match navigation, selection, details, direct relationships, and upstream/downstream focus in `tests/docs-flow/viewer.test.tsx`
- [X] T038 [P] [US2] Add failing generation and command-dialog search tests proving node-only text reaches the owning page without indexing IDs or raw YAML in `tests/docs-flow/search.test.mjs`

### Implementation for User Story 2

- [X] T039 [US2] Add reader controls for zoom, pan reset, fit view, node search, match navigation, focus modes, and linear/canvas switching in `themes/default/src/components/docs-flow/DocsFlowToolbar.tsx`
- [X] T040 [US2] Implement stable keyboard focus order, selected-node centering, match highlighting, direct/upstream/downstream traversal, and fit-view restoration in `themes/default/src/components/docs-flow/DocsFlowCanvas.tsx`
- [X] T041 [US2] Render read-only node attributes, safe related links, incoming/outgoing edges, and upstream/downstream actions in `themes/default/src/components/docs-flow/DocsFlowInspector.tsx`
- [X] T042 [US2] Complete the narrow-screen and canvas-unavailable semantic reader with ordered lanes, unassigned nodes, edge meanings, node details, and keyboard navigation in `themes/default/src/components/docs-flow/DocsFlowLinearView.tsx`
- [X] T043 [US2] Include compiled flow text in site-wide page matching and command search while retaining route behavior in `scripts/generate-content.mjs` and `themes/default/src/components/ActionCommandDialog.tsx`
- [X] T044 [US2] Add a 20-node exploration fixture and a 100-node/150-edge maximum fixture with interaction timing instrumentation in `tests/docs-flow/viewer.test.tsx` and `examples/basic/docs/interactive-flow.md`
- [X] T045 [US2] Execute the exploration, keyboard reader, page-search, narrow-screen, and 2-second/200-millisecond timing scenarios from `specs/001-interactive-flow-viewer/quickstart.md` and resolve failures in the US2-owned files

**Checkpoint**: User Story 2 works on the read-only viewer independently of editing and makes large
flows searchable and understandable.

---

## Phase 5: User Story 3 - 定義を再利用し安全に保守する (Priority: P2)

**Goal**: Resolve one reusable `.docs-flow.yml` from multiple pages, edit it safely from either
page, propagate one generated update to every reference, and reject invalid or escaping sources
without silent loss.

**Independent Test**: Reference one external definition from two pages with different view options,
save an edit from one page, and observe both pages update without restart. Only the external file
may change; unsafe, missing, invalid, oversized, or conflicted sources must produce actionable
failures without outside-root access or draft loss.

### Tests for User Story 3

- [X] T046 [P] [US3] Add failing external-reference tests for descriptor shape, page-relative resolution, view/height validation, multi-page reuse, publish-root boundaries, invalid fallback, and asset exclusion in `tests/docs-flow/parse.test.mjs`
- [X] T047 [P] [US3] Extend failing safety tests for derived external targets, reference changes during editing, target/parent symlink swaps, outside-root reads/writes, and external atomic replacement in `tests/docs-flow/path-safety.test.mjs`
- [X] T048 [P] [US3] Extend failing API tests for external load/save, per-target serialization, reference-inclusive revisions, two-tab conflicts, duplicate watcher suppression, one regeneration, and shared HMR delivery in `tests/docs-flow/dev-api.test.mjs`

### Implementation for User Story 3

- [X] T049 [US3] Parse and validate external descriptors, resolve publication-safe `.docs-flow.yml` files, compile per-embed view options, reuse definitions across pages, and keep source files out of public assets in `scripts/docs-flow/parse.mjs` and `scripts/generate-content.mjs`
- [X] T050 [US3] Re-derive external ownership from current raw Markdown, include reference and file bytes in revisions, reconcile the external YAML AST, and atomically replace only the canonical external file in `scripts/docs-flow/source.mjs` and `scripts/docs-flow/files.mjs`
- [X] T051 [US3] Extend flow source/save routes for external targets, per-target queues, reference-change conflicts, typed path failures, silent watcher coordination, and one shared content update in `vite.config.ts`
- [X] T052 [US3] Preserve a dirty editor on shared HMR changes and show last-good content or escaped local source plus actionable missing/invalid/unsupported diagnostics in `themes/default/src/components/docs-flow/DocsFlowBlock.tsx` and `themes/default/src/components/docs-flow/DocsFlowEditor.tsx`
- [X] T053 [US3] Add one reusable parking workflow and a second page that references it with a different initial story/height in `examples/basic/docs/flows/parking-start.docs-flow.yml`, `examples/basic/docs/interactive-flow.md`, and `examples/basic/docs/interactive-flow-reuse.md`
- [X] T054 [US3] Execute the two-page HMR, external round-trip, invalid-source, traversal/symlink, oversized-input, conflict, and public-asset exclusion scenarios from `specs/001-interactive-flow-viewer/quickstart.md` and resolve failures in the US3-owned files

**Checkpoint**: User Story 3 safely supports shared external definitions and cannot use a forged
client path or symlink to read or mutate outside the allowed docs roots.

---

## Phase 6: User Story 4 - 注目経路を再生し図を共有する (Priority: P3)

**Goal**: Let authors maintain named paths, let readers play them step by step with reduced-motion
support, and export the complete clean diagram as a shareable PNG.

**Independent Test**: Define normal and error stories, add/reorder/delete their steps visually,
save and reload, play both in declared order, and export the whole themed graph while zoomed in. The
PNG must omit toolbars, handles, selections, and editor state.

### Tests for User Story 4

- [X] T055 [P] [US4] Add failing story tests for selection, ordered playback, pause/reset/completion, editing add/reorder/delete, invalid references, edit-time playback stop, and reduced motion in `tests/docs-flow/story.test.tsx`
- [X] T056 [P] [US4] Add failing export tests for full-graph bounds, fit transform, current theme, transient-UI filtering, selection exclusion, and filename generation in `tests/docs-flow/export.test.tsx`

### Implementation for User Story 4

- [X] T057 [US4] Implement named-story selection, ordered node/edge highlighting, play/pause/reset/completion state, accessible announcements, and reduced-motion behavior in `themes/default/src/components/docs-flow/DocsFlowStoryPlayer.tsx`
- [X] T058 [US4] Add story create/edit/reorder/delete and ordered node/edge step controls as undoable domain commands in `themes/default/src/components/docs-flow/DocsFlowInspector.tsx` and `themes/default/src/components/docs-flow/flow-editor-reducer.ts`
- [X] T059 [US4] Implement whole-graph PNG capture with `html-to-image@1.11.11`, graph-bound fitting, theme retention, and transient editor/control filtering, then expose it in the toolbar in `themes/default/src/components/docs-flow/DocsFlowExport.ts` and `themes/default/src/components/docs-flow/DocsFlowToolbar.tsx`
- [X] T060 [US4] Add normal and error stories with deterministic ordered steps to the inline and external examples in `examples/basic/docs/interactive-flow.md` and `examples/basic/docs/flows/parking-start.docs-flow.yml`
- [X] T061 [US4] Execute story editing/playback, reduced-motion, theme-switch, and zoomed full-graph PNG scenarios from `specs/001-interactive-flow-viewer/quickstart.md` and resolve failures in the US4-owned files

**Checkpoint**: User Story 4 provides reproducible guided explanations and clean image sharing
without changing the authored viewport or exposing editor state.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify all stories together against publication, performance, accessibility, theme,
documentation, and Constitution requirements.

- [X] T062 [P] Expand static-output and lazy-chunk assertions to prove ordinary pages omit flow chunks and built page data omits endpoints, revisions, writable paths, raw external source, absolute paths, and editing flags in `tests/docs-flow/static-output.test.mjs`
- [X] T063 [P] Verify and correct semantic-token contrast, focus rings, edge patterns/icons, narrow layouts, and reduced motion across default, linear, github, dracula, and raycast themes in `themes/default/src/styles.css`
- [X] T064 [P] Complete automated keyboard/accessibility coverage for viewer/editor dialogs, forms, live regions, edge creation, conflicts, and semantic fallback in `tests/docs-flow/keyboard.test.tsx`
- [X] T065 [P] Add repeatable maximum-scale generation/layout/render benchmarks and document the 2-second/200-millisecond measurements in `tests/docs-flow/performance.test.tsx`
- [X] T066 [P] Document `smooth-flow` inline/external syntax, local editing, static behavior, dependency rationale, and elkjs license implications in `README.md`
- [X] T067 Run `pnpm test:flow`, `pnpm test:flow-ui`, `pnpm generate`, `pnpm typecheck`, `pnpm build`, and every manual acceptance section in `specs/001-interactive-flow-viewer/quickstart.md`; record any environment-limited residual risk before delivery

**Checkpoint**: All automated gates and the full quickstart pass without editing `.generated/`,
`dist/`, `site/`, example-site output, or installed dependencies directly.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story.
- **User Story 1 (Phase 3)**: Depends on Foundational; this is the recommended MVP.
- **User Story 2 (Phase 4)**: Depends only on Foundational and may proceed alongside US1 because it
  owns read-only exploration behavior.
- **User Story 3 (Phase 5)**: Its parser/safety tests may begin after Foundational, but the complete
  visual-editing acceptance depends on US1 editor/save behavior.
- **User Story 4 (Phase 6)**: Playback tests may begin after Foundational, but story editing and
  toolbar integration depend on US1; it does not require US3.
- **Polish (Phase 7)**: Depends on every user story selected for release.

### User Story Dependency Graph

```text
Setup
  -> Foundation
       ├──> US1 (visual editing + inline safe save) ──> US3 (external reuse/save)
       │                                      └──────> US4 (story editing/playback/export)
       └──> US2 (read-only exploration)

US1 + US2 + US3 + US4 -> Polish
```

### Within Each User Story

1. Add the story's failing tests and confirm the failure is caused by missing behavior.
2. Implement domain/model behavior before UI projection or transport integration.
3. Implement source services before development endpoints, and endpoints before editor wiring.
4. Keep React Flow state as a projection; save only the complete validated `FlowDocument`.
5. Finish the story checkpoint before relying on its behavior from a later story.

### Parallel Opportunities

- T002 and T003 can proceed while T001 updates the dependency manifest.
- T004–T008 are independent foundational test files and can be authored in parallel.
- T022–T025, T037–T038, T046–T048, and T055–T056 are parallel test groups within their stories.
- After Foundation, US1 and US2 can be implemented in parallel; US3 external parser/safety work can
  also start while US1 completes the editor transport.
- T062–T066 are independent final reviews/tests until T067 runs the combined gate.

---

## Parallel Example: User Story 1

```text
Task T022: Add reducer/state tests in tests/docs-flow/editor.test.tsx
Task T023: Add keyboard editing tests in tests/docs-flow/keyboard.test.tsx
Task T024: Add inline development API tests in tests/docs-flow/dev-api.test.mjs
Task T025: Add static authoring-data exclusion tests in tests/docs-flow/static-output.test.mjs
```

## Parallel Example: User Story 2

```text
Task T037: Add viewer interaction tests in tests/docs-flow/viewer.test.tsx
Task T038: Add generation and command-search tests in tests/docs-flow/search.test.mjs
```

## Parallel Example: User Story 3

```text
Task T046: Add external descriptor/compiler tests in tests/docs-flow/parse.test.mjs
Task T047: Add external path/atomic-write tests in tests/docs-flow/path-safety.test.mjs
Task T048: Add external save/conflict/HMR API tests in tests/docs-flow/dev-api.test.mjs
```

## Parallel Example: User Story 4

```text
Task T055: Add story editor/player tests in tests/docs-flow/story.test.tsx
Task T056: Add whole-graph PNG export tests in tests/docs-flow/export.test.tsx
```

---

## Implementation Strategy

### MVP First: User Story 1

1. Complete Setup and Foundation.
2. Complete US1 tests, source API, editor, inline save, conflict handling, and static stripping.
3. Stop and run the US1 checkpoint from `quickstart.md`.
4. Demonstrate visual editing and readable text round-trip before adding exploration extras.

This MVP already differentiates the feature from Mermaid: authors can change the diagram visually,
undo/redo, validate, and safely persist the result.

### Incremental Delivery

1. **Foundation**: Versioned syntax, typed IR, validation, deterministic layout, and read-only base.
2. **US1 MVP**: Visual editing and inline safe save.
3. **US2**: Large-flow exploration and site-wide search.
4. **US3**: Reusable external definitions, hardened persistence, and shared HMR.
5. **US4**: Named-path editing/playback and PNG export.
6. **Polish**: Cross-theme, static-publication, accessibility, scale, docs, and full release gates.

### Parallel Team Strategy

After Foundation:

- Developer A completes US1 editor and inline persistence.
- Developer B completes US2 read-only exploration.
- Developer C begins US3 external parser and safety tests, then integrates with US1 save transport.
- US4 begins after US1 domain commands and toolbar contracts stabilize.

## Notes

- Do not edit `.generated/`, `dist/`, `site/`, `examples/*/site/`, or `node_modules/` directly.
- Preserve Mermaid, accordion, raw HTML, Markdown links/assets, themes, and existing authoring APIs.
- Keep external flow files private authored sources; publish only validated, safe compiled data.
- Commit after each task or coherent task group, and stop at story checkpoints for independent
  verification.
