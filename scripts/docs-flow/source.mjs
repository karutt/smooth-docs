import crypto from "node:crypto";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import YAML from "yaml";
import { readFileBounded, resolveExternalFlowPath } from "./files.mjs";
import { parseFlowMarkdown, parseFlowYaml } from "./parse.mjs";

export class DocsFlowSourceError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "DocsFlowSourceError";
    this.code = code;
  }
}

function sourceError(code, message, cause) {
  return new DocsFlowSourceError(code, message, cause ? { cause } : undefined);
}

function linesWithOffsets(source) {
  const lines = [];
  let start = 0;

  while (start < source.length) {
    const newline = source.indexOf("\n", start);
    const end = newline === -1 ? source.length : newline + 1;
    const eol = newline === -1 ? "" : source[newline - 1] === "\r" ? "\r\n" : "\n";
    const contentEnd = end - eol.length;
    lines.push({
      start,
      end,
      content: source.slice(start, contentEnd),
      eol,
    });
    start = end;
  }

  return lines;
}

function parseOpeningFence(line) {
  const match = /^( {0,3})(`{3,}|~{3,})smooth-flow[ \t]*$/.exec(line.content);
  if (!match) return null;
  return {
    indentLength: match[1].length,
    marker: match[2][0],
    delimiterLength: match[2].length,
    delimiterStart: line.start + match[1].length,
    delimiterEnd: line.start + match[1].length + match[2].length,
  };
}

function parseClosingFence(line, opening) {
  const match = /^( {0,3})([`~]+)[ \t]*$/.exec(line.content);
  if (
    !match ||
    match[2][0] !== opening.marker ||
    [...match[2]].some((marker) => marker !== opening.marker) ||
    match[2].length < opening.delimiterLength
  ) {
    return null;
  }
  return {
    delimiterLength: match[2].length,
    delimiterStart: line.start + match[1].length,
    delimiterEnd: line.start + match[1].length + match[2].length,
  };
}

function parseFlowId(body) {
  try {
    const value = YAML.parse(body);
    if (value && typeof value === "object" && !Array.isArray(value) && typeof value.id === "string") {
      return value.id;
    }
  } catch {
    // Invalid YAML is diagnosed by the parser/validator. It cannot own a save by ID.
  }
  return null;
}

/** Locate one complete top-level smooth-flow fence using raw Markdown offsets. */
export function findInlineFlowSource(markdown, flowId) {
  if (typeof markdown !== "string" || typeof flowId !== "string" || flowId.length === 0) {
    throw sourceError("FLOW_SOURCE_INVALID", "markdown and flowId are required");
  }

  const lines = linesWithOffsets(markdown);
  const matches = [];

  for (let index = 0; index < lines.length; index += 1) {
    const openingLine = lines[index];
    const opening = parseOpeningFence(openingLine);
    if (!opening) continue;

    let closingLine = null;
    let closing = null;
    let closingIndex = index + 1;
    for (; closingIndex < lines.length; closingIndex += 1) {
      closing = parseClosingFence(lines[closingIndex], opening);
      if (closing) {
        closingLine = lines[closingIndex];
        break;
      }
    }
    if (!closingLine || !closing) continue;

    const bodyStart = openingLine.end;
    const bodyEnd = closingLine.start;
    const body = markdown.slice(bodyStart, bodyEnd);
    if (parseFlowId(body) === flowId) {
      matches.push({
        flowId,
        fenceStart: openingLine.start,
        fenceEnd: closingLine.end,
        bodyStart,
        bodyEnd,
        body,
        marker: opening.marker,
        delimiterLength: opening.delimiterLength,
        closingDelimiterLength: closing.delimiterLength,
        openDelimiterStart: opening.delimiterStart,
        openDelimiterEnd: opening.delimiterEnd,
        closeDelimiterStart: closing.delimiterStart,
        closeDelimiterEnd: closing.delimiterEnd,
        lineEnding: openingLine.eol || (markdown.includes("\r\n") ? "\r\n" : "\n"),
      });
    }

    index = closingIndex;
  }

  if (matches.length === 0) {
    throw sourceError("FLOW_SOURCE_NOT_FOUND", `inline flow ${flowId} was not found`);
  }
  if (matches.length > 1) {
    throw sourceError("FLOW_SOURCE_AMBIGUOUS", `inline flow ${flowId} is not unique`);
  }
  return matches[0];
}

