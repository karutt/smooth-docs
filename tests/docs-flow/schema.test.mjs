import assert from "node:assert/strict";
import test from "node:test";
import { validateFlowDocument } from "../../scripts/docs-flow/index.mjs";

function node(id = "start") {
  return {
    id,
    type: "action",
    label: `Node ${id}`,
  };
}

function flow(overrides = {}) {
  return {
    version: 1,
    id: "schema-test",
    kind: "workflow",
    title: "Schema test",
    direction: "right",
    nodes: [node()],
    edges: [],
    ...overrides,
  };
}

function diagnosticSummary(result) {
  return result.diagnostics
    .map((diagnostic) => `${diagnostic.code}:${diagnostic.path ?? ""}`)
    .join(", ");
}

function assertValid(document) {
  const result = validateFlowDocument(document);
  assert.equal(result.ok, true, diagnosticSummary(result));
  assert.deepEqual(result.diagnostics, []);
  return result;
}

function assertInvalid(document, { code, path } = {}) {
  const result = validateFlowDocument(document);
  assert.equal(result.ok, false, "invalid input must not be accepted");
  assert.ok(result.diagnostics.length > 0, "invalid input must produce diagnostics");

  if (code) {
    assert.ok(
      result.diagnostics.some((diagnostic) => diagnostic.code === code),
      `expected ${code}; received ${diagnosticSummary(result)}`,
    );
  }

  if (path) {
    assert.ok(
      result.diagnostics.some((diagnostic) => diagnostic.path === path),
      `expected path ${path}; received ${diagnosticSummary(result)}`,
    );
  }

  for (const diagnostic of result.diagnostics) {
    assert.equal(diagnostic.severity, "error");
    assert.equal(typeof diagnostic.message, "string");
    assert.ok(diagnostic.message.length > 0);
  }

  return result;
}

test("accepts every inclusive scalar boundary in the v1 authored contract", () => {
  const id64 = `a${"1".repeat(63)}`;
  const externalPrefix = "https://example.test/";
  const externalHref = `${externalPrefix}${"x".repeat(2048 - externalPrefix.length)}`;

  assertValid(
    flow({
      id: id64,
      title: "T".repeat(200),
      description: "D".repeat(4000),
      direction: "down",
      lanes: [
        {
          id: "lane-one",
          label: "L".repeat(120),
          description: "D".repeat(1000),
        },
      ],
      nodes: [
        {
          id: "bounded-node",
          type: "note",
          label: "N".repeat(120),
          description: "D".repeat(2000),
          lane: "lane-one",
          owner: "O".repeat(120),
          status: "S".repeat(64),
          risk: "critical",
          position: { x: -1_000_000, y: 1_000_000 },
          links: [
            {
              kind: "external",
              href: externalHref,
              label: "X".repeat(120),
            },
          ],
        },
      ],
      edges: [
        {
          id: "bounded-edge",
          from: "bounded-node",
          to: "bounded-node",
          label: "E".repeat(160),
          style: "async",
        },
      ],
      stories: [
        {
          id: "bounded-story",
          label: "S".repeat(120),
          description: "D".repeat(1000),
          steps: Array.from({ length: 300 }, () => ({ node: "bounded-node" })),
        },
      ],
    }),
  );
});

test("accepts all collections at their inclusive maximum sizes", () => {
  const nodes = Array.from({ length: 100 }, (_, index) => node(`node-${index + 1}`));

  assertValid(
    flow({
      lanes: Array.from({ length: 32 }, (_, index) => ({
        id: `lane-${index + 1}`,
        label: `Lane ${index + 1}`,
      })),
      nodes,
      edges: Array.from({ length: 150 }, (_, index) => ({
        id: `edge-${index + 1}`,
        from: "node-1",
        to: `node-${(index % nodes.length) + 1}`,
      })),
      stories: Array.from({ length: 32 }, (_, index) => ({
        id: `story-${index + 1}`,
        label: `Story ${index + 1}`,
        steps: [{ node: "node-1" }],
      })),
    }),
  );
});

test("rejects unknown fields at the document and nested entity levels", async (t) => {
  await t.test("unknown document field", () => {
    assertInvalid(flow({ executable: "do-not-run" }), { path: "executable" });
  });

  await t.test("unknown nested field", () => {
    const document = flow();
    document.nodes[0].viewport = { zoom: 2 };
    assertInvalid(document, { path: "nodes[0].viewport" });
  });
});

test("rejects unsafe links and non-finite authored values", async (t) => {
  const unsafeLinks = [
    { kind: "external", href: "javascript:alert(1)" },
    { kind: "external", href: "data:text/html,unsafe" },
    { kind: "external", href: "file:///etc/passwd" },
    { kind: "external", href: "//evil.example/flow" },
    { kind: "docs", href: "../outside.md" },
    { kind: "docs", href: "guide.md\u0000hidden" },
  ];

  for (const link of unsafeLinks) {
    await t.test(`${link.kind} ${JSON.stringify(link.href)}`, () => {
      const document = flow();
      document.nodes[0].links = [link];
      assertInvalid(document, { path: "nodes[0].links[0].href" });
    });
  }

  await t.test("NaN position", () => {
    const document = flow();
    document.nodes[0].position = { x: Number.NaN, y: 0 };
    assertInvalid(document, { path: "nodes[0].position.x" });
  });

  await t.test("infinite position", () => {
    const document = flow();
    document.nodes[0].position = { x: 0, y: Number.POSITIVE_INFINITY };
    assertInvalid(document, { path: "nodes[0].position.y" });
  });
});

test("rejects every collection immediately above its maximum", async (t) => {
  const cases = [
    [
      "lanes",
      Array.from({ length: 33 }, (_, index) => ({
        id: `lane-${index + 1}`,
        label: `Lane ${index + 1}`,
      })),
    ],
    ["nodes", Array.from({ length: 101 }, (_, index) => node(`node-${index + 1}`))],
    [
      "edges",
      Array.from({ length: 151 }, (_, index) => ({
        id: `edge-${index + 1}`,
        from: "start",
        to: "start",
      })),
    ],
    [
      "stories",
      Array.from({ length: 33 }, (_, index) => ({
        id: `story-${index + 1}`,
        label: `Story ${index + 1}`,
        steps: [{ node: "start" }],
      })),
    ],
  ];

  for (const [collection, value] of cases) {
    await t.test(collection, () => {
      assertInvalid(flow({ [collection]: value }), { path: collection });
    });
  }
});
