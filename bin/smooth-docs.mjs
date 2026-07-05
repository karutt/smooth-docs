#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_NAV_IGNORE_PATTERNS,
  listThemes,
  loadSmoothDocsConfig,
} from "../scripts/config.mjs";

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliName = "smdocs";
const cliArgs = process.argv.slice(2);
if (cliArgs[0] === "--") cliArgs.shift();
const command = cliArgs[0] ?? "help";
const args = cliArgs.slice(1);

try {
  if (command === "init") {
    await initProject(args);
  } else if (command === "run" || command === "serve" || command === "dev") {
    await runProject(args);
  } else if (command === "build") {
    await buildProject(args);
  } else if (command === "themes") {
    printThemes();
  } else if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function initProject(rawArgs) {
  const options = parseArgs(rawArgs);
  const projectDir = path.resolve(options.positionals[0] ?? ".");
  const siteName = String(options.title ?? options.name ?? path.basename(projectDir));
  const theme = String(options.theme ?? "default");
  const docsDir = path.join(projectDir, "docs");
  const inboxDir = path.join(docsDir, "inbox");
  const assetsDir = path.join(docsDir, "assets");
  const configPath = path.join(projectDir, "smooth-docs.yml");
  const indexPath = path.join(docsDir, "index.md");
  const previewAssetPath = path.join(assetsDir, "linear-preview.svg");

  await fs.mkdir(inboxDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
  await writeFileIfMissing(
    configPath,
    [
      `site_name: ${quoteYaml(siteName)}`,
      "site_key: docs",
      "docs_dir: docs",
      `theme: ${quoteYaml(theme)}`,
      "nav:",
      "  ignore:",
      ...DEFAULT_NAV_IGNORE_PATTERNS.map((pattern) => `    - ${quoteYaml(pattern)}`),
      "",
    ].join("\n"),
  );
  await writeFileIfMissing(
    indexPath,
    blockPreviewMarkdown(),
  );
  await writeFileIfMissing(
    previewAssetPath,
    linearPreviewSvg(),
  );

  console.log(`Created Smooth Docs project at ${projectDir}`);
  console.log(`Run: ${cliName} run ${projectDir}`);
}

async function runProject(rawArgs) {
  const options = parseArgs(rawArgs);
  const projectDir = path.resolve(options.positionals[0] ?? ".");
  const host = String(options.host ?? "127.0.0.1");
  const config = loadSmoothDocsConfig({ kitRoot, projectDir });
  // Default to the project's configured dev_port (falls back to 8100) so that
  // distinct projects don't all contend for the same port.
  const port = String(options.port ?? config.devPort);

  await runNode([viteBinPath(), "--host", host, "--port", port], {
    SMOOTH_DOCS_PROJECT_DIR: projectDir,
  });
}

async function buildProject(rawArgs) {
  const options = parseArgs(rawArgs);
  const projectDir = path.resolve(options.positionals[0] ?? ".");
  const config = loadSmoothDocsConfig({ kitRoot, projectDir });
  const outDir = path.resolve(projectDir, String(options.outDir ?? options.out ?? "site"));

  await runNode([viteBinPath(), "build", "--outDir", outDir, "--emptyOutDir"], {
    SMOOTH_DOCS_PROJECT_DIR: projectDir,
  });
  await runNode([path.join(kitRoot, "scripts", "postbuild.mjs"), outDir], {
    SMOOTH_DOCS_PROJECT_DIR: projectDir,
  });

  console.log(`Built ${config.siteName} to ${outDir}`);
}

function printThemes() {
  const themes = listThemes(kitRoot);
  if (themes.length === 0) {
    console.log("No themes found.");
    return;
  }

  for (const theme of themes) {
    const suffix = theme.extends ? ` extends ${theme.extends}` : "";
    console.log(`${theme.name} - ${theme.title}${suffix}`);
  }
}

function printHelp() {
  console.log(`Smooth Docs Kit

Usage:
  ${cliName} init <project-dir> [--title "My Docs"] [--theme default]
  ${cliName} run [project-dir] [--port 8100]
  ${cliName} build [project-dir] [--out-dir site]
  ${cliName} themes

Aliases:
  ${cliName} serve -> ${cliName} run
  ${cliName} dev   -> ${cliName} run
`);
}

function blockPreviewMarkdown() {
  return [
    "# Block Preview",
    "",
    "This page enumerates the common Smooth Docs display blocks so the Linear theme can be checked in one place. It should feel compact, dark, quiet, and product-focused.",
    "",
    "## Text",
    "",
    "Linear-like prose should keep a restrained rhythm. This paragraph includes **strong text**, _emphasis_, `inline code`, [a link](https://linear.app/docs), and keyboard hints like <kbd>⌘</kbd><kbd>K</kbd>.",
    "",
    "Use short paragraphs to verify spacing between body copy, links, and inline code without introducing oversized gaps.",
    "",
    "---",
    "",
    "## Headings",
    "",
    "### Level 3 Heading",
    "",
    "Text under a level 3 heading should be readable without the heading becoming a hero.",
    "",
    "#### Level 4 Heading",
    "",
    "Level 4 headings should remain compact and useful for dense docs pages.",
    "",
    "## Lists",
    "",
    "- Overview item with a concise line.",
    "- Another item that wraps to a second line so line height, bullet alignment, and paragraph rhythm can be checked against the Linear theme.",
    "- Nested structure:",
    "    - Child item one.",
    "    - Child item two with `inline code`.",
    "",
    "1. First ordered item.",
    "2. Second ordered item.",
    "3. Third ordered item with a nested list:",
    "    1. Nested ordered item.",
    "    2. Another nested item.",
    "",
    "- Mixed normal list item.",
    "- Mixed normal list item with enough copy to verify that loose-list paragraph wrappers do not create excessive vertical spacing.",
    "",
    "- [ ] Unchecked task item",
    "- [x] Checked task item",
    "",
    "## Quote",
    "",
    "> Product work benefits from interfaces that stay calm under pressure. A docs theme should preserve focus while still making structure easy to scan.",
    "",
    "## Callout With Raw HTML",
    "",
    '<div class="preview-callout raycast-callout">',
    "  <strong>Raw HTML block</strong>",
    "  <p>This checks that raw HTML can sit naturally beside Markdown-rendered blocks.</p>",
    "</div>",
    "",
    "## Table",
    "",
    "| Token      | Linear value | Usage                    |",
    "| ---------- | ------------ | ------------------------ |",
    "| Background | `#08090a`    | Page and navigation base |",
    "| Panel      | `#0f1011`    | Code, cards, dialogs     |",
    "| Border     | `#23252a`    | Hairlines and panels     |",
    "| Brand      | `#5e6ad2`    | Primary brand accent     |",
    "| Link       | `#828fff`    | Inline links and focus   |",
    "",
    "## Code",
    "",
    "```ts",
    "type ThemeToken = {",
    "    name: string;",
    "    value: string;",
    '    role: "background" | "foreground" | "accent";',
    "};",
    "",
    "const brand: ThemeToken = {",
    '    name: "brand",',
    '    value: "#5e6ad2",',
    '    role: "accent",',
    "};",
    "```",
    "",
    "```bash",
    "smdocs run ./docs",
    "```",
    "",
    "## Math",
    "",
    "Inline math should sit with text like $E = mc^2$ without changing paragraph rhythm.",
    "",
    "$$",
    "\\int_0^1 x^2\\,dx = \\frac{1}{3}",
    "$$",
    "",
    "## Mermaid",
    "",
    "```mermaid",
    "flowchart LR",
    "  A[Markdown] --> B[Generate content]",
    "  B --> C[Linear theme CSS]",
    "  C --> D[Preview]",
    "```",
    "",
    "## Accordion",
    "",
    "::accordion",
    "::item[Open item]{open}",
    "This item starts open and includes **Markdown** content.",
    "",
    "- Compact list item.",
    "- Another compact list item.",
    "",
    "::",
    "::item[Closed item]",
    "Closed content should use the same prose rhythm once expanded.",
    "",
    "```js",
    'console.log("accordion code block");',
    "```",
    "",
    "::",
    "::",
    "",
    "## Image",
    "",
    "![Linear-style preview panel](./assets/linear-preview.svg)",
    "",
  ].join("\n");
}

function linearPreviewSvg() {
  return `<svg width="960" height="540" viewBox="0 0 960 540" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Linear-style preview panel</title>
  <desc id="desc">A dark product documentation preview panel with navigation, content rows, and chart accents.</desc>
  <defs>
    <clipPath id="linear-preview-chart-clip">
      <rect x="292" y="326" width="248" height="92" rx="14"/>
    </clipPath>
  </defs>
  <rect width="960" height="540" rx="32" fill="#08090A"/>
  <rect x="48" y="44" width="864" height="452" rx="24" fill="#0F1011" stroke="#23252A"/>
  <rect x="80" y="84" width="180" height="372" rx="16" fill="#111317" stroke="#23252A"/>
  <circle cx="112" cy="118" r="10" fill="#5E6AD2"/>
  <rect x="136" y="111" width="78" height="14" rx="7" fill="#E7E8EA"/>
  <rect x="104" y="160" width="116" height="10" rx="5" fill="#828FFF"/>
  <rect x="104" y="192" width="92" height="10" rx="5" fill="#6B6F76"/>
  <rect x="104" y="224" width="128" height="10" rx="5" fill="#6B6F76"/>
  <rect x="104" y="256" width="74" height="10" rx="5" fill="#6B6F76"/>
  <rect x="292" y="84" width="312" height="28" rx="14" fill="#17191E" stroke="#23252A"/>
  <rect x="316" y="93" width="174" height="10" rx="5" fill="#A9ADB5"/>
  <rect x="292" y="144" width="520" height="34" rx="8" fill="#15171B" stroke="#23252A"/>
  <rect x="316" y="156" width="226" height="10" rx="5" fill="#E7E8EA"/>
  <circle cx="778" cy="161" r="7" fill="#5E6AD2"/>
  <rect x="292" y="198" width="520" height="34" rx="8" fill="#15171B" stroke="#23252A"/>
  <rect x="316" y="210" width="284" height="10" rx="5" fill="#A9ADB5"/>
  <circle cx="778" cy="215" r="7" fill="#2B2D33"/>
  <rect x="292" y="252" width="520" height="34" rx="8" fill="#15171B" stroke="#23252A"/>
  <rect x="316" y="264" width="198" height="10" rx="5" fill="#A9ADB5"/>
  <circle cx="778" cy="269" r="7" fill="#2B2D33"/>
  <rect x="292" y="326" width="248" height="92" rx="14" fill="#14161A" stroke="#23252A"/>
  <path d="M318 386C344 354 371 366 394 344C423 332 452 352 474 338C488 330 506 338 516 344" stroke="#5E6AD2" stroke-width="6" stroke-linecap="round" clip-path="url(#linear-preview-chart-clip)"/>
  <rect x="572" y="326" width="240" height="92" rx="14" fill="#14161A" stroke="#23252A"/>
  <rect x="600" y="354" width="68" height="12" rx="6" fill="#E7E8EA"/>
  <rect x="600" y="382" width="148" height="10" rx="5" fill="#6B6F76"/>
  <rect x="600" y="404" width="106" height="10" rx="5" fill="#6B6F76"/>
</svg>
`;
}

function parseArgs(rawArgs) {
  const options = { positionals: [] };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      options.positionals.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const nextValue = rawArgs[index + 1];
    if (inlineValue !== undefined) {
      options[key] = inlineValue;
    } else if (nextValue && !nextValue.startsWith("--")) {
      options[key] = nextValue;
      index += 1;
    } else {
      options[key] = true;
    }
  }

  return options;
}

async function writeFileIfMissing(filePath, content) {
  try {
    await fs.writeFile(filePath, content, { flag: "wx" });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
}

function quoteYaml(value) {
  return JSON.stringify(String(value));
}

function viteBinPath() {
  return path.join(kitRoot, "node_modules", "vite", "bin", "vite.js");
}

function runNode(argsToNode, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argsToNode, {
      cwd: kitRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        ...extraEnv,
      },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed with exit code ${code}`));
    });
  });
}
