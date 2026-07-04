import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const defaultSiteKey = "docs";
const currentDir = path.dirname(fileURLToPath(import.meta.url));

export function loadSmoothDocsConfig(options = {}) {
  const kitRoot = path.resolve(options.kitRoot ?? path.resolve(currentDir, ".."));
  const projectDir = path.resolve(
    options.projectDir ?? process.env.SMOOTH_DOCS_PROJECT_DIR ?? kitRoot,
  );
  const configPath = findConfigPath(projectDir);
  const rawConfig = configPath ? readConfigFile(configPath) : {};
  const docsDir = path.resolve(projectDir, rawConfig.docs_dir ?? rawConfig.docsDir ?? "docs");
  const siteKey = normalizeSiteKey(rawConfig.site_key ?? rawConfig.siteKey ?? defaultSiteKey);
  const siteName = String(rawConfig.site_name ?? rawConfig.siteName ?? path.basename(projectDir));
  const devPort = normalizeDevPort(rawConfig.dev_port ?? rawConfig.devPort ?? rawConfig.port);
  const themeConfig = normalizeThemeConfig(rawConfig.theme);
  const theme = resolveTheme({ kitRoot, projectDir, themeConfig });

  // Namespace the aggregated ".generated/all" output by site_key so that two
  // projects served from the same kit checkout can never overwrite each other's
  // generated content (they resolve to distinct directories).
  const generatedAllDir = path.join(kitRoot, ".generated", "all", siteKey);

  return {
    kitRoot,
    projectDir,
    configPath,
    docsDir,
    siteKey,
    siteName,
    devPort,
    generatedAllDir,
    theme,
  };
}

export function findConfigPath(projectDir) {
  for (const fileName of ["smooth-docs.yml", "smooth-docs.yaml", "smooth-docs.json"]) {
    const candidate = path.join(projectDir, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

export function listThemes(kitRoot) {
  const themesDir = path.join(kitRoot, "themes");
  if (!fs.existsSync(themesDir)) return [];

  return fs
    .readdirSync(themesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const themeRoot = path.join(themesDir, entry.name);
      const metadata = readThemeMetadata(themeRoot);
      return {
        name: entry.name,
        root: themeRoot,
        title: metadata.title ?? titleCase(entry.name),
        extends: metadata.extends,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readConfigFile(configPath) {
  const source = fs.readFileSync(configPath, "utf8");
  if (configPath.endsWith(".json")) return JSON.parse(source);
  return YAML.parse(source) ?? {};
}

function normalizeThemeConfig(theme) {
  if (!theme) return { name: "default" };
  if (typeof theme === "string") return { name: theme };
  if (typeof theme === "object") return theme;
  throw new Error("theme must be a string or object");
}

function resolveTheme({ kitRoot, projectDir, themeConfig }) {
  const themeRoot = themeConfig.path
    ? path.resolve(projectDir, String(themeConfig.path))
    : path.join(kitRoot, "themes", String(themeConfig.name ?? "default"));

  if (!fs.existsSync(themeRoot)) {
    throw new Error(`Theme not found: ${themeRoot}`);
  }

  const metadata = readThemeMetadata(themeRoot);
  const inheritedTheme =
    metadata.extends || themeConfig.extends
      ? resolveTheme({
          kitRoot,
          projectDir,
          themeConfig: { name: metadata.extends ?? themeConfig.extends },
        })
      : null;
  const sourceDir = fs.existsSync(path.join(themeRoot, "src", "App.tsx"))
    ? path.join(themeRoot, "src")
    : inheritedTheme?.sourceDir ?? path.join(kitRoot, "themes", "default", "src");

  return {
    name: String(themeConfig.name ?? path.basename(themeRoot)),
    root: themeRoot,
    title: metadata.title ?? titleCase(path.basename(themeRoot)),
    sourceDir,
    cssFile: firstExistingPath([
      path.join(themeRoot, "theme.css"),
      inheritedTheme?.cssFile,
    ]),
    jsFile: firstExistingPath([
      path.join(themeRoot, "theme.js"),
      inheritedTheme?.jsFile,
    ]),
    publicDir: firstExistingPath([path.join(themeRoot, "public")]),
    extends: metadata.extends ?? themeConfig.extends,
  };
}

function readThemeMetadata(themeRoot) {
  for (const fileName of ["theme.yml", "theme.yaml", "theme.json"]) {
    const filePath = path.join(themeRoot, fileName);
    if (!fs.existsSync(filePath)) continue;
    return readConfigFile(filePath);
  }

  return {};
}

function firstExistingPath(paths) {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function normalizeDevPort(value) {
  if (value === undefined || value === null || value === "") return 8100;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid dev_port: ${value}`);
  }
  return port;
}

function normalizeSiteKey(value) {
  const siteKey = String(value).trim() || defaultSiteKey;
  if (!/^[a-z][a-z0-9_-]*$/i.test(siteKey)) {
    throw new Error(`Invalid site_key: ${siteKey}`);
  }

  return siteKey;
}

function titleCase(value) {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
