import path from "node:path";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import {
  listThemes,
  loadSmoothDocsConfig,
  updateSmoothDocsTheme,
} from "./scripts/config.mjs";
import type { AllDocsData } from "./src/types";

const docsConfig = loadSmoothDocsConfig({ kitRoot: __dirname });
const allSites = [docsConfig.siteKey] as const;
type DocsSite = string;

type WatchAction =
  | { type: "content"; refreshThemeStylesheet: boolean }
  | { type: "full-reload" }
  | { type: "ignore" };

type DocsContentUpdatePayload = {
  docsDataBySite: AllDocsData;
  generatedAt: number;
  changedFile?: string;
  refreshThemeStylesheet?: boolean;
};

type DocsThemeOption = {
  name: string;
  title: string;
  extends?: string;
  requiresRestart: boolean;
};

function selectedSites(): DocsSite[] {
  const rawSites = process.env.SMOOTH_DOCS_SITES ?? "";
  const sites = rawSites
    .split(",")
    .map((site) => site.trim())
    .filter(Boolean);

  if (sites.length === 0 || sites.includes("all")) {
    return [...allSites];
  }

  for (const site of sites) {
    if (!allSites.includes(site as DocsSite)) {
      throw new Error(`Unknown docs site: ${site}`);
    }
  }

  return [...new Set(sites as DocsSite[])];
}

function generateDocsContent() {
  const result = spawnSync("node", ["scripts/generate-all-content.mjs", ...selectedSites()], {
    cwd: __dirname,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("Failed to generate docs content");
  }

  return readGeneratedDocsData();
}

function readGeneratedDocsData(): AllDocsData {
  const generatedPath = path.join(docsConfig.generatedAllDir, "docs-data.ts");
  const generated = readFileSync(generatedPath, "utf8");
  const jsonMatch = generated.match(
    /export const docsDataBySite: Record<SiteKey, DocsData> = ([\s\S]*);\n$/,
  );

  if (!jsonMatch) {
    throw new Error(`Unable to parse ${generatedPath}`);
  }

  return JSON.parse(jsonMatch[1]) as AllDocsData;
}

function isWithinPath(root: string, file: string) {
  return file === root || file.startsWith(`${root}${path.sep}`);
}

function isThemeMetadataFile(themeRoot: string, file: string) {
  return (
    isWithinPath(themeRoot, file) &&
    ["theme.yml", "theme.yaml", "theme.json"].includes(path.basename(file))
  );
}

function docsContentPlugin(): Plugin {
  const docsRoot = path.resolve(docsConfig.docsDir);
  const themeRoot = path.resolve(docsConfig.theme.root);
  const themeSourceRoot = path.resolve(docsConfig.theme.sourceDir);
  const themePublicRoot = docsConfig.theme.publicDir
    ? path.resolve(docsConfig.theme.publicDir)
    : null;
  const themeCssFile = docsConfig.theme.cssFile ? path.resolve(docsConfig.theme.cssFile) : null;
  const themeJsFile = docsConfig.theme.jsFile ? path.resolve(docsConfig.theme.jsFile) : null;
  const generatedRoot = path.resolve(__dirname, ".generated");
  const watchedRoots = [docsRoot, themeRoot, themeSourceRoot];

  const isDocsFile = (file: string) =>
    watchedRoots.some((root) => file === root || file.startsWith(`${root}${path.sep}`));
  const isGeneratedFile = (file: string) => isWithinPath(generatedRoot, path.resolve(file));
  const classifyWatchAction = (file: string): WatchAction => {
    const resolved = path.resolve(file);

    if (isWithinPath(docsRoot, resolved)) {
      return { type: "content", refreshThemeStylesheet: false };
    }

    if (themeJsFile && resolved === themeJsFile) {
      return { type: "full-reload" };
    }

    if (themeCssFile && resolved === themeCssFile) {
      return { type: "content", refreshThemeStylesheet: true };
    }

    if (themePublicRoot && isWithinPath(themePublicRoot, resolved)) {
      return { type: "content", refreshThemeStylesheet: true };
    }

    if (isThemeMetadataFile(themeRoot, resolved)) {
      return { type: "full-reload" };
    }

    if (isWithinPath(themeSourceRoot, resolved)) {
      return { type: "ignore" };
    }

    if (isWithinPath(themeRoot, resolved)) {
      return { type: "content", refreshThemeStylesheet: true };
    }

    return { type: "ignore" };
  };

  return {
    name: "smooth-docs-content",
    buildStart() {
      generateDocsContent();
    },
    handleHotUpdate(context) {
      if (isGeneratedFile(context.file)) return [];
    },
    configureServer(server) {
      for (const root of watchedRoots) {
        server.watcher.add(root);
      }

      const silentDocsFiles = new Set<string>();
      let timer: NodeJS.Timeout | undefined;
      let pendingAction: WatchAction = { type: "ignore" };
      let pendingFile: string | undefined;
      const regenerate = (file: string) => {
        if (!isDocsFile(file)) return;
        if (silentDocsFiles.delete(path.resolve(file))) return;
        const action = classifyWatchAction(file);
        if (action.type === "ignore") return;

        clearTimeout(timer);
        pendingFile = file;
        pendingAction =
          pendingAction.type === "full-reload" || action.type === "full-reload"
            ? { type: "full-reload" }
            : {
                type: "content",
                refreshThemeStylesheet:
                  (pendingAction.type === "content" &&
                    pendingAction.refreshThemeStylesheet) ||
                  action.refreshThemeStylesheet,
              };
        timer = setTimeout(() => {
          try {
            const actionToPublish = pendingAction;
            const docsDataBySite = generateDocsContent();
            if (actionToPublish.type === "full-reload") {
              server.ws.send({ type: "full-reload" });
            } else if (actionToPublish.type === "content") {
              server.ws.send("smooth-docs:content-update", {
                docsDataBySite,
                generatedAt: Date.now(),
                changedFile: pendingFile,
                refreshThemeStylesheet: actionToPublish.refreshThemeStylesheet,
              } satisfies DocsContentUpdatePayload);
            }
          } catch (error) {
            server.config.logger.error(String(error));
          } finally {
            pendingAction = { type: "ignore" };
            pendingFile = undefined;
          }
        }, 75);
      };

      server.watcher.on("add", regenerate);
      server.watcher.on("change", regenerate);
      server.watcher.on("unlink", regenerate);

      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/__smooth-docs/")) {
          next();
          return;
        }

        void handleDocsActionRequest(req, res, {
          markSilentDocsFile(file) {
            silentDocsFiles.add(path.resolve(file));
          },
        }).catch((error) => {
          sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
        });
      });
    },
  };
}

