# AGENTS.md

## Project Overview

Smooth Docs Kit is a MkDocs-style documentation renderer. This repository owns the shared CLI, Vite/React renderer, Markdown generation pipeline, styles, and built-in themes. Individual docs projects should only own their `smooth-docs.yml`, `docs/`, and generated static output.

## Tech Stack

- Package manager: `pnpm`
- Runtime/build: Node.js ESM, Vite, TypeScript
- UI: React, Tailwind CSS, Radix UI-style primitives, `lucide-react`
- Markdown pipeline: `markdown-it`, `gray-matter`, `beautiful-mermaid`, `highlight.js`
- Config files: `smooth-docs.yml`, `smooth-docs.yaml`, or `smooth-docs.json`

## Important Paths

- `bin/smooth-docs.mjs`: CLI entrypoint for `init`, `run`, `build`, and `themes`.
- `scripts/config.mjs`: loads docs config and resolves theme inheritance/assets.
- `scripts/generate-content.mjs`: converts Markdown and assets into generated docs data.
- `scripts/generate-all-content.mjs`: combines per-site generated data and theme assets.
- `scripts/postbuild.mjs`: writes SPA route files and `404.html` after Vite build.
- `vite.config.ts`: Vite config, content generation plugin, and dev-only docs edit endpoints.
- `src/main.tsx`: React renderer entrypoint.
- `src/types.ts`: shared docs data types.
- `themes/default/src/App.tsx`: primary default theme UI.
- `themes/default/src/components/ui/`: local UI primitives.
- `themes/default/src/styles.css`: default theme styling.
- `themes/*/theme.yml`: theme metadata. Extension themes can set `extends: default`.
- `examples/basic/`: smoke-test docs project used by default scripts.

Do not edit `.generated/`, `dist/`, `site/`, `examples/*/site/`, or `node_modules/` directly. They are generated or installed artifacts.

## Common Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm generate
pnpm typecheck
pnpm smdocs -- help
pnpm smdocs -- themes
```

- `pnpm dev` serves `examples/basic` through the CLI.
- `pnpm build` builds `examples/basic` and runs the postbuild step.
- `pnpm generate` regenerates `.generated/` for `examples/basic`.
- There is currently no configured lint or test runner. Use `pnpm typecheck` and `pnpm build` as the default verification path.

## Development Guidelines

- Follow the surrounding file's style. Most Node/TypeScript support files use 2-space indentation; the default theme UI currently uses 4-space indentation.
- Keep new code ESM-compatible. Use `import`/`export`; avoid CommonJS unless a dependency requires it.
- Prefer existing path aliases:
  - `@/*` -> `themes/default/src/*`
  - `#smooth-docs-theme/*` -> selected theme source
  - `#smooth-docs/types` -> `src/types.ts`
  - `#docs-data` -> `.generated/all/docs-data.ts`
- For UI work, reuse components from `themes/default/src/components/ui/`, `cn` from `themes/default/src/lib/utils.ts`, Tailwind semantic tokens, and `lucide-react` icons.
- For Markdown behavior, update `scripts/generate-content.mjs` and preserve existing support for frontmatter, local assets, rewritten `.md` links, Mermaid, syntax highlighting, raw HTML, and accordion blocks.
- For theme behavior, keep the full-theme vs extension-theme split:
  - Full theme: `src/App.tsx` and `src/styles.css`
  - Extension theme: `extends: default` plus optional `theme.css`, `theme.js`, and `public/`
- For CLI behavior, update `bin/smooth-docs.mjs` and keep docs project paths resolved relative to the caller's provided project directory.
- For dev server write endpoints in `vite.config.ts`, preserve path normalization and `safeJoin`-style protections against writing outside intended docs roots.

## Verification Expectations

Run the smallest useful verification for the change:

- Type-only or UI/React changes: `pnpm typecheck`
- Markdown generation/config/theme asset changes: `pnpm generate` and `pnpm typecheck`
- CLI/build/routing changes: `pnpm build` and `pnpm typecheck`
- Visual theme changes: run `pnpm dev` and inspect `examples/basic`

If you cannot run a relevant command, say so in the final response and explain the remaining risk.
