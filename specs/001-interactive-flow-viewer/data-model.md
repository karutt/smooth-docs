# Data Model: Interactive Flow Viewer and Editor

## Model Boundaries

The feature uses four deliberately separate model layers:

1. **Authored model** — the human-readable `FlowDocument` stored in Markdown or
   `.docs-flow.yml`.
2. **Compiled model** — validated data plus computed geometry and safe embed settings used by a
   rendered page.
3. **Development source model** — writable source locator and revision, available only from the
   local authoring server.
4. **Transient interaction model** — viewport, selection, search, playback, and unsaved edit
   history; never persisted unless an explicit domain edit is saved.

This separation prevents renderer-specific state from becoming part of the authored contract and
prevents local write metadata from entering static output.

## Authored Entities

### FlowDocument

The canonical representation of one workflow.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `version` | integer | yes | Must equal `1` for the initial format. |
| `id` | stable ID | yes | Unique within the owning page/file; not derived again after creation. |
| `kind` | literal | yes | Must be `workflow`. |
| `title` | string | yes | 1–200 characters. |
| `description` | string | no | Maximum 4,000 characters. |
| `direction` | enum | yes | `right` or `down`. |
| `lanes` | Lane array | no | Declared order is display order; maximum 32. |
| `nodes` | FlowNode array | yes | Declared order is stable source order; maximum 100. |
| `edges` | FlowEdge array | yes | Declared order is stable source order; maximum 150. |
| `stories` | FlowStory array | no | Declared order is picker order; maximum 32. |

Validation rules:

- IDs are lowercase ASCII kebab-case, 1–64 characters, and unique within their entity collection.
- Unknown top-level fields are rejected for version 1.
- At least one node is required. Empty edge/lane/story collections are valid.
- The document must not contain executable expressions, HTML fragments intended for execution,
  custom YAML tags, aliases, anchors, or merge keys.

### Lane

Groups nodes by participant, system, team, or boundary.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | stable ID | yes | Unique in `FlowDocument.lanes`. |
| `label` | string | yes | 1–120 characters. |
| `description` | string | no | Maximum 1,000 characters. |

Relationships:

- A lane contains zero or more nodes through `FlowNode.lane` references.
- Deleting a non-empty lane requires the author to move its nodes or confirm that their lane
  references will be removed.
- Array order is the authoritative lane order and is respected by the layout post-pass.

### FlowNode

Represents one meaningful workflow step or annotation.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | stable ID | yes | Unique in `FlowDocument.nodes`. |
| `type` | enum | yes | `action`, `decision`, `service`, `external`, or `note`. |
| `label` | string | yes | 1–120 characters. |
| `description` | string | no | Maximum 2,000 characters. |
| `lane` | Lane ID | no | Must refer to an existing lane. |
| `owner` | string | no | Maximum 120 characters. |
| `status` | string | no | Maximum 64 characters; presented as text, not executable state. |
| `risk` | enum | no | `low`, `medium`, `high`, or `critical`. |
| `links` | FlowLink array | no | Maximum 16. |
| `position` | Position | no | Explicit authored placement. Missing placement is computed. |

Relationships:

- A node may belong to one lane.
- An edge refers to nodes through `from` and `to`.
- A story step may refer to a node.
- Deleting a referenced node requires removal or reassignment of all incident edges and story
  steps in the same editor command so the draft never saves dangling references.

### Position

Explicit authored placement of a node.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `x` | finite number | yes | Between -1,000,000 and 1,000,000. |
| `y` | finite number | yes | Between -1,000,000 and 1,000,000. |

Positions are domain values only after an explicit author move or accepted Auto Layout result.
Viewport, zoom, measured node size, selection, and drag-in-progress values are not positions and are
never persisted.

### FlowLink

Associates a node with supporting documentation or source.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `kind` | enum | yes | `docs`, `source`, or `external`. |
| `href` | string | yes | 1–2,048 characters; semantic validation applies. |
| `label` | string | no | Maximum 120 characters. |

Link rules:

- `docs` accepts safe docs-relative paths and anchors and participates in Markdown route rewriting.
- `external` accepts only `http:` and `https:` URLs.
- `source` may resolve to a local source path in authoring mode; static output omits local absolute
  paths and displays only explicitly public URLs.
