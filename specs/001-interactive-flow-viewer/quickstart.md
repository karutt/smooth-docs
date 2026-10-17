# Quickstart: Interactive Flow Viewer and Editor

This guide is the implementation acceptance path for the first editable `smooth-flow` release. Run
it from the repository root after the feature tasks have been implemented. The examples exercise
both the authoring server and the generated static site; they must not require editing generated
files.

Use [the authored schema](contracts/docs-flow.schema.json),
[the Markdown embedding contract](contracts/markdown-embedding.md),
[the development API contract](contracts/dev-api.md), and [the data model](data-model.md) as the
expected source of truth while diagnosing a failed check.

## 1. Prerequisites and automated gates

```bash
pnpm install
pnpm test:flow
pnpm test:flow-ui
pnpm generate
pnpm typecheck
pnpm build
```

Expected results:

- The contract schema and runtime schema are byte-identical and compile in Ajv strict mode.
- Parser, semantic validation, deterministic layout, source round-trip, path containment, API, UI,
  keyboard, and static-output tests pass.
- Generation and build do not modify authored Markdown or `.docs-flow.yml` files.
- A page without a flow does not load the flow viewer/editor chunks.

## 2. Start the authoring server

```bash
pnpm dev
```

Open the URL printed by the CLI (normally `http://127.0.0.1:8100`) and navigate to the interactive
flow example. Keep the terminal visible so generation or validation diagnostics are observable.

The page must show the inline and external flows without a layout jump. Confirm pan, zoom, fit view,
node search, detail inspection, upstream/downstream focus, and story playback. Switching to an
ordinary documentation page must not fetch the flow chunks.

## 3. Edit an inline flow and verify the round trip

1. Copy `examples/basic/docs/interactive-flow.md` to a temporary location outside the repository
   so it can be compared after the exercise.
2. Choose **Edit flow** on the inline example.
3. Add one action node and connect it to an existing node.
4. Move the node, change its label and description, assign its lane, and add it to a story.
5. Undo and redo the property change. Confirm the canvas and the accessible form show the same
   draft.
6. Choose **Save**, wait for the success announcement, and reload the page.

The saved diagram must reproduce the node, edge, position, lane, properties, and story. Compare the
Markdown with the temporary copy: only the selected `smooth-flow` fence body may differ. Frontmatter,
headings, prose, other fences, line endings, and bytes outside the target body must be unchanged.
Existing comments and key order should remain where their YAML items were retained.

Repeat a no-op save. It must not rewrite the file or trigger a content-update cycle.

## 4. Edit a reusable external flow

1. Open two pages that reference `flows/parking-start.docs-flow.yml`.
2. Edit the flow from one page, add a note node, and save.
3. Observe the other page without manually restarting the server.

Only the external flow file may change. Both references must receive the same regenerated document
through one content update, while the external `.docs-flow.yml` source itself must not be served as
a public asset. Discarding a later draft must restore the last saved document without a write.

## 5. Verify conflict and validation behavior

Open the same flow in two browser tabs:

1. Enter edit mode in both tabs.
2. Save a label change in the first tab.
3. Make a different change and save from the second tab.

The second save must return a visible conflict state rather than overwrite the first save. Its draft
must remain available, with the current source revision/document offered for an explicit reload or
manual reconciliation. No partial file may be left behind.

Then try each invalid draft in turn: duplicate node ID, missing edge endpoint, unsafe link scheme,
and more than a configured collection limit. Save must stay disabled or return field-linked
diagnostics; the last valid rendered flow remains visible. A syntactically invalid source file must
show a readable fallback with source location and must not make the rest of the page unusable.

## 6. Verify editing parity and accessibility

Using only the keyboard:

1. Enter and leave edit mode.
2. Search and select a node.
3. Add, edit, move, and delete a node through the linear form/commands.
4. Create and delete an edge by selecting its source and target in the form.
5. Change a lane and story, then undo, redo, discard, and save.

Focus must remain visible, every control must have an accessible name, and status/error/conflict
changes must be announced. Normal, error, and async edges must remain distinguishable without color
alone. With reduced motion enabled, story playback and transitions must avoid non-essential motion.

At a narrow viewport, confirm the linear view is usable without horizontal page scrolling and that
all core edit operations remain available even if the canvas is collapsed.

## 7. Verify themes, export, search, and scale

Check the flow under every bundled theme (`default`, `linear`, `github`, `dracula`, and `raycast`) in
light/dark modes where supported. Nodes, lanes, labels, controls, focus rings, and selected paths
must use semantic tokens and retain readable contrast.

Search for text that exists only in a node label or description. The page must be discoverable from
the command search and the matching node must be discoverable inside the flow. Export the complete
diagram as PNG while zoomed into a small region; the image must contain the whole graph and omit
selection handles, toolbars, and other transient editor UI.

Load the maximum fixture of 32 lanes, 100 nodes, 150 edges, and 32 stories. On the target browser,
record these acceptance timings:

- 95% of measured page loads become interactive within 2 seconds of navigation start.
- Search, selection, pan, and form edits show feedback within 200 milliseconds.
- Auto Layout produces the same ordered coordinates from the same input on repeated runs.

## 8. Verify source and path safety

Use test fixtures—not important repository files—to attempt an external reference with `..`, an
absolute path, a non-`.docs-flow.yml` extension, and a symlink escaping the docs root. Each request
must fail without reading or writing the outside target. Repeat with an oversized body and a request
whose content type or origin is not accepted; the server must reject it with the contract status.

Confirm that the save request supplies only the owning page, flow ID, base revision, and candidate
document. Changing a client-side path value must never select a writable server target.

## 9. Verify the static site

After `pnpm build`, serve the generated site using a disposable local static server and open the
flow page. Viewer behavior, search, stories, semantic fallback, themes, and PNG export must work,
but **Edit flow** and all write controls must be absent.

Inspect the built output:

```bash
rg -n "__smooth-docs/flow|baseRevision|sourcePath|\.docs-flow\.yml|/Users/" site
```

The command must find no development endpoint, writable locator, revision, raw external flow source,
or absolute local project path. Invalid unpublished source text must not be embedded as a client-side
parser input.

## Acceptance summary

The feature is ready only when authors can visually edit every supported domain field, safely save
inline and reusable sources, recover from validation and revision conflicts without data loss, and
obtain the same read-only viewing experience from a static build without publishing authoring
capabilities or local metadata.