async function handleDocsActionRequest(
  req: IncomingMessage,
  res: ServerResponse,
  actions: {
    markSilentDocsFile: (file: string) => void;
  },
) {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/__smooth-docs/folders") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const site = url.searchParams.get("site") ?? docsConfig.siteKey;
    if (!allSites.includes(site as DocsSite)) {
      sendJson(res, 400, { error: `Unknown docs site: ${site}` });
      return;
    }

    const query = normalizeDocsRelativePath(url.searchParams.get("query") ?? "");
    const folders = await listDocsFolders(site as DocsSite, query);
    sendJson(res, 200, { folders });
    return;
  }

  if (url.pathname === "/__smooth-docs/promote-draft") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const sourcePath = typeof body.sourcePath === "string" ? body.sourcePath : "";
    const destinationPath =
      typeof body.destinationPath === "string" ? body.destinationPath : "";
    const result = await promoteDraftMarkdown(sourcePath, destinationPath);
    const docsDataBySite = generateDocsContent();

    sendJson(res, 200, {
      ...result,
      docsDataBySite,
      generatedAt: Date.now(),
    });
    return;
  }

  if (url.pathname === "/__smooth-docs/create-markdown") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const site = typeof body.site === "string" ? body.site : "";
    const filePath = typeof body.filePath === "string" ? body.filePath : "";
    const result = await createMarkdownFile(site, filePath, actions.markSilentDocsFile);
    const docsDataBySite = generateDocsContent();

    sendJson(res, 200, {
      ...result,
      docsDataBySite,
      generatedAt: Date.now(),
    });
    return;
  }

  if (url.pathname === "/__smooth-docs/create-docs-entry") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const site = typeof body.site === "string" ? body.site : docsConfig.siteKey;
    const kind = body.kind === "folder" ? "folder" : "file";
    const folderPath = typeof body.folderPath === "string" ? body.folderPath : "";
    const name = typeof body.name === "string" ? body.name : "";
    const result = await createDocsEntry(site, kind, folderPath, name, actions.markSilentDocsFile);
    const docsDataBySite = generateDocsContent();

    sendJson(res, 200, {
      ...result,
      docsDataBySite,
      generatedAt: Date.now(),
    });
    return;
  }

  if (url.pathname === "/__smooth-docs/save-markdown") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const sourcePath = typeof body.sourcePath === "string" ? body.sourcePath : "";
    const markdown = typeof body.markdown === "string" ? body.markdown : "";
    const result = await saveMarkdownFile(sourcePath, markdown, actions.markSilentDocsFile);

    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/__smooth-docs/regenerate") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const docsDataBySite = generateDocsContent();
    sendJson(res, 200, {
      ok: true,
      docsDataBySite,
      generatedAt: Date.now(),
    });
    return;
  }

  if (url.pathname === "/__smooth-docs/themes") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    sendJson(res, 200, getThemeSettingsPayload());
    return;
  }

  if (url.pathname === "/__smooth-docs/theme") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const themeName = typeof body.theme === "string" ? body.theme.trim() : "";
    const targetTheme = listThemes(__dirname).find((theme) => theme.name === themeName);

    if (!targetTheme) {
      sendJson(res, 400, { error: `Unknown theme: ${themeName}` });
      return;
    }

    updateSmoothDocsTheme(docsConfig.projectDir, themeName);

    const requiresRestart =
      path.resolve(targetTheme.sourceDir) !== path.resolve(docsConfig.theme.sourceDir);

    if (requiresRestart) {
      sendJson(res, 200, {
        ...getThemeSettingsPayload(),
        requiresRestart: true,
      });
      return;
    }

    const docsDataBySite = generateDocsContent();
    sendJson(res, 200, {
      ...getThemeSettingsPayload(),
      docsDataBySite,
      generatedAt: Date.now(),
      refreshThemeStylesheet: true,
      requiresRestart: false,
    });
    return;
  }

  if (url.pathname === "/__smooth-docs/delete-markdown") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const sourcePath = typeof body.sourcePath === "string" ? body.sourcePath : "";
    const result = await deleteMarkdownFile(sourcePath, actions.markSilentDocsFile);
    const docsDataBySite = generateDocsContent();

    sendJson(res, 200, {
      ...result,
      docsDataBySite,
      generatedAt: Date.now(),
    });
    return;
  }

  if (url.pathname === "/__smooth-docs/move-markdown") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const sourcePaths = Array.isArray(body.sourcePaths)
      ? body.sourcePaths.filter((value): value is string => typeof value === "string")
      : [];
    const destinationFolder =
      typeof body.destinationFolder === "string" ? body.destinationFolder : "";
    const result = await moveMarkdownFiles(
      sourcePaths,
      destinationFolder,
      actions.markSilentDocsFile,
    );
    const docsDataBySite = generateDocsContent();

    sendJson(res, 200, {
      ...result,
      docsDataBySite,
      generatedAt: Date.now(),
    });
    return;
  }

  if (url.pathname === "/__smooth-docs/rename-docs-entry") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const site = typeof body.site === "string" ? body.site : docsConfig.siteKey;
    const sourcePath = typeof body.sourcePath === "string" ? body.sourcePath : "";
    const folderPath = typeof body.folderPath === "string" ? body.folderPath : "";
    const newName = typeof body.newName === "string" ? body.newName : "";
    const result = await renameDocsEntry(
      site,
      sourcePath,
      folderPath,
      newName,
      actions.markSilentDocsFile,
    );
    const docsDataBySite = generateDocsContent();

    sendJson(res, 200, {
      ...result,
      docsDataBySite,
      generatedAt: Date.now(),
    });
    return;
  }

  if (url.pathname === "/__smooth-docs/delete-docs-entry") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const site = typeof body.site === "string" ? body.site : docsConfig.siteKey;
    const sourcePath = typeof body.sourcePath === "string" ? body.sourcePath : "";
    const sourcePaths = Array.isArray(body.sourcePaths)
      ? body.sourcePaths.filter((value): value is string => typeof value === "string")
      : [];
    const folderPath = typeof body.folderPath === "string" ? body.folderPath : "";
    const result = await deleteDocsEntry(
      site,
      sourcePath,
      sourcePaths,
      folderPath,
      actions.markSilentDocsFile,
    );
    const docsDataBySite = generateDocsContent();

    sendJson(res, 200, {
      ...result,
      docsDataBySite,
      generatedAt: Date.now(),
    });
    return;
  }

  sendJson(res, 404, { error: "Unknown docs action" });
}

