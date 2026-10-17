import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import YAML from "yaml";

import { createFlowDevApiHandler } from "../../scripts/docs-flow/dev-api.mjs";
import { atomicWriteFile } from "../../scripts/docs-flow/files.mjs";

const HOST = "docs.test:8100";
const ORIGIN = `http://${HOST}`;
const PAGE_SOURCE_PATH = "docs/docs/guide.md";
const REUSE_PAGE_SOURCE_PATH = "docs/docs/reuse.md";
const REQUEST_LIMIT = 1024 * 1024;
const SOURCE_LIMIT = 512 * 1024;

function flowDocument(overrides = {}) {
  return {
    version: 1,
    id: "parking-start",
    kind: "workflow",
    title: "Parking start",
    direction: "right",
    nodes: [
      { id: "scan", type: "action", label: "Scan" },
      { id: "finish", type: "service", label: "Finish" },
    ],
    edges: [{ id: "scan-finish", from: "scan", to: "finish" }],
    ...overrides,
  };
}

function inlineMarkdown(document = flowDocument(), extraBody = "") {
  const body = [
    `version: ${document.version}`,
    `id: ${document.id}`,
    `kind: ${document.kind}`,
    `title: ${document.title}`,
    `direction: ${document.direction}`,
    ...(extraBody ? [extraBody] : []),
    "nodes:",
    ...document.nodes.flatMap((node) => [
      `  - id: ${node.id}`,
      `    type: ${node.type}`,
      `    label: ${node.label}`,
    ]),
    "edges:",
    ...document.edges.flatMap((edge) => [
      `  - id: ${edge.id}`,
      `    from: ${edge.from}`,
      `    to: ${edge.to}`,
    ]),
    "",
  ].join("\n");

  return [
    "# Guide",
    "",
    "BEFORE_SAVE_SENTINEL",
    "",
    "```smooth-flow",
    body,
    "```",
    "",
    "AFTER_SAVE_SENTINEL",
    "",
  ].join("\n");
}

function externalMarkdown({
  src = "./flows/parking-start.docs-flow.yml",
  view = "happy-path",
  height = 560,
} = {}) {
  return [
    "# Guide",
    "",
    "BEFORE_REFERENCE_SENTINEL",
    "",
    "```smooth-flow",
    `src: ${src}`,
    ...(view ? [`view: ${view}`] : []),
    ...(height ? [`height: ${height}`] : []),
    "```",
    "",
    "AFTER_REFERENCE_SENTINEL",
    "",
  ].join("\n");
}

function externalFlowDocument(overrides = {}) {
  return flowDocument({
    stories: [
      {
        id: "happy-path",
        label: "Happy path",
        steps: [{ node: "scan" }, { edge: "scan-finish" }, { node: "finish" }],
      },
    ],
    ...overrides,
  });
}

async function createFixture(t, options = {}) {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "smooth-docs-dev-api-"));
  const docsRoot = path.join(sandbox, "docs");
  const pagePath = path.join(docsRoot, "guide.md");
  const outsidePath = path.join(sandbox, "outside.docs-flow.yml");
  const writes = [];
  const regenerations = [];
  const broadcasts = [];
  const silentFiles = [];

  await mkdir(docsRoot, { recursive: true });
  await writeFile(pagePath, options.markdown ?? inlineMarkdown(), "utf8");
  await writeFile(outsidePath, "OUTSIDE_SENTINEL\n", "utf8");

  const handler = createFlowDevApiHandler({
    docsRoot,
    siteKey: "docs",
    protocol: "http:",
    maxRequestBytes: REQUEST_LIMIT,
    maxSourceBytes: SOURCE_LIMIT,
    atomicWrite: async (...args) => {
      writes.push(args[0]);
      return options.atomicWrite ? options.atomicWrite(...args) : atomicWriteFile(...args);
    },
    regenerate: async () => {
      regenerations.push("regenerate");
      if (options.regenerate) return options.regenerate();
      return {
        docsDataBySite: { docs: { pages: [] } },
        generatedAt: 1787700000000,
      };
    },
    broadcast: async (content) => {
      broadcasts.push(structuredClone(content));
      await options.broadcast?.(content);
    },
    markSilentDocsFile(file) {
      silentFiles.push(file);
      options.markSilentDocsFile?.(file);
    },
  });

  t.after(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  return {
    sandbox,
    docsRoot,
    pagePath,
    outsidePath,
    writes,
    regenerations,
    broadcasts,
    silentFiles,
    handler,
  };
}

