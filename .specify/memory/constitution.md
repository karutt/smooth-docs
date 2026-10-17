<!--
Sync Impact Report
- Version change: unratified scaffold -> 1.0.0
- Modified principles:
  - Placeholder principle 1 -> I. Shared Kit Is the Single Source of Truth
  - Placeholder principle 2 -> II. Markdown Fidelity and Deterministic Output
  - Placeholder principle 3 -> III. Stable Theme and Renderer Contracts
  - Placeholder principle 4 -> IV. Project-Boundary and Path Safety
  - Placeholder principle 5 -> V. Generated-Artifact and Verification Discipline
- Added sections:
  - Architecture and Product Constraints
  - Development Workflow and Quality Gates
- Removed sections: none
- Follow-up TODOs: none
-->
# Smooth Docs Kit Constitution

## Core Principles

### I. Shared Kit Is the Single Source of Truth
The shared CLI, renderer, Markdown pipeline, styles, and built-in themes MUST live in this
repository. A consuming documentation project MUST remain limited to its configuration,
authored documentation and assets, and generated static output. Features MUST NOT require
copying shared renderer code into consuming projects. This separation ensures that one Kit
upgrade can improve every documentation project without creating divergent local forks.

### II. Markdown Fidelity and Deterministic Output
Every Markdown pipeline change MUST preserve supported frontmatter, local assets, rewritten
Markdown links, Mermaid diagrams, syntax highlighting, raw HTML, mathematics, tables, task
lists, and accordion blocks unless an approved specification explicitly introduces a breaking
change. The same source and configuration MUST produce equivalent navigation, routes, and page
content across repeated builds. Invalid source MUST produce an actionable diagnostic or a safe
fallback; it MUST NOT silently disappear from the rendered document.

### III. Stable Theme and Renderer Contracts
Full themes MUST provide their own application and stylesheet entry points. Extension themes
MUST declare inheritance and limit customization to supported CSS, JavaScript, and public-asset
hooks. Shared UI changes MUST use existing semantic tokens, path aliases, utilities, and local UI
primitives where applicable. A renderer change MUST be checked against both a full theme and an
extension theme whenever it changes markup, shared types, CSS variables, or theme assets. These
contracts keep themes independently useful without duplicating the default renderer.

### IV. Project-Boundary and Path Safety
CLI paths MUST be resolved relative to the project directory supplied by the caller. Build,
asset, include, and development write paths MUST be normalized and proven to remain inside their
allowed roots before any filesystem mutation. Development endpoints MUST retain `safeJoin`-style
protections and MUST reject traversal or ambiguous targets. Static builds MUST exclude local-only
editing, file-management, chat, and absolute-path capabilities. Convenience MUST NOT weaken the
boundary between the Kit, authored docs, generated output, and the host filesystem.

### V. Generated-Artifact and Verification Discipline
Contributors MUST edit source files rather than `.generated/`, `dist/`, `site/`, example-site
output, or installed dependencies. Every change MUST run the smallest verification set that
covers its risk, and failures MUST be resolved or reported with the remaining risk. Type-only and
React changes require type checking; Markdown, configuration, and theme-asset changes require
content generation plus type checking; CLI, routing, and build changes require a full build plus
type checking. Visual changes also require local inspection of the basic example.

## Architecture and Product Constraints

- The runtime and build system MUST remain Node.js ESM, Vite, TypeScript, and React compatible.
  New support code MUST use `import` and `export` unless an external dependency requires an
  isolated compatibility boundary.
- Shared data contracts MUST be defined in the common type layer. Generated content and theme
  renderers MUST consume those contracts instead of maintaining parallel untyped shapes.
- The Markdown generator MUST remain responsible for source parsing, safe path rewriting, and
  generation-time transformations. Interactive presentation behavior belongs in the selected
  theme renderer and MUST degrade to understandable content when interaction is unavailable.
- Full-theme and extension-theme resolution MUST remain distinct. Inheritance and public assets
  MUST be resolved through configuration rather than hard-coded theme-specific paths.
- Published output MUST be self-contained static viewer output. Local authoring capabilities
  MUST only be exposed by the development server.
- Added dependencies MUST have a concrete user-facing or maintenance benefit. A proposal MUST
  explain why existing utilities or platform APIs are insufficient when the dependency adds a
  new runtime, parser, renderer, or state-management layer.

## Development Workflow and Quality Gates

1. Changes MUST begin by identifying the owning layer: CLI, configuration, generation, shared
   types, renderer, theme, or post-build routing. Cross-layer changes MUST document the data or
   behavioral contract between those layers.
2. Implementations MUST follow the surrounding file's style and preserve existing path aliases,
   semantic tokens, UI primitives, and ESM conventions.
3. New Markdown syntax or interactive blocks MUST define parsing behavior, invalid-input
   behavior, searchable text behavior, static-build behavior, and theme behavior before they are
   considered complete.
4. Filesystem-writing behavior MUST be reviewed for normalized paths, allowed roots, overwrite
   semantics, and generated-output boundaries before verification.
5. The required verification commands MUST pass before delivery. If an environment prevents a
   command from running, delivery MUST identify the skipped command and the concrete residual
   risk.
6. Reviews MUST reject unexplained duplication, edits to generated artifacts, unsafe path
   handling, silent content loss, and theme-specific coupling in shared layers.

## Governance

This constitution is the highest-priority project governance document. Repository instructions,
feature specifications, plans, and reviews MUST comply with it. When guidance conflicts, the
constitution governs unless it is amended through the procedure below.

Amendments MUST be proposed as an explicit constitution change with a rationale, compatibility
impact, and migration notes for affected code, themes, documentation projects, or contributor
workflows. Approval requires review by a project maintainer. The amendment MUST update the Sync
Impact Report, version, and last-amended date in the same change.

Constitution versions follow semantic versioning. MAJOR changes remove or redefine a principle
in a backward-incompatible way. MINOR changes add a principle or materially expand mandatory
governance. PATCH changes clarify wording without changing obligations. The initial ratified
constitution is version 1.0.0.

Every feature specification, implementation plan, and code review MUST include a constitution
compliance check. Any intentional exception MUST be documented with its scope, owner, rationale,
expiry or removal condition, and migration path. Undocumented exceptions are not permitted.

**Version**: 1.0.0 | **Ratified**: 2026-08-26 | **Last Amended**: 2026-08-26
