# Theme Example

Change the theme in `smooth-docs.yml`:

```yaml
theme: linear
```

For a GitHub-inspired theme:

```yaml
theme: github
```

Or point at a local theme directory:

```yaml
theme:
  path: ../my-theme
```

A theme can provide a full React UI under `src/`, or it can extend another theme and only provide `theme.css` and `theme.js`.
