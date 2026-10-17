import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { atomicWriteFile, withTargetWriteQueue } from "./files.mjs";
import { compileFlowLayout } from "./layout.mjs";
import { parseFlowYaml } from "./parse.mjs";
import {
  createInlineFlowRevision,
  findInlineFlowSource,
  loadExternalFlowSource,
  prepareExternalFlowSave,
  prepareInlineFlowSave,
} from "./source.mjs";
import { validateFlowDocument } from "./validate.mjs";

const FLOW_ROUTE_PREFIX = "/__smooth-docs/flow";
const DEFAULT_REQUEST_LIMIT = 1024 * 1024;
const DEFAULT_SOURCE_LIMIT = 512 * 1024;
const FLOW_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class FlowApiError extends Error {
  constructor(status, code, message, options = {}) {
    super(message, options);
    this.name = "FlowApiError";
    this.status = status;
    this.code = code;
    this.diagnostics = options.diagnostics ?? [];
    this.details = options.details ?? {};
  }
}

function apiError(status, code, message, options) {
  return new FlowApiError(status, code, message, options);
}

function errorResponse(error) {
  if (error instanceof FlowApiError) {
    return {
      status: error.status,
      body: {
        code: error.code,
        message: error.message,
        diagnostics: error.diagnostics,
        ...error.details,
      },
    };
  }

  return {
    status: 500,
    body: {
      code: "FLOW_INTERNAL_ERROR",
      message: "The flow request could not be completed.",
      diagnostics: [],
    },
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getHeader(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct.length === 1 ? String(direct[0]) : "";
  return typeof direct === "string" ? direct : "";
}

function normalizeProtocol(value) {
  const protocol = typeof value === "string" && value ? value : "http:";
  return protocol.endsWith(":") ? protocol : `${protocol}:`;
}

function requireHost(request) {
  const host = getHeader(request.headers, "host").trim();
  if (!host || /[\s/@\\]/.test(host)) {
    throw apiError(400, "INVALID_REQUEST", "A valid Host header is required.");
  }
  return host;
}

function requireJsonRequest(request, options, host) {
  const origin = getHeader(request.headers, "origin");
  const expectedOrigin = `${normalizeProtocol(request.protocol ?? options.protocol)}//${host}`;
  if (!origin || origin !== expectedOrigin) {
    throw apiError(403, "ORIGIN_REJECTED", "The request origin is not accepted.");
  }

  const contentType = getHeader(request.headers, "content-type");
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw apiError(400, "INVALID_CONTENT_TYPE", "Content-Type must be application/json.");
  }

  const rawBody = request.body === undefined ? "" : request.body;
  if (typeof rawBody !== "string" && !Buffer.isBuffer(rawBody)) {
    throw apiError(400, "INVALID_REQUEST", "The request body must contain JSON.");
  }
  if (Buffer.byteLength(rawBody) > options.maxRequestBytes) {
    throw apiError(413, "REQUEST_TOO_LARGE", "The JSON request body is too large.");
  }

  let body;
  try {
    body = rawBody.length === 0 ? {} : JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw apiError(400, "INVALID_REQUEST", "The request body is not valid JSON.");
  }
  if (!isRecord(body)) {
    throw apiError(400, "INVALID_REQUEST", "The request body must be a JSON object.");
  }
  if (Object.hasOwn(body, "targetPath") || Object.hasOwn(body, "path")) {
    throw apiError(400, "INVALID_REQUEST", "Writable target paths are server-derived.");
  }
  return body;
}

function requireString(value, code = "INVALID_REQUEST") {
  if (typeof value !== "string" || !value) {
    throw apiError(400, code, "A required string value is missing.");
  }
  return value;
}

function requireFlowId(value) {
  const flowId = requireString(value, "INVALID_FLOW_ID");
  if (flowId.length > 64 || !FLOW_ID_PATTERN.test(flowId)) {
    throw apiError(400, "INVALID_FLOW_ID", "The flow ID is invalid.");
  }
  return flowId;
}

function isWithinPath(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolvePageSource({ docsRoot, siteKey, sourcePath }) {
  const logical = requireString(sourcePath);
  const prefix = `${siteKey}/docs/`;
  if (
    !logical.startsWith(prefix) ||
    logical.includes("\\") ||
    logical.includes("\0") ||
    logical.includes("?") ||
    logical.includes("#")
  ) {
    throw apiError(400, "INVALID_REQUEST", "The page source path is invalid.");
  }

  const relativeSource = logical.slice(prefix.length);
  const segments = relativeSource.split("/");
  if (
    !relativeSource.endsWith(".md") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw apiError(400, "INVALID_REQUEST", "The page source path is invalid.");
  }

  const lexicalRoot = path.resolve(docsRoot);
  const lexicalPage = path.resolve(lexicalRoot, ...segments);
  if (!isWithinPath(lexicalRoot, lexicalPage)) {
    throw apiError(403, "PATH_OUTSIDE_DOCS", "The page is outside the docs root.");
  }

  let canonicalRoot;
  let canonicalPage;
  try {
    [canonicalRoot, canonicalPage] = await Promise.all([
      realpath(lexicalRoot),
      realpath(lexicalPage),
    ]);
    const pageInfo = await stat(canonicalPage);
    if (!pageInfo.isFile()) throw new Error("not a file");
  } catch {
    throw apiError(404, "PAGE_NOT_FOUND", "The requested page no longer exists.");
  }

  if (!isWithinPath(canonicalRoot, canonicalPage)) {
    throw apiError(403, "SYMLINK_ESCAPE", "The page resolves outside the docs root.");
  }

  return {
    sourcePath: logical,
    pagePath: lexicalPage,
    canonicalPage,
    docsRoot: lexicalRoot,
    canonicalDocsRoot: canonicalRoot,
  };
}

function assertBoundedFlowFences(markdown, maxBytes) {
  const lines = markdown.match(/.*(?:\r\n|\n|$)/g) ?? [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\r?\n$/, "");
    const opening = /^( {0,3})(`{3,}|~{3,})smooth-flow(?:[ \t].*)?$/.exec(line);
    if (!opening) continue;

    const marker = opening[2][0];
    const minimumLength = opening[2].length;
    let body = "";
    for (index += 1; index < lines.length; index += 1) {
      const candidate = lines[index].replace(/\r?\n$/, "");
      const closing = /^( {0,3})(`+|~+)[ \t]*$/.exec(candidate);
      if (
        closing &&
        closing[2][0] === marker &&
        closing[2].length >= minimumLength &&
        [...closing[2]].every((character) => character === marker)
      ) {
        break;
      }
      body += lines[index];
      if (Buffer.byteLength(body) > maxBytes) {
        throw apiError(413, "FLOW_SOURCE_TOO_LARGE", "The flow YAML source is too large.");
      }
    }
  }
}

