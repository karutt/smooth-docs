import assert from "node:assert/strict";
import test from "node:test";
import YAML from "yaml";
import {
  createInlineFlowRevision,
  findInlineFlowSource,
  prepareInlineFlowSave,
  reconcileFlowYaml,
  spliceInlineFlowSource,
} from "../../scripts/docs-flow/source.mjs";

const PAGE_SOURCE_PATH = "docs/docs/guide.md";

function candidate(overrides = {}) {
  return {
    version: 1,
    id: "parking-start",
    kind: "workflow",
    title: "Parking start",
    direction: "right",
    nodes: [
      { id: "scan", type: "action", label: "Scan" },
      { id: "validate", type: "decision", label: "Validate" },
      { id: "finish", type: "service", label: "Finish" },
    ],
    edges: [
      { id: "scan-validate", from: "scan", to: "validate" },
      { id: "validate-finish", from: "validate", to: "finish" },
    ],
    ...overrides,
  };
}

function inlineMarkdown(body, { close = "```", eol = "\n", open = "```smooth-flow" } = {}) {
  return [
    "---",
    "title: Raw source offsets",
    "---",
    "",
    "# Raw source offsets",
    "",
    "Before sentinel.",
    "",
    "```yaml",
    "not: the target",
    "```",
    "",
    open,
    body.replace(/\r?\n/g, eol).replace(new RegExp(`${eol}$`), ""),
    close,
    "",
    "After sentinel.",
    "",
  ].join(eol);
}

function sourceBody() {
  return [
    "version: 1",
    "title: Parking start",
    "id: parking-start",
    "kind: workflow",
    "direction: right",
    "nodes:",
    "  # scan stays with the retained node",
    "  - label: Scan",
    "    type: action",
    "    id: scan",
    "  # validate stays with the retained node",
    "  - label: Validate",
    "    type: decision",
    "    id: validate",
    "  # finish moves with the retained node",
    "  - label: Finish",
    "    type: service",
    "    id: finish",
    "edges:",
    "  - id: scan-validate",
    "    from: scan",
    "    to: validate",
    "  - id: validate-finish",
    "    from: validate",
    "    to: finish",
    "",
  ].join("\n");
}

test("findInlineFlowSource reports offsets into exact raw Markdown", () => {
  const body = sourceBody();
  const markdown = inlineMarkdown(body);
  const source = findInlineFlowSource(markdown, "parking-start");

  assert.equal(markdown.slice(source.bodyStart, source.bodyEnd), body);
  assert.equal(markdown.slice(source.fenceStart, source.bodyStart), "```smooth-flow\n");
  assert.equal(markdown.slice(source.bodyEnd, source.fenceEnd), "```\n");
  assert.equal(source.body, body);
  assert.equal(source.marker, "`");
  assert.equal(source.delimiterLength, 3);
  assert.equal(source.lineEnding, "\n");
});

