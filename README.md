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
pnpm smooth-docs -- help
```

## Create Docs

```bash
smooth-docs init /path/to/path-a-doc --title "Path A"
smooth-docs init /path/to/path-b-doc --title "Path B" --theme compact
smooth-docs init /path/to/path-c-doc --title "Path C"
```

Each project gets:

```text
smooth-docs.yml
docs/
  index.md
```

Serve any project:

```bash
smooth-docs serve /path/to/path-a-doc
```

Build static output:

```bash
smooth-docs build /path/to/path-a-doc
```

The default output directory is `site/` inside the docs project.

## Config

```yaml
site_name: "Path A"
site_key: docs
docs_dir: docs
theme: default
```

Use a built-in theme:

```yaml
theme: compact
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
  compact/
    theme.yml
    theme.css
```

Theme levels:

- Full theme: provide `src/App.tsx` and `src/styles.css`.
- Extension theme: set `extends: default` in `theme.yml` and provide only `theme.css` or `theme.js`.
- Static assets: put files in `public/`; they are served under `/theme/`.

List available themes:

```bash
smooth-docs themes
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
smooth-docs serve /path/to/path-a-doc
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
