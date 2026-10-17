import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

export const MAX_FLOW_SOURCE_BYTES = 1024 * 1024;

const schema = JSON.parse(
  readFileSync(new URL("../../src/docs-flow/schema.json", import.meta.url), "utf8"),
);
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictNumbers: true,
});
const validateSchema = ajv.compile(schema);

const COLLECTION_LIMITS = {
  lanes: 32,
  nodes: 100,
  edges: 150,
  stories: 32,
};

export function validateFlowDocument(value, options = {}) {
  const locate = typeof options.locate === "function" ? options.locate : null;
  const maxBytes = options.maxBytes ?? MAX_FLOW_SOURCE_BYTES;
  const diagnostics = [];
  const byteLength = jsonByteLength(value);

  if (byteLength === null) {
    return invalidResult([
      createDiagnostic(
        "FLOW_SCHEMA_INVALID",
        "The flow must be an acyclic JSON-compatible value.",
        undefined,
        undefined,
        locate,
      ),
    ]);
  }

  if (byteLength > maxBytes) {
    return invalidResult([
      createDiagnostic(
        "FLOW_SOURCE_TOO_LARGE",
        `The flow exceeds the ${maxBytes}-byte source limit.`,
        undefined,
        undefined,
        locate,
      ),
    ]);
  }

  const limitDiagnostic = findCollectionLimitDiagnostic(value, locate);
  if (limitDiagnostic) return invalidResult([limitDiagnostic]);

  if (!validateSchema(value)) {
    for (const error of validateSchema.errors ?? []) {
      const path = ajvErrorPath(error);
      diagnostics.push(
        createDiagnostic(
          schemaDiagnosticCode(error),
          schemaDiagnosticMessage(error, path),
          path,
          subjectIdForPath(value, path),
          locate,
        ),
      );
    }

    return invalidResult(dedupeDiagnostics(diagnostics));
  }

  validateUniqueIds(value, diagnostics, locate);
  validateReferences(value, diagnostics, locate);
  validateLinks(value, diagnostics, locate);
  validateFinitePositions(value, diagnostics, locate);

  if (diagnostics.length > 0) return invalidResult(diagnostics);

  return {
    ok: true,
    document: value,
    diagnostics: [],
  };
}

function invalidResult(diagnostics) {
  return {
    ok: false,
    diagnostics,
  };
}

function jsonByteLength(value) {
  try {
    const json = JSON.stringify(value);
    return typeof json === "string" ? Buffer.byteLength(json, "utf8") : null;
  } catch {
    return null;
  }
}

function findCollectionLimitDiagnostic(value, locate) {
  if (!isRecord(value)) return null;

  for (const [name, maximum] of Object.entries(COLLECTION_LIMITS)) {
    const collection = value[name];
    if (Array.isArray(collection) && collection.length > maximum) {
      return createDiagnostic(
        "FLOW_COLLECTION_LIMIT_EXCEEDED",
        `${name} contains ${collection.length} items; at most ${maximum} are allowed.`,
        name,
        undefined,
        locate,
      );
    }
  }

  if (Array.isArray(value.nodes)) {
    for (let index = 0; index < value.nodes.length; index += 1) {
      const links = value.nodes[index]?.links;
      if (Array.isArray(links) && links.length > 16) {
        const path = `nodes[${index}].links`;
        return createDiagnostic(
          "FLOW_COLLECTION_LIMIT_EXCEEDED",
          `${path} contains ${links.length} items; at most 16 are allowed.`,
          path,
          value.nodes[index]?.id,
          locate,
        );
      }
    }
  }

  if (Array.isArray(value.stories)) {
    for (let index = 0; index < value.stories.length; index += 1) {
      const steps = value.stories[index]?.steps;
      if (Array.isArray(steps) && steps.length > 300) {
        const path = `stories[${index}].steps`;
        return createDiagnostic(
          "FLOW_COLLECTION_LIMIT_EXCEEDED",
          `${path} contains ${steps.length} items; at most 300 are allowed.`,
          path,
          value.stories[index]?.id,
          locate,
        );
      }
    }
  }

  return null;
}

function validateUniqueIds(value, diagnostics, locate) {
  const collections = [
    ["lanes", "LANE"],
    ["nodes", "NODE"],
    ["edges", "EDGE"],
    ["stories", "STORY"],
  ];

  for (const [collectionName, entityName] of collections) {
    const seen = new Set();
    for (const [index, item] of (value[collectionName] ?? []).entries()) {
      if (seen.has(item.id)) {
        const path = `${collectionName}[${index}].id`;
        diagnostics.push(
          createDiagnostic(
            `DUPLICATE_${entityName}_ID`,
            `${entityName.toLowerCase()} ID ${item.id} is duplicated.`,
            path,
            item.id,
            locate,
          ),
        );
      } else {
        seen.add(item.id);
      }
    }
  }
}