test("reconcileFlowYaml preserves retained comments and existing key order", () => {
  const current = sourceBody();
  const nextCandidate = candidate({
    nodes: [
      { id: "scan", type: "action", label: "Scan QR" },
      { id: "validate", type: "decision", label: "Validate" },
      { id: "finish", type: "service", label: "Finish" },
    ],
  });

  const next = reconcileFlowYaml(current, nextCandidate);

  assert.match(next, /# scan stays with the retained node/);
  const scanBlock = next.slice(next.indexOf("# scan"), next.indexOf("# validate"));
  assert.ok(scanBlock.indexOf("label: Scan QR") < scanBlock.indexOf("type: action"));
  assert.ok(scanBlock.indexOf("type: action") < scanBlock.indexOf("id: scan"));
  assert.ok(next.indexOf("title: Parking start") < next.indexOf("id: parking-start"));
  assert.deepEqual(YAML.parse(next), nextCandidate);
});

test("reconcileFlowYaml moves retained nodes with comments and supports add/delete/reorder", () => {
  const current = sourceBody();
  const nextCandidate = candidate({
    nodes: [
      { id: "finish", type: "service", label: "Finish" },
      { id: "scan", type: "action", label: "Scan" },
      { id: "notify", type: "external", label: "Notify" },
    ],
    edges: [{ id: "scan-notify", from: "scan", to: "notify", style: "async" }],
  });

  const next = reconcileFlowYaml(current, nextCandidate);

  assert.match(next, /# finish moves with the retained node/);
  assert.match(next, /# scan stays with the retained node/);
  assert.ok(next.indexOf("id: finish") < next.indexOf("id: scan"));
  assert.ok(next.indexOf("id: scan") < next.indexOf("id: notify"));
  assert.doesNotMatch(next, /id: validate/);
  assert.deepEqual(YAML.parse(next), nextCandidate);
});

test("prepareInlineFlowSave preserves CRLF and all Markdown outside the target", () => {
  const currentBody = sourceBody().replace(/\n/g, "\r\n");
  const markdown = inlineMarkdown(currentBody, { eol: "\r\n" });
  const beforeSource = findInlineFlowSource(markdown, "parking-start");
  const nextCandidate = candidate({ title: "Parking start updated" });

  const prepared = prepareInlineFlowSave({
    markdown,
    pageSourcePath: PAGE_SOURCE_PATH,
    flowId: "parking-start",
    candidateDocument: nextCandidate,
  });
  const afterSource = findInlineFlowSource(prepared.markdown, "parking-start");

  assert.equal(prepared.changed, true);
  assert.equal(
    prepared.markdown.slice(0, afterSource.fenceStart),
    markdown.slice(0, beforeSource.fenceStart),
  );
  assert.equal(
    prepared.markdown.slice(afterSource.fenceEnd),
    markdown.slice(beforeSource.fenceEnd),
  );
  assert.equal(/(?<!\r)\n/.test(prepared.markdown), false, "save must not introduce lone LF");
  assert.deepEqual(YAML.parse(afterSource.body), nextCandidate);
});

test("spliceInlineFlowSource lengthens only the target delimiter when its body needs it", () => {
  const markdown = inlineMarkdown(sourceBody());
  const source = findInlineFlowSource(markdown, "parking-start");
  const prefix = markdown.slice(0, source.fenceStart);
  const suffix = markdown.slice(source.fenceEnd);
  const nextBody = [sourceBody().trimEnd(), "description: |-", "  ```", "  example", "  ```", ""].join(
    "\n",
  );

  const nextMarkdown = spliceInlineFlowSource(markdown, source, nextBody);
  const nextSource = findInlineFlowSource(nextMarkdown, "parking-start");

  assert.equal(nextSource.delimiterLength, 4);
  assert.equal(nextMarkdown.slice(0, nextSource.fenceStart), prefix);
  assert.equal(nextMarkdown.slice(nextSource.fenceEnd), suffix);
  assert.equal(nextMarkdown.slice(nextSource.fenceStart, nextSource.bodyStart), "````smooth-flow\n");
  assert.equal(nextMarkdown.slice(nextSource.bodyEnd, nextSource.fenceEnd), "````\n");
  assert.equal(nextSource.body, nextBody);
});

test("inline revisions cover the logical locator, flow ID, and exact body bytes", () => {
  const body = sourceBody();
  const revision = createInlineFlowRevision({
    pageSourcePath: PAGE_SOURCE_PATH,
    flowId: "parking-start",
    body,
  });

  assert.match(revision, /^sha256:[0-9a-f]{64}$/);
  assert.equal(
    revision,
    createInlineFlowRevision({
      pageSourcePath: PAGE_SOURCE_PATH,
      flowId: "parking-start",
      body,
    }),
  );
  assert.notEqual(
    revision,
    createInlineFlowRevision({
      pageSourcePath: PAGE_SOURCE_PATH,
      flowId: "parking-start",
      body: `${body} `,
    }),
  );
  assert.notEqual(
    revision,
    createInlineFlowRevision({
      pageSourcePath: "docs/docs/other.md",
      flowId: "parking-start",
      body,
    }),
  );
  assert.notEqual(
    revision,
    createInlineFlowRevision({
      pageSourcePath: PAGE_SOURCE_PATH,
      flowId: "other-flow",
      body,
    }),
  );
});

test("prepareInlineFlowSave detects semantic no-op without rewriting or changing revision", () => {
  const markdown = inlineMarkdown(sourceBody());
  const source = findInlineFlowSource(markdown, "parking-start");
  const currentDocument = YAML.parse(source.body);
  const currentRevision = createInlineFlowRevision({
    pageSourcePath: PAGE_SOURCE_PATH,
    flowId: "parking-start",
    body: source.body,
  });

  const prepared = prepareInlineFlowSave({
    markdown,
    pageSourcePath: PAGE_SOURCE_PATH,
    flowId: "parking-start",
    candidateDocument: currentDocument,
  });

  assert.equal(prepared.changed, false);
  assert.equal(prepared.markdown, markdown);
  assert.equal(prepared.revision, currentRevision);
  assert.equal(prepared.body, source.body);
});
