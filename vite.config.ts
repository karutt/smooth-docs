import path from "node:path";
import { EventEmitter } from "node:events";
import * as readline from "node:readline";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
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
import { getCodexAppResourceDirs, resolveCodexCommand } from "./scripts/codex-command";
import {
  CodexMessageStream,
  extractCodexThreadMessages,
  type CodexChatMessage,
  type CodexChatMessageUpdate,
} from "./src/codex-chat";

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

type GeneratedDocsContent = {
  docsDataBySite: AllDocsData;
  generatedAt: number;
};

type DocsThemeOption = {
  name: string;
  title: string;
  extends?: string;
  requiresRestart: boolean;
};

type CodexJsonRpcMessage = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: {
    code?: number;
    message?: string;
  };
};

type CodexChatEvent =
  | { type: "status"; status: CodexChatStatus }
  | ({ type: "message" } & CodexChatMessageUpdate)
  | { type: "done"; status: CodexChatStatus }
  | { type: "error"; message: string; status: CodexChatStatus };

type CodexChatStatus = {
  available: boolean;
  running: boolean;
  threadId: string | null;
  lastError: string;
  selectedEffort: string | null;
  selectedModel: string | null;
};

type CodexSessionResumeResult = {
  status: CodexChatStatus;
  messages: CodexChatMessage[];
};

type CodexChatMessageRequest = {
  text: string;
  contextBlocks?: Array<{
    label?: string;
    markdown?: string;
    sourcePath?: string;
  }>;
  page?: {
    title?: string;
    url?: string;
    sourcePath?: string;
    site?: string;
  };
  selection?: string;
};

type CodexModelOption = {
  id: string;
  model: string;
  displayName: string;
  description: string;
  defaultEffort: string | null;
  effortOptions: Array<{
    value: string;
    description: string;
  }>;
  isDefault: boolean;
};

type CodexSessionSummary = {
  id: string;
  name: string;
  preview: string;
  cwd: string;
  modelProvider: string;
  updatedAt: number;
  status: string;
};

const CODEX_SESSION_SOURCE_KINDS = ["appServer", "cli", "vscode", "exec", "unknown"];

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

async function generateDocsContentAsync() {
  await runNodeScript(["scripts/generate-all-content.mjs", ...selectedSites()]);
  return readGeneratedDocsData();
}

