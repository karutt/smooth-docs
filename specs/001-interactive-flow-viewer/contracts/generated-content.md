# Contract: Generated Content and Theme Rendering

## Page Data Extension

`DocPage` gains an optional flow map keyed by internal embed ID.

```ts
type DocPage = {
  // Existing fields remain unchanged.
  flows?: Record<string, CompiledFlow>;
};
```

Pages without a flow omit `flows`. Existing generated fields and routes remain backward compatible.

## Compiled Flow Shape

```ts
type CompiledFlow = {
  embedId: string;
  document?: FlowDocument;
  view: {
    story?: string;
    height: number;
  };
  layout?: CompiledFlowLayout;
  diagnostics: FlowDiagnostic[];
  fallbackText?: string;
  searchText: string;
  source?: FlowSourceReference;
};
```

Rules:

- `document` and `layout` exist for valid supported flows.
- `fallbackText` exists when valid compiled content cannot be produced. It is escaped text, not HTML.
- `source` exists only in local development generation and never contains a directly writable target
  path.
- The generated document is domain data. It contains no viewport, selection, measured runtime node,
  editor history, or transient playback state.
- Computed positions remain in `layout`; they are not inserted into `document` until explicitly
  saved by the author.

## HTML Marker

Markdown rendering replaces a recognized flow fence with exactly one inert marker:

```html
<div data-docs-flow="flow-embed-id"></div>
```

The ID contains only a generated safe token. Raw YAML, JSON, diagnostics, paths, labels, and source
revisions are not serialized into the attribute.

The article parser extends its discriminated union:

```ts
type ArticleBlock =
  | { type: "html"; html: string }
  | { type: "accordion"; data: DocsAccordionData }
  | { type: "flow"; id: string; data: CompiledFlow };
```

Marker parsing must preserve the existing accordion behavior and the exact order of surrounding
HTML fragments.

## Rendering Ownership

Generation owns:

- fence and external-reference parsing;
- path resolution and publication boundaries;
- restricted YAML and graph validation;
- diagnostics and safe fallback text;
- deterministic missing-position layout;
- docs/source link normalization;
- search-text extraction;
- development-only source metadata;
- removal of external flow definitions from copied public assets.

The selected full theme owns:

- canvas and semantic fallback presentation;
- selection, search, focus, details, story playback, and PNG export;
- local edit controls and transient editor state;
- semantic theme tokens and responsive behavior.

Bundled extension themes inherit the default full-theme implementation and can override flow CSS
variables. A custom full theme receives the shared generated types and data but must implement its
own `flow` article block renderer. If it does not, it must display `fallbackText` or a semantic list;
it must not silently omit the block.

## Lazy Loading Contract

- A page without flow markers does not load the flow viewer/editor chunk.
- The viewer chunk loads when a valid or fallback flow block enters the article render tree.
- Editor-only components are imported only when local development mode is active and the author
  opens Edit Flow.
- Layout code is not shipped to static readers; content generation and the local layout endpoint
  provide geometry.
- A viewer chunk load failure renders the semantic fallback plus a retry action.

## Theme Contract

The default flow styles derive from existing semantic variables, including:

- `--background`, `--foreground`;
- `--card`, `--card-foreground`;
- `--muted`, `--muted-foreground`;
- `--border`, `--ring`;
- `--accent`, `--accent-foreground`;
- `--destructive`, `--destructive-foreground`.

Flow-specific variables may be added as aliases of those semantic tokens, but components cannot
hard-code theme-specific colors. Error and asynchronous meaning also uses labels, icons, or line
patterns so color is not the sole signal.

Reduced-motion preferences disable nonessential edge animation, story transitions, and layout
animation. Focus rings remain visible in every bundled theme.

## Semantic Fallback

Every valid flow can be represented as accessible, non-spatial content:

- title and description;
- ordered lanes with their nodes;
- unassigned nodes;
- edge list with source, target, label, and meaning;
- named stories with ordered steps;
- node details and safe links.

The fallback is available through an explicit view switch and is automatically selected when the
canvas is unavailable or the screen cannot provide the minimum editing workspace. It remains
keyboard navigable and is the form-based editing path in local authoring mode.

## Search Integration

Generation appends each `CompiledFlow.searchText` to the page's existing plain text. Any page search
or command search that uses `DocPage` must include `page.text` in its searchable value. Search result
navigation still opens the owning page; in-page flow search then locates the matching node.

## HMR Update Contract

A successful flow save produces one newly generated `docsDataBySite` payload.

- The save response returns that payload to the initiating client.
- The development server broadcasts the same logical update to every connected HMR client.
- Pages and tabs referencing the same external flow all receive the new compiled data.
- The saved editor instance adopts the returned document and revision as its new base.
- An editor with unrelated unsaved changes does not discard its draft when an HMR update arrives;
  it transitions to conflict/stale status if its source revision changed.

## Static Output Assertions

Static builds must prove that serialized page data contains none of the following:

- `FlowSourceReference` objects or revision hashes;
- writable logical/canonical target paths;
- local absolute filesystem paths;
- raw external `.docs-flow.yml` source;
- editing labels, save URLs, or authoring-only capability flags.

The static bundle may contain the read-only viewer and PNG exporter. Development endpoint code is
Vite server configuration and is not emitted as a callable static route.
