import MarkdownIt from "markdown-it";
import {
  LineCounter,
  isAlias,
  isMap,
  isSeq,
  parseDocument,
} from "yaml";
import { MAX_FLOW_SOURCE_BYTES, validateFlowDocument } from "./validate.mjs";

const markdownParser = new MarkdownIt({ html: true });
const DOCUMENT_FIELDS = new Set([
  "version",
  "id",
  "kind",
  "title",
  "description",
  "direction",
  "lanes",
  "nodes",
  "edges",
  "stories",
]);
const REFERENCE_FIELDS = new Set(["src", "view", "height"]);
const STABLE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function parseFlowYaml(source, options = {}) {
  const sourceText = typeof source === "string" ? source : String(source ?? "");
  const maxBytes = options.maxBytes ?? MAX_FLOW_SOURCE_BYTES;

  if (Buffer.byteLength(sourceText, "utf8") > maxBytes) {
    return invalidYamlResult(sourceText, [
      diagnostic(
        "FLOW_SOURCE_TOO_LARGE",
        `The flow source exceeds the ${maxBytes}-byte limit.`,
        undefined,
        { line: 1, column: 1 },
      ),
    ]);
  }

  const lineCounter = new LineCounter();
  const yamlDocument = parseDocument(sourceText, {
    keepSourceTokens: true,
    lineCounter,
    merge: false,
    prettyErrors: true,
    schema: "core",
    strict: true,
    stringKeys: true,
    uniqueKeys: true,
    version: "1.2",
  });

  if (yamlDocument.errors.length > 0) {
    return invalidYamlResult(
      sourceText,
      yamlDocument.errors.map((error) => yamlErrorDiagnostic(error, lineCounter)),
      yamlDocument,
    );
  }

  const restrictedDiagnostics = findRestrictedYamlFeatures(yamlDocument, lineCounter);
  if (restrictedDiagnostics.length > 0) {
    return invalidYamlResult(sourceText, restrictedDiagnostics, yamlDocument);
  }

  let value;
  try {
    value = yamlDocument.toJS({ maxAliasCount: 0 });
  } catch (error) {
    return invalidYamlResult(
      sourceText,
      [
        diagnostic(
          "YAML_INVALID",
          error instanceof Error ? error.message : "The YAML source is invalid.",
          undefined,
          { line: 1, column: 1 },
        ),
      ],
      yamlDocument,
    );
  }

  const locate = createYamlLocator(yamlDocument, lineCounter);
  const keys = isRecord(value) ? Object.keys(value) : [];
  const containsReference = keys.includes("src");
  const containsDocumentField = keys.some((key) => DOCUMENT_FIELDS.has(key));

  if (containsReference && containsDocumentField) {
    return invalidYamlResult(
      sourceText,
      [
        diagnostic(
          "FLOW_SHAPE_MIXED",
          "A smooth-flow block cannot mix an external reference with a complete document.",
          "src",
          locate("src"),
        ),
      ],
      yamlDocument,
    );
  }

  if (containsReference) {
    if (options.allowReference === false) {
      return invalidYamlResult(
        sourceText,
        [
          diagnostic(
            "FLOW_REFERENCE_NOT_ALLOWED",
            "An external flow file must contain a complete document, not another reference.",
            "src",
            locate("src"),
          ),
        ],
        yamlDocument,
      );
    }

    const referenceDiagnostics = validateReferenceDescriptor(value, locate);
    if (referenceDiagnostics.length > 0) {
      return invalidYamlResult(sourceText, referenceDiagnostics, yamlDocument);
    }

    return {
      ok: true,
      kind: "reference",
      reference: {
        ...value,
        height: value.height ?? 560,
      },
      diagnostics: [],
      sourceText,
      editable: true,
      yamlDocument,
    };
  }

  if (isRecord(value) && Object.hasOwn(value, "version") && value.version !== 1) {
    return invalidYamlResult(
      sourceText,
      [
        diagnostic(
          "UNSUPPORTED_FLOW_VERSION",
          `Flow format version ${String(value.version)} is not supported.`,
          "version",
          locate("version"),
        ),
      ],
      yamlDocument,
    );
  }

  const validation = validateFlowDocument(value, {
    locate,
    maxBytes,
  });
  if (!validation.ok) {
    return invalidYamlResult(sourceText, validation.diagnostics, yamlDocument);
  }

  return {
    ok: true,
    kind: "document",
    document: value,
    diagnostics: [],
    sourceText,
    editable: true,
    yamlDocument,
  };
}

