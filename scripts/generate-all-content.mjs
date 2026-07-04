import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadSmoothDocsConfig } from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const config = loadSmoothDocsConfig({ kitRoot: rootDir });
const allGeneratedDir = config.generatedAllDir;
const allPublicDir = path.join(allGeneratedDir, "public", "docs-assets");
const themePublicDir = path.join(allGeneratedDir, "public", "theme");
const allSites = [config.siteKey];
const requestedSites = parseRequestedSites();

for (const site of requestedSites) {
  const result = spawnSync("node", ["scripts/generate-content.mjs", site], {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to generate ${site} content`);
  }
}

const docsDataBySite = {};

for (const site of requestedSites) {
  const generatedPath = path.join(rootDir, ".generated", site, "docs-data.ts");
  const generated = await fs.readFile(generatedPath, "utf8");
  const jsonMatch = generated.match(/export const docsData: DocsData = ([\s\S]*);\n$/);

  if (!jsonMatch) {
    throw new Error(`Unable to parse ${generatedPath}`);
  }

  docsDataBySite[site] = JSON.parse(jsonMatch[1]);
}

await fs.rm(allGeneratedDir, { recursive: true, force: true });
await fs.mkdir(allGeneratedDir, { recursive: true });
await fs.mkdir(allPublicDir, { recursive: true });
await fs.mkdir(themePublicDir, { recursive: true });

for (const site of requestedSites) {
  const sitePublicDir = path.join(rootDir, ".generated", site, "public", "docs-assets");
  const targetDir = path.join(allPublicDir, site);
  await fs.mkdir(targetDir, { recursive: true });
  try {
    await fs.cp(sitePublicDir, targetDir, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await copyThemeAssets(themePublicDir);

const output = `import type { DocsData, SiteKey } from "../../src/types";\n\nexport const docsDataBySite: Record<SiteKey, DocsData> = ${JSON.stringify(
  docsDataBySite,
  null,
  2,
)};\n`;

await fs.writeFile(path.join(allGeneratedDir, "docs-data.ts"), output);

function parseRequestedSites() {
  const rawSites = process.argv.slice(2).join(",") || process.env.SMOOTH_DOCS_SITES || "";
  const sites = rawSites
    .split(",")
    .map((site) => site.trim())
    .filter(Boolean);

  if (sites.length === 0 || sites.includes("all")) {
    return allSites;
  }

  for (const site of sites) {
    if (!allSites.includes(site)) {
      throw new Error(`Unknown docs site: ${site}`);
    }
  }

  return [...new Set(sites)];
}

async function copyThemeAssets(targetDir) {
  if (config.theme.publicDir) {
    await fs.cp(config.theme.publicDir, targetDir, { recursive: true, force: true });
  }

  await copyFileOrEmpty(config.theme.cssFile, path.join(targetDir, "theme.css"));
  await copyFileOrEmpty(config.theme.jsFile, path.join(targetDir, "theme.js"));
}

async function copyFileOrEmpty(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  if (!sourcePath) {
    await fs.writeFile(targetPath, "", "utf8");
    return;
  }

  await fs.copyFile(sourcePath, targetPath);
}
