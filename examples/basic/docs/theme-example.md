# Theme Example

Change the theme in `smooth-docs.yml`:

```yaml
theme: compact
```

For a Linear-inspired theme:

```yaml
theme: linear
```

Or point at a local theme directory:

```yaml
theme:
  path: ../my-theme
```

A theme can provide a full React UI under `src/`, or it can extend another theme and only provide `theme.css` and `theme.js`.
