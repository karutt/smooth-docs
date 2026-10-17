import crypto from "node:crypto";
import path from "node:path";
import {
  lstat,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  stat,
  unlink,
} from "node:fs/promises";

const targetWriteQueues = new Map();

export class DocsFlowFileError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "DocsFlowFileError";
    this.code = code;
  }
}

function flowFileError(code, message, cause) {
  return new DocsFlowFileError(code, message, cause ? { cause } : undefined);
}

function isWithinPath(root, file) {
  const relative = path.relative(root, file);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function requirePathString(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw flowFileError("FLOW_PATH_INVALID", `${label} must be a non-empty path without NUL bytes`);
  }
  return value;
}

async function canonicalDirectory(value, label) {
  const lexicalPath = path.resolve(requirePathString(value, label));
  let canonicalPath;
  let info;

  try {
    canonicalPath = await realpath(lexicalPath);
    info = await stat(canonicalPath);
  } catch (error) {
    throw flowFileError("FLOW_ROOT_NOT_FOUND", `${label} does not exist`, error);
  }

  if (!info.isDirectory()) {
    throw flowFileError("FLOW_PATH_INVALID", `${label} must be a directory`);
  }

  return { lexicalPath, canonicalPath };
}

async function canonicalFile(value, label) {
  const lexicalPath = path.resolve(requirePathString(value, label));
  let canonicalPath;
  let info;

  try {
    canonicalPath = await realpath(lexicalPath);
    info = await stat(canonicalPath);
  } catch (error) {
    throw flowFileError("FLOW_SOURCE_NOT_FOUND", `${label} does not exist`, error);
  }

  if (!info.isFile()) {
    throw flowFileError("FLOW_PATH_INVALID", `${label} must be a file`);
  }

  return { lexicalPath, canonicalPath };
}

function normalizeExternalSource(src) {
  const raw = requirePathString(src, "src");

  if (
    raw.trim() !== raw ||
    raw.startsWith("/") ||
    raw.startsWith("\\") ||
    raw.startsWith("//") ||
    /^[A-Za-z]:/.test(raw) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw) ||
    raw.includes("?") ||
    raw.includes("#")
  ) {
    throw flowFileError("FLOW_PATH_INVALID", "src must be a plain page-relative path");
  }

  const withPosixSeparators = raw.replace(/\\/g, "/");
  const segments = withPosixSeparators.split("/");
  if (segments.some((segment) => segment === "..")) {
    throw flowFileError("FLOW_PATH_INVALID", "src cannot contain parent traversal segments");
  }

  const normalized = path.posix.normalize(withPosixSeparators);
  if (
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    !normalized.endsWith(".docs-flow.yml")
  ) {
    throw flowFileError(
      "FLOW_PATH_INVALID",
      "src must end in the exact .docs-flow.yml extension",
    );
  }

  return normalized;
}

/**
 * Resolve an authored external flow reference without allowing it to leave the
 * configured docs root or the optional active publish root.
 *
 * @returns {Promise<string>} the canonical real path of the existing flow file
 */
export async function resolveExternalFlowPath({ docsRoot, publishRoot, pagePath, src }) {
  const normalizedSource = normalizeExternalSource(src);
  const docs = await canonicalDirectory(docsRoot, "docsRoot");
  const page = await canonicalFile(pagePath, "pagePath");

  if (
    !isWithinPath(docs.lexicalPath, page.lexicalPath) ||
    !isWithinPath(docs.canonicalPath, page.canonicalPath)
  ) {
    throw flowFileError("FLOW_PATH_FORBIDDEN", "pagePath is outside docsRoot");
  }

  let publish = null;
  if (publishRoot !== undefined && publishRoot !== null) {
    publish = await canonicalDirectory(publishRoot, "publishRoot");
    if (
      !isWithinPath(docs.lexicalPath, publish.lexicalPath) ||
      !isWithinPath(docs.canonicalPath, publish.canonicalPath) ||
      !isWithinPath(publish.lexicalPath, page.lexicalPath) ||
      !isWithinPath(publish.canonicalPath, page.canonicalPath)
    ) {
      throw flowFileError("FLOW_PATH_FORBIDDEN", "publishRoot or pagePath is outside docsRoot");
    }
  }

  const lexicalTarget = path.resolve(
    path.dirname(page.lexicalPath),
    ...normalizedSource.split("/"),
  );
  if (!isWithinPath(docs.lexicalPath, lexicalTarget)) {
    throw flowFileError("FLOW_PATH_FORBIDDEN", "external flow is outside docsRoot");
  }
  if (publish && !isWithinPath(publish.lexicalPath, lexicalTarget)) {
    throw flowFileError("FLOW_PATH_FORBIDDEN", "external flow is outside publishRoot");
  }

  const target = await canonicalFile(lexicalTarget, "external flow");
  if (!isWithinPath(docs.canonicalPath, target.canonicalPath)) {
    throw flowFileError("FLOW_PATH_FORBIDDEN", "external flow resolves outside docsRoot");
  }
  if (publish && !isWithinPath(publish.canonicalPath, target.canonicalPath)) {
    throw flowFileError("FLOW_PATH_FORBIDDEN", "external flow resolves outside publishRoot");
  }

  return target.canonicalPath;
}