function mapSourceLookupError(error) {
  if (error?.code === "FLOW_SOURCE_AMBIGUOUS") {
    return apiError(409, "FLOW_ID_AMBIGUOUS", "The flow ID is not unique on this page.");
  }
  if (error?.code === "FLOW_SOURCE_NOT_FOUND") {
    return apiError(404, "FLOW_NOT_FOUND", "The requested flow no longer exists.");
  }
  return error;
}

async function loadInlineFlow(options, sourcePath, flowId) {
  const page = await resolvePageSource({
    docsRoot: options.docsRoot,
    siteKey: options.siteKey,
    sourcePath,
  });
  let markdown;
  try {
    markdown = await readFile(page.pagePath, "utf8");
  } catch {
    throw apiError(404, "PAGE_NOT_FOUND", "The requested page no longer exists.");
  }
  assertBoundedFlowFences(markdown, options.maxSourceBytes);

  let source;
  try {
    source = findInlineFlowSource(markdown, flowId);
  } catch (error) {
    throw mapSourceLookupError(error);
  }

  if (Buffer.byteLength(source.body) > options.maxSourceBytes) {
    throw apiError(413, "FLOW_SOURCE_TOO_LARGE", "The flow YAML source is too large.");
  }

  const parsed = parseFlowYaml(source.body, { maxBytes: options.maxSourceBytes });
  if (!parsed.ok || parsed.kind !== "document" || !parsed.document) {
    const primaryCode = parsed.diagnostics[0]?.code;
    const code = primaryCode === "UNSUPPORTED_FLOW_VERSION" ? primaryCode : "YAML_INVALID";
    throw apiError(422, code, "The current flow source is invalid.", {
      diagnostics: parsed.diagnostics,
    });
  }

  return {
    ...page,
    markdown,
    source,
    document: parsed.document,
    revision: createInlineFlowRevision({
      pageSourcePath: sourcePath,
      flowId,
      body: source.body,
    }),
  };
}