- `javascript:`, `data:`, `file:`, protocol-relative URLs, and control characters are rejected.

### FlowEdge

Represents one directed relationship between nodes.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | stable ID | yes | Unique in `FlowDocument.edges`. |
| `from` | Node ID | yes | Must refer to an existing node. |
| `to` | Node ID | yes | Must refer to an existing node. |
| `label` | string | no | Maximum 160 characters. |
| `style` | enum | no | `normal`, `error`, or `async`; defaults to `normal`. |

Cycles, self-edges, parallel edges, disconnected components, and multiple starts/ends are valid.
The visual representation must distinguish edge meaning through text or iconography as well as
color.

### FlowStory

A named ordered path used for focused explanation and playback.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | stable ID | yes | Unique in `FlowDocument.stories`. |
| `label` | string | yes | 1–120 characters. |
| `description` | string | no | Maximum 1,000 characters. |
| `steps` | StoryStep array | yes | 1–300 ordered steps. |

### StoryStep

Exactly one of the following forms:

- `{ node: <Node ID> }`
- `{ edge: <Edge ID> }`

Every reference must exist. Consecutive node and edge steps are not required, allowing a story to
focus on only the authored facts that matter, but playback always follows declared order and never
infers unauthored topology.

## Embedding Entities

### InlineFlowEmbed

A top-level `smooth-flow` fence whose YAML body is a complete `FlowDocument`.

Rules:

- The flow ID must be unique among inline flows in the same Markdown file.
- Editable inline fences cannot be nested under lists or block quotes in version 1.
- The fence opening/closing lines and all content outside the body are source context, not part of
  the `FlowDocument`.

### ExternalFlowEmbed

A top-level `smooth-flow` fence that references one reusable document.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `src` | relative path | yes | POSIX-relative, no query/fragment, and ends in `.docs-flow.yml`. |
| `view` | Story ID | no | Must exist in the referenced document. |
| `height` | integer | no | 320–1,200 CSS pixels; defaults to 560. |

The external file contains only a complete `FlowDocument`; it cannot contain another external
reference. The reference resolves relative to the Markdown page, then must remain within both the
active docs root and, during a publish-root build, the active publish root.

## Compiled Entities

### CompiledFlow

One renderable embed stored in `DocPage.flows` and addressed by an internal `embedId` marker.

| Field | Type | Static output | Purpose |
|---|---|---:|---|
| `embedId` | string | yes | Resolves the HTML marker to this record. |
| `document` | FlowDocument | yes | Validated domain document. |
| `view` | CompiledFlowView | yes | Safe per-embed initial story and height. |
| `layout` | CompiledFlowLayout | yes | Computed geometry for missing authored positions. |
| `diagnostics` | FlowDiagnostic array | yes | Safe syntax/semantic messages; no absolute paths. |
| `searchText` | string | yes | Flattened title, lanes, nodes, edges, and stories. |
| `source` | FlowSourceReference | no | Development-only writable identity and revision. |

If compilation fails, the entry contains diagnostics plus a safe text fallback rather than an empty
marker. A client component may retain the last valid `CompiledFlow` while showing newer diagnostics.

### CompiledFlowView

| Field | Type | Required | Rules |
|---|---|---:|---|
| `story` | Story ID | no | Initial named path. |
| `height` | integer | yes | Validated 320–1,200; default 560. |

### CompiledFlowLayout

| Field | Type | Required | Purpose |
|---|---|---:|---|
| `nodes` | map of node ID to LayoutBox | yes | Position and fixed measured bounds. |
| `lanes` | map of lane ID to LayoutBox | yes | Group bounds after lane normalization. |
| `direction` | enum | yes | Effective `right` or `down`. |
| `computedNodeIds` | Node ID array | yes | Identifies positions computed for display but not authored. |

`LayoutBox` contains finite `x`, `y`, `width`, and `height`. Canonical input order and fixed layout
options make compiled output deterministic. The layout never mutates the authored document unless
the author accepts and saves an Auto Layout draft.

### FlowDiagnostic

