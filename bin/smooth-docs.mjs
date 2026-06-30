#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { listThemes, loadSmoothDocsConfig } from "../scripts/config.mjs";

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2] ?? "help";
const args = process.argv.slice(3);

try {
  if (command === "init") {
    await initProject(args);
  } else if (command === "serve" || command === "dev") {
    await serveProject(args);
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
  const configPath = path.join(projectDir, "smooth-docs.yml");
  const indexPath = path.join(docsDir, "index.md");

  await fs.mkdir(docsDir, { recursive: true });
  await writeFileIfMissing(
    configPath,
    [
      `site_name: ${quoteYaml(siteName)}`,
      "site_key: docs",
      "docs_dir: docs",
      `theme: ${quoteYaml(theme)}`,
      "",
    ].join("\n"),
  );
  await writeFileIfMissing(
    indexPath,
    [`# ${siteName}`, "", "Write your documentation here.", ""].join("\n"),
  );

  console.log(`Created Smooth Docs project at ${projectDir}`);
  console.log(`Run: smooth-docs serve ${projectDir}`);
}

async function serveProject(rawArgs) {
  const options = parseArgs(rawArgs);
  const projectDir = path.resolve(options.positionals[0] ?? ".");
  const host = String(options.host ?? "127.0.0.1");
  const port = String(options.port ?? "8100");
  loadSmoothDocsConfig({ kitRoot, projectDir });

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
  smooth-docs init <project-dir> [--title "My Docs"] [--theme default]
  smooth-docs serve [project-dir] [--port 8100]
  smooth-docs build [project-dir] [--out-dir site]
  smooth-docs themes
`);
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