function mapExternalSourceError(error) {
  if (error?.code === "FLOW_SOURCE_AMBIGUOUS") {
    return apiError(409, "FLOW_ID_AMBIGUOUS", "The flow ID is not unique on this page.");
  }
  if (error?.code === "FLOW_SOURCE_NOT_FOUND") {
    return apiError(404, "FLOW_NOT_FOUND", "The requested flow no longer exists.");
  }
  if (error?.code === "FLOW_SOURCE_TOO_LARGE") {
    return apiError(413, "FLOW_SOURCE_TOO_LARGE", "The flow YAML source is too large.");
  }
  if (error?.code === "FLOW_PATH_FORBIDDEN") {
    return apiError(403, "PATH_OUTSIDE_DOCS", "The external flow is outside the docs root.");
  }
  return error;
}

async function loadCurrentFlow(options, sourcePath, flowId) {
  try {
    return { ...(await loadInlineFlow(options, sourcePath, flowId)), kind: "inline" };
  } catch (error) {
    if (!(error instanceof FlowApiError) || error.code !== "FLOW_NOT_FOUND") throw error;
  }

  const page = await resolvePageSource({
    docsRoot: options.docsRoot,
    siteKey: options.siteKey,
    sourcePath,
  });
  try {
    const external = await loadExternalFlowSource({
      docsRoot: page.docsRoot,
      pagePath: page.pagePath,
      pageSourcePath: sourcePath,
      flowId,
      maxBytes: options.maxSourceBytes,
    });
    return { ...page, ...external, kind: "external" };
  } catch (error) {
    throw mapExternalSourceError(error);
  }
}

function validateCandidate(document, maxSourceBytes) {
  const result = validateFlowDocument(document, { maxBytes: maxSourceBytes });
  if (!result.ok || !result.document) {
    const oversized = result.diagnostics.some((item) => item.code === "FLOW_SOURCE_TOO_LARGE");
    throw apiError(
      oversized ? 413 : 422,
      oversized ? "FLOW_SOURCE_TOO_LARGE" : "FLOW_VALIDATION_FAILED",
      oversized ? "The flow YAML source is too large." : "The flow contains invalid values.",
      { diagnostics: result.diagnostics },
    );
  }
  return result.document;
}

async function handleSource(options, url) {
  const sourcePath = requireString(url.searchParams.get("sourcePath"));
  const flowId = requireFlowId(url.searchParams.get("flowId"));
  const current = await loadCurrentFlow(options, sourcePath, flowId);
  return {
    status: 200,
    body: {
      document: current.document,
      source: {
        kind: current.kind,
        pageSourcePath: sourcePath,
        flowId,
        ...(current.kind === "external" ? { reference: current.reference } : {}),
        revision: current.revision,
        editable: true,
      },
      diagnostics: [],
    },
  };
}

async function handleLayout(options, body) {
  if (body.scope !== "all" && body.scope !== "missing") {
    throw apiError(400, "INVALID_REQUEST", "Layout scope must be all or missing.");
  }
  const document = validateCandidate(body.document, options.maxSourceBytes);
  const layoutDocument =
    body.scope === "all"
      ? {
          ...document,
          nodes: document.nodes.map(({ position: _position, ...node }) => node),
        }
      : document;
  const layout = await compileFlowLayout(layoutDocument);
  return { status: 200, body: { layout, diagnostics: [] } };
}

function conflictResponse(current) {
  throw apiError(409, "REVISION_CONFLICT", "The flow changed after editing started.", {
    details: {
      currentRevision: current.revision,
      currentDocument: current.document,
    },
  });
}

async function handleSave(options, body) {
  const sourcePath = requireString(body.sourcePath);
  const flowId = requireFlowId(body.flowId);
  const baseRevision = requireString(body.baseRevision);
  if (!/^sha256:[0-9a-f]{64}$/.test(baseRevision)) {
    throw apiError(400, "INVALID_REQUEST", "The base revision is invalid.");
  }
  if (!isRecord(body.document) || body.document.id !== flowId) {
    throw apiError(400, "INVALID_FLOW_ID", "The document ID must match the stable flow ID.");
  }

  const ownership = await loadCurrentFlow(options, sourcePath, flowId);
  const queueTarget = ownership.kind === "external" ? ownership.targetPath : ownership.pagePath;

  return withTargetWriteQueue(queueTarget, async () => {
    const current = await loadCurrentFlow(options, sourcePath, flowId);
    if (current.revision !== baseRevision) conflictResponse(current);
    if (
      current.kind !== ownership.kind ||
      (current.kind === "external" && current.targetPath !== queueTarget)
    ) {
      conflictResponse(current);
    }
    const document = validateCandidate(body.document, options.maxSourceBytes);
    const prepared = current.kind === "external"
      ? await prepareExternalFlowSave({
          docsRoot: current.docsRoot,
          pagePath: current.pagePath,
          pageSourcePath: sourcePath,
          flowId,
          baseRevision,
          candidateDocument: document,
          maxBytes: options.maxSourceBytes,
        })
      : prepareInlineFlowSave({
          markdown: current.markdown,
          pageSourcePath: sourcePath,
          flowId,
          candidateDocument: document,
        });

    if (!prepared.changed) {
      return {
        status: 200,
        body: {
          ok: true,
          changed: false,
          sourcePath,
          flowId,
          revision: current.revision,
          document: current.document,
        },
      };
    }

    const writeTarget = current.kind === "external" ? current.logicalTargetPath : current.pagePath;
    const writeContent = current.kind === "external" ? prepared.nextBody : prepared.markdown;
    if (options.markSilentDocsFile) options.markSilentDocsFile(writeTarget);
    await options.atomicWrite(writeTarget, writeContent, {
      allowedRoots: [current.docsRoot],
    });
    const generated = await options.regenerate();
    if (!isRecord(generated) || !isRecord(generated.docsDataBySite)) {
      throw new Error("Flow regeneration returned an invalid payload");
    }
    if (options.broadcast) await options.broadcast(generated);

    return {
      status: 200,
      body: {
        ok: true,
        changed: true,
        sourcePath,
        flowId,
        revision: prepared.revision,
        document,
        docsDataBySite: generated.docsDataBySite,
        generatedAt: generated.generatedAt,
      },
    };
  });
}