function scalarKey(pair) {
  return YAML.isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
}

function createNode(document, value) {
  return document.createNode(value, { keepUndefined: false });
}

function reconcileNode(document, currentNode, candidateValue) {
  if (Array.isArray(candidateValue)) {
    if (!YAML.isSeq(currentNode)) return createNode(document, candidateValue);
    reconcileSequence(document, currentNode, candidateValue);
    return currentNode;
  }

  if (candidateValue && typeof candidateValue === "object") {
    if (!YAML.isMap(currentNode)) return createNode(document, candidateValue);
    reconcileMap(document, currentNode, candidateValue);
    return currentNode;
  }

  if (YAML.isScalar(currentNode)) {
    currentNode.value = candidateValue;
    return currentNode;
  }
  return createNode(document, candidateValue);
}

function reconcileMap(document, map, candidate) {
  const candidateKeys = Object.keys(candidate);
  const remaining = new Set(candidateKeys);
  const retainedPairs = [];

  for (const pair of map.items) {
    const key = scalarKey(pair);
    if (!Object.hasOwn(candidate, key)) continue;
    pair.value = reconcileNode(document, pair.value, candidate[key]);
    retainedPairs.push(pair);
    remaining.delete(key);
  }

  for (const key of candidateKeys) {
    if (!remaining.has(key)) continue;
    const addition = document.createPair(key, candidate[key]);
    retainedPairs.push(addition);
  }

  map.items = retainedPairs;
}

function stableItemId(value) {
  return value && typeof value === "object" && !Array.isArray(value) && typeof value.id === "string"
    ? value.id
    : null;
}

function sequenceNodeId(node) {
  if (!YAML.isMap(node)) return null;
  const pair = node.items.find((item) => scalarKey(item) === "id");
  return pair && YAML.isScalar(pair.value) && typeof pair.value.value === "string"
    ? pair.value.value
    : null;
}

function reconcileSequence(document, sequence, candidate) {
  const candidateHasStableIds = candidate.every((item) => stableItemId(item) !== null);
  const currentById = new Map();
  if (candidateHasStableIds) {
    for (const item of sequence.items) {
      const id = sequenceNodeId(item);
      if (id !== null && !currentById.has(id)) currentById.set(id, item);
    }
  }

  sequence.items = candidate.map((value, index) => {
    if (candidateHasStableIds) {
      const retained = currentById.get(stableItemId(value));
      return retained ? reconcileNode(document, retained, value) : createNode(document, value);
    }
    const retained = sequence.items[index];
    return retained ? reconcileNode(document, retained, value) : createNode(document, value);
  });
}

function normalizeLineEndings(value, lineEnding) {
  return value.replace(/\r\n|\r|\n/g, lineEnding);
}

/** Reconcile domain values into the current YAML AST while retaining stable-ID nodes and comments. */
export function reconcileFlowYaml(currentBody, candidateDocument) {
  if (typeof currentBody !== "string" || !candidateDocument || typeof candidateDocument !== "object") {
    throw sourceError("FLOW_SOURCE_INVALID", "currentBody and candidateDocument are required");
  }

  let currentValue;
  let document;
  try {
    document = YAML.parseDocument(currentBody, {
      keepSourceTokens: true,
      prettyErrors: false,
      strict: true,
      uniqueKeys: true,
    });
    if (document.errors.length > 0) throw document.errors[0];
    currentValue = document.toJS();
  } catch (error) {
    throw sourceError("FLOW_SOURCE_INVALID", "current flow YAML is invalid", error);
  }

  if (isDeepStrictEqual(currentValue, candidateDocument)) return currentBody;
  if (!YAML.isMap(document.contents)) {
    throw sourceError("FLOW_SOURCE_INVALID", "flow YAML must contain a mapping");
  }

  reconcileMap(document, document.contents, candidateDocument);
  const lineEnding = currentBody.includes("\r\n") ? "\r\n" : "\n";
  const hadTrailingLineEnding = /(?:\r\n|\n)$/.test(currentBody);
  let nextBody = normalizeLineEndings(document.toString({ lineWidth: 0 }), lineEnding);
  if (!hadTrailingLineEnding) nextBody = nextBody.replace(/(?:\r\n|\n)$/, "");
  return nextBody;
}