| Field | Type | Required | Purpose |
|---|---|---:|---|
| `code` | stable string | yes | Machine-testable failure category. |
| `severity` | enum | yes | `error` or `warning`. |
| `message` | string | yes | Human-readable explanation. |
| `path` | string | no | Domain path such as `nodes[2].lane`. |
| `line` | positive integer | no | Source line when known. |
| `column` | positive integer | no | Source column when known. |
| `subjectId` | stable ID | no | Related flow/lane/node/edge/story. |
| `supportedFixes` | string array | no | Bounded actions the UI can offer without guessing. |

Diagnostics in static output use docs-relative source labels only. Absolute filesystem paths are
never included.

## Development-Only Entities

### FlowSourceReference

Identifies current editable source without allowing the client to select the write target.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `kind` | enum | yes | `inline` or `external`. |
| `pageSourcePath` | logical source path | yes | Existing site/docs-prefixed page path. |
| `flowId` | stable ID | yes | Server reparses page and finds this flow. |
| `reference` | string | external only | Authored relative `src`; informational, never trusted as a direct target. |
| `revision` | string | yes | `sha256:` followed by lowercase hex. |
| `editable` | boolean | yes | False when source is invalid, unsupported, or outside allowed roots. |

Revision material:

- Inline: normalized logical page locator, flow ID, and exact current fence body bytes.
- External: normalized logical page locator, exact current reference fence body, resolved logical
  external locator, and exact external file bytes.

No revision field is stored in YAML. Source is re-read and revision is rechecked immediately before
write.

### FlowEditorSession

Transient local state for one editor instance.

| Field | Type | Purpose |
|---|---|---|
| `status` | EditorStatus | Controls UI and allowed transitions. |
| `baseDocument` | FlowDocument | Last server-confirmed source. |
| `draftDocument` | FlowDocument | Current editable domain state. |
| `baseRevision` | string | Optimistic concurrency token. |
| `undo` | FlowDocument array | Prior domain states, maximum 100. |
| `redo` | FlowDocument array | Reverted domain states, maximum 100. |
| `diagnostics` | FlowDiagnostic array | Current draft/server failures. |
| `conflict` | ConflictSnapshot | Current server document/revision after a 409. |

Viewport-only operations do not create undo entries. One logical action, such as deleting a node
and its dependent references, creates one undo entry.

### FlowViewState

Transient reader state:

- viewport and zoom;
- selected node/edge;
- search query and match cursor;
- upstream/downstream focus mode;
- selected story and playback index;
- details/fallback panel visibility.

It is reset or restored independently from the `FlowDocument` and is excluded from save requests and
image export unless explicitly part of the authored view contract.

## State Transitions

### Editor Session

```text
closed
  -> loading
loading
  -> clean       source fetched, parsed, and revision captured
  -> error       source unavailable or uneditable
clean
  -> dirty       first domain command
  -> closed      close without edits
dirty
  -> dirty       edit, undo, redo, or accepted auto-layout
  -> clean       discard restores base document
  -> saving      explicit save
  -> closed      explicit discard then close
saving
  -> clean       save succeeds; response becomes new base and revision
  -> conflict    revision mismatch; draft and server snapshot both retained
  -> dirty       validation or recoverable transport error; draft retained
conflict
  -> loading     reload server source and discard draft
  -> dirty       author manually reconciles into a new draft
  -> saving      retry only after rebasing onto current revision
error
  -> loading     retry source load
  -> closed
```

Closing or navigating away from `dirty`, `saving`, or `conflict` requires confirmation. A failed
save never clears the draft or history.

### Story Playback

```text
idle -> playing -> paused -> playing
playing -> complete
playing|paused|complete -> idle
```

Playback changes only `FlowViewState`. Editing a story stops playback before changing its steps.

## Validation Sequence

1. Enforce request/source byte limits.
2. Parse one restricted YAML 1.2 document and collect line/column diagnostics.
3. Distinguish complete document from external reference; reject mixed shapes.
4. Validate complete document against JSON Schema.
5. Validate IDs and cross-entity graph references.
6. Validate links and source/embed path rules.
7. Validate view story and display bounds.
8. Resolve external paths lexically and by real path.
9. Compute or verify layout geometry.
10. Emit compiled data or an explicit diagnostic fallback.

The save endpoint repeats steps 1–8 against the submitted candidate and current source before any
write. Generated content and the editor therefore share the same authoritative validation behavior.
