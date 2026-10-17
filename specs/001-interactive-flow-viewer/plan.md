# Implementation Plan: Interactive Flow Viewer and Editor

**Branch**: `001-interactive-flow-viewer` | **Date**: 2026-08-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-interactive-flow-viewer/spec.md`

## Summary

Add a versioned `smooth-flow` document format that can live inside Markdown or in reusable
`.docs-flow.yml` files. During content generation, parse, validate, index, and deterministically
layout each workflow into a typed page-level flow map while emitting only a marker into rendered
HTML. The default theme lazy-loads an interactive viewer and a development-only visual editor.
Authors edit domain nodes, edges, lanes, positions, properties, and stories; a dedicated local API
re-derives the writable source, validates the complete candidate, compares a content revision, and
atomically updates only the target fence body or external file. Static output retains the viewer,
search, semantic fallback, and PNG export but omits all authoring metadata and controls.

## Technical Context

**Language/Version**: Node.js 22-compatible ESM, TypeScript 5.7+, React 19

**Primary Dependencies**: Existing Vite 6, markdown-it 14, YAML 2, Tailwind 3, Radix-style UI;
new `@xyflow/react` 12.11.x, Ajv 8.20.x, direct `elkjs` 0.11.1, and pinned
`html-to-image` 1.11.11

**Storage**: Human-authored UTF-8 Markdown and `.docs-flow.yml` files under the active docs root;
generated typed page data remains ephemeral under `.generated/`

**Testing**: Node built-in test runner for parser/schema/layout/source/path/API helpers; Vitest,
jsdom, React Testing Library, DOM Testing Library, user-event, and jest-dom for viewer/editor state
and keyboard interactions; existing `pnpm generate`, `pnpm typecheck`, `pnpm build`, and manual
browser inspection remain release gates

**Target Platform**: Local Vite authoring server and generated static SPA in current evergreen
desktop/mobile browsers; editing is desktop-oriented and local-only, viewing has a narrow-screen and
non-interactive semantic fallback

**Project Type**: Shared documentation CLI, content compiler, and React static-site renderer

**Performance Goals**: For diagrams up to 100 nodes and 150 edges, 95% become interactive within
2 seconds of page-load start and search/select/pan interactions show feedback within 200 ms;
ordinary pages without flows do not load the flow viewer chunk

**Constraints**: Preserve all bytes outside an edited inline fence; stable deterministic output;
same-origin development writes only; lexical and real-path containment inside the active docs root;
no raw flow source or local authoring metadata in static output; no arbitrary HTML/code execution;
all core edit operations have a keyboard/form path; external flow sources are not copied as public
assets

**Scale/Scope**: One workflow kind, 5 node types, up to 32 lanes, 100 nodes, 150 edges, 32 stories,
multiple embeds per page, and multiple pages referencing one external definition

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-design Gate

| Principle or constraint | Status | Plan evidence |
|---|---|---|
| Shared Kit is the single source of truth | PASS | Parser, contracts, renderer, editor, endpoints, and styles live in this Kit; consuming projects add only authored flow definitions. |
| Markdown fidelity and deterministic output | PASS | Flow fences are isolated before generic rendering; target-only splicing preserves unrelated Markdown; fixed schema/layout inputs and diagnostics prevent silent loss. |
| Stable theme and renderer contracts | PASS | Generated flow types are shared; viewer colors use semantic tokens; all bundled extension themes inherit the default component; full-theme compatibility is documented. |
| Project-boundary and path safety | PASS | External references are docs-root-relative, real-path checked, extension limited, revision checked, size bounded, and written atomically by development-only endpoints. |
| Generated-artifact and verification discipline | PASS | Only source files and example fixtures are edited; generated output remains disposable; automated and visual gates are defined. |
| Common typed data contracts | PASS | Flow types are defined in the shared source type layer and backed by one published JSON Schema used by generator/server validation. |
| Generation versus presentation ownership | PASS | Parsing, path resolution, validation, search extraction, and initial layout happen during generation; the theme owns interaction and visual editing. |
| Publish/local capability separation | PASS | Static data strips revisions, writable locators, absolute paths, and edit controls; only the local dev server exposes flow endpoints. |
| Dependency justification | PASS | Each new dependency replaces a substantial specialized subsystem; rationale and rejected alternatives are recorded in `research.md`. |

No constitution violations require an exception.

### Post-design Re-check

The Phase 1 data model and contracts preserve every pre-design gate:

- `data-model.md` separates authored `FlowDocument`, generated `CompiledFlow`, transient
  `FlowViewState`, and development-only `FlowSourceReference`.
- `contracts/docs-flow.schema.json` bounds authored values and rejects unknown executable content.
- `contracts/markdown-embedding.md` limits editable inline flows to top-level fences and defines
  exact external-reference and publish-root behavior.
- `contracts/dev-api.md` makes source derivation, revisions, real-path checks, typed failures,
  atomic writes, regeneration, and HMR delivery explicit.
- `quickstart.md` covers inline/external round trips, conflicts, invalid input, search, themes,
  keyboard operation, scale, and static authoring-data removal.

No new gate violation was introduced by the design.

## Project Structure

### Documentation (this feature)

```text
specs/001-interactive-flow-viewer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── dev-api.md
│   ├── docs-flow.schema.json
│   ├── generated-content.md
│   └── markdown-embedding.md
└── tasks.md                    # Created later by $speckit-tasks
```

### Source Code (repository root)

```text
src/
├── docs-flow/
│   ├── schema.json             # Byte-identical runtime mirror of the canonical contract schema
│   └── types.ts                # Shared authored/generated/editor contracts
└── types.ts                    # DocPage gains the compiled flow map