function getThemeSettingsPayload() {
  const currentConfig = loadSmoothDocsConfig({
    kitRoot: __dirname,
    projectDir: docsConfig.projectDir,
  });
  const themes: DocsThemeOption[] = listThemes(__dirname).map((theme) => ({
    name: theme.name,
    title: theme.title,
    extends: theme.extends,
    requiresRestart:
      path.resolve(theme.sourceDir) !== path.resolve(docsConfig.theme.sourceDir),
  }));

  return {
    currentTheme: currentConfig.theme.name,
    themes,
  };
}

async function promoteDraftMarkdown(sourcePath: string, destinationPath: string) {
  if (!sourcePath.startsWith("draft/docs/") || !sourcePath.endsWith(".md")) {
    throw new Error("Current page is not a draft Markdown file");
  }

  const sourceRelativePath = normalizeDocsRelativePath(sourcePath.slice("draft/docs/".length));
  if (!sourceRelativePath.endsWith(".md")) {
    throw new Error("Current page is not a draft Markdown file");
  }

  const destinationRelativePath = normalizeDestinationPath(destinationPath, sourceRelativePath);
  const draftRoot = path.resolve(__dirname, "draft", "docs");
  const publishedRoot = path.resolve(__dirname, "published", "docs");
  const from = safeJoin(draftRoot, sourceRelativePath);
  const to = safeJoin(publishedRoot, destinationRelativePath);

  try {
    const destinationStat = await fs.stat(to);
    if (destinationStat) {
      throw new Error(`Destination already exists: published/docs/${destinationRelativePath}`);
    }
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);

  return {
    sourcePath: `draft/docs/${sourceRelativePath}`,
    destinationPath: `published/docs/${destinationRelativePath}`,
    url: await toMarkdownRoute(publishedRoot, destinationRelativePath),
  };
}