export function parseFlowMarkdown(markdown, options = {}) {
  const source = typeof markdown === "string" ? markdown : String(markdown ?? "");
  const tokens = markdownParser.parse(source, {});
  const lineStarts = createLineStarts(source);
  const embeds = [];
  const diagnostics = [];

  for (const token of tokens) {
    if (token.type !== "fence" || firstInfoToken(token.info) !== "smooth-flow") continue;

    const sourceRange = fenceSourceRange(source, lineStarts, token);
    const topLevel = token.level === 0 && sourceRange.openingIsTopLevel;
    const embed = {
      embedId: `smooth-flow-${embeds.length + 1}`,
      topLevel,
      delimiter: token.markup,
      info: token.info,
      startLine: sourceRange.startLine,
      endLine: sourceRange.endLine,
      startOffset: sourceRange.startOffset,
      endOffset: sourceRange.endOffset,
      bodyStart: sourceRange.bodyStartOffset,
      bodyEnd: sourceRange.bodyEndOffset,
      bodyStartOffset: sourceRange.bodyStartOffset,
      bodyEndOffset: sourceRange.bodyEndOffset,
      sourceText: topLevel ? sourceRange.body : token.content,
      fallbackText: topLevel ? sourceRange.body : token.content,
      diagnostics: [],
    };

    if (!topLevel) {
      const nestedDiagnostic = diagnostic(
        "FLOW_FENCE_NOT_TOP_LEVEL",
        "Version 1 visual editing supports only top-level smooth-flow fences.",
        undefined,
        {
          line: sourceRange.startLine,
          column: sourceRange.openingColumn,
        },
      );
      embed.kind = "invalid";
      embed.editable = false;
      embed.diagnostics.push(nestedDiagnostic);
      diagnostics.push(nestedDiagnostic);
      embeds.push(embed);
      continue;
    }

    if (!sourceRange.closed) {
      const unclosedDiagnostic = diagnostic(
        "FLOW_FENCE_UNCLOSED",
        "The smooth-flow fence is not closed.",
        undefined,
        {
          line: sourceRange.startLine,
          column: sourceRange.openingColumn,
        },
      );
      embed.kind = "invalid";
      embed.editable = false;
      embed.diagnostics.push(unclosedDiagnostic);
      diagnostics.push(unclosedDiagnostic);
      embeds.push(embed);
      continue;
    }

    const parsed = parseFlowYaml(sourceRange.body, options);
    const adjustedDiagnostics = parsed.diagnostics.map((item) =>
      offsetBodyDiagnostic(item, sourceRange.startLine),
    );
    Object.assign(embed, parsed, { diagnostics: adjustedDiagnostics });
    if (parsed.kind === "document" && parsed.document?.id) embed.flowId = parsed.document.id;
    diagnostics.push(...adjustedDiagnostics);
    embeds.push(embed);
  }

  const ids = new Map();
  for (const embed of embeds) {
    if (!embed.ok || embed.kind !== "document" || !embed.document?.id) continue;
    const first = ids.get(embed.document.id);
    if (!first) {
      ids.set(embed.document.id, embed);
      continue;
    }

    const duplicateDiagnostic = diagnostic(
      "FLOW_ID_AMBIGUOUS",
      `Flow ID ${embed.document.id} is duplicated in this Markdown file.`,
      "id",
      {
        line: embed.startLine,
        column: embed.sourceText.match(/^\s*/)?.[0].length + 1 || 1,
      },
    );
    embed.ok = false;
    embed.editable = false;
    embed.diagnostics.push(duplicateDiagnostic);
    diagnostics.push(duplicateDiagnostic);
  }

  return {
    embeds,
    diagnostics,
  };
}

