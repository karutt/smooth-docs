import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const defaultSiteKey = "docs";
const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_NAV_IGNORE_PATTERNS = [
  "**/assets/**",
  "**/images/**",
  "**/media/**",
  "**/attachments/**",
];

export function loadSmoothDocsConfig(options = {}) {
  const kitRoot = path.resolve(options.kitRoot ?? path.resolve(currentDir, ".."));
  const projectDir = path.resolve(
    options.projectDir ?? process.env.SMOOTH_DOCS_PROJECT_DIR ?? kitRoot,
  );
  const configPath = findConfigPath(projectDir);
  const rawConfig = configPath ? readConfigFile(configPath) : {};
  const configuredDocsDir = path.resolve(
    projectDir,
    rawConfig.docs_dir ?? rawConfig.docsDir ?? "docs",
  );
  const docsDir = process.env.SMOOTH_DOCS_DOCS_DIR
    ? path.resolve(process.env.SMOOTH_DOCS_DOCS_DIR)
    : configuredDocsDir;
  const siteKey = normalizeSiteKey(rawConfig.site_key ?? rawConfig.siteKey ?? defaultSiteKey);
  const siteName = String(rawConfig.site_name ?? rawConfig.siteName ?? path.basename(projectDir));
  const devPort = normalizeDevPort(
    rawConfig.dev_port ??
      rawConfig.devPort ??
      rawConfig.docs_port ??
      rawConfig.docsPort ??
      rawConfig.port,
  );
  const navIgnore = normalizeNavIgnore(getRawNavIgnore(rawConfig));
  const publish = normalizePublishConfig(rawConfig, {
    docsDir: configuredDocsDir,
    projectDir,
  });
  const themeConfig = getThemeConfigOverride() ?? normalizeThemeConfig(rawConfig.theme);
  const theme = resolveTheme({ kitRoot, projectDir, themeConfig });

  // Namespace generated files by project directory so separate docs projects
  // with the same site_key can be served from one kit checkout at the same time.
  const generatedProjectKey = createGeneratedProjectKey(projectDir);
  const generatedProjectDir = path.join(kitRoot, ".generated", "projects", generatedProjectKey);
  const generatedSiteDir = path.join(generatedProjectDir, siteKey);
  const generatedAllDir = path.join(generatedProjectDir, "all", siteKey);

  return {
    kitRoot,
    projectDir,
    configPath,
    configuredDocsDir,
    docsDir,
    siteKey,
    siteName,
    devPort,
    navIgnore,
    publish,
    generatedSiteDir,
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
      const resolvedTheme = resolveTheme({
        kitRoot,
        projectDir: kitRoot,
        themeConfig: { name: entry.name },
      });
      return {
        name: entry.name,
        root: themeRoot,
        title: metadata.title ?? titleCase(entry.name),
        extends: metadata.extends,
        sourceDir: resolvedTheme.sourceDir,
        cssFile: resolvedTheme.cssFile,
        jsFile: resolvedTheme.jsFile,
        publicDir: resolvedTheme.publicDir,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function updateSmoothDocsTheme(projectDir, themeName) {
  const configPath = findConfigPath(projectDir);

  if (!configPath) {
    const targetPath = path.join(projectDir, "smooth-docs.yml");
    fs.writeFileSync(targetPath, `theme: ${JSON.stringify(String(themeName))}\n`, "utf8");
    return targetPath;
  }

  if (configPath.endsWith(".json")) {
    const config = readConfigFile(configPath);
    config.theme = String(themeName);
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    return configPath;
  }

  const source = fs.readFileSync(configPath, "utf8");
  const document = YAML.parseDocument(source);
  document.set("theme", String(themeName));
  fs.writeFileSync(configPath, String(document), "utf8");

  return configPath;
}

function readConfigFile(configPath) {
  const source = fs.readFileSync(configPath, "utf8");
  if (configPath.endsWith(".json")) return JSON.parse(source);
  return YAML.parse(source) ?? {};
}

function getThemeConfigOverride() {
  if (process.env.SMOOTH_DOCS_THEME_CONFIG) {
    let parsed;

    try {
      parsed = JSON.parse(process.env.SMOOTH_DOCS_THEME_CONFIG);
    } catch {
      throw new Error("SMOOTH_DOCS_THEME_CONFIG must be valid JSON");
    }

    return normalizeThemeConfig(parsed, "SMOOTH_DOCS_THEME_CONFIG");
  }

  if (process.env.SMOOTH_DOCS_THEME) {
    return normalizeThemeConfig(process.env.SMOOTH_DOCS_THEME, "SMOOTH_DOCS_THEME");
  }

  return null;
}

function normalizeThemeConfig(theme, label = "theme") {
  if (!theme) return { name: "default" };
  if (typeof theme === "string") return { name: theme };
  if (typeof theme === "object") return theme;
  throw new Error(`${label} must be a string or object`);
}

function normalizeOptionalThemeConfig(theme, label) {
  if (theme === undefined || theme === null || theme === false || theme === "") return null;
  return normalizeThemeConfig(theme, label);
}

function getRawNavIgnore(rawConfig) {
  if (rawConfig.nav && typeof rawConfig.nav === "object" && "ignore" in rawConfig.nav) {
    return rawConfig.nav.ignore;
  }

  if ("nav_ignore" in rawConfig) return rawConfig.nav_ignore;
  if ("navIgnore" in rawConfig) return rawConfig.navIgnore;
  if ("ignore" in rawConfig) return rawConfig.ignore;

  return DEFAULT_NAV_IGNORE_PATTERNS;
}

function normalizeNavIgnore(value) {
  if (value === undefined || value === null || value === false) return [];
  if (typeof value === "string") return [value.trim()].filter(Boolean);

  if (Array.isArray(value)) {
    return value.map((pattern) => String(pattern).trim()).filter(Boolean);
  }

  throw new Error("nav.ignore must be a string or array of strings");
}

function normalizePublishConfig(rawConfig, { docsDir, projectDir }) {
  const rawPublish =
    rawConfig.publish && typeof rawConfig.publish === "object" ? rawConfig.publish : {};
  const rootValue = rawPublish.root ?? rawPublish.root_dir ?? rawPublish.rootDir;
  const outDirValue =
    rawPublish.out_dir ??
    rawPublish.outDir ??
    rawConfig.out_dir ??
    rawConfig.outDir ??
    "site";
  const themeValue = rawPublish.theme ?? rawPublish.default_theme ?? rawPublish.defaultTheme;

  const outDir = normalizeProjectRelativePath(outDirValue, "publish.out_dir");
  const outDirPath = path.resolve(projectDir, outDir);
  const themeConfig = normalizeOptionalThemeConfig(themeValue, "publish.theme");

  if (rootValue === undefined || rootValue === null || rootValue === false || rootValue === "") {
    return {
      enabled: false,
      outDir,
      outDirPath,
      root: null,
      rootDir: null,
      themeConfig,
    };
  }

  const root = normalizeProjectRelativePath(rootValue, "publish.root");
  const rootDir = path.resolve(docsDir, root);

  if (!isWithinPath(docsDir, rootDir)) {
    throw new Error("publish.root must stay inside docs_dir");
  }

  return {
    enabled: true,
    outDir,
    outDirPath,
    root,
    rootDir,
    themeConfig,
  };
}

function normalizeProjectRelativePath(value, label) {
  const raw = String(value).trim();
  if (!raw) return "";
  if (path.isAbsolute(raw)) {
    throw new Error(`${label} must be relative`);
  }

  const normalized = path.posix.normalize(raw.replace(/\\/g, "/").replace(/^\/+/, ""));
  if (normalized === ".") return "";
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`${label} cannot escape the project`);
  }

  return normalized.replace(/\/+$/, "");
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

function isWithinPath(root, file) {
  const relative = path.relative(root, file);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function createGeneratedProjectKey(projectDir) {
  const slug = toGeneratedPathSegment(path.basename(projectDir)) || "project";
  const hash = crypto.createHash("sha1").update(projectDir).digest("hex").slice(0, 10);
  return `${slug}-${hash}`;
}

function toGeneratedPathSegment(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function titleCase(value) {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
