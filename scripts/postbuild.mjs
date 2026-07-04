import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSmoothDocsConfig } from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const config = loadSmoothDocsConfig({ kitRoot: rootDir });
const generatedPath = path.join(config.generatedAllDir, "docs-data.ts");
const distDir = path.resolve(rootDir, process.argv[2] ?? "dist");

const generated = await fs.readFile(generatedPath, "utf8");
const jsonMatch = generated.match(
  /export const docsDataBySite: Record<SiteKey, DocsData> = ([\s\S]*);\n$/,
);

if (!jsonMatch) {
  throw new Error(`Unable to parse ${generatedPath}`);
}

const docsDataBySite = JSON.parse(jsonMatch[1]);
const indexHtml = await fs.readFile(path.join(distDir, "index.html"), "utf8");
const notFoundHtml = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>404 Not Found | Smooth Docs</title>
    <style>
      :root {
        color-scheme: dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
        background: #09090b;
        color: #fafafa;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }

      main {
        width: min(480px, calc(100vw - 48px));
      }

      h1 {
        margin: 0 0 12px;
        font-size: 32px;
        line-height: 1.1;
      }

      p {
        margin: 0;
        color: #a1a1aa;
        line-height: 1.7;
      }

      a {
        color: #fafafa;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>404 Not Found</h1>
      <p>This page is not available. Open <a href="/${config.siteKey}/">${config.siteName}</a>.</p>
    </main>
  </body>
</html>
`;

await fs.writeFile(path.join(distDir, "index.html"), indexHtml);
await fs.writeFile(path.join(distDir, "404.html"), notFoundHtml);

for (const [site, docsData] of Object.entries(docsDataBySite)) {
  for (const page of docsData.pages) {
    const route = page.url === "/" ? "" : page.url.replace(/^\/|\/$/g, "");
    const targetDir = path.join(distDir, site, route);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, "index.html"), indexHtml);
  }
}