function invalidYamlResult(sourceText, diagnostics, yamlDocument) {
  return {
    ok: false,
    kind: "invalid",
    diagnostics,
    sourceText,
    fallbackText: sourceText,
    editable: false,
    ...(yamlDocument ? { yamlDocument } : {}),
  };
}

function validateReferenceDescriptor(value, locate) {
  const diagnostics = [];
  if (!isRecord(value)) {
    return [
      diagnostic(
        "FLOW_REFERENCE_INVALID",
        "An external flow reference must be a mapping.",
        undefined,
        locate(),
      ),
    ];
  }

  for (const key of Object.keys(value)) {
    if (!REFERENCE_FIELDS.has(key)) {
      diagnostics.push(
        diagnostic(
          "UNKNOWN_FLOW_FIELD",
          `Unknown external flow reference field ${key}.`,
          key,
          locate(key),
        ),
      );
    }
  }

  if (!isSafeExternalReference(value.src)) {
    diagnostics.push(
      diagnostic(
        "EXTERNAL_REFERENCE_INVALID",
        "src must be a safe relative POSIX path ending in .docs-flow.yml.",
        "src",
        locate("src"),
      ),
    );
  }

  if (value.view !== undefined && !isStableId(value.view)) {
    diagnostics.push(
      diagnostic(
        "FLOW_REFERENCE_INVALID",
        "view must be a stable story ID.",
        "view",
        locate("view"),
      ),
    );
  }

  if (
    value.height !== undefined &&
    (!Number.isInteger(value.height) || value.height < 320 || value.height > 1200)
  ) {
    diagnostics.push(
      diagnostic(
        "FLOW_REFERENCE_INVALID",
        "height must be an integer from 320 through 1200.",
        "height",
        locate("height"),
      ),
    );
  }

  return diagnostics;
}

function isSafeExternalReference(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.includes("\\") || value.includes("?") || value.includes("#")) return false;
  if (value.startsWith("/") || value.startsWith("//")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  if (/^[a-z]:/i.test(value)) return false;
  if (!value.endsWith(".docs-flow.yml")) return false;

  return value.split("/").every((segment) => segment !== "..");
}

function isStableId(value) {
  return typeof value === "string" && value.length <= 64 && STABLE_ID_PATTERN.test(value);
}

function yamlErrorDiagnostic(error, lineCounter) {
  const location = error.linePos?.[0] ??
    (Array.isArray(error.pos) && Number.isInteger(error.pos[0])
      ? lineCounter.linePos(error.pos[0])
      : { line: 1, col: 1 });
  return diagnostic(
    "YAML_INVALID",
    cleanYamlMessage(error.message),
    undefined,
    {
      line: location.line,
      column: location.col,
    },
  );
}

function cleanYamlMessage(message) {
  return String(message).split("\n\n", 1)[0].trim() || "The YAML source is invalid.";
}

function findRestrictedYamlFeatures(yamlDocument, lineCounter) {
  const diagnostics = [];
  const reported = new Set();

  function report(node, feature, message) {
    const location = yamlNodeLocation(node, lineCounter);
    const key = `${feature}:${location.line}:${location.column}`;
    if (reported.has(key)) return;
    reported.add(key);
    diagnostics.push(diagnostic("YAML_FEATURE_FORBIDDEN", message, undefined, location));
  }

  function walk(node) {
    if (!node || typeof node !== "object") return;

    if (isAlias(node)) {
      report(node, "alias", "YAML aliases are not allowed in smooth-flow documents.");
      return;
    }

    if (node.anchor) {
      report(node, "anchor", "YAML anchors are not allowed in smooth-flow documents.");
    }

    if (node.tag && !String(node.tag).startsWith("tag:yaml.org,2002:")) {
      report(node, "tag", "Custom YAML tags are not allowed in smooth-flow documents.");
    }

    if (isMap(node)) {
      for (const pair of node.items) {
        if (pair?.key?.value === "<<") {
          report(pair.key, "merge", "YAML merge keys are not allowed in smooth-flow documents.");
        }
        walk(pair?.key);
        walk(pair?.value);
      }
      return;
    }

    if (isSeq(node)) {
      for (const item of node.items) walk(item);
    }
  }

  walk(yamlDocument.contents);
  return diagnostics;
}