function runNodeScript(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("node", args, {
      cwd: __dirname,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: node ${args.join(" ")}`));
      }
    });
  });
}

function createDocsContentGenerator() {
  let pending: Promise<GeneratedDocsContent> | null = null;

  return () => {
    if (!pending) {
      pending = Promise.resolve()
        .then(async () => ({
          docsDataBySite: await generateDocsContentAsync(),
          generatedAt: Date.now(),
        }))
        .finally(() => {
          pending = null;
        });
    }

    return pending;
  };
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

      const generateDocsContentForServer = createDocsContentGenerator();
      const folderCache = new Map<DocsSite, Promise<string[]>>();
      const silentDocsFiles = new Set<string>();
      let timer: NodeJS.Timeout | undefined;
      let pendingAction: WatchAction = { type: "ignore" };
      let pendingFile: string | undefined;
      const readDocsFolders = (site: DocsSite) => {
        const cached = folderCache.get(site);
        if (cached) return cached;

        const folders = collectFolders(docsRootForSite(site)).catch((error) => {
          folderCache.delete(site);
          throw error;
        });
        folderCache.set(site, folders);
        return folders;
      };
      const invalidateDocsFolderCache = (site?: string) => {
        if (site && allSites.includes(site as DocsSite)) {
          folderCache.delete(site as DocsSite);
          return;
        }

        folderCache.clear();
      };
      const regenerate = (file: string) => {
        if (!isDocsFile(file)) return;
        if (silentDocsFiles.delete(path.resolve(file))) return;
        const action = classifyWatchAction(file);
        if (action.type === "ignore") return;

        invalidateDocsFolderCache();
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
          void (async () => {
            try {
              const actionToPublish = pendingAction;
              const content = await generateDocsContentForServer();
              if (actionToPublish.type === "full-reload") {
                server.ws.send({ type: "full-reload" });
              } else if (actionToPublish.type === "content") {
                server.ws.send("smooth-docs:content-update", {
                  docsDataBySite: content.docsDataBySite,
                  generatedAt: content.generatedAt,
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
          })();
        }, 75);
      };

      server.watcher.on("add", regenerate);
      server.watcher.on("change", regenerate);
      server.watcher.on("unlink", regenerate);

      server.middlewares.use((req, res, next) => {
        void serveGeneratedPublicFile(req, res)
          .then((served) => {
            if (!served) next();
          })
          .catch(next);
      });

      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/__smooth-docs/")) {
          next();
          return;
        }

        void handleDocsActionRequest(req, res, {
          generateDocsContent: generateDocsContentForServer,
          invalidateDocsFolderCache,
          listDocsFolders: readDocsFolders,
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

async function serveGeneratedPublicFile(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const relativePath = generatedPublicRelativePath(url.pathname);
  if (!relativePath) return false;

  const publicRoot = path.join(docsConfig.generatedAllDir, "public");
  const filePath = safeJoin(publicRoot, relativePath);

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      sendPlainText(res, 404, "Generated asset not found");
      return true;
    }

    const body = await fs.readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", contentTypeForPath(filePath));
    res.setHeader("Content-Length", String(body.byteLength));
    res.end(body);
    return true;
  } catch (error) {
    if (isNodeError(error) && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      sendPlainText(res, 404, "Generated asset not found");
      return true;
    }
    throw error;
  }
}

function generatedPublicRelativePath(pathname: string) {
  const decodedPathname = decodeUrlPathname(pathname);
  if (decodedPathname.startsWith("/theme/")) return decodedPathname.slice(1);
  if (decodedPathname.startsWith("/docs-assets/")) return decodedPathname.slice(1);
  return "";
}

function decodeUrlPathname(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    throw new Error(`Invalid URL path: ${pathname}`);
  }
}

class CodexChatBridge {
  private messageStream = new CodexMessageStream();
  private activeTurnId: string | null = null;
  private child: ChildProcessWithoutNullStreams | null = null;
  private events = new EventEmitter();
  private initialized = false;
  private lastError = "";
  private selectedEffort: string | null = null;
  private selectedModel: string | null = null;
  private nextRequestId = 1;
  private pendingRequests = new Map<
    number,
    {
      reject: (error: Error) => void;
      resolve: (value: Record<string, unknown>) => void;
      timer: NodeJS.Timeout;
    }
  >();
  private startPromise: Promise<void> | null = null;
  private stderrTail = "";
  private suppressNextCloseError = false;
  private threadId: string | null = null;

  constructor(
    private options: {
      cwd: string;
      serviceName: string;
    },
  ) {}

  getStatus(): CodexChatStatus {
    return {
      available: this.child !== null || !this.lastError,
      running: this.activeTurnId !== null,
      threadId: this.threadId,
      lastError: this.lastError,
      selectedEffort: this.selectedEffort,
      selectedModel: this.selectedModel,
    };
  }

  onEvent(listener: (event: CodexChatEvent) => void) {
    this.events.on("event", listener);
    return () => this.events.off("event", listener);
  }

  async sendMessage(request: CodexChatMessageRequest) {
    const text = request.text.trim();
    if (!text) {
      throw new Error("Message is required");
    }

    if (this.activeTurnId) {
      throw new Error("Codex is still working on the previous message");
    }

    await this.ensureReady();

    if (!this.threadId) {
      throw new Error("Codex thread is not ready");
    }

    const params: Record<string, unknown> = {
      threadId: this.threadId,
      summary: "auto",
      input: [
        {
          type: "text",
          text: buildCodexChatPrompt(request),
        },
      ],
    };

    if (this.selectedModel) {
      params.model = this.selectedModel;
    }

    if (this.selectedEffort) {
      params.effort = this.selectedEffort;
    }

    const result = await this.sendRequest("turn/start", params);

    const turn = getObject(result.turn);
    this.activeTurnId = getString(turn?.id) ?? this.activeTurnId;
    this.broadcast({ type: "status", status: this.getStatus() });
    return { threadId: this.threadId, turnId: this.activeTurnId };
  }

  async resetThread() {
    this.threadId = null;
    this.activeTurnId = null;
    this.lastError = "";
    await this.ensureReady();
    this.broadcast({ type: "status", status: this.getStatus() });
  }

  async configure(settings: { effort?: string | null; model?: string | null }) {
    if ("model" in settings) {
      this.selectedModel = normalizeOptionalString(settings.model);
    }

    if ("effort" in settings) {
      this.selectedEffort = normalizeOptionalString(settings.effort);
    }

    this.broadcast({ type: "status", status: this.getStatus() });
    return this.getStatus();
  }

  async listModels(): Promise<CodexModelOption[]> {
    await this.ensureInitialized();

    const catalog = new Map<string, CodexModelOption>();
    const cursors = new Set<string>();
    let cursor: string | null = null;
    do {
      const result = await this.sendRequest("model/list", {
        includeHidden: false,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      const data = Array.isArray(result.data) ? result.data : [];
      for (const entry of data) {
        const model = normalizeCodexModelOption(entry);
        if (model) catalog.set(model.model, model);
      }
      cursor = getString(result.nextCursor);
      if (cursor && cursors.has(cursor)) throw new Error("Codex returned a repeated model-list cursor");
      if (cursor) cursors.add(cursor);
    } while (cursor);
    const models = [...catalog.values()];

    if (!this.selectedModel) {
      const defaultModel = models.find((model) => model.isDefault) ?? models[0];
      this.selectedModel = defaultModel?.model ?? null;
      this.selectedEffort = this.selectedEffort ?? defaultModel?.defaultEffort ?? null;
      this.broadcast({ type: "status", status: this.getStatus() });
    }

    return models;
  }

  async listSessions(): Promise<CodexSessionSummary[]> {
    await this.ensureInitialized();

    const result = await this.sendRequest("thread/list", {
      archived: false,
      limit: 100,
      sourceKinds: CODEX_SESSION_SOURCE_KINDS,
      sortDirection: "desc",
      sortKey: "recency_at",
    });
    const data = Array.isArray(result.data) ? result.data : [];
    return data
      .filter((thread) => isSmoothDocsCodexSession(thread, this.options.cwd))
      .map(normalizeCodexSessionSummary)
      .filter(Boolean) as CodexSessionSummary[];
  }

  async resumeThread(threadId: string): Promise<CodexSessionResumeResult> {
    if (!threadId) {
      throw new Error("Thread id is required");
    }

    if (this.activeTurnId) {
      throw new Error("Stop the active turn before switching sessions");
    }

    await this.ensureInitialized();

    const params: Record<string, unknown> = { threadId };
    if (this.selectedModel) params.model = this.selectedModel;

    const result = await this.sendRequest("thread/resume", params);
    const thread = getObject(result.thread);
    this.threadId = getString(thread?.id) ?? threadId;
    this.selectedModel = getString(result.model) ?? this.selectedModel;
    this.selectedEffort = getString(result.reasoningEffort) ?? this.selectedEffort;
    this.activeTurnId = null;
    this.lastError = "";
    const messages = await this.readThreadMessages(this.threadId, thread);
    this.broadcast({ type: "status", status: this.getStatus() });
    return {
      status: this.getStatus(),
      messages,
    };
  }

  async stopActiveTurn() {
    if (!this.threadId || !this.activeTurnId) {
      return this.getStatus();
    }

    const turnId = this.activeTurnId;

    try {
      await this.sendRequest("turn/interrupt", {
        threadId: this.threadId,
        turnId,
      });
    } catch (error) {
      this.child?.kill("SIGTERM");
      this.lastError = error instanceof Error ? error.message : "Failed to stop Codex";
    } finally {
      this.activeTurnId = null;
      this.broadcast({ type: "status", status: this.getStatus() });
    }

    return this.getStatus();
  }

  private async ensureReady() {
    await this.ensureInitialized();

    if (this.threadId) return;

    if (!this.startPromise) {
      this.startPromise = this.startThread().finally(() => {
        this.startPromise = null;
      });
    }

    await this.startPromise;
  }

  private async ensureInitialized() {
    if (this.child && this.initialized) return;

    if (!this.startPromise) {
      this.startPromise = this.start().finally(() => {
        this.startPromise = null;
      });
    }

    await this.startPromise;
  }

  private async start() {
    if (!this.child) {
      this.spawnAppServer();
    }

    if (!this.initialized) {
      await this.sendRequest("initialize", {
        clientInfo: {
          name: "smooth_docs_kit",
          title: "Smooth Docs Kit",
          version: "0.1.0",
        },
      });
      this.sendNotification("initialized", {});
      this.initialized = true;
    }
  }

  private async startThread() {
    if (!this.threadId) {
      const params: Record<string, unknown> = {
        cwd: this.options.cwd,
        serviceName: this.options.serviceName,
      };

      if (this.selectedModel) {
        params.model = this.selectedModel;
      }

      const result = await this.sendRequest("thread/start", params);
      const thread = getObject(result.thread);
      this.threadId = getString(thread?.id) ?? null;
      this.selectedModel = getString(result.model) ?? this.selectedModel;
      if (!this.threadId) {
        throw new Error("Codex did not return a thread id");
      }
    }

    this.lastError = "";
    this.broadcast({ type: "status", status: this.getStatus() });
  }

  private async readThreadMessages(threadId: string, thread: Record<string, unknown> | null) {
    const resumedMessages = extractCodexThreadMessages(thread, threadId);
    if (resumedMessages.length > 0) return resumedMessages;

    try {
      const result = await this.sendRequest("thread/read", {
        threadId,
        includeTurns: true,
      });
      return extractCodexThreadMessages(getObject(result.thread), threadId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to read session history";
      return [
        {
          id: `${threadId}:history-error`,
          role: "system" as const,
          content: `Failed to read session history: ${message}`,
        },
      ];
    }
  }

  private spawnAppServer() {
    const command = resolveCodexCommand();
    if (!command) {
      const message =
        "Could not find the Codex CLI. Set SMOOTH_DOCS_CODEX_BIN to the absolute path of the codex executable.";
      this.lastError = message;
      this.broadcast({ type: "error", message, status: this.getStatus() });
      throw new Error(message);
    }

    this.lastError = "";
    this.stderrTail = "";
    this.suppressNextCloseError = false;
    this.child = spawn(command, ["app-server"], {
      cwd: this.options.cwd,
      env: getCodexProcessEnv(command),
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdout = readline.createInterface({ input: this.child.stdout });
    stdout.on("line", (line) => this.handleLine(line));

    this.child.stderr.on("data", (chunk: Buffer) => {
      this.stderrTail = `${this.stderrTail}${chunk.toString("utf8")}`.slice(-4000);
    });

    this.child.on("error", (error) => {
      this.child = null;
      this.initialized = false;
      this.threadId = null;
      this.activeTurnId = null;
      this.suppressNextCloseError = true;
      this.failAll(error);
      this.lastError = error.message;
      this.broadcast({ type: "error", message: error.message, status: this.getStatus() });
    });

    this.child.on("close", (code, signal) => {
      if (this.suppressNextCloseError) {
        this.suppressNextCloseError = false;
        return;
      }

      const detail = this.stderrTail.trim();
      const message = detail
        ? `Codex app-server exited (${code ?? signal}): ${detail}`
        : `Codex app-server exited (${code ?? signal ?? "unknown"})`;
      this.child = null;
      this.initialized = false;
      this.threadId = null;
      this.activeTurnId = null;
      this.failAll(new Error(message));
      this.lastError = message;
      this.broadcast({ type: "error", message, status: this.getStatus() });
    });
  }

  private handleLine(line: string) {
    let message: CodexJsonRpcMessage;
    try {
      message = JSON.parse(line) as CodexJsonRpcMessage;
    } catch {
      return;
    }

    if (typeof message.id === "number") {
      this.handleResponse(message);
      return;
    }

    if (message.method) {
      this.handleNotification(message.method, message.params ?? {});
    }
  }

  private handleResponse(message: CodexJsonRpcMessage) {
    const pending = this.pendingRequests.get(message.id ?? -1);
    if (!pending) return;

    this.pendingRequests.delete(message.id ?? -1);
    clearTimeout(pending.timer);

    if (message.error) {
      pending.reject(new Error(message.error.message ?? "Codex app-server request failed"));
      return;
    }

    pending.resolve(message.result ?? {});
  }

  private handleNotification(method: string, params: Record<string, unknown>) {
    if (typeof params.threadId === "string" && this.threadId && params.threadId !== this.threadId) return;

    if (method === "turn/started") {
      this.messageStream.reset();
      const turn = getObject(params.turn);
      this.activeTurnId = getString(turn?.id) ?? this.activeTurnId;
      this.broadcast({ type: "status", status: this.getStatus() });
      return;
    }

    const update = this.messageStream.handle(method, params);
    if (update) {
      this.broadcast({ type: "message", ...update });
      return;
    }

    if (method === "turn/completed") {
      this.messageStream.reset();
      this.activeTurnId = null;
      this.broadcast({ type: "done", status: this.getStatus() });
      return;
    }

    if (method === "thread/started") {
      const thread = getObject(params.thread);
      this.threadId = getString(thread?.id) ?? this.threadId;
      this.broadcast({ type: "status", status: this.getStatus() });
    }
  }

  private sendRequest(method: string, params: Record<string, unknown>) {
    const child = this.child;
    if (!child) {
      return Promise.reject(new Error("Codex app-server is not running"));
    }

    const id = this.nextRequestId++;
    const payload = { method, id, params };

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Timed out waiting for Codex app-server: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, { reject, resolve, timer });
      child.stdin.write(`${JSON.stringify(payload)}\n`, (error) => {
        if (!error) return;
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(error);
      });
    });
  }

  private sendNotification(method: string, params: Record<string, unknown>) {
    if (!this.child) return;
    this.child.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  private failAll(error: Error) {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  private broadcast(event: CodexChatEvent) {
    this.events.emit("event", event);
  }
}

const codexChatBridge = new CodexChatBridge({
  cwd: docsConfig.projectDir,
  serviceName: "smooth_docs_kit",
});

function getCodexProcessEnv(command: string) {
  const commandDir = path.dirname(command);
  const extraPathEntries = [
    commandDir,
    ...getCodexAppResourceDirs(),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];

  return {
    ...process.env,
    PATH: [...extraPathEntries, process.env.PATH].filter(Boolean).join(path.delimiter),
  };
}

function buildCodexChatPrompt(request: CodexChatMessageRequest) {
  const page = request.page ?? {};
  const context = [
    "You are being prompted from the Smooth Docs Kit browser preview.",
    "Use the local repository and docs files as the source of truth.",
    "",
    "Current preview context:",
    `- Site: ${page.site || "(unknown)"}`,
    `- Page title: ${page.title || "(unknown)"}`,
    `- Page URL: ${page.url || "(unknown)"}`,
    `- Source path: ${page.sourcePath || "(unknown)"}`,
  ];

  const selection = request.selection?.trim();
  if (selection) {
    context.push("", "Selected text:", trimCodexContext(selection, 6000));
  }

  const contextBlocks = request.contextBlocks ?? [];
  if (contextBlocks.length > 0) {
    context.push("", "Attached docs context blocks:");

    contextBlocks.slice(0, 8).forEach((block, index) => {
      const label = block.label?.trim() || `Block ${index + 1}`;
      const sourcePath = block.sourcePath?.trim();
      context.push(
        "",
        `### ${label}`,
        sourcePath ? `Source: ${sourcePath}` : "",
        trimCodexContext(block.markdown ?? "", 8000),
      );
    });
  }

  context.push("", "User request:", request.text.trim());
  return context.join("\n");
}

