# Smooth Docs Kit

Smooth Docs Kit is a MkDocs-style documentation renderer.

One local kit repository owns the renderer, React layout, styles, Markdown pipeline, and themes.
Each docs project owns only `smooth-docs.yml`, `docs/`, and its static output.

When you update the kit or a theme in this repository, every local docs project uses the new common code the next time it is served or built.

## Install

```bash
git clone git@github.com:YOUR_ORG/smooth-docs-kit.git
cd smooth-docs-kit
pnpm install
pnpm link --global
```

If you do not want a global command, run commands through the repository:

```bash
pnpm smdocs -- help
```

## Create Docs

```bash
smdocs init /path/to/path-a-doc --title "Path A"
smdocs init /path/to/path-b-doc --title "Path B" --theme linear
smdocs init /path/to/path-c-doc --title "Path C"
```

Each project gets:

```text
smooth-docs.yml
docs/
  assets/
    linear-preview.svg
  inbox/
  index.md
```

Serve any project:

```bash
smdocs run /path/to/path-a-doc
```

Build static output:

```bash
smdocs build /path/to/path-a-doc
```

The default output directory is `site/` inside the docs project.

Static builds are public-viewer output. Local editing controls, file/folder
management actions, Codex chat, and absolute filesystem path copying are
disabled in the generated site. CSS-only docs themes bundled at build time can
still be switched by readers from the static site.

Use top-level `theme` for local editing and preview. Set `publish.theme` when
the published site should open with a different initial docs theme. For a one-off
build, pass `--theme`:

```bash
smdocs build . --theme linear
```

If a project has a publish root, `build` uses only that folder for static output while
`run` still shows the whole docs tree:

```yaml
docs_dir: docs
publish:
  root: published
  out_dir: site
  theme: linear
```

With this config, `smdocs run .` serves `docs/`, but `smdocs build .` publishes only
`docs/published/` with `linear` as the initial published theme. Use
`smdocs build . --all` to build the full `docs/` tree instead.

## Config

```yaml
site_name: "Path A"
site_key: docs
docs_dir: docs
theme: default
publish:
  root: published
  out_dir: site
  theme: linear
nav:
  ignore:
    - "**/assets/**"
    - "**/images/**"
    - "**/media/**"
    - "**/attachments/**"
```

Use a built-in theme:

```yaml
theme: linear
```

Use a local theme directory:

```yaml
theme:
  path: ../my-smooth-docs-theme
```

## Themes

Built-in themes live in `themes/`.

```text
themes/
  default/
    src/
      App.tsx
      styles.css
    theme.css
    theme.js
    theme.yml
  dracula/
  github/
  linear/
  raycast/
```

Theme levels:

- Full theme: provide `src/App.tsx` and `src/styles.css`.
- Extension theme: set `extends: default` in `theme.yml` and provide only `theme.css` or `theme.js`.
- Static assets: put files in `public/`; they are served under `/theme/`.

List available themes:

```bash
smdocs themes
```

## Updating Common Code

All docs projects point back to this kit at serve/build time. To update common layout, JS, styles, Markdown rendering, or themes:

```bash
cd /path/to/smooth-docs-kit
git pull
pnpm install
```

Then run:

```bash
smdocs run /path/to/path-a-doc
```

If a dev server is already running from this kit, changes to `themes/` and the selected docs project's `docs/` directory trigger a reload.

## Markdown

Put Markdown and assets under `docs/`.

```text
docs/
  index.md
  guides/
    index.md
    setup.md
    images/
      architecture.png
```

Relative links to `.md` files are converted to docs routes:

```md
[Setup](./guides/setup.md)
![Architecture](./guides/images/architecture.png)
```

Supported features include GitHub-style Markdown, Mermaid, syntax highlighting, tables, raw HTML, and accordion blocks.

## Interactive workflows (`smooth-flow`)

Use a `smooth-flow` fence when a diagram needs richer exploration and visual editing than Mermaid.
The authored YAML remains the source of truth; the build validates it, computes deterministic
coordinates, and lazy-loads the React Flow viewer only on pages that contain a workflow.

```yaml
version: 1
id: checkout
kind: workflow
title: Checkout
direction: right
lanes:
  - id: customer
    label: Customer
  - id: api
    label: API
nodes:
  - id: submit
    type: action
    label: Submit order
    lane: customer
  - id: validate
    type: decision
    label: Is the order valid?
    lane: api
edges:
  - id: submit-validate
    from: submit
    to: validate
    label: Request
stories:
  - id: happy-path
    label: Happy path
    steps:
      - node: submit
      - edge: submit-validate
      - node: validate
```

Place that YAML inside a fenced block whose info string is `smooth-flow`. Supported node types are
`action`, `decision`, `service`, `external`, and `note`; edge styles are `normal`, `error`, and
`async`. Lanes, node metadata and links, authored positions, and named story steps are optional.
IDs must be stable lowercase kebab-case values because references and visual edits use them for
round trips.

For a reusable definition, put the full document in a `.docs-flow.yml` file under the published
docs root and reference it relative to the Markdown page:

```yaml
src: ./flows/checkout.docs-flow.yml
view: happy-path
height: 560
```

One external definition can be embedded by multiple pages with different `view` and `height`
options. Source paths that escape the allowed docs root, use another extension, resolve through an
unsafe symlink, or exceed the configured size limits are rejected. Flow source files are not copied
to public assets.

While using `smdocs run`, choose **Edit flow** to change nodes, connections, lanes, properties,
positions, and stories. Undo, redo, discard, validation, conflict recovery, and explicit save are
available. Inline saves replace only the selected fence body; external saves replace only the
derived `.docs-flow.yml` target. The server reparses the owning Markdown and checks a source
revision before every atomic write, so a client-supplied path or stale editor cannot silently
overwrite another source. Editing is intentionally unavailable in `smdocs build` output.

Readers can pan, zoom, search, inspect relationships, focus upstream/downstream paths, play named
stories, switch to a keyboard-friendly text view, and export the complete graph as PNG. PNG export
fits authored graph bounds rather than the current viewport and excludes controls, selections, and
editor UI.

The viewer uses `@xyflow/react` (MIT), deterministic layout uses `elkjs` (EPL-2.0), and PNG capture
uses `html-to-image` (MIT). `elkjs` is shipped as an unmodified dependency; distributors should
retain its EPL-2.0 license and notices when redistributing the kit. Layout runs during content
generation so reader output is stable and does not visibly rearrange on page load.
