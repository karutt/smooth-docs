# Contract: Markdown Embedding and Source Ownership

## Fence Recognition

A flow embed is a top-level fenced code block whose first info-string token is exactly
`smooth-flow`.

- Backtick and tilde fences are both recognized.
- The closing fence follows normal Markdown fence-length rules.
- Version 1 visual editing supports only top-level fences. A flow inside a list item or block quote
  produces a diagnostic and remains readable as source text.
- Other code fences, Mermaid blocks, raw HTML, accordions, frontmatter, headings, and asset/link
  rewriting retain their existing behavior.

## Inline Document Form

The fence body is a complete document conforming to
[docs-flow.schema.json](docs-flow.schema.json).

````markdown
```smooth-flow
version: 1
id: parking-start
kind: workflow
title: 駐車場利用開始
direction: right
lanes:
  - id: user
    label: 利用者
  - id: backend
    label: Backend
nodes:
  - id: scan
    type: action
    label: QRコードを読む
    lane: user
  - id: validate
    type: decision
    label: QRコードは有効か
    lane: backend
edges:
  - id: scan-to-validate
    from: scan
    to: validate
    style: normal
stories:
  - id: happy-path
    label: 正常系
    steps:
      - node: scan
      - edge: scan-to-validate
      - node: validate
```
````

Contract rules:

- `id` is the stable source identity for load/save operations and must be unique among inline flows
  in the same Markdown file.
- The rendered page emits a generated embed marker but does not embed raw YAML in HTML attributes.
- Visual save replaces only the YAML body unless the fence delimiter must be lengthened to contain
  newly authored text safely.
- When delimiter length changes, only that one complete fence is replaced; all surrounding bytes
  remain unchanged.

## External Reference Form

The fence body contains an external reference descriptor, not a complete document.

````markdown
```smooth-flow
src: ./flows/parking-start.docs-flow.yml
view: happy-path
height: 560
```
````

Allowed descriptor fields:

| Field | Required | Rules |
|---|---:|---|
| `src` | yes | Relative POSIX path ending in `.docs-flow.yml`. |
| `view` | no | Stable story ID in the referenced document. |
| `height` | no | Integer from 320 through 1,200; defaults to 560. |

The descriptor has `additionalProperties: false`. It cannot include `version`, `id`, `kind`,
`nodes`, `edges`, `lanes`, or `stories`. The referenced file must contain one complete document and
cannot reference another file.

## External Path Resolution

Resolution starts from the directory containing the referencing Markdown page.

A reference is rejected when it contains any of the following:

- an absolute path, URL scheme, protocol-relative prefix, query, fragment, NUL, Windows drive, or
  UNC path;
- a path segment equal to `..` after separator normalization;
- an extension other than `.docs-flow.yml`;
- a lexical normalized target outside the active docs root;
- a resolved real path outside the active docs root or a symlink escape;
- during a publish-root build, a target outside the active publish root.

The development server re-runs these checks on every load and immediately before every save.

## Source Lookup for Editing

The browser supplies only:

- the logical page `sourcePath`; and
- the stable flow ID.

The development server re-reads the raw Markdown page and parses its current `smooth-flow` fences.
It derives whether the flow is inline or external and, for an external reference, derives the target
from the current descriptor. A target path supplied directly by a browser is never accepted.

Inline source locations are calculated from the current raw Markdown line offsets. Offsets from
frontmatter-stripped, title-stripped, trimmed, rendered HTML, or previously generated page data are
never used for writes.

## Revision Contract

Every editable flow load returns a `sha256:` revision.

- Inline revision material includes the logical page locator, flow ID, and exact fence body bytes.
- External revision material includes the logical page locator, exact reference fence body, resolved
  logical external locator, and exact external file bytes.
- Revision comparison occurs after acquiring the per-target save queue and after re-reading current
  source.
- A mismatch returns a conflict without writing any file.

## YAML Round-Trip Contract

The writer parses the current YAML as a document tree and reconciles domain items by stable ID.

- Existing retained items reuse their document nodes and key order.
- Reordered items move their document nodes so associated comments move where supported.
- New keys use the schema order; new collections preserve author/editor order.
- Indentation is two spaces for new content; lines are not wrapped solely for formatting.
- Existing LF or CRLF style is preserved; new external files use LF.
- A no-op candidate does not write or change the revision.

Guaranteed preservation:

- all Markdown bytes outside an inline target fence;
- the meaning, IDs, order, and supported fields of the target document;
- retained YAML comments where the document model retains their association.

Not guaranteed inside the edited YAML:

- original quote style;
- insignificant internal whitespace;
- attachment position of trailing comments;
- comments belonging to deleted values.

## Invalid and Incomplete Source

An invalid flow produces a diagnostic containing a stable code, message, and line/column when
available. It must not become an empty block.

- Local preview shows the last valid flow if the mounted component has one, plus current diagnostics.
- Without a last valid flow, preview shows escaped source text and diagnostics.
- Visual save is disabled until the candidate passes structural and semantic validation.
- Unsupported format versions remain readable as source but are not editable.

## Search Contract

The compiled page search text appends normalized text from:

- flow title and description;
- lane labels and descriptions;
- node labels, descriptions, owners, statuses, and risks;
- edge labels;
- story labels and descriptions.

The raw fenced YAML itself is not indexed. IDs and path-only source metadata are not included unless
they also appear as user-facing labels.

## Static Publication Contract

- External `.docs-flow.yml` files are excluded from generic public asset copying.
- Static output contains the validated document, compiled layout, safe view options, search text,
  and safe diagnostics only.
- Static output omits revision hashes, writable locators, external source references, local absolute
  paths, raw YAML, and edit capability flags.
- Local `source` links are omitted unless the author supplied a public `http:` or `https:` URL.
- Viewer, search, story playback, semantic fallback, and image export remain available.
