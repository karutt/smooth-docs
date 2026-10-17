import path from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export function getCodexAppResourceDirs() {
  if (process.platform !== "darwin") return [];

  const applications = [
    "/Applications/ChatGPT.app",
    "/Applications/Codex.app",
    ...(process.env.HOME
      ? ["ChatGPT.app", "Codex.app"].map((app) => path.join(process.env.HOME!, "Applications", app))
      : []),
  ];

  return applications.flatMap((app) => {
    const resources = path.join(app, "Contents", "Resources");
    return [
      resources,
      path.join(resources, "codex-cli", "bin"),
      path.join(resources, "codex-cli", "CodexCLI.app", "Contents", "MacOS"),
      path.join(resources, "codex-cli", "codex-path"),
    ];
  });
}

export function selectNewestCodexCommand(
  candidates: string[],
  readVersion: (command: string) => string = (command) => {
    const result = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 2000 });
    return result.status === 0 ? result.stdout.trim() : "";
  },
) {
  let selected: { command: string; version: number[]; prerelease: string } | null = null;

  for (const command of new Set(candidates)) {
    const match = readVersion(command).match(/\b(\d+)\.(\d+)\.(\d+)(?:-([^\s]+))?/);
    if (!match) continue;
    const version = match.slice(1, 4).map(Number);
    const prerelease = match[4] ?? "";
    let difference = selected
      ? version.map((part, index) => part - selected!.version[index]).find((part) => part !== 0) ?? 0
      : 1;
    if (difference === 0 && selected) {
      difference = comparePrerelease(prerelease, selected.prerelease);
    }
    if (difference > 0) {
      selected = { command, version, prerelease };
    }
  }

  return selected?.command ?? null;
}

function comparePrerelease(left: string, right: string) {
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index++) {
    const a = leftParts[index];
    const b = rightParts[index];
    if (a === b) continue;
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return Number(a) - Number(b);
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

export function resolveCodexCommand() {
  const configured = process.env.SMOOTH_DOCS_CODEX_BIN || process.env.CODEX_BIN;
  if (configured) return existsSync(configured) ? configured : null;

  const executable = process.platform === "win32" ? "codex.cmd" : "codex";
  const pathDirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const homeDirs = process.env.HOME
    ? [".local/bin", ".codex/bin", ".codex/plugins/.plugin-appserver"].map((dir) =>
        path.join(process.env.HOME!, dir),
      )
    : [];
  const candidates = [...new Set([
    ...pathDirs,
    ...getCodexAppResourceDirs(),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    ...homeDirs,
  ].map((dir) => path.join(dir, executable)))].filter((command) => existsSync(command));

  // A PATH-installed CLI may lag behind the desktop app and expose an old catalog.
  return selectNewestCodexCommand(candidates);
}
