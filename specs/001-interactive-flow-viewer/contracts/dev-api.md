# Contract: Development Flow API

## Scope

These routes exist only in the local Smooth Docs development server. Static builds do not expose
them. All response bodies use UTF-8 JSON.

Route prefix: `/__smooth-docs/flow`

## Common Request Guards

Every route applies the following before reading or mutating source:

- accept only the documented HTTP method;
- require a `Host` value for request routing;
- for state-changing requests, require `Origin` to match the current scheme and `Host`;
- require `Content-Type: application/json` for JSON bodies;
- reject a request body larger than 1 MiB with `413`;
- reject a YAML source larger than 512 KiB with `413`;
- never accept a canonical filesystem target from the client;
- derive source from an existing logical page `sourcePath` plus stable `flowId`;
- repeat lexical and real-path containment checks before read and immediately before write.

## GET `/__smooth-docs/flow/source`

Loads the freshest editable source when the author opens the editor.

Query parameters:

| Name | Required | Meaning |
|---|---:|---|
| `sourcePath` | yes | Existing logical page source, for example `docs/docs/guide.md`. |
| `flowId` | yes | Stable flow document ID. |

The server reparses the current raw Markdown page, locates the unique top-level flow with this ID,
and derives inline/external ownership.

### Success: `200 OK`

```json
{
  "document": {
    "version": 1,
    "id": "parking-start",
    "kind": "workflow",
    "title": "Parking start",
    "direction": "right",
    "nodes": [
      {
        "id": "start",
        "type": "action",
        "label": "Start"
      }
    ],
    "edges": []
  },
  "source": {
    "kind": "external",
    "pageSourcePath": "docs/docs/guide.md",
    "flowId": "parking-start",
    "reference": "./flows/parking-start.docs-flow.yml",
    "revision": "sha256:0123456789abcdef",
    "editable": true
  },
  "diagnostics": []
}
```

The example revision is abbreviated; real revisions contain the complete SHA-256 hex value.

If source is readable but invalid, the route may return `422` with diagnostics and escaped source
text. It never returns a partially trusted document as editable.

## POST `/__smooth-docs/flow/layout`

Computes an unsaved deterministic layout for a valid draft. It never writes a file and never
changes a revision.

### Request

```json
{
  "document": {
    "version": 1,
    "id": "parking-start",
    "kind": "workflow",
    "title": "Parking start",
    "direction": "right",
    "nodes": [
      {
        "id": "start",
        "type": "action",
        "label": "Start"
      }
    ],
    "edges": []
  },
  "scope": "all"
}
```

`scope` is `all` for an explicit full Auto Layout or `missing` to retain every authored position
and fill only absent positions.

### Success: `200 OK`

```json
{
  "layout": {
    "direction": "right",
    "nodes": {},
    "lanes": {},
    "computedNodeIds": []
  },
  "diagnostics": []
}
```

The editor applies returned positions as one undoable draft command. The response is not considered
saved until the save route succeeds.

## POST `/__smooth-docs/flow/save`

Validates and persists one complete candidate document with optimistic concurrency.

### Request

```json
{
  "sourcePath": "docs/docs/guide.md",
  "flowId": "parking-start",
  "baseRevision": "sha256:0123456789abcdef",
  "document": {
    "version": 1,
    "id": "parking-start",
    "kind": "workflow",
    "title": "Parking start",
    "direction": "right",
    "nodes": [
      {
        "id": "start",
        "type": "action",
        "label": "Start"
      }
    ],
    "edges": []
  }
}
```

Rules:

- `document.id` must equal `flowId` for version 1; visual editing cannot rename stable IDs.
- The server locates the current source from `sourcePath + flowId`; it ignores no current reference
  in favor of stale client metadata.
- `baseRevision` must exactly match the newly computed current revision.
- Structural, semantic, path, and link validation runs before serialization.
- A no-op candidate returns success without writing, but still returns the current revision.

### Success: `200 OK`

```json
{
  "ok": true,
  "sourcePath": "docs/docs/guide.md",
  "flowId": "parking-start",
  "revision": "sha256:fedcba9876543210",
  "document": {
    "version": 1,
    "id": "parking-start",
    "kind": "workflow",
    "title": "Parking start",
    "direction": "right",
    "nodes": [
      {
        "id": "start",
        "type": "action",
        "label": "Start"
      }
    ],
    "edges": []
  },
  "docsDataBySite": {},
  "generatedAt": 1787700000000
}
```