async function createMarkdownFile(
  siteValue: string,
  filePath: string,
  markSilentDocsFile: (file: string) => void,
) {
  if (!allSites.includes(siteValue as DocsSite)) {
    throw new Error(`Unknown docs site: ${siteValue}`);
  }

  const site = siteValue as DocsSite;
  const relativePath = normalizeNewMarkdownPath(filePath);
  const root = docsRootForSite(site);
  const to = safeJoin(root, relativePath);

  try {
    const destinationStat = await fs.stat(to);
    if (destinationStat) {
      throw new Error(`File already exists: ${site}/docs/${relativePath}`);
    }
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.mkdir(path.dirname(to), { recursive: true });
  markSilentDocsFile(to);
  await fs.writeFile(to, `# ${titleFromMarkdownPath(relativePath)}\n`, "utf8");

  return {
    sourcePath: `${site}/docs/${relativePath}`,
    site,
    url: await toMarkdownRoute(root, relativePath),
  };
}

async function createDocsEntry(
  siteValue: string,
  kind: "file" | "folder",
  folderPath: string,
  name: string,
  markSilentDocsFile: (file: string) => void,
) {
  if (!allSites.includes(siteValue as DocsSite)) {
    throw new Error(`Unknown docs site: ${siteValue}`);
  }

  const site = siteValue as DocsSite;
  const root = docsRootForSite(site);
  const folder = normalizeDocsFolderPath(folderPath);

  if (kind === "folder") {
    const folderName = name.trim() ? normalizeDocsEntryName(name) : "untitled";
    const folderRelativePath = await uniqueDocsEntryPath(root, folder, folderName, "");
    const directoryPath = safeJoin(root, folderRelativePath);

    markSilentDocsFile(directoryPath);
    await fs.mkdir(directoryPath, { recursive: true });

    return {
      kind,
      folderPath: `${site}/docs/${folderRelativePath}`,
      sourcePath: `${site}/docs/${folderRelativePath}/`,
      site,
      url: toFolderRoute(folderRelativePath),
    };
  }

  const relativePath = await uniqueDocsEntryPath(root, folder, "untitled", ".md");
  const filePath = safeJoin(root, relativePath);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  markSilentDocsFile(filePath);
  await fs.writeFile(filePath, "# Untitled\n", "utf8");

  return {
    kind,
    sourcePath: `${site}/docs/${relativePath}`,
    site,
    url: await toMarkdownRoute(root, relativePath),
  };
}

async function saveMarkdownFile(
  sourcePath: string,
  markdown: string,
  markSilentDocsFile: (file: string) => void,
) {
  const { relativePath, site } = parseMarkdownSourcePath(sourcePath);
  const root = docsRootForSite(site);
  const filePath = safeJoin(root, relativePath);

  markSilentDocsFile(filePath);
  await fs.writeFile(filePath, markdown, "utf8");

  return {
    sourcePath: `${site}/docs/${relativePath}`,
    site,
  };
}

async function deleteMarkdownFile(
  sourcePath: string,
  markSilentDocsFile: (file: string) => void,
) {
  const { relativePath, site } = parseMarkdownSourcePath(sourcePath);
  const root = docsRootForSite(site);
  const filePath = safeJoin(root, relativePath);

  markSilentDocsFile(filePath);
  await fs.unlink(filePath);

  return {
    sourcePath: `${site}/docs/${relativePath}`,
    site,
  };
}

async function moveMarkdownFiles(
  sourcePaths: string[],
  destinationFolder: string,
  markSilentDocsFile: (file: string) => void,
) {
  if (sourcePaths.length === 0) {
    throw new Error("Select at least one Markdown file to move");
  }

  if (sourcePaths.length > 100) {
    throw new Error("Move at most 100 Markdown files at a time");
  }

  const destinationRelativeFolder = normalizeDocsFolderPath(destinationFolder);
  const parsedSources = sourcePaths.map((sourcePath) => parseMarkdownSourcePath(sourcePath));
  const firstSite = parsedSources[0]?.site;
  if (!firstSite || parsedSources.some((source) => source.site !== firstSite)) {
    throw new Error("Move files from one docs site at a time");
  }

  const root = docsRootForSite(firstSite);
  const uniqueSources = new Map<string, { relativePath: string; site: DocsSite }>();
  for (const source of parsedSources) {
    uniqueSources.set(source.relativePath, source);
  }

  const moves = [...uniqueSources.values()]
    .map((source) => {
      const fileName = path.posix.basename(source.relativePath);
      const destinationRelativePath = destinationRelativeFolder
        ? `${destinationRelativeFolder}/${fileName}`
        : fileName;

      return {
        sourceRelativePath: source.relativePath,
        destinationRelativePath,
        from: safeJoin(root, source.relativePath),
        to: safeJoin(root, destinationRelativePath),
      };
    })
    .filter((move) => move.sourceRelativePath !== move.destinationRelativePath);

  if (moves.length === 0) {
    return {
      site: firstSite,
      moved: [],
    };
  }

  const destinationCounts = new Map<string, number>();
  for (const move of moves) {
    destinationCounts.set(
      move.destinationRelativePath,
      (destinationCounts.get(move.destinationRelativePath) ?? 0) + 1,
    );
  }

  const duplicateDestination = [...destinationCounts.entries()].find(([, count]) => count > 1);
  if (duplicateDestination) {
    throw new Error(`Multiple files would move to ${firstSite}/docs/${duplicateDestination[0]}`);
  }

  for (const move of moves) {
    try {
      const destinationStat = await fs.stat(move.to);
      if (destinationStat) {
        throw new Error(`Destination already exists: ${firstSite}/docs/${move.destinationRelativePath}`);
      }
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  for (const move of moves) {
    await fs.mkdir(path.dirname(move.to), { recursive: true });
    markSilentDocsFile(move.from);
    markSilentDocsFile(move.to);
    await fs.rename(move.from, move.to);
  }

  const moved = [];
  for (const move of moves) {
    moved.push({
      sourcePath: `${firstSite}/docs/${move.sourceRelativePath}`,
      destinationPath: `${firstSite}/docs/${move.destinationRelativePath}`,
      url: await toMarkdownRoute(root, move.destinationRelativePath),
    });
  }

  return {
    site: firstSite,
    moved,
  };
}

async function renameDocsEntry(
  siteValue: string,
  sourcePath: string,
  folderPath: string,
  newName: string,
  markSilentDocsFile: (file: string) => void,
) {
  const cleanName = normalizeDocsEntryName(newName);
  if (!cleanName) {
    throw new Error("New name is required");
  }

  if (sourcePath) {
    const { relativePath, site } = parseMarkdownSourcePath(sourcePath);
    const root = docsRootForSite(site);
    const parentDir = path.posix.dirname(relativePath);
    const targetFileName = cleanName.endsWith(".md") ? cleanName : `${cleanName}.md`;
    const destinationRelativePath =
      parentDir === "." ? targetFileName : `${parentDir}/${targetFileName}`;

    if (destinationRelativePath === relativePath) {
      return {
        site,
        renamed: [],
      };
    }

    const from = safeJoin(root, relativePath);
    const to = safeJoin(root, destinationRelativePath);
    await assertDestinationAvailable(to, `${site}/docs/${destinationRelativePath}`);
    await fs.mkdir(path.dirname(to), { recursive: true });
    markSilentDocsFile(from);
    markSilentDocsFile(to);
    await fs.rename(from, to);

    return {
      site,
      renamed: [
        {
          sourcePath: `${site}/docs/${relativePath}`,
          destinationPath: `${site}/docs/${destinationRelativePath}`,
          url: await toMarkdownRoute(root, destinationRelativePath),
        },
      ],
    };
  }

  const { relativePath, site } = parseDocsFolderPath(siteValue, folderPath);
  if (!relativePath || relativePath === "inbox") {
    throw new Error("This folder cannot be renamed");
  }

  const root = docsRootForSite(site);
  const parentDir = path.posix.dirname(relativePath);
  const destinationRelativePath =
    parentDir === "." ? cleanName : `${parentDir}/${cleanName}`;
  if (destinationRelativePath === relativePath) {
    return {
      site,
      renamed: [],
    };
  }

  const from = safeJoin(root, relativePath);
  const to = safeJoin(root, destinationRelativePath);
  await assertDestinationAvailable(to, `${site}/docs/${destinationRelativePath}`);
  const affectedMarkdown = await collectMarkdownFilesInDirectory(root, relativePath);
  markSilentDocsFile(from);
  markSilentDocsFile(to);
  for (const file of affectedMarkdown) {
    markSilentDocsFile(safeJoin(root, file));
    markSilentDocsFile(safeJoin(root, replacePathPrefix(file, relativePath, destinationRelativePath)));
  }
  await fs.rename(from, to);

  const renamed = [];
  for (const file of affectedMarkdown) {
    const destinationPath = replacePathPrefix(file, relativePath, destinationRelativePath);
    renamed.push({
      sourcePath: `${site}/docs/${file}`,
      destinationPath: `${site}/docs/${destinationPath}`,
      url: await toMarkdownRoute(root, destinationPath),
    });
  }

  return {
    site,
    renamed,
  };
}

async function deleteDocsEntry(
  siteValue: string,
  sourcePath: string,
  sourcePaths: string[],
  folderPath: string,
  markSilentDocsFile: (file: string) => void,
) {
  if (sourcePaths.length > 0) {
    return deleteMarkdownFiles(sourcePaths, markSilentDocsFile);
  }

  if (sourcePath) {
    const { relativePath, site } = parseMarkdownSourcePath(sourcePath);
    const root = docsRootForSite(site);
    const filePath = safeJoin(root, relativePath);

    markSilentDocsFile(filePath);
    await fs.unlink(filePath);

    return {
      site,
      deleted: [`${site}/docs/${relativePath}`],
    };
  }

  const { relativePath, site } = parseDocsFolderPath(siteValue, folderPath);
  if (!relativePath || relativePath === "inbox") {
    throw new Error("This folder cannot be deleted");
  }

  const root = docsRootForSite(site);
  const directory = safeJoin(root, relativePath);
  const affectedMarkdown = await collectMarkdownFilesInDirectory(root, relativePath);

  markSilentDocsFile(directory);
  for (const file of affectedMarkdown) {
    markSilentDocsFile(safeJoin(root, file));
  }
  await fs.rm(directory, { recursive: true, force: false });

  return {
    site,
    deleted: affectedMarkdown.map((file) => `${site}/docs/${file}`),
  };
}

async function deleteMarkdownFiles(
  sourcePaths: string[],
  markSilentDocsFile: (file: string) => void,
) {
  if (sourcePaths.length === 0) {
    throw new Error("Select at least one Markdown file to delete");
  }

  if (sourcePaths.length > 100) {
    throw new Error("Delete at most 100 Markdown files at a time");
  }

  const parsedSources = sourcePaths.map((sourcePath) => parseMarkdownSourcePath(sourcePath));
  const firstSite = parsedSources[0]?.site;
  if (!firstSite || parsedSources.some((source) => source.site !== firstSite)) {
    throw new Error("Delete files from one docs site at a time");
  }

  const root = docsRootForSite(firstSite);
  const uniqueSources = [
    ...new Map(parsedSources.map((source) => [source.relativePath, source])).values(),
  ];

  for (const source of uniqueSources) {
    const filePath = safeJoin(root, source.relativePath);
    markSilentDocsFile(filePath);
    await fs.unlink(filePath);
  }

  return {
    site: firstSite,
    deleted: uniqueSources.map((source) => `${firstSite}/docs/${source.relativePath}`),
  };
}

function parseMarkdownSourcePath(sourcePath: string) {
  const normalized = sourcePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const matchedSite = allSites.find((candidate) =>
    normalized.startsWith(`${candidate}/docs/`),
  );

  if (!matchedSite) {
    throw new Error("Current page is not a Markdown file");
  }

  const site = matchedSite as DocsSite;
  const relativePath = normalizeDocsRelativePath(
    normalized.slice(`${matchedSite}/docs/`.length),
  );

  if (!relativePath.endsWith(".md")) {
    throw new Error("Current page is not a Markdown file");
  }

  return { relativePath, site };
}

function parseDocsFolderPath(siteValue: string, folderPath: string) {
  if (!allSites.includes(siteValue as DocsSite)) {
    throw new Error(`Unknown docs site: ${siteValue}`);
  }

  const site = siteValue as DocsSite;
  const relativePath = normalizeDocsFolderPath(folderPath);

  return { relativePath, site };
}

function normalizeDocsEntryName(value: string) {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.includes("/")) {
    throw new Error("Name must be a single file or folder name");
  }

  if (normalized.startsWith(".")) {
    throw new Error("Names starting with a dot are not supported");
  }

  return normalized;
}

async function assertDestinationAvailable(filePath: string, label: string) {
  try {
    const destinationStat = await fs.stat(filePath);
    if (destinationStat) {
      throw new Error(`Destination already exists: ${label}`);
    }
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function collectMarkdownFilesInDirectory(root: string, relativeDir: string) {
  const directory = safeJoin(root, relativeDir);
  let entries: Dirent[];

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Folder does not exist: ${relativeDir}`);
    }
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const child = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFilesInDirectory(root, child)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(child);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function replacePathPrefix(value: string, fromPrefix: string, toPrefix: string) {
  return value === fromPrefix
    ? toPrefix
    : `${toPrefix}/${value.slice(fromPrefix.length).replace(/^\/+/, "")}`;
}

async function listDocsFolders(site: DocsSite, query: string) {
  const root = docsRootForSite(site);
  const folders = await collectFolders(root);
  const normalizedQuery = query.toLowerCase();

  return folders
    .filter((folder) => folder.toLowerCase().includes(normalizedQuery))
    .slice(0, 24)
    .map((folder) => ({ path: folder }));
}

async function collectFolders(root: string, relativeDir = ""): Promise<string[]> {
  const directory = safeJoin(root, relativeDir);
  let entries: Dirent[];

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }

  const folders: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const child = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    folders.push(child);
    folders.push(...(await collectFolders(root, child)));
  }

  return folders.sort((a, b) => a.localeCompare(b));
}

function normalizeDestinationPath(destinationPath: string, sourceRelativePath: string) {
  const sourceFileName = path.posix.basename(sourceRelativePath);
  let normalized = normalizeDocsRelativePath(destinationPath);

  if (normalized === "") {
    normalized = sourceRelativePath;
  } else if (normalized.endsWith("/")) {
    normalized = `${normalized}${sourceFileName}`;
  } else if (!normalized.endsWith(".md")) {
    normalized = `${normalized}.md`;
  }

  if (!normalized.endsWith(".md")) {
    throw new Error("Destination path must be a Markdown file");
  }

  return normalized;
}

function normalizeDocsFolderPath(value: string) {
  let normalized = normalizeDocsRelativePath(value);

  if (normalized.endsWith(".md")) {
    normalized = path.posix.dirname(normalized);
  }

  if (normalized === ".") return "";

  return normalized.replace(/\/+$/, "");
}

async function uniqueDocsEntryPath(
  root: string,
  folderPath: string,
  baseName: string,
  extension: string,
) {
  for (let index = 1; index < 1000; index += 1) {
    const name = index === 1 ? `${baseName}${extension}` : `${baseName}-${index}${extension}`;
    const relativePath = folderPath ? `${folderPath}/${name}` : name;

    try {
      const destinationStat = await fs.stat(safeJoin(root, relativePath));
      if (destinationStat) continue;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return relativePath;
      throw error;
    }
  }

  throw new Error(`Unable to create a unique ${baseName}${extension} path`);
}

function normalizeDocsRelativePath(value: string) {
  let stripped = value
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  for (const site of allSites) {
    const prefix = `${site}/docs/`;
    if (stripped === `${site}/docs`) {
      stripped = "";
      break;
    }
    if (stripped.startsWith(prefix)) {
      stripped = stripped.slice(prefix.length);
      break;
    }
  }

  const normalized = path.posix.normalize(stripped);

  if (normalized === ".") return "";
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Path cannot escape docs directory");
  }

  return normalized;
}

function docsRootForSite(site: DocsSite) {
  if (!allSites.includes(site)) {
    throw new Error(`Unknown docs site: ${site}`);
  }

  return docsConfig.docsDir;
}

function normalizeNewMarkdownPath(filePath: string) {
  let normalized = normalizeDocsRelativePath(filePath);

  if (!normalized) {
    throw new Error("File path is required");
  }

  if (normalized.endsWith("/")) {
    normalized = `${normalized}index.md`;
  } else if (!normalized.endsWith(".md")) {
    normalized = `${normalized}.md`;
  }

  return normalized;
}

function safeJoin(root: string, relativePath: string) {
  const resolved = path.resolve(root, ...relativePath.split("/").filter(Boolean));

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Path cannot escape docs directory");
  }

  return resolved;
}

function toRoute(relativePath: string) {
  if (relativePath === "index.md") return "/";
  return `/${relativePath.replace(/\.md$/, "")}/`;
}

async function toMarkdownRoute(root: string, relativePath: string) {
  if (relativePath === "index.md") return "/";

  const normalized = relativePath.replace(/\\/g, "/");
  const routePath = normalized.replace(/\.md$/, "");
  const directoryPath = safeJoin(root, routePath);

  try {
    const stats = await fs.stat(directoryPath);
    if (stats.isDirectory()) return `/${normalized}/`;
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  return toRoute(normalized);
}

function toFolderRoute(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/\/+$/, "");
  return normalized ? `/${normalized}/` : "/";
}

function titleFromMarkdownPath(relativePath: string) {
  const fileName = path.posix.basename(relativePath, ".md");
  const titleSource = fileName === "index" ? path.posix.basename(path.posix.dirname(relativePath)) : fileName;
  const title = titleSource.replace(/[_-]+/g, " ").trim();

  return title ? title.replace(/\b\w/g, (char) => char.toUpperCase()) : "New Page";
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export default defineConfig({
  plugins: [docsContentPlugin(), react()],
  resolve: {
    alias: {
      "@": docsConfig.theme.sourceDir,
      "#smooth-docs-theme": docsConfig.theme.sourceDir,
      "#smooth-docs/types": path.resolve(__dirname, "src/types.ts"),
      "#docs-data": path.join(docsConfig.generatedAllDir, "docs-data.ts"),
    },
  },
  publicDir: path.join(docsConfig.generatedAllDir, "public"),
});