async function createExternalFixture(t, options = {}) {
  const document = options.externalDocument ?? externalFlowDocument();
  const fixture = await createFixture(t, {
    ...options,
    markdown: options.markdown ?? externalMarkdown(options.reference),
  });
  const flowDir = path.join(fixture.docsRoot, "flows");
  const externalPath = path.join(flowDir, "parking-start.docs-flow.yml");
  const reusePagePath = path.join(fixture.docsRoot, "reuse.md");

  await mkdir(flowDir, { recursive: true });
  await writeFile(externalPath, YAML.stringify(document, { lineWidth: 0 }), "utf8");
  await writeFile(
    reusePagePath,
    externalMarkdown(options.reuseReference ?? { view: "happy-path", height: 720 }),
    "utf8",
  );

  return { ...fixture, document, externalPath, reusePagePath };
}

function request(handler, { method, pathname, query, body, headers = {}, rawBody } = {}) {
  const search = query ? `?${new URLSearchParams(query)}` : "";
  const serializedBody =
    rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body);
  return handler({
    method: method ?? "GET",
    url: `${pathname}${search}`,
    protocol: "http:",
    headers: {
      host: HOST,
      ...((method ?? "GET") === "GET"
        ? {}
        : { origin: ORIGIN, "content-type": "application/json" }),
      ...headers,
    },
    body: serializedBody,
  });
}

function assertError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal(response.body.code, code);
  assert.ok(Array.isArray(response.body.diagnostics));
  assert.doesNotMatch(JSON.stringify(response.body), /\/Users\/|smooth-docs-dev-api-/);
}

async function loadSource(handler) {
  return request(handler, {
    method: "GET",
    pathname: "/__smooth-docs/flow/source",
    query: { sourcePath: PAGE_SOURCE_PATH, flowId: "parking-start" },
  });
}

async function loadExternalSource(handler, sourcePath = PAGE_SOURCE_PATH) {
  return request(handler, {
    method: "GET",
    pathname: "/__smooth-docs/flow/source",
    query: { sourcePath, flowId: "parking-start" },
  });
}

async function saveFlow(handler, { sourcePath = PAGE_SOURCE_PATH, revision, document }) {
  return request(handler, {
    method: "POST",
    pathname: "/__smooth-docs/flow/save",
    body: {
      sourcePath,
      flowId: "parking-start",
      baseRevision: revision,
      document,
    },
  });
}

test("pure handler contract applies method, host, origin, and content-type guards", async (t) => {
  const { handler, pagePath } = await createFixture(t);
  const original = await readFile(pagePath, "utf8");

  assertError(
    await request(handler, {
      method: "POST",
      pathname: "/__smooth-docs/flow/source",
      body: {},
    }),
    405,
    "METHOD_NOT_ALLOWED",
  );

  assertError(
    await request(handler, {
      method: "GET",
      pathname: "/__smooth-docs/flow/source",
      query: { sourcePath: PAGE_SOURCE_PATH, flowId: "parking-start" },
      headers: { host: "" },
    }),
    400,
    "INVALID_REQUEST",
  );

  assertError(
    await request(handler, {
      method: "POST",
      pathname: "/__smooth-docs/flow/layout",
      body: { document: flowDocument(), scope: "all" },
      headers: { origin: "https://attacker.test" },
    }),
    403,
    "ORIGIN_REJECTED",
  );

  assertError(
    await request(handler, {
      method: "POST",
      pathname: "/__smooth-docs/flow/layout",
      body: { document: flowDocument(), scope: "all" },
      headers: { "content-type": "text/plain" },
    }),
    400,
    "INVALID_CONTENT_TYPE",
  );
  assert.equal(await readFile(pagePath, "utf8"), original);
});

