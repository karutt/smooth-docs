# Research: Interactive Flow Viewer and Editor

## Decision 1: Use a versioned, restricted YAML 1.2 source format

**Decision**: Use `smooth-flow` fenced blocks for inline definitions and references. Store reusable
definitions in `*.docs-flow.yml`. A complete definition requires `version`, `id`, `kind`, and the
workflow collections. A reference definition contains `src` plus optional view settings and cannot
also contain a complete definition.

**Rationale**:

- YAML is already a production dependency and is easier to edit by hand than JSON.
- `yaml.parseDocument()` exposes document nodes, comments, key order, and source ranges, which are
  needed for round-trip visual editing and diagnostics.
- A restricted YAML subset is safer and more predictable than accepting arbitrary YAML features.
- A versioned source contract allows later diagram kinds to evolve without coupling the source to
  the rendering library's private save format.

**Alternatives considered**:

- JSON was rejected because it has no comments and is cumbersome for authored documentation.
- A custom DSL was rejected because parsing, formatting, diagnostics, and round-trip editing would
  all become new maintenance responsibilities.
- Persisting the canvas library's node/edge snapshot was rejected because viewport and measured UI
  state are not domain data and would couple authored files to one renderer.

**Sources**:

- [YAML Document API](https://eemeli.org/yaml/)
- [React Flow save and restore](https://reactflow.dev/examples/interaction/save-and-restore)

## Decision 2: Preserve source through AST reconciliation and bounded Markdown splicing

**Decision**: Re-read the exact raw source on every edit load and save. Reconcile YAML document
nodes by stable IDs, then serialize only the target definition. For an inline definition, locate a
top-level `smooth-flow` fence by its flow ID and replace only its body using raw character offsets.
For an external definition, rewrite only that external file. Preserve the existing line-ending
style and do not write a no-op edit.

**Rationale**:

- Rendering currently removes frontmatter/title context and trims the Markdown body, so rendered
  token positions are not safe write coordinates.
- A raw-source splice can guarantee that frontmatter, headings, surrounding prose, other fences,
  and their whitespace remain byte-for-byte unchanged.
- Reusing YAML AST nodes preserves existing key order and most comments on unchanged items while
  still allowing add, delete, and reorder operations.

**Preservation contract**:

- Content outside the target inline block is byte-for-byte preserved.
- Definition meaning, collection order, stable IDs, and existing key order are preserved.
- Comments attached to retained fields/items are preserved where the YAML document model can do so.
- Quote style, internal whitespace, trailing-comment attachment, and comments on deleted items are
  not guaranteed. The YAML library documents that trailing comment association is not fully stable.

**Alternatives considered**:

- Re-serializing the whole Markdown page was rejected because it violates the exact-target write
  requirement.
- Regex-only fence replacement was rejected because fence length, nested fences, and raw offsets
  are not reliably handled.
- A concrete-syntax-tree patcher could preserve every byte inside YAML, but its complexity is not
  justified for the initial editor.

**Local evidence**:

- `scripts/generate-content.mjs` parses raw Markdown, removes title context, and trims rendered body.
- `vite.config.ts` currently saves Markdown using an unconditional whole-file `writeFile`.

## Decision 3: Use JSON Schema Draft 2020-12 plus semantic validation

**Decision**: Publish `contracts/docs-flow.schema.json` and validate it with Ajv in strict mode.
Use the existing YAML parser for syntax and source locations. Run a second semantic pass for graph
references and security rules that JSON Schema cannot express.

**Rationale**:

- A standard schema is usable by the generator, development server, editor, external tooling, and
  future documentation without inventing parallel validators.
- Strict schema compilation detects ambiguous or ignored schema keywords.
- Semantic checks remain necessary for unique IDs, lane references, edge endpoints, story steps,
  link schemes, finite positions, and embed view references.
- Size limits are checked before `allErrors` validation to bound diagnostic work.

**Validation restrictions**:

- YAML 1.2, one document, unique string keys, no custom tags, aliases, anchors, or merge keys.
- At most 100 nodes, 150 edges, 32 lanes, and 32 stories.
- Stable kebab-case IDs of 1–64 characters.
- Only safe document-relative links and `http:`/`https:` public links; local source links are
  development-only presentation data.

**Alternatives considered**:

- Handwritten structural validation was rejected because it would duplicate the published schema.
- Zod was considered, but JSON Schema is a better external contract for non-TypeScript consumers.

**Sources**:

- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
- [Ajv getting started](https://ajv.js.org/guide/getting-started)
- [Ajv strict mode](https://ajv.js.org/strict-mode.html)

## Decision 4: Use React Flow as a projection of the domain document

**Decision**: Use `@xyflow/react` 12.x with controlled nodes and edges. Implement typed custom
nodes, custom edges, and group/parent nodes for lanes. Keep the `FlowDocument` as the authoritative
editor state; convert it to and from the canvas representation at the component boundary.

**Rationale**:

- React Flow provides pan, zoom, selection, handles, reconnection, grouping, focus behavior, and
  accessible node movement without building a canvas system from scratch.
- It supports React 19 through its React `>=17` peer range and is MIT licensed.
- Keeping a domain document prevents viewport, selection, measured dimensions, and transient
  rendering state from leaking into authored YAML.
- Parent nodes and child nodes support lane visualization; parent nodes are emitted before children.

**Alternatives considered**:

- Embedding standalone Archify HTML was rejected because it would isolate theme, search,
  accessibility, page links, and editing from Smooth Docs.
- A custom SVG/canvas editor was rejected because pan/zoom, keyboard navigation, hit testing,
  grouping, and edge editing would dominate the feature cost.
- Extending Mermaid was rejected because it does not provide the required visual round-trip editor.

**Sources**:

- [React Flow repository](https://github.com/xyflow/xyflow)
- [Custom nodes](https://reactflow.dev/learn/customization/custom-nodes)
- [Custom edges](https://reactflow.dev/learn/customization/custom-edges)
- [Sub flows and grouping](https://reactflow.dev/learn/layouting/sub-flows)

## Decision 5: Use ELK Layered for deterministic, lane-aware layout

**Decision**: Add `elkjs@0.11.1` as a direct dependency and use the layered algorithm with canonical
node/edge ordering, fixed node dimensions, stable ports, orthogonal routing inputs, and a fixed
random seed. Apply a deterministic post-pass that orders lane groups according to the authored lane
array. Run layout during content generation when saved positions are missing and through a local
development-only layout endpoint when the author chooses Auto Layout.

**Rationale**:

- ELK handles compounds, hierarchy-crossing edges, cycles, self-loops, labels, and multiple edges.
- Dagre has a documented sub-flow limitation when children connect outside their group, which is a
  central lane use case.
- Running editor layout on the local server avoids shipping ELK to static readers and avoids main
  thread blocking, while still returning an unsaved preview the author can accept or undo.
- Version 0.11.1 is already present through `beautiful-mermaid`; declaring it directly avoids
  relying on a transitive dependency or introducing a second version.

**Layout policy**:

- Saved positions always win and are not changed on page load.
- Missing positions are computed for display but are not written without an explicit save.
- Auto Layout returns a draft with positions; it does not write source by itself.
- The 100-node/150-edge target is verified with fixtures rather than assumed from library claims.

**Alternatives considered**:

- Dagre is smaller but unsuitable for cross-lane compound edges.
- D3 hierarchy/flextree only fit tree-shaped flows.
- Force/constraint layouts provide weaker directional and deterministic workflow semantics.
- An ELK browser worker is a valid future option if editing moves outside the local dev server, but
  is unnecessary for the initial local-only editor.

**Sources**:

- [React Flow layout comparison](https://reactflow.dev/learn/layouting/layouting)
- [ELK Layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)
- [ELK random seed](https://eclipse.dev/elk/reference/options/org-eclipse-elk-randomSeed.html)
- [elkjs](https://github.com/kieler/elkjs)

## Decision 6: Compile flows into page data and render by marker ID

**Decision**: Add a `flows` map to each generated page. Each entry contains the validated domain
document, compiled layout, embed options, diagnostics, search text, and development-only source
metadata. Emit only a small marker ID into page HTML, then extend the article-block parser to render
the corresponding flow component. Lazy-load the viewer, and lazy-load editor-only UI only in local
authoring mode.

**Rationale**:

- The existing accordion block demonstrates the marker-to-React-component pattern.
- Keeping large documents out of HTML attributes avoids escaping, size, and duplication problems.
- Generation remains responsible for source parsing, path rewriting, validation, and computed
  layout; the theme remains responsible for interactive presentation.
- Flow labels and descriptions can be added explicitly to `page.text`, because the current plain
  text extraction removes fenced blocks.
- External `*.docs-flow.yml` files must be excluded from public asset copying; only validated,
  publication-safe compiled data is emitted.

**Alternatives considered**:

- Client-side fetching/parsing of raw YAML was rejected because it bypasses build validation and
  would publish authoring source and local metadata.
- Embedding the full document in a `data-*` attribute was rejected because of size and escaping.

**Local evidence**:

- `scripts/generate-content.mjs` handles special fences and currently copies non-Markdown files as
  public assets.
- `themes/default/src/App.tsx` already replaces accordion markers with React components.
- All bundled non-default themes extend the default theme, so the shared component is inherited.

## Decision 7: Use a dedicated, revision-checked development save contract

**Decision**: Add development-only source, layout, and save endpoints under
`/__smooth-docs/flow/*`. The client identifies the owning page and stable flow ID; it never chooses
the writable target path. The server reparses the current page to derive inline or external storage,
compares a SHA-256 revision, validates the candidate, performs an atomic target-only write, runs one
content regeneration, and broadcasts the resulting content update.

**Rationale**:

- The existing Markdown endpoint replaces an entire page without concurrency protection.
- A revision based on exact writable bytes detects outside edits without a mutable revision field in
  authored YAML.
- Re-deriving the target from page source and flow ID prevents a forged external write path.
- A per-target in-process queue serializes saves from the same development server.
- A sibling temporary file, file sync, close, and rename reduces partial-write risk.

**Safety contract**:

- Reject absolute paths, URL schemes, query/fragment text, NUL, Windows drive/UNC paths, and `..`.
- Require `.docs-flow.yml` for external definitions.
- Verify both lexical containment and resolved real paths; reject symlink escapes.
- Require JSON content type, same-origin development requests, and bounded request/source size.
- Return typed `400`, `403`, `404`, `409`, `413`, and `422` errors rather than collapsing to `500`.
- Omit source locators, revisions, local paths, and edit controls from static output.

**Alternatives considered**:

- Reusing `/__smooth-docs/save-markdown` was rejected because it writes the whole page.
- Accepting a client-supplied target path was rejected as an avoidable filesystem attack surface.
- Relying only on the file watcher was rejected because save response and other-tab update order
  would be ambiguous and conflict with the existing silent-file mechanism.

**Sources**:

- [Node.js file system API](https://nodejs.org/api/fs.html)

## Decision 8: Provide an accessible command/form editor alongside the canvas

**Decision**: Keep canvas pointer editing, but expose all required node, edge, lane, story, undo,
redo, save, and discard actions through keyboard-accessible controls and linear forms. Provide a
semantic list fallback for narrow screens, unavailable interaction, and assistive technology.

**Rationale**:

- React Flow supports keyboard focus, selection, node movement, ARIA labels, and live movement
  announcements, but does not promise keyboard-only edge creation/reconnection.
- A form path makes the feature independently operable without precise dragging and gives tests
  stable labels and roles.
- Edge meaning must use text/iconography in addition to color.

**Alternatives considered**:

- Canvas-only editing was rejected because it cannot satisfy the keyboard-complete requirement.
- A separate full-screen editor application was rejected because it duplicates page context and
  complicates source ownership; an in-page dialog/sheet can provide adequate space.

**Sources**:

- [React Flow accessibility](https://reactflow.dev/learn/advanced-use/accessibility)

## Decision 9: Export PNG from the complete graph bounds

**Decision**: Use the official `html-to-image` approach and pin `html-to-image@1.11.11`. Calculate
the complete graph bounds, fit them into the export canvas, and filter controls, MiniMap, selection,
handles, and editor panels. Export the saved document state, not an unsaved transient draft unless
the author explicitly previews it.

**Rationale**:

- The official React Flow example uses this approach and warns that releases after 1.11.11 do not
  export correctly in its tested scenario.
- PNG meets the specification's format-neutral image-sharing requirement without introducing a
  headless browser or server rendering runtime.

**Alternatives considered**:

- SVG through `foreignObject` is not a universally portable pure-vector artifact.
- Headless-browser server export adds a browser runtime to a static toolkit and is outside the MVP.

**Sources**:

- [React Flow download image example](https://reactflow.dev/examples/misc/download-image)
- [html-to-image](https://github.com/bubkoo/html-to-image)

## Decision 10: Add focused automated tests for core and editor behavior

**Decision**: Use `node:test` for ESM parser, schema, layout, source patch, path, and endpoint-helper
tests. Add Vitest with React Testing Library, DOM Testing Library, user-event, and jsdom for the
viewer/editor state machine and keyboard/form interactions. Retain generation, typecheck, full
build, and manual browser inspection as release gates.

**Rationale**:

- The source patcher and path boundary require byte-level and filesystem fixtures.
- Stateful editing, undo/redo, conflict handling, and keyboard alternatives cannot be covered by
  type checking or a production build alone.
- Testing Library queries by accessible roles and labels, reinforcing the accessibility contract.

**Alternatives considered**:

- Manual-only verification was rejected for destructive source-writing behavior.
- A full browser E2E dependency was deferred; the quickstart provides targeted manual browser
  validation until the project adopts a general E2E runner.

**Sources**:

- [Vitest](https://main.vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [user-event](https://testing-library.com/docs/user-event/intro/)

## Dependency Summary

Production additions:

- `@xyflow/react@^12.11.5` — node-based viewer/editor surface, MIT.
- `ajv@^8.20.0` — shared JSON Schema validation, MIT.
- `elkjs@0.11.1` — compound deterministic layout, EPL-2.0 OR GPL-3.0-or-later; already present
  transitively and must be recorded in dependency/license review when made direct.
- `html-to-image@1.11.11` — tested browser PNG export path, MIT.

Development additions:

- `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`,
  `@testing-library/user-event`, and `@testing-library/jest-dom` for user-facing component tests.

No research questions remain unresolved.