function longestMarkerRun(body, marker) {
  let longest = 0;
  let current = 0;
  for (const character of body) {
    if (character === marker) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

/** Replace only the located fence, expanding its delimiter if the new body requires it. */
export function spliceInlineFlowSource(markdown, source, nextBody) {
  if (typeof markdown !== "string" || typeof nextBody !== "string") {
    throw sourceError("FLOW_SOURCE_INVALID", "markdown and nextBody must be strings");
  }
  if (
    !source ||
    markdown.slice(source.bodyStart, source.bodyEnd) !== source.body ||
    source.fenceStart > source.bodyStart ||
    source.bodyEnd > source.fenceEnd
  ) {
    throw sourceError("FLOW_SOURCE_STALE", "inline flow offsets no longer match the raw Markdown");
  }

  const lineEnding = source.lineEnding || "\n";
  let normalizedBody = normalizeLineEndings(nextBody, lineEnding);
  if (normalizedBody.length > 0 && !normalizedBody.endsWith(lineEnding)) {
    normalizedBody += lineEnding;
  }

  const delimiterLength = Math.max(
    source.delimiterLength,
    longestMarkerRun(normalizedBody, source.marker) + 1,
  );
  const delimiter = source.marker.repeat(delimiterLength);

  return [
    markdown.slice(0, source.openDelimiterStart),
    delimiter,
    markdown.slice(source.openDelimiterEnd, source.bodyStart),
    normalizedBody,
    markdown.slice(source.bodyEnd, source.closeDelimiterStart),
    delimiter,
    markdown.slice(source.closeDelimiterEnd),
  ].join("");
}

function addRevisionField(hash, value) {
  const bytes = Buffer.from(String(value), "utf8");
  hash.update(String(bytes.byteLength));
  hash.update(":");
  hash.update(bytes);
  hash.update("\0");
}

/** Revision over the logical locator, stable flow ID, and exact writable body bytes. */
export function createInlineFlowRevision({ pageSourcePath, flowId, body }) {
  if (
    typeof pageSourcePath !== "string" ||
    typeof flowId !== "string" ||
    typeof body !== "string"
  ) {
    throw sourceError("FLOW_SOURCE_INVALID", "revision fields must be strings");
  }

  const hash = crypto.createHash("sha256");
  hash.update("smooth-docs:inline-flow:v1\0");
  addRevisionField(hash, pageSourcePath);
  addRevisionField(hash, flowId);
  addRevisionField(hash, body);
  return `sha256:${hash.digest("hex")}`;
}

/** Revision over the current page descriptor and exact reusable flow bytes. */
export function createExternalFlowRevision({
  pageSourcePath,
  flowId,
  referenceBody,
  externalLocator,
  body,
}) {
  if (
    [pageSourcePath, flowId, referenceBody, externalLocator, body].some(
      (value) => typeof value !== "string",
    )
  ) {
    throw sourceError("FLOW_SOURCE_INVALID", "external revision fields must be strings");
  }
  const hash = crypto.createHash("sha256");
  hash.update("smooth-docs:external-flow:v1\0");
  addRevisionField(hash, pageSourcePath);
  addRevisionField(hash, flowId);
  addRevisionField(hash, referenceBody);
  addRevisionField(hash, externalLocator);
  addRevisionField(hash, body);
  return `sha256:${hash.digest("hex")}`;
}

/** Re-read a page and derive one reusable flow target without trusting a browser path. */
export async function loadExternalFlowSource({
  docsRoot,
  publishRoot,
  pagePath,
  pageSourcePath,
  flowId,
  maxBytes = 512 * 1024,
}) {
  if (
    !docsRoot ||
    !pagePath ||
    typeof pageSourcePath !== "string" ||
    typeof flowId !== "string"
  ) {
    throw sourceError("FLOW_SOURCE_INVALID", "external source identity is required");
  }

  const markdown = await readFileBounded(pagePath, {
    allowedRoots: [docsRoot],
    encoding: "utf8",
    maxBytes: Math.max(maxBytes, 1024 * 1024),
  });
  const parsedPage = parseFlowMarkdown(markdown, { maxBytes });
  const matches = [];

  for (const embed of parsedPage.embeds) {
    if (!embed.ok || embed.kind !== "reference" || !embed.reference) continue;
    let targetPath;
    let body;
    try {
      targetPath = await resolveExternalFlowPath({
        docsRoot,
        publishRoot,
        pagePath,
        src: embed.reference.src,
      });
      body = await readFileBounded(targetPath, {
        allowedRoots: [docsRoot],
        encoding: "utf8",
        maxBytes,
      });
    } catch {
      continue;
    }
    const parsed = parseFlowYaml(body, { allowReference: false, maxBytes });
    if (!parsed.ok || parsed.kind !== "document" || parsed.document?.id !== flowId) continue;
    const logicalTargetPath = path.resolve(
      path.dirname(pagePath),
      ...embed.reference.src.replace(/\\/g, "/").split("/"),
    );
    matches.push({ embed, targetPath, logicalTargetPath, body, document: parsed.document });
  }

  if (matches.length === 0) {
    throw sourceError("FLOW_SOURCE_NOT_FOUND", `external flow ${flowId} was not found`);
  }
  if (matches.length > 1) {
    throw sourceError("FLOW_SOURCE_AMBIGUOUS", `external flow ${flowId} is not unique`);
  }

  const match = matches[0];
  const externalLocator = path
    .relative(path.resolve(docsRoot), match.logicalTargetPath)
    .split(path.sep)
    .join("/");
  const revision = createExternalFlowRevision({
    pageSourcePath,
    flowId,
    referenceBody: match.embed.sourceText,
    externalLocator,
    body: match.body,
  });
  return {
    markdown,
    targetPath: match.targetPath,
    logicalTargetPath: match.logicalTargetPath,
    reference: match.embed.reference.src,
    referenceBody: match.embed.sourceText,
    externalLocator,
    body: match.body,
    document: match.document,
    revision,
  };
}

/** Re-derive current ownership and prepare a target-only reusable YAML replacement. */
export async function prepareExternalFlowSave(options) {
  const current = await loadExternalFlowSource(options);
  if (current.revision !== options.baseRevision) {
    throw sourceError("REVISION_CONFLICT", "The external flow reference or source changed.");
  }
  if (!options.candidateDocument || options.candidateDocument.id !== options.flowId) {
    throw sourceError("FLOW_SOURCE_INVALID", "candidate flow ID must match the source identity");
  }
  if (isDeepStrictEqual(current.document, options.candidateDocument)) {
    return { ...current, changed: false, nextBody: current.body };
  }

  const nextBody = reconcileFlowYaml(current.body, options.candidateDocument);
  return {
    ...current,
    changed: nextBody !== current.body,
    nextBody,
    revision: createExternalFlowRevision({
      pageSourcePath: options.pageSourcePath,
      flowId: options.flowId,
      referenceBody: current.referenceBody,
      externalLocator: current.externalLocator,
      body: nextBody,
    }),
  };
}

/** Prepare, but do not write, one target-only inline flow update. */
export function prepareInlineFlowSave({
  markdown,
  pageSourcePath,
  flowId,
  candidateDocument,
}) {
  const source = findInlineFlowSource(markdown, flowId);
  let currentDocument;
  try {
    currentDocument = YAML.parse(source.body);
  } catch (error) {
    throw sourceError("FLOW_SOURCE_INVALID", "current flow YAML is invalid", error);
  }

  if (isDeepStrictEqual(currentDocument, candidateDocument)) {
    return {
      changed: false,
      markdown,
      body: source.body,
      revision: createInlineFlowRevision({ pageSourcePath, flowId, body: source.body }),
      source,
    };
  }

  const reconciledBody = reconcileFlowYaml(source.body, candidateDocument);
  const nextMarkdown = spliceInlineFlowSource(markdown, source, reconciledBody);
  const nextSource = findInlineFlowSource(nextMarkdown, flowId);
  return {
    changed: true,
    markdown: nextMarkdown,
    body: nextSource.body,
    revision: createInlineFlowRevision({ pageSourcePath, flowId, body: nextSource.body }),
    source: nextSource,
  };
}