test("JSON body guards reject oversized and malformed requests before source work", async (t) => {
  const { handler, pagePath, writes, regenerations } = await createFixture(t);
  const original = await readFile(pagePath, "utf8");

  assertError(
    await request(handler, {
      method: "POST",
      pathname: "/__smooth-docs/flow/save",
      rawBody: "x".repeat(REQUEST_LIMIT + 1),
    }),
    413,
    "REQUEST_TOO_LARGE",
  );
  assertError(
    await request(handler, {
      method: "POST",
      pathname: "/__smooth-docs/flow/save",
      rawBody: "{not-json",
    }),
    400,
    "INVALID_REQUEST",
  );

  assert.equal(await readFile(pagePath, "utf8"), original);
  assert.equal(writes.length, 0);
  assert.equal(regenerations.length, 0);
});

test("source loading is bounded and returns only logical server-derived identity", async (t) => {
  const largeDescription = `description: ${"x".repeat(SOURCE_LIMIT + 1)}`;
  const oversized = await createFixture(t, {
    markdown: inlineMarkdown(flowDocument(), largeDescription),
  });
  assertError(await loadSource(oversized.handler), 413, "FLOW_SOURCE_TOO_LARGE");

  const fixture = await createFixture(t);
  const response = await loadSource(fixture.handler);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.document, flowDocument());
  assert.equal(response.body.source.kind, "inline");
  assert.equal(response.body.source.pageSourcePath, PAGE_SOURCE_PATH);
  assert.equal(response.body.source.flowId, "parking-start");
  assert.match(response.body.source.revision, /^sha256:[0-9a-f]{64}$/);
  assert.equal(response.body.source.editable, true);
  assert.equal("targetPath" in response.body.source, false);
  assert.doesNotMatch(JSON.stringify(response.body), new RegExp(fixture.sandbox.replaceAll("\\", "\\\\")));
});

test("layout validates a draft, returns deterministic geometry, and never writes", async (t) => {
  const { handler, pagePath, writes, regenerations } = await createFixture(t);
  const original = await readFile(pagePath, "utf8");
  const payload = { document: flowDocument(), scope: "all" };

  const first = await request(handler, {
    method: "POST",
    pathname: "/__smooth-docs/flow/layout",
    body: payload,
  });
  const second = await request(handler, {
    method: "POST",
    pathname: "/__smooth-docs/flow/layout",
    body: payload,
  });

  assert.equal(first.status, 200);
  assert.deepEqual(second.body.layout, first.body.layout);
  assert.equal(first.body.layout.direction, "right");
  assert.deepEqual(first.body.diagnostics, []);
  assert.equal(await readFile(pagePath, "utf8"), original);
  assert.equal(writes.length, 0);
  assert.equal(regenerations.length, 0);
});

test("save rejects client-selected targets and leaves outside files untouched", async (t) => {
  const { handler, outsidePath, pagePath, writes, regenerations } = await createFixture(t);
  const source = await loadSource(handler);
  const pageBefore = await readFile(pagePath, "utf8");

  const response = await request(handler, {
    method: "POST",
    pathname: "/__smooth-docs/flow/save",
    body: {
      sourcePath: PAGE_SOURCE_PATH,
      flowId: "parking-start",
      baseRevision: source.body.source.revision,
      targetPath: outsidePath,
      document: flowDocument({ title: "Must not save" }),
    },
  });

  assertError(response, 400, "INVALID_REQUEST");
  assert.equal(await readFile(outsidePath, "utf8"), "OUTSIDE_SENTINEL\n");
  assert.equal(await readFile(pagePath, "utf8"), pageBefore);
  assert.equal(writes.length, 0);
  assert.equal(regenerations.length, 0);
});

test("save validation failure is typed and performs no write or regeneration", async (t) => {
  const { handler, pagePath, writes, regenerations } = await createFixture(t);
  const source = await loadSource(handler);
  const original = await readFile(pagePath, "utf8");
  const invalid = flowDocument({
    edges: [{ id: "scan-missing", from: "scan", to: "missing" }],
  });

  const response = await request(handler, {
    method: "POST",
    pathname: "/__smooth-docs/flow/save",
    body: {
      sourcePath: PAGE_SOURCE_PATH,
      flowId: "parking-start",
      baseRevision: source.body.source.revision,
      document: invalid,
    },
  });

  assertError(response, 422, "FLOW_VALIDATION_FAILED");
  assert.ok(response.body.diagnostics.some((item) => item.code === "EDGE_TARGET_NOT_FOUND"));
  assert.equal(await readFile(pagePath, "utf8"), original);
  assert.equal(writes.length, 0);
  assert.equal(regenerations.length, 0);
});