export async function readFileBounded(filePath, options = {}) {
  const {
    allowedRoots = [],
    encoding = null,
    maxBytes = 1024 * 1024,
  } = options;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw flowFileError("FLOW_SIZE_INVALID", "maxBytes must be a non-negative safe integer");
  }

  await verifyAllowedRoots(path.resolve(filePath), allowedRoots);
  const before = await stat(filePath);
  if (!before.isFile()) {
    throw flowFileError("FLOW_PATH_INVALID", "bounded reads require a regular file");
  }
  if (before.size > maxBytes) {
    throw flowFileError("FLOW_SOURCE_TOO_LARGE", `file exceeds ${maxBytes} bytes`);
  }

  const bytes = await readFile(filePath);
  if (bytes.byteLength > maxBytes) {
    throw flowFileError("FLOW_SOURCE_TOO_LARGE", `file exceeds ${maxBytes} bytes`);
  }
  return encoding ? bytes.toString(encoding) : bytes;
}

async function verifyAllowedRoots(targetPath, allowedRoots) {
  if (!allowedRoots || allowedRoots.length === 0) return;

  let canonicalTarget;
  let canonicalParent;
  try {
    canonicalTarget = await realpath(targetPath);
    canonicalParent = await realpath(path.dirname(targetPath));
  } catch (error) {
    throw flowFileError("FLOW_PATH_FORBIDDEN", "target path cannot be verified", error);
  }
  let allowed = false;
  for (const root of allowedRoots) {
    if (!root) continue;
    const canonicalRoot = await realpath(path.resolve(root));
    if (
      isWithinPath(canonicalRoot, canonicalTarget) &&
      isWithinPath(canonicalRoot, canonicalParent)
    ) {
      allowed = true;
      break;
    }
  }
  if (!allowed) {
    throw flowFileError("FLOW_PATH_FORBIDDEN", "target resolves outside its allowed root");
  }
}

async function findNamedFile(root, name) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const candidate = path.join(root, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isFile() && entry.name === name) return candidate;
    if (entry.isDirectory()) {
      const nested = await findNamedFile(candidate, name);
      if (nested) return nested;
    }
  }
  return null;
}

async function cleanupTemporaryFile(temporaryPath, allowedRoots) {
  if (!allowedRoots || allowedRoots.length === 0) {
    await unlink(temporaryPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    return;
  }

  try {
    await verifyAllowedRoots(temporaryPath, allowedRoots);
    await unlink(temporaryPath);
    return;
  } catch {
    // A parent may have been renamed between the write and the safety check.
  }

  const temporaryName = path.basename(temporaryPath);
  for (const root of allowedRoots) {
    if (!root) continue;
    const canonicalRoot = await realpath(path.resolve(root));
    const discovered = await findNamedFile(canonicalRoot, temporaryName);
    if (discovered) {
      await unlink(discovered);
      return;
    }
  }
}

/**
 * Atomically replace one existing file using an exclusive sibling temporary
 * file. The old mode is retained and every failure path removes the temporary.
 */
export async function atomicWriteFile(targetPath, content, options = {}) {
  const absoluteTarget = path.resolve(requirePathString(targetPath, "targetPath"));
  const allowedRoots = Array.isArray(options.allowedRoots) ? options.allowedRoots : [];
  await verifyAllowedRoots(absoluteTarget, allowedRoots);

  const targetInfo = await stat(absoluteTarget);
  const targetMode = targetInfo.mode & 0o7777;
  const canonicalParent = await realpath(path.dirname(absoluteTarget));
  const temporaryPath = path.join(
    canonicalParent,
    `.${path.basename(absoluteTarget)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );
  let temporaryHandle;
  let renamed = false;

  try {
    temporaryHandle = await open(temporaryPath, "wx", targetMode);
    await temporaryHandle.writeFile(content);
    await temporaryHandle.chmod(targetMode);
    await temporaryHandle.sync();
    await temporaryHandle.close();
    temporaryHandle = undefined;

    if (typeof options.beforeRename === "function") await options.beforeRename();
    await verifyAllowedRoots(absoluteTarget, allowedRoots);
    await rename(temporaryPath, absoluteTarget);
    renamed = true;
  } finally {
    if (temporaryHandle) {
      await temporaryHandle.close().catch(() => {});
    }
    if (!renamed) {
      await cleanupTemporaryFile(temporaryPath, allowedRoots);
    }
  }
}

/** Serialize operations that address the same canonical target in this process. */
export function withTargetWriteQueue(targetPath, operation) {
  if (typeof operation !== "function") {
    throw new TypeError("operation must be a function");
  }

  const key = path.resolve(requirePathString(targetPath, "targetPath"));
  const previous = targetWriteQueues.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(() => operation());
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  targetWriteQueues.set(key, settled);

  return run.finally(() => {
    if (targetWriteQueues.get(key) === settled) {
      targetWriteQueues.delete(key);
    }
  });
}

// Short alias for callers that treat reads and writes as one target transaction.
export const withTargetQueue = withTargetWriteQueue;

export async function isSymbolicLink(filePath) {
  return (await lstat(filePath)).isSymbolicLink();
}