function createYamlLocator(yamlDocument, lineCounter) {
  return (path) => {
    const segments = parseDomainPath(path);
    let node = yamlDocument.contents;

    if (segments.length > 0) {
      for (let length = segments.length; length > 0; length -= 1) {
        const candidate = yamlDocument.getIn(segments.slice(0, length), true);
        if (candidate && typeof candidate === "object") {
          node = candidate;
          break;
        }
      }
    }

    return yamlNodeLocation(node, lineCounter);
  };
}

function parseDomainPath(path) {
  if (!path) return [];
  const segments = [];
  const pattern = /(?:^|\.)([^.\[]+)|\[(\d+)]/g;
  for (const match of path.matchAll(pattern)) {
    segments.push(match[1] ?? Number(match[2]));
  }
  return segments;
}

function yamlNodeLocation(node, lineCounter) {
  const offset = Array.isArray(node?.range) && Number.isInteger(node.range[0]) ? node.range[0] : 0;
  const location = lineCounter.linePos(offset);
  return {
    line: location.line,
    column: location.col,
  };
}

function firstInfoToken(info) {
  return String(info ?? "").trim().split(/\s+/, 1)[0];
}

function createLineStarts(source) {
  const starts = [0];
  const newline = /\r\n|\n|\r/g;
  for (const match of source.matchAll(newline)) starts.push(match.index + match[0].length);
  return starts;
}

function fenceSourceRange(source, lineStarts, token) {
  const [startLineIndex, endLineIndex] = token.map ?? [0, 0];
  const startOffset = lineStarts[startLineIndex] ?? source.length;
  const endOffset = lineStarts[endLineIndex] ?? source.length;
  const openingEndOffset = lineStarts[startLineIndex + 1] ?? source.length;
  const openingLine = source.slice(startOffset, lineContentEnd(source, openingEndOffset));
  const openingMatch = openingLine.match(/^([ \t]{0,3})(`{3,}|~{3,})(.*)$/);
  const openingColumn = (openingMatch?.[1].length ?? 0) + 1;
  const closingLineIndex = Math.max(startLineIndex, endLineIndex - 1);
  const closingOffset = lineStarts[closingLineIndex] ?? endOffset;
  const closingLine = source.slice(closingOffset, lineContentEnd(source, endOffset));
  const markerCharacter = token.markup[0] ?? "`";
  const closingPattern = new RegExp(
    `^[ \\t]{0,3}${escapeRegExp(markerCharacter)}{${token.markup.length},}[ \\t]*$`,
  );
  const closed = closingLineIndex > startLineIndex && closingPattern.test(closingLine);
  const bodyStartOffset = openingEndOffset;
  const bodyEndOffset = closed ? closingOffset : endOffset;

  return {
    startLine: startLineIndex + 1,
    endLine: endLineIndex,
    startOffset,
    endOffset,
    bodyStartOffset,
    bodyEndOffset,
    body: source.slice(bodyStartOffset, bodyEndOffset),
    closed,
    openingColumn,
    openingIsTopLevel: Boolean(openingMatch),
  };
}

function lineContentEnd(source, exclusiveLineEnd) {
  let end = exclusiveLineEnd;
  if (end > 0 && source[end - 1] === "\n") end -= 1;
  if (end > 0 && source[end - 1] === "\r") end -= 1;
  return end;
}

function offsetBodyDiagnostic(item, openingLine) {
  if (!Number.isInteger(item.line)) return { ...item };
  return {
    ...item,
    line: item.line + openingLine,
  };
}

function diagnostic(code, message, path, location) {
  const result = {
    code,
    severity: "error",
    message,
  };
  if (path) result.path = path;
  if (Number.isInteger(location?.line) && location.line > 0) result.line = location.line;
  if (Number.isInteger(location?.column) && location.column > 0) {
    result.column = location.column;
  }
  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