test("semantic no-op succeeds with the same revision and does not write or regenerate", async (t) => {
  const { handler, pagePath, writes, regenerations } = await createFixture(t);
  const source = await loadSource(handler);
  const original = await readFile(pagePath, "utf8");

  const response = await request(handler, {
    method: "POST",
    pathname: "/__smooth-docs/flow/save",
    body: {
      sourcePath: PAGE_SOURCE_PATH,
      flowId: "parking-start",
      baseRevision: source.body.source.revision,
      document: source.body.document,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.changed, false);
  assert.equal(response.body.revision, source.body.source.revision);
  assert.equal(await readFile(pagePath, "utf8"), original);
  assert.equal(writes.length, 0);
  assert.equal(regenerations.length, 0);
});

test("changed save atomically updates only the derived page and regenerates exactly once", async (t) => {
  const { handler, pagePath, outsidePath, writes, regenerations } = await createFixture(t);
  const source = await loadSource(handler);
  const candidate = flowDocument({ title: "Parking start updated" });

  const response = await request(handler, {
    method: "POST",
    pathname: "/__smooth-docs/flow/save",
    body: {
      sourcePath: PAGE_SOURCE_PATH,
      flowId: "parking-start",
      baseRevision: source.body.source.revision,
      document: candidate,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.changed, true);
  assert.deepEqual(response.body.document, candidate);
  assert.match(response.body.revision, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(response.body.revision, source.body.source.revision);
  assert.deepEqual(response.body.docsDataBySite, { docs: { pages: [] } });
  assert.equal(response.body.generatedAt, 1787700000000);
  assert.deepEqual(writes, [pagePath]);
  assert.equal(regenerations.length, 1);

  const saved = await readFile(pagePath, "utf8");
  assert.match(saved, /title: Parking start updated/);
  assert.match(saved, /BEFORE_SAVE_SENTINEL/);
  assert.match(saved, /AFTER_SAVE_SENTINEL/);
  assert.equal(await readFile(outsidePath, "utf8"), "OUTSIDE_SENTINEL\n");
});

test("stale revision returns 409 with current source and never overwrites the retained draft", async (t) => {
  const { handler, pagePath, writes, regenerations } = await createFixture(t);
  const source = await loadSource(handler);
  const outsideUpdate = inlineMarkdown(flowDocument({ title: "Outside update" }));
  await writeFile(pagePath, outsideUpdate, "utf8");
  const draft = flowDocument({ title: "My unsaved draft" });
  const draftSnapshot = structuredClone(draft);

  const response = await request(handler, {
    method: "POST",
    pathname: "/__smooth-docs/flow/save",
    body: {
      sourcePath: PAGE_SOURCE_PATH,
      flowId: "parking-start",
      baseRevision: source.body.source.revision,
      document: draft,
    },
  });

  assertError(response, 409, "REVISION_CONFLICT");
  assert.match(response.body.currentRevision, /^sha256:[0-9a-f]{64}$/);
  assert.equal(response.body.currentDocument.title, "Outside update");
  assert.deepEqual(draft, draftSnapshot, "the caller keeps its complete unsaved draft");
  assert.equal(await readFile(pagePath, "utf8"), outsideUpdate);
  assert.equal(writes.length, 0);
  assert.equal(regenerations.length, 0);
});

test("source lookup maps missing page and flow identities to stable 404 errors", async (t) => {
  const { handler } = await createFixture(t);
  assertError(
    await request(handler, {
      method: "GET",
      pathname: "/__smooth-docs/flow/source",
      query: { sourcePath: "docs/docs/missing.md", flowId: "parking-start" },
    }),
    404,
    "PAGE_NOT_FOUND",
  );
  assertError(
    await request(handler, {
      method: "GET",
      pathname: "/__smooth-docs/flow/source",
      query: { sourcePath: PAGE_SOURCE_PATH, flowId: "missing-flow" },
    }),
    404,
    "FLOW_NOT_FOUND",
  );
});

test("external source load derives ownership and revisions include reference and file bytes", async (t) => {
  const fixture = await createExternalFixture(t);
  const first = await loadExternalSource(fixture.handler);

  assert.equal(first.status, 200);
  assert.deepEqual(first.body.document, fixture.document);
  assert.deepEqual(first.body.source, {
    kind: "external",
    pageSourcePath: PAGE_SOURCE_PATH,
    flowId: "parking-start",
    reference: "./flows/parking-start.docs-flow.yml",
    revision: first.body.source.revision,
    editable: true,
  });
  assert.match(first.body.source.revision, /^sha256:[0-9a-f]{64}$/);
  assert.equal("targetPath" in first.body.source, false);
  assert.doesNotMatch(JSON.stringify(first.body), /smooth-docs-dev-api-|\/Users\//);

  await writeFile(
    fixture.pagePath,
    externalMarkdown({ view: "happy-path", height: 640 }),
    "utf8",
  );
  const afterReferenceChange = await loadExternalSource(fixture.handler);
  assert.equal(afterReferenceChange.status, 200);
  assert.notEqual(
    afterReferenceChange.body.source.revision,
    first.body.source.revision,
    "exact reference-fence bytes must participate in the revision",
  );

  await writeFile(
    fixture.externalPath,
    `${await readFile(fixture.externalPath, "utf8")}# retained external comment\n`,
    "utf8",
  );
  const afterFileChange = await loadExternalSource(fixture.handler);
  assert.equal(afterFileChange.status, 200);
  assert.deepEqual(afterFileChange.body.document, fixture.document);
  assert.notEqual(
    afterFileChange.body.source.revision,
    afterReferenceChange.body.source.revision,
    "exact external-file bytes must participate in the revision",
  );
});

test("external save writes only the derived target and publishes one shared content update", async (t) => {
  const sharedDocsData = {
    docs: {
      pages: [
        {
          sourcePath: PAGE_SOURCE_PATH,
          flows: { "guide-flow": { document: { id: "parking-start" }, view: { height: 560 } } },
        },
        {
          sourcePath: REUSE_PAGE_SOURCE_PATH,
          flows: { "reuse-flow": { document: { id: "parking-start" }, view: { height: 720 } } },
        },
      ],
    },
  };
  const fixture = await createExternalFixture(t, {
    regenerate: async () => ({
      docsDataBySite: sharedDocsData,
      generatedAt: 1787700000999,
    }),
  });
  const loaded = await loadExternalSource(fixture.handler);
  assert.equal(loaded.status, 200);
  const pageBefore = await readFile(fixture.pagePath, "utf8");
  const reuseBefore = await readFile(fixture.reusePagePath, "utf8");
  const candidate = externalFlowDocument({ title: "Shared parking flow updated" });

  const response = await saveFlow(fixture.handler, {
    revision: loaded.body.source.revision,
    document: candidate,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.changed, true);
  assert.deepEqual(response.body.document, candidate);
  assert.deepEqual(response.body.docsDataBySite, sharedDocsData);
  assert.equal(response.body.generatedAt, 1787700000999);
  assert.deepEqual(fixture.writes, [fixture.externalPath]);
  assert.deepEqual(fixture.silentFiles, [fixture.externalPath]);
  assert.equal(fixture.regenerations.length, 1);
  assert.equal(fixture.broadcasts.length, 1);
  assert.deepEqual(fixture.broadcasts[0], {
    docsDataBySite: sharedDocsData,
    generatedAt: 1787700000999,
  });
  assert.equal(fixture.broadcasts[0].docsDataBySite.docs.pages.length, 2);
  assert.equal(await readFile(fixture.pagePath, "utf8"), pageBefore);
  assert.equal(await readFile(fixture.reusePagePath, "utf8"), reuseBefore);
  assert.deepEqual(YAML.parse(await readFile(fixture.externalPath, "utf8")), candidate);
});

test("concurrent saves through two references serialize on the shared external target", async (t) => {
  let activeWrites = 0;
  let maximumActiveWrites = 0;
  let signalFirstWrite;
  let releaseWrites;
  const firstWriteStarted = new Promise((resolve) => {
    signalFirstWrite = resolve;
  });
  const writesMayFinish = new Promise((resolve) => {
    releaseWrites = resolve;
  });
  const fixture = await createExternalFixture(t, {
    atomicWrite: async (...args) => {
      activeWrites += 1;
      maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
      signalFirstWrite();
      await writesMayFinish;
      try {
        return await atomicWriteFile(...args);
      } finally {
        activeWrites -= 1;
      }
    },
  });
  const firstSource = await loadExternalSource(fixture.handler, PAGE_SOURCE_PATH);
  const secondSource = await loadExternalSource(fixture.handler, REUSE_PAGE_SOURCE_PATH);
  assert.equal(firstSource.status, 200);
  assert.equal(secondSource.status, 200);

  const firstSave = saveFlow(fixture.handler, {
    sourcePath: PAGE_SOURCE_PATH,
    revision: firstSource.body.source.revision,
    document: externalFlowDocument({ title: "First tab wins" }),
  });
  let writeStartTimer;
  try {
    await Promise.race([
      firstWriteStarted,
      new Promise((_, reject) => {
        writeStartTimer = setTimeout(
          () => reject(new Error("first external write did not start")),
          1_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(writeStartTimer);
  }
  const secondDraft = externalFlowDocument({ title: "Second tab draft" });
  const secondDraftSnapshot = structuredClone(secondDraft);
  const secondSave = saveFlow(fixture.handler, {
    sourcePath: REUSE_PAGE_SOURCE_PATH,
    revision: secondSource.body.source.revision,
    document: secondDraft,
  });
  await new Promise((resolve) => setImmediate(resolve));
  releaseWrites();

  const [firstResponse, secondResponse] = await Promise.all([firstSave, secondSave]);
  assert.equal(firstResponse.status, 200);
  assertError(secondResponse, 409, "REVISION_CONFLICT");
  assert.equal(secondResponse.body.currentDocument.title, "First tab wins");
  assert.deepEqual(secondDraft, secondDraftSnapshot, "the losing tab retains its complete draft");
  assert.equal(maximumActiveWrites, 1, "the canonical external target admits only one writer");
  assert.deepEqual(fixture.writes, [fixture.externalPath]);
  assert.equal(fixture.regenerations.length, 1);
  assert.equal(fixture.broadcasts.length, 1);
  assert.equal(YAML.parse(await readFile(fixture.externalPath, "utf8")).title, "First tab wins");
});

test("two tabs on one external reference reject the stale save without duplicate delivery", async (t) => {
  const fixture = await createExternalFixture(t);
  const firstTab = await loadExternalSource(fixture.handler);
  const secondTab = await loadExternalSource(fixture.handler);
  assert.equal(firstTab.status, 200);
  assert.equal(secondTab.status, 200);
  assert.equal(firstTab.body.source.revision, secondTab.body.source.revision);

  const winner = externalFlowDocument({ title: "Saved by tab one" });
  const loser = externalFlowDocument({ title: "Unsaved in tab two" });
  const loserSnapshot = structuredClone(loser);
  const firstResponse = await saveFlow(fixture.handler, {
    revision: firstTab.body.source.revision,
    document: winner,
  });
  const secondResponse = await saveFlow(fixture.handler, {
    revision: secondTab.body.source.revision,
    document: loser,
  });

  assert.equal(firstResponse.status, 200);
  assertError(secondResponse, 409, "REVISION_CONFLICT");
  assert.equal(secondResponse.body.currentDocument.title, "Saved by tab one");
  assert.deepEqual(loser, loserSnapshot);
  assert.deepEqual(fixture.writes, [fixture.externalPath]);
  assert.deepEqual(fixture.silentFiles, [fixture.externalPath]);
  assert.equal(fixture.regenerations.length, 1);
  assert.equal(fixture.broadcasts.length, 1);
  assert.deepEqual(YAML.parse(await readFile(fixture.externalPath, "utf8")), winner);
});