/**
 * Create a transport-neutral local-authoring handler.
 *
 * @param {object} inputOptions
 * @returns {(request: object) => Promise<{status: number, body: object}>}
 */
export function createFlowDevApiHandler(inputOptions) {
  if (!isRecord(inputOptions) || typeof inputOptions.docsRoot !== "string") {
    throw new TypeError("docsRoot is required");
  }
  const options = {
    docsRoot: inputOptions.docsRoot,
    siteKey:
      typeof inputOptions.siteKey === "string" && inputOptions.siteKey
        ? inputOptions.siteKey
        : "docs",
    protocol: normalizeProtocol(inputOptions.protocol),
    maxRequestBytes: inputOptions.maxRequestBytes ?? DEFAULT_REQUEST_LIMIT,
    maxSourceBytes: inputOptions.maxSourceBytes ?? DEFAULT_SOURCE_LIMIT,
    atomicWrite:
      typeof inputOptions.atomicWrite === "function" ? inputOptions.atomicWrite : atomicWriteFile,
    regenerate:
      typeof inputOptions.regenerate === "function"
        ? inputOptions.regenerate
        : async () => ({ docsDataBySite: {}, generatedAt: Date.now() }),
    broadcast: typeof inputOptions.broadcast === "function" ? inputOptions.broadcast : null,
    markSilentDocsFile:
      typeof inputOptions.markSilentDocsFile === "function"
        ? inputOptions.markSilentDocsFile
        : null,
  };

  for (const [name, value] of [
    ["maxRequestBytes", options.maxRequestBytes],
    ["maxSourceBytes", options.maxSourceBytes],
  ]) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive safe integer`);
    }
  }

  return async function handleFlowDevApiRequest(request) {
    try {
      if (!isRecord(request)) {
        throw apiError(400, "INVALID_REQUEST", "A request object is required.");
      }
      const host = requireHost(request);
      let url;
      try {
        url = new URL(typeof request.url === "string" ? request.url : "/", "http://local.invalid");
      } catch {
        throw apiError(400, "INVALID_REQUEST", "The request URL is invalid.");
      }

      const route = url.pathname;
      const methods = {
        [`${FLOW_ROUTE_PREFIX}/source`]: "GET",
        [`${FLOW_ROUTE_PREFIX}/layout`]: "POST",
        [`${FLOW_ROUTE_PREFIX}/save`]: "POST",
      };
      const expectedMethod = methods[route];
      if (!expectedMethod) {
        throw apiError(404, "FLOW_NOT_FOUND", "The flow endpoint does not exist.");
      }
      if (request.method !== expectedMethod) {
        throw apiError(405, "METHOD_NOT_ALLOWED", "The HTTP method is not supported.");
      }

      if (route === `${FLOW_ROUTE_PREFIX}/source`) return await handleSource(options, url);
      const body = requireJsonRequest(request, options, host);
      if (route === `${FLOW_ROUTE_PREFIX}/layout`) return await handleLayout(options, body);
      return await handleSave(options, body);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export const FLOW_DEV_API_REQUEST_LIMIT = DEFAULT_REQUEST_LIMIT;
export const FLOW_DEV_API_SOURCE_LIMIT = DEFAULT_SOURCE_LIMIT;