The response's document is the server-normalized saved document. The same logical generated update
is broadcast to all HMR clients after exactly one successful regeneration.

## Conflict: `409 Conflict`

```json
{
  "code": "REVISION_CONFLICT",
  "message": "The flow changed after editing started.",
  "currentRevision": "sha256:current",
  "currentDocument": {},
  "diagnostics": []
}
```

No write occurs. The editor retains its complete draft and presents Reload or Reconcile actions. A
retry is accepted only after the editor obtains the current revision.

## Validation Failure: `422 Unprocessable Entity`

```json
{
  "code": "FLOW_VALIDATION_FAILED",
  "message": "The flow contains invalid references.",
  "diagnostics": [
    {
      "code": "EDGE_TARGET_NOT_FOUND",
      "severity": "error",
      "message": "Edge scan-to-pay refers to missing node pay.",
      "path": "edges[0].to",
      "subjectId": "scan-to-pay"
    }
  ]
}
```

No write occurs. Diagnostic codes are stable test contracts; message wording may improve without a
contract version change.

## Error Status Mapping

| Status | Stable codes | Meaning |
|---:|---|---|
| `400` | `INVALID_REQUEST`, `INVALID_CONTENT_TYPE`, `INVALID_FLOW_ID` | Malformed request before source resolution. |
| `403` | `ORIGIN_REJECTED`, `SOURCE_NOT_EDITABLE`, `PATH_OUTSIDE_DOCS`, `SYMLINK_ESCAPE` | Request or derived source violates authoring boundary. |
| `404` | `PAGE_NOT_FOUND`, `FLOW_NOT_FOUND`, `EXTERNAL_FLOW_NOT_FOUND` | Current source identity no longer resolves. |
| `405` | `METHOD_NOT_ALLOWED` | Unsupported method. |
| `409` | `REVISION_CONFLICT`, `FLOW_ID_AMBIGUOUS` | Current source cannot be safely matched to the base. |
| `413` | `REQUEST_TOO_LARGE`, `FLOW_SOURCE_TOO_LARGE` | Bounded input exceeded. |
| `422` | `YAML_INVALID`, `FLOW_VALIDATION_FAILED`, `UNSUPPORTED_FLOW_VERSION` | Source/candidate is understood but invalid. |
| `500` | `FLOW_INTERNAL_ERROR` | Unexpected failure; no absolute path is returned to the browser. |

Common error shape:

```json
{
  "code": "STABLE_CODE",
  "message": "Human-readable action message.",
  "diagnostics": []
}
```

## Save Transaction Semantics

For each canonical target, the server performs:

1. Enter the in-process per-target queue.
2. Re-read the page and derived external source, if any.
3. Recompute and compare revision.
4. Reparse raw Markdown and YAML; re-derive the exact target.
5. Validate the candidate completely.
6. Reconcile candidate values with the current YAML document tree.
7. Produce target-only new bytes and confirm they differ.
8. Revalidate target/parent real paths and reject symlink escape.
9. Create an exclusive sibling temporary file.
10. Preserve the original file mode, write, sync, and close the temporary file.
11. Rename the temporary file over the target.
12. Clean up the temporary file on every failure path.
13. Generate content once and broadcast/return the update.

The transaction guarantees no partial target content and no stale write within one dev-server
process. Portable filesystems do not provide a complete compare-and-swap across unrelated external
processes; the immediate pre-write revision check minimizes but cannot eliminate that narrow race.
Multi-process collaborative editing is out of scope.

## HMR Delivery

The save operation suppresses duplicate watcher regeneration for its own target and explicitly
publishes one update. Unrelated outside file changes continue through the existing watcher path.

- All tabs/pages that reference a shared external flow receive the saved compiled document.
- A clean editor adopts the new base.
- A dirty editor whose source revision changed becomes stale/conflicted; it never silently discards
  its draft.
- A generation failure after the atomic source write returns an error and leaves source saved; the
  UI keeps its draft/base context and offers Regenerate/Reload rather than claiming rollback.