function validateReferences(value, diagnostics, locate) {
  const laneIds = new Set((value.lanes ?? []).map((lane) => lane.id));
  const nodeIds = new Set(value.nodes.map((node) => node.id));
  const edgeIds = new Set(value.edges.map((edge) => edge.id));

  for (const [index, node] of value.nodes.entries()) {
    if (node.lane && !laneIds.has(node.lane)) {
      const path = `nodes[${index}].lane`;
      diagnostics.push(
        createDiagnostic(
          "NODE_LANE_NOT_FOUND",
          `Node ${node.id} refers to missing lane ${node.lane}.`,
          path,
          node.id,
          locate,
        ),
      );
    }
  }

  for (const [index, edge] of value.edges.entries()) {
    if (!nodeIds.has(edge.from)) {
      const path = `edges[${index}].from`;
      diagnostics.push(
        createDiagnostic(
          "EDGE_SOURCE_NOT_FOUND",
          `Edge ${edge.id} refers to missing source node ${edge.from}.`,
          path,
          edge.id,
          locate,
        ),
      );
    }

    if (!nodeIds.has(edge.to)) {
      const path = `edges[${index}].to`;
      diagnostics.push(
        createDiagnostic(
          "EDGE_TARGET_NOT_FOUND",
          `Edge ${edge.id} refers to missing target node ${edge.to}.`,
          path,
          edge.id,
          locate,
        ),
      );
    }
  }

  for (const [storyIndex, story] of (value.stories ?? []).entries()) {
    for (const [stepIndex, step] of story.steps.entries()) {
      if (step.node && !nodeIds.has(step.node)) {
        const path = `stories[${storyIndex}].steps[${stepIndex}].node`;
        diagnostics.push(
          createDiagnostic(
            "STORY_NODE_NOT_FOUND",
            `Story ${story.id} refers to missing node ${step.node}.`,
            path,
            story.id,
            locate,
          ),
        );
      }

      if (step.edge && !edgeIds.has(step.edge)) {
        const path = `stories[${storyIndex}].steps[${stepIndex}].edge`;
        diagnostics.push(
          createDiagnostic(
            "STORY_EDGE_NOT_FOUND",
            `Story ${story.id} refers to missing edge ${step.edge}.`,
            path,
            story.id,
            locate,
          ),
        );
      }
    }
  }
}

function validateLinks(value, diagnostics, locate) {
  for (const [nodeIndex, node] of value.nodes.entries()) {
    for (const [linkIndex, link] of (node.links ?? []).entries()) {
      if (isSafeLink(link)) continue;

      const path = `nodes[${nodeIndex}].links[${linkIndex}].href`;
      diagnostics.push(
        createDiagnostic(
          "UNSAFE_FLOW_LINK",
          `Node ${node.id} contains an unsafe ${link.kind} link.`,
          path,
          node.id,
          locate,
        ),
      );
    }
  }
}

function isSafeLink(link) {
  const href = link.href;
  if (containsControlCharacter(href) || href.startsWith("//")) return false;

  if (link.kind === "external") {
    try {
      const url = new URL(href);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  if (link.kind === "docs") {
    if (href.startsWith("#")) return href.length > 1;
    if (href.startsWith("/") || href.includes("\\")) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return false;

    const withoutSuffix = href.split(/[?#]/, 1)[0];
    return withoutSuffix
      .split("/")
      .filter(Boolean)
      .every((segment) => segment !== "..");
  }

  if (link.kind === "source") {
    if (/^(?:javascript|data|file):/i.test(href)) return false;
    if (/^https?:/i.test(href)) {
      try {
        const url = new URL(href);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }
    return true;
  }

  return false;
}

function containsControlCharacter(value) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function validateFinitePositions(value, diagnostics, locate) {
  for (const [index, node] of value.nodes.entries()) {
    if (!node.position) continue;

    for (const coordinate of ["x", "y"]) {
      if (Number.isFinite(node.position[coordinate])) continue;
      const path = `nodes[${index}].position.${coordinate}`;
      diagnostics.push(
        createDiagnostic(
          "POSITION_NOT_FINITE",
          `Node ${node.id} has a non-finite ${coordinate} position.`,
          path,
          node.id,
          locate,
        ),
      );
    }
  }
}

function ajvErrorPath(error) {
  const segments = error.instancePath
    .split("/")
    .slice(1)
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

  if (error.keyword === "additionalProperties") {
    segments.push(error.params.additionalProperty);
  } else if (error.keyword === "required") {
    segments.push(error.params.missingProperty);
  }

  return domainPath(segments);
}

function domainPath(segments) {
  let output = "";
  for (const segment of segments) {
    if (/^(?:0|[1-9]\d*)$/.test(String(segment))) {
      output += `[${segment}]`;
    } else {
      output += output ? `.${segment}` : String(segment);
    }
  }
  return output || undefined;
}

function schemaDiagnosticCode(error) {
  if (error.keyword === "additionalProperties") return "UNKNOWN_FLOW_FIELD";
  if (error.keyword === "maxItems") return "FLOW_COLLECTION_LIMIT_EXCEEDED";
  return "FLOW_SCHEMA_INVALID";
}

function schemaDiagnosticMessage(error, path) {
  if (error.keyword === "additionalProperties") {
    return `Unknown flow field ${path}.`;
  }
  if (error.keyword === "required") {
    return `Required flow field ${path} is missing.`;
  }
  return `${path ? `${path} ` : "The flow "}${error.message ?? "is invalid"}.`;
}

function subjectIdForPath(value, path) {
  const match = path?.match(/^(lanes|nodes|edges|stories)\[(\d+)]/);
  if (!match) return undefined;
  return value[match[1]]?.[Number(match[2])]?.id;
}

function createDiagnostic(code, message, path, subjectId, locate) {
  const diagnostic = {
    code,
    severity: "error",
    message,
  };
  if (path) diagnostic.path = path;
  if (subjectId) diagnostic.subjectId = subjectId;

  const location = locate?.(path);
  if (Number.isInteger(location?.line) && location.line > 0) diagnostic.line = location.line;
  if (Number.isInteger(location?.column) && location.column > 0) {
    diagnostic.column = location.column;
  }
  return diagnostic;
}

function dedupeDiagnostics(diagnostics) {
  const seen = new Set();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.code}\u0000${diagnostic.path ?? ""}\u0000${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