scripts/
├── docs-flow/
│   ├── index.mjs               # Public compiler helpers
│   ├── parse.mjs               # YAML and Markdown fence parsing with diagnostics
│   ├── validate.mjs            # Schema and graph semantic validation
│   ├── layout.mjs              # ELK adapter and deterministic lane post-pass
│   ├── source.mjs              # AST reconciliation, revisions, and target-only splicing
│   ├── files.mjs               # Real-path containment and atomic write helpers
│   └── index.d.mts             # Type declarations for TypeScript consumers
└── generate-content.mjs        # Flow compilation, markers, search text, asset exclusion

themes/default/src/
├── App.tsx                     # Article block dispatch and dev save integration
├── components/docs-flow/
│   ├── DocsFlowBlock.tsx       # Lazy viewer/editor boundary and last-good state
│   ├── DocsFlowCanvas.tsx      # Controlled canvas projection
│   ├── DocsFlowEditor.tsx      # Draft state, commands, undo/redo, save/discard
│   ├── DocsFlowInspector.tsx   # Keyboard-accessible property forms
│   ├── DocsFlowLinearView.tsx  # Semantic/narrow-screen fallback and form editing
│   ├── DocsFlowNode.tsx        # Typed custom nodes and lane group
│   ├── DocsFlowEdge.tsx        # Normal/error/async edges without color-only meaning
│   ├── DocsFlowToolbar.tsx     # Search, fit, focus, stories, export, edit commands
│   ├── DocsFlowStoryPlayer.tsx # Named-path playback
│   ├── DocsFlowExport.ts       # Whole-graph PNG export filtering transient UI
│   └── flow-editor-reducer.ts  # Domain commands and bounded undo/redo history
└── styles.css                  # Semantic flow tokens, responsive and reduced-motion rules

vite.config.ts                 # Dev-only flow source/layout/save endpoints and flow vendor chunk
package.json                   # Runtime/test dependencies and targeted test scripts
vitest.config.ts               # jsdom component-test configuration

tests/docs-flow/
├── schema.test.mjs
├── schema-contract.test.mjs    # Prevents canonical/runtime schema drift
├── parse.test.mjs
├── source-roundtrip.test.mjs
├── path-safety.test.mjs
├── layout.test.mjs
├── dev-api.test.mjs
├── editor.test.tsx
├── keyboard.test.tsx
└── static-output.test.mjs

examples/basic/docs/
├── interactive-flow.md        # Inline, invalid, story, and editor smoke fixtures
└── flows/
    └── parking-start.docs-flow.yml
```

**Structure Decision**: Keep the feature inside the existing single Kit repository and its current
compiler/theme split. Shared domain types live under `src/docs-flow`; Node-executed compiler and
safe-write logic remain ESM under `scripts/docs-flow`; interactive presentation is a cohesive set of
default-theme components. `vite.config.ts` only exposes the local transport and orchestrates the
same compiler helpers, avoiding a second validation or persistence implementation.

## Implementation Strategy

1. Finalize the source schema and shared types, then implement syntax and semantic diagnostics with
   fixtures before integrating Markdown rendering.
2. Add deterministic compilation: inline/reference parsing, publish-root-safe external resolution,
   ELK layout for missing positions, marker emission, page flow maps, search extraction, and
   exclusion of flow sources from copied assets.
3. Add pure source-editing and filesystem helpers with byte-preservation, AST reconciliation,
   revision calculation, real-path containment, per-target serialization, and atomic writes.
4. Add the development-only source/layout/save contracts, typed status mapping, one regeneration,
   and one HMR broadcast per successful save.
5. Add the lazy read-only viewer, semantic fallback, search/detail/focus/story/export behavior, and
   theme tokens before enabling authoring controls.
6. Add the visual editor with domain-command history, canvas and form equivalents, explicit
   save/discard, conflict retention, auto-layout preview, and accessibility announcements.
7. Complete automated fixtures plus manual quickstart checks across all bundled themes, narrow
   screens, keyboard-only operation, scale limits, HMR reuse, and static output.

## Dependency and License Notes

- `@xyflow/react` and `html-to-image` are MIT licensed.
- Ajv is MIT licensed and provides the shared standards-based validation layer.
- Direct `elkjs@0.11.1` use is licensed `EPL-2.0 OR GPL-3.0-or-later`; the version is already present
  transitively through `beautiful-mermaid`, but direct use must be recorded in dependency/license
  review.
- Flow viewer/editor code is split from ordinary documentation pages; editor-only controls and
  save transport are excluded from static authoring capability even though the read-only viewer
  remains available.