function trimCodexContext(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n[truncated]`;
}

function extractOriginalCodexUserRequest(value: string) {
  const marker = "\nUser request:\n";
  const markerIndex = value.lastIndexOf(marker);
  if (markerIndex === -1) return value.trim();
  return value.slice(markerIndex + marker.length).trim();
}

function isSmoothDocsCodexSession(value: unknown, cwd: string) {
  const thread = getObject(value);
  if (!thread) return false;

  const threadCwd = getString(thread.cwd);
  if (threadCwd && path.resolve(threadCwd) === path.resolve(cwd)) return true;

  const preview = getString(thread.preview) ?? "";
  return preview.includes("You are being prompted from the Smooth Docs Kit browser preview.");
}

function getObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function handleDocsActionRequest(
  req: IncomingMessage,
  res: ServerResponse,
  actions: {
    generateDocsContent: () => Promise<GeneratedDocsContent>;
    invalidateDocsFolderCache: (site?: string) => void;
    listDocsFolders: (site: DocsSite) => Promise<string[]>;
    markSilentDocsFile: (file: string) => void;
  },
) {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname.startsWith("/__smooth-docs/codex/")) {
    await handleCodexChatRequest(req, res, url);
    return;
  }

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
    const folders = await listDocsFolders(site as DocsSite, query, actions.listDocsFolders);
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
    const result = await promoteDraftMarkdown(
      sourcePath,
      destinationPath,
      actions.markSilentDocsFile,
    );
    actions.invalidateDocsFolderCache(result.site);
    const content = await actions.generateDocsContent();

    sendJson(res, 200, {
      ...result,
      ...content,
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
    actions.invalidateDocsFolderCache(result.site);
    const content = await actions.generateDocsContent();

    sendJson(res, 200, {
      ...result,
      ...content,
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
    actions.invalidateDocsFolderCache(result.site);
    const content = await actions.generateDocsContent();

    sendJson(res, 200, {
      ...result,
      ...content,
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

    const content = await actions.generateDocsContent();
    sendJson(res, 200, {
      ok: true,
      ...content,
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

    const content = await actions.generateDocsContent();
    sendJson(res, 200, {
      ...getThemeSettingsPayload(),
      ...content,
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
    const content = await actions.generateDocsContent();

    sendJson(res, 200, {
      ...result,
      ...content,
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
    actions.invalidateDocsFolderCache(result.site);
    const content = await actions.generateDocsContent();

    sendJson(res, 200, {
      ...result,
      ...content,
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
    actions.invalidateDocsFolderCache(result.site);
    const content = await actions.generateDocsContent();

    sendJson(res, 200, {
      ...result,
      ...content,
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
    actions.invalidateDocsFolderCache(result.site);
    const content = await actions.generateDocsContent();

    sendJson(res, 200, {
      ...result,
      ...content,
    });
    return;
  }

  sendJson(res, 404, { error: "Unknown docs action" });
}

async function handleCodexChatRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) {
  if (url.pathname === "/__smooth-docs/codex/status") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    sendJson(res, 200, codexChatBridge.getStatus());
    return;
  }

  if (url.pathname === "/__smooth-docs/codex/events") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    res.writeHead(200, {
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    });
    sendSseEvent(res, "status", codexChatBridge.getStatus());

    const removeListener = codexChatBridge.onEvent((event) => {
      if (event.type === "status") {
        sendSseEvent(res, "status", event.status);
      } else {
        sendSseEvent(res, event.type, event);
      }
    });

    req.on("close", removeListener);
    return;
  }

  if (url.pathname === "/__smooth-docs/codex/message") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const request = normalizeCodexChatMessageRequest(body);
    const result = await codexChatBridge.sendMessage(request);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/__smooth-docs/codex/settings") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const settings: { effort?: string | null; model?: string | null } = {};
    if (Object.prototype.hasOwnProperty.call(body, "effort")) {
      settings.effort = typeof body.effort === "string" ? body.effort : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "model")) {
      settings.model = typeof body.model === "string" ? body.model : null;
    }
    const status = await codexChatBridge.configure(settings);
    sendJson(res, 200, status);
    return;
  }

  if (url.pathname === "/__smooth-docs/codex/models") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const models = await codexChatBridge.listModels();
    sendJson(res, 200, {
      models,
      status: codexChatBridge.getStatus(),
    });
    return;
  }

  if (url.pathname === "/__smooth-docs/codex/sessions") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const sessions = await codexChatBridge.listSessions();
    sendJson(res, 200, { sessions });
    return;
  }

  if (url.pathname === "/__smooth-docs/codex/session") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req);
    const threadId = typeof body.threadId === "string" ? body.threadId : "";
    const result = await codexChatBridge.resumeThread(threadId);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/__smooth-docs/codex/stop") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const status = await codexChatBridge.stopActiveTurn();
    sendJson(res, 200, status);
    return;
  }

  if (url.pathname === "/__smooth-docs/codex/reset") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    await codexChatBridge.resetThread();
    sendJson(res, 200, codexChatBridge.getStatus());
    return;
  }

  sendJson(res, 404, { error: "Unknown Codex chat action" });
}

function normalizeCodexChatMessageRequest(body: Record<string, unknown>): CodexChatMessageRequest {
  const page = getObject(body.page);
  const contextBlocks: NonNullable<CodexChatMessageRequest["contextBlocks"]> = Array.isArray(
    body.contextBlocks,
  )
    ? body.contextBlocks
        .flatMap((value) => {
          const block = getObject(value);
          if (!block) return [];
          const normalized = {
            label: typeof block.label === "string" ? block.label : "",
            markdown: typeof block.markdown === "string" ? block.markdown : "",
            sourcePath: typeof block.sourcePath === "string" ? block.sourcePath : "",
          };
          return normalized.markdown.trim() ? [normalized] : [];
        })
        .slice(0, 8)
    : [];

  return {
    contextBlocks,
    text: typeof body.text === "string" ? body.text : "",
    selection: typeof body.selection === "string" ? body.selection : "",
    page: page
      ? {
          title: typeof page.title === "string" ? page.title : "",
          url: typeof page.url === "string" ? page.url : "",
          sourcePath: typeof page.sourcePath === "string" ? page.sourcePath : "",
          site: typeof page.site === "string" ? page.site : "",
        }
      : undefined,
  };
}

function normalizeCodexModelOption(value: unknown): CodexModelOption | null {
  const model = getObject(value);
  if (!model) return null;

  const modelId = getString(model.model) ?? getString(model.id);
  if (!modelId) return null;

  const effortOptions = Array.isArray(model.supportedReasoningEfforts)
    ? model.supportedReasoningEfforts
        .map((option) => {
          const optionObject = getObject(option);
          const value = getString(optionObject?.reasoningEffort);
          if (!value) return null;
          return {
            value,
            description: getString(optionObject?.description) ?? "",
          };
        })
        .filter((option): option is { value: string; description: string } => Boolean(option))
    : [];

  return {
    id: getString(model.id) ?? modelId,
    model: modelId,
    displayName: getString(model.displayName) ?? modelId,
    description: getString(model.description) ?? "",
    defaultEffort: getString(model.defaultReasoningEffort),
    effortOptions,
    isDefault: model.isDefault === true,
  };
}

function normalizeCodexSessionSummary(value: unknown): CodexSessionSummary | null {
  const thread = getObject(value);
  const id = getString(thread?.id);
  if (!thread || !id) return null;

  const status = getObject(thread.status);
  const preview = extractOriginalCodexUserRequest(getString(thread.preview) ?? "");
  const name = getString(thread.name) ?? preview.split("\n")[0]?.trim() ?? id;

  return {
    id,
    name: name || id,
    preview,
    cwd: getString(thread.cwd) ?? "",
    modelProvider: getString(thread.modelProvider) ?? "",
    updatedAt: getNumber(thread.updatedAt) ?? getNumber(thread.recencyAt) ?? 0,
    status: getString(status?.type) ?? "unknown",
  };
}

function sendSseEvent(res: ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
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

async function promoteDraftMarkdown(
  sourcePath: string,
  destinationPath: string,
  markSilentDocsFile: (file: string) => void,
) {
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
  markSilentDocsFile(to);
  await fs.copyFile(from, to);

  return {
    sourcePath: `draft/docs/${sourceRelativePath}`,
    destinationPath: `published/docs/${destinationRelativePath}`,
    site: "published",
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

async function listDocsFolders(
  site: DocsSite,
  query: string,
  readFolders?: (site: DocsSite) => Promise<string[]>,
) {
  const root = docsRootForSite(site);
  const folders = readFolders ? await readFolders(site) : await collectFolders(root);
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
  if (relativePath === "index.md") return "/index/";
  return `/${relativePath.replace(/\.md$/, "")}/`;
}

async function toMarkdownRoute(root: string, relativePath: string) {
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

function sendPlainText(res: ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(body);
}

function contentTypeForPath(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function docsManualChunks(id: string) {
  const normalized = id.replace(/\\/g, "/");
  if (!normalized.includes("/node_modules/")) return undefined;

  if (
    normalized.includes("/node_modules/react/") ||
    normalized.includes("/node_modules/react-dom/") ||
    normalized.includes("/node_modules/scheduler/")
  ) {
    return "react-vendor";
  }

  if (normalized.includes("/node_modules/cmdk/")) {
    return "command-vendor";
  }

  if (
    normalized.includes("/node_modules/@radix-ui/") ||
    normalized.includes("/node_modules/sonner/")
  ) {
    return "ui-vendor";
  }

  if (normalized.includes("/node_modules/lucide-react/")) {
    return "icons";
  }

  if (
    normalized.includes("/node_modules/highlight.js/") ||
    normalized.includes("/node_modules/katex/")
  ) {
    return "rendering-vendor";
  }

  return "vendor";
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: docsManualChunks,
      },
    },
  },
});
