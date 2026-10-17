import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { stringify } from "yaml";
import { loadSmoothDocsConfig } from "../../scripts/config.mjs";
import { parseFlowMarkdown, parseFlowYaml } from "../../scripts/docs-flow/index.mjs";

const execFileAsync = promisify(execFile);
const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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
    id: "parse-test",
    kind: "workflow",
    title: "Parse test",
    direction: "right",
    nodes: [node()],
    edges: [],
    ...overrides,
  };
}

function yaml(value) {
  return stringify(value, {
    aliasDuplicateObjects: false,
    indent: 2,
    lineWidth: 0,
  });
}

function diagnosticSummary(result) {
  return result.diagnostics
    .map(
      (diagnostic) =>
        `${diagnostic.code}:${diagnostic.path ?? ""}@${diagnostic.line ?? "?"}:${diagnostic.column ?? "?"}`,
    )
    .join(", ");
}

function assertYamlValid(source) {
  const result = parseFlowYaml(source);
  assert.equal(result.ok, true, diagnosticSummary(result));
  assert.equal(result.kind, "document");
  assert.ok(result.document);
  assert.deepEqual(result.diagnostics, []);
  return result;
}

function assertYamlInvalid(source, code, path) {
  const result = parseFlowYaml(source);
  assert.equal(result.ok, false, "invalid YAML flow must not be accepted");
  assert.ok(result.diagnostics.length > 0, "invalid YAML flow must have diagnostics");
  const diagnostic = result.diagnostics.find((candidate) => candidate.code === code);
  assert.ok(diagnostic, `expected ${code}; received ${diagnosticSummary(result)}`);

  if (path) assert.equal(diagnostic.path, path);
  return { diagnostic, result };
}

function reusableExternalFlow(overrides = {}) {
  return flow({
    id: "shared-external-flow",
    title: "Shared reusable workflow",
    description: "One definition rendered by multiple Markdown pages.",
    nodes: [
      { ...node("start"), description: "Begin the shared workflow." },
      { ...node("finish"), description: "Complete the shared workflow." },
    ],
    edges: [{ id: "start-to-finish", from: "start", to: "finish" }],
    stories: [
      {
        id: "happy-path",
        label: "Happy path",
        steps: [{ node: "start" }, { edge: "start-to-finish" }, { node: "finish" }],
      },
      {
        id: "review-path",
        label: "Review path",
        steps: [{ node: "finish" }],
      },
    ],
    ...overrides,
  });
}

function referenceMarkdown(reference) {
  return `# Referenced flow\n\n\`\`\`smooth-flow\n${yaml(reference)}\`\`\`\n`;
}

async function createGeneratedFixture(t) {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "smooth-docs-external-flow-"));
  const docsDir = path.join(projectDir, "docs");
  await mkdir(docsDir, { recursive: true });
  await writeFile(
    path.join(projectDir, "smooth-docs.yml"),
    "site_key: docs\nsite_name: External flow fixture\ndocs_dir: docs\n",
  );

  const config = loadSmoothDocsConfig({ kitRoot, projectDir });
  t.after(async () => {
    await rm(projectDir, { recursive: true, force: true });
    await rm(path.dirname(config.generatedSiteDir), { recursive: true, force: true });
  });

  return {
    projectDir,
    docsDir,
    generatedSiteDir: config.generatedSiteDir,
  };
}

async function writeFixture(root, relativePath, source) {
  const target = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, source);
  return target;
}

async function generateFixture(fixture, activeDocsDir = fixture.docsDir) {
  const environment = {
    ...process.env,
    SMOOTH_DOCS_PROJECT_DIR: fixture.projectDir,
    SMOOTH_DOCS_DOCS_DIR: activeDocsDir,
  };
  delete environment.SMOOTH_DOCS_STATIC_BUILD;

  await execFileAsync(process.execPath, [path.join(kitRoot, "scripts/generate-content.mjs"), "docs"], {
    cwd: kitRoot,
    env: environment,
    maxBuffer: 20 * 1024 * 1024,
  });

  const generatedSource = await readFile(
    path.join(fixture.generatedSiteDir, "docs-data.ts"),
    "utf8",
  );
  const match = generatedSource.match(/export const docsData: DocsData = ([\s\S]*);\n$/);
  assert.ok(match, "generated docs-data.ts must contain serializable DocsData");
  return JSON.parse(match[1]);
}

function generatedPage(data, relativePath) {
  const page = data.pages.find(
    (candidate) => candidate.sourcePath === `docs/docs/${relativePath}`,
  );
  assert.ok(page, `expected generated page ${relativePath}`);
  return page;
}

function generatedFlow(page, embedId = "flow-1") {
  const compiled = page.flows?.[embedId];
  assert.ok(compiled, `expected compiled ${embedId} in ${page.sourcePath}`);
  return compiled;
}

async function listFiles(root, prefix = "") {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path.join(root, entry.name), relativePath)));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

test("parses one restricted YAML 1.2 flow document", () => {
  const result = assertYamlValid(yaml(flow()));
  assert.equal(result.document.id, "parse-test");
});

test("rejects YAML features outside the authored subset with source locations", async (t) => {
  const cases = [
    {
      name: "anchor and alias",
      source: `version: 1
id: restricted
kind: workflow
title: Restricted
direction: right
nodes: &shared
  - id: start
    type: action
    label: Start
edges: []
copy: *shared
`,
    },
    {
      name: "custom tag",
      source: `version: 1
id: restricted
kind: workflow
title: !unsafe Restricted
direction: right
nodes:
  - id: start
    type: action
    label: Start
edges: []
`,
    },
    {
      name: "merge key",
      source: `version: 1
id: restricted
kind: workflow
title: Restricted
direction: right
nodes:
  - <<: { id: start, type: action, label: Start }
edges: []
`,
    },
    {
      name: "multiple YAML documents",
      source: `${yaml(flow())}---\n${yaml(flow({ id: "second" }))}`,
    },
    {
      name: "duplicate mapping key",
      source: `version: 1
id: restricted
id: repeated
kind: workflow
title: Restricted
direction: right
nodes:
  - id: start
    type: action
    label: Start
edges: []
`,
    },
  ];

  for (const { name, source } of cases) {
    await t.test(name, () => {
      const result = parseFlowYaml(source);
      assert.equal(result.ok, false, `${name} must be rejected`);
      const diagnostic = result.diagnostics.find((candidate) => candidate.code.startsWith("YAML_"));
      assert.ok(diagnostic, diagnosticSummary(result));
      assert.ok(Number.isInteger(diagnostic.line) && diagnostic.line > 0);
      assert.ok(Number.isInteger(diagnostic.column) && diagnostic.column > 0);
    });
  }
});

test("discovers top-level backtick and tilde smooth-flow fences", () => {
  const backtick = yaml(flow({ id: "backtick-flow" }));
  const tilde = yaml(flow({ id: "tilde-flow" }));
  const markdown = `# Flows

Before.

\`\`\`\`smooth-flow
${backtick}\`\`\`\`

Between.

~~~~smooth-flow optional-info-is-allowed
${tilde}~~~~

After.
`;

  const result = parseFlowMarkdown(markdown);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.embeds.length, 2);
  assert.deepEqual(
    result.embeds.map((embed) => embed.document?.id),
    ["backtick-flow", "tilde-flow"],
  );
  assert.ok(result.embeds.every((embed) => embed.topLevel === true));
});

test("rejects a smooth-flow fence nested under Markdown structure", () => {
  const source = yaml(flow({ id: "nested-flow" }));
  const markdown = `- Nested flow

  \`\`\`smooth-flow
${source
  .split("\n")
  .filter(Boolean)
  .map((line) => `  ${line}`)
  .join("\n")}
  \`\`\`
`;

  const result = parseFlowMarkdown(markdown);
  const diagnostic = result.diagnostics.find(
    (candidate) => candidate.code === "FLOW_FENCE_NOT_TOP_LEVEL",
  );
  assert.ok(diagnostic, diagnosticSummary(result));
  assert.equal(diagnostic.line, 3);
  assert.ok(result.embeds.some((embed) => embed.sourceText.includes("version: 1")));
});

test("rejects a descriptor that mixes complete-document and external-reference shapes", () => {
  const source = `${yaml(flow())}src: ./flows/shared.docs-flow.yml\n`;
  const { diagnostic } = assertYamlInvalid(source, "FLOW_SHAPE_MIXED");
  assert.ok(Number.isInteger(diagnostic.line) && diagnostic.line > 0);
  assert.ok(Number.isInteger(diagnostic.column) && diagnostic.column > 0);
});

test("accepts only the external descriptor shape and supplies the default height", () => {
  const source = yaml({
    src: "./flows/shared.docs-flow.yml",
    view: "happy-path",
  });
  const result = parseFlowYaml(source);

  assert.equal(result.ok, true, diagnosticSummary(result));
  assert.equal(result.kind, "reference");
  assert.deepEqual(result.reference, {
    src: "./flows/shared.docs-flow.yml",
    view: "happy-path",
    height: 560,
  });
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.editable, true);

  const unknown = assertYamlInvalid(
    yaml({ src: "./flows/shared.docs-flow.yml", unexpected: "Not allowed" }),
    "UNKNOWN_FLOW_FIELD",
  );
  assert.equal(unknown.diagnostic.path, "unexpected");

  const nested = parseFlowYaml(source, { allowReference: false });
  assert.equal(nested.ok, false);
  assert.ok(
    nested.diagnostics.some((diagnostic) => diagnostic.code === "FLOW_REFERENCE_NOT_ALLOWED"),
    diagnosticSummary(nested),
  );
});

test("validates external view IDs and the inclusive height range", async (t) => {
  for (const height of [320, 1200]) {
    await t.test(`accepts height ${height}`, () => {
      const result = parseFlowYaml(yaml({ src: "./flows/shared.docs-flow.yml", height }));
      assert.equal(result.ok, true, diagnosticSummary(result));
      assert.equal(result.reference.height, height);
    });
  }

  for (const height of [319, 1201, 560.5, "560"]) {
    await t.test(`rejects height ${String(height)}`, () => {
      assertYamlInvalid(
        yaml({ src: "./flows/shared.docs-flow.yml", height }),
        "FLOW_REFERENCE_INVALID",
        "height",
      );
    });
  }

  assertYamlInvalid(
    yaml({ src: "./flows/shared.docs-flow.yml", view: "Not a stable ID" }),
    "FLOW_REFERENCE_INVALID",
    "view",
  );
});

test("keeps an unsupported version readable but not editable", () => {
  const source = yaml(flow({ version: 2 }));
  const { diagnostic, result } = assertYamlInvalid(source, "UNSUPPORTED_FLOW_VERSION", "version");

  assert.equal(diagnostic.line, 1);
  assert.ok(Number.isInteger(diagnostic.column) && diagnostic.column > 0);
  assert.equal(result.sourceText, source);
  assert.equal(result.editable, false);
});

test("rejects duplicate stable IDs in every entity collection", async (t) => {
  const cases = [
    {
      name: "lane",
      code: "DUPLICATE_LANE_ID",
      path: "lanes[1].id",
      document: flow({
        lanes: [
          { id: "shared-lane", label: "First" },
          { id: "shared-lane", label: "Second" },
        ],
      }),
    },
    {
      name: "node",
      code: "DUPLICATE_NODE_ID",
      path: "nodes[1].id",
      document: flow({ nodes: [node("shared-node"), node("shared-node")] }),
    },
    {
      name: "edge",
      code: "DUPLICATE_EDGE_ID",
      path: "edges[1].id",
      document: flow({
        edges: [
          { id: "shared-edge", from: "start", to: "start" },
          { id: "shared-edge", from: "start", to: "start" },
        ],
      }),
    },
    {
      name: "story",
      code: "DUPLICATE_STORY_ID",
      path: "stories[1].id",
      document: flow({
        stories: [
          { id: "shared-story", label: "First", steps: [{ node: "start" }] },
          { id: "shared-story", label: "Second", steps: [{ node: "start" }] },
        ],
      }),
    },
  ];

  for (const { name, code, path, document } of cases) {
    await t.test(name, () => {
      const { diagnostic } = assertYamlInvalid(yaml(document), code, path);
      assert.ok(Number.isInteger(diagnostic.line) && diagnostic.line > 0);
      assert.ok(Number.isInteger(diagnostic.column) && diagnostic.column > 0);
    });
  }
});

test("rejects every dangling authored reference", async (t) => {
  const cases = [
    {
      name: "node lane",
      code: "NODE_LANE_NOT_FOUND",
      path: "nodes[0].lane",
      document: flow({ nodes: [{ ...node(), lane: "missing-lane" }] }),
    },
    {
      name: "edge source",
      code: "EDGE_SOURCE_NOT_FOUND",
      path: "edges[0].from",
      document: flow({ edges: [{ id: "missing-source", from: "missing", to: "start" }] }),
    },
    {
      name: "edge target",
      code: "EDGE_TARGET_NOT_FOUND",
      path: "edges[0].to",
      document: flow({ edges: [{ id: "missing-target", from: "start", to: "missing" }] }),
    },
    {
      name: "story node",
      code: "STORY_NODE_NOT_FOUND",
      path: "stories[0].steps[0].node",
      document: flow({
        stories: [{ id: "node-story", label: "Node", steps: [{ node: "missing" }] }],
      }),
    },
    {
      name: "story edge",
      code: "STORY_EDGE_NOT_FOUND",
      path: "stories[0].steps[0].edge",
      document: flow({
        stories: [{ id: "edge-story", label: "Edge", steps: [{ edge: "missing" }] }],
      }),
    },
  ];

  for (const { name, code, path, document } of cases) {
    await t.test(name, () => {
      const { diagnostic } = assertYamlInvalid(yaml(document), code, path);
      assert.ok(Number.isInteger(diagnostic.line) && diagnostic.line > 0);
      assert.ok(Number.isInteger(diagnostic.column) && diagnostic.column > 0);
    });
  }
});

test("reports exact line and column for malformed YAML", () => {
  const source = `version: 1
id: malformed
kind: workflow
title: Malformed
direction: right
nodes:
  - id: start
    type: action
    label: [
edges: []
`;
  const { diagnostic } = assertYamlInvalid(source, "YAML_INVALID");

  assert.equal(diagnostic.line, 10);
  assert.equal(diagnostic.column, 1);
});

test("reports duplicate inline flow IDs as ambiguous", () => {
  const source = yaml(flow({ id: "same-flow" }));
  const markdown = `\`\`\`smooth-flow
${source}\`\`\`

~~~smooth-flow
${source}~~~
`;
  const result = parseFlowMarkdown(markdown);
  const diagnostic = result.diagnostics.find(
    (candidate) => candidate.code === "FLOW_ID_AMBIGUOUS",
  );

  assert.ok(diagnostic, diagnosticSummary(result));
  assert.ok(Number.isInteger(diagnostic.line) && diagnostic.line > 0);
  assert.ok(Number.isInteger(diagnostic.column) && diagnostic.column > 0);
});

test("resolves one page-relative external definition for multiple page-specific views", async (t) => {
  const fixture = await createGeneratedFixture(t);
  await writeFixture(
    fixture.docsDir,
    "guides/flows/shared.docs-flow.yml",
    yaml(reusableExternalFlow()),
  );
  await writeFixture(
    fixture.docsDir,
    "guides/first.md",
    referenceMarkdown({
      src: "./flows/shared.docs-flow.yml",
      view: "happy-path",
      height: 480,
    }),
  );
  await writeFixture(
    fixture.docsDir,
    "guides/second.md",
    referenceMarkdown({
      src: "./flows/shared.docs-flow.yml",
      view: "review-path",
      height: 720,
    }),
  );
  await writeFixture(fixture.docsDir, "guides/copied-asset.txt", "ordinary asset\n");

  const data = await generateFixture(fixture);
  const firstPage = generatedPage(data, "guides/first.md");
  const secondPage = generatedPage(data, "guides/second.md");
  const first = generatedFlow(firstPage);
  const second = generatedFlow(secondPage);

  assert.equal(first.document.id, "shared-external-flow");
  assert.equal(second.document.id, "shared-external-flow");
  assert.deepEqual(second.document, first.document, "the external definition must be reusable");
  assert.deepEqual(second.layout, first.layout, "the reusable definition must have a stable layout");
  assert.deepEqual(first.view, { story: "happy-path", height: 480 });
  assert.deepEqual(second.view, { story: "review-path", height: 720 });
  assert.match(firstPage.text, /Shared reusable workflow/);
  assert.match(secondPage.text, /Complete the shared workflow/);

  const publicFiles = await listFiles(path.join(fixture.generatedSiteDir, "public"));
  assert.ok(publicFiles.includes("docs-assets/guides/copied-asset.txt"));
  assert.equal(
    publicFiles.some((file) => file.endsWith(".docs-flow.yml")),
    false,
    "authored external definitions must never become public assets",
  );
});

test("keeps missing, malformed, and unknown-view external embeds visible with diagnostics", async (t) => {
  const fixture = await createGeneratedFixture(t);
  await writeFixture(
    fixture.docsDir,
    "flows/shared.docs-flow.yml",
    yaml(reusableExternalFlow({ stories: reusableExternalFlow().stories.slice(0, 1) })),
  );
  const malformedSource = `version: 1\nid: malformed-external\nINVALID_EXTERNAL_CANARY: [\n`;
  await writeFixture(fixture.docsDir, "flows/malformed.docs-flow.yml", malformedSource);
  await writeFixture(
    fixture.docsDir,
    "unknown-view.md",
    referenceMarkdown({ src: "./flows/shared.docs-flow.yml", view: "missing-story" }),
  );
  await writeFixture(
    fixture.docsDir,
    "missing.md",
    referenceMarkdown({ src: "./flows/missing.docs-flow.yml" }),
  );
  await writeFixture(
    fixture.docsDir,
    "malformed.md",
    referenceMarkdown({ src: "./flows/malformed.docs-flow.yml" }),
  );

  const data = await generateFixture(fixture);
  const unknownView = generatedFlow(generatedPage(data, "unknown-view.md"));
  const missing = generatedFlow(generatedPage(data, "missing.md"));
  const malformed = generatedFlow(generatedPage(data, "malformed.md"));

  assert.equal(unknownView.document, undefined);
  assert.ok(
    unknownView.diagnostics.some(
      (diagnostic) => diagnostic.path === "view" && /missing-story/.test(diagnostic.message),
    ),
    JSON.stringify(unknownView.diagnostics),
  );
  assert.match(unknownView.fallbackText, /src: .*shared\.docs-flow\.yml/);

  assert.equal(missing.document, undefined);
  assert.ok(
    missing.diagnostics.some((diagnostic) => /missing|not found/i.test(diagnostic.message)),
    JSON.stringify(missing.diagnostics),
  );
  assert.match(missing.fallbackText, /src: .*missing\.docs-flow\.yml/);

  assert.equal(malformed.document, undefined);
  assert.ok(
    malformed.diagnostics.some((diagnostic) => diagnostic.code === "YAML_INVALID"),
    JSON.stringify(malformed.diagnostics),
  );
  assert.match(malformed.fallbackText, /INVALID_EXTERNAL_CANARY/);

  for (const relativePath of ["unknown-view.md", "missing.md", "malformed.md"]) {
    assert.match(
      generatedPage(data, relativePath).html,
      /data-smooth-flow-id="flow-1"/,
      `${relativePath} must retain its rendered fallback position`,
    );
  }
});

test("enforces the active publish root while resolving external definitions", async (t) => {
  const fixture = await createGeneratedFixture(t);
  const publishRoot = path.join(fixture.docsDir, "published");
  await writeFixture(
    publishRoot,
    "flows/inside.docs-flow.yml",
    yaml(reusableExternalFlow({ id: "inside-publish-root" })),
  );
  const outsideTarget = await writeFixture(
    fixture.docsDir,
    "private/outside.docs-flow.yml",
    yaml(reusableExternalFlow({ id: "outside-publish-root" })),
  );
  const escapeLink = path.join(publishRoot, "flows/escape.docs-flow.yml");
  await symlink(outsideTarget, escapeLink);
  await writeFixture(
    publishRoot,
    "index.md",
    `# Publish root\n\n\`\`\`smooth-flow\nsrc: ./flows/inside.docs-flow.yml\n\`\`\`\n\n\`\`\`smooth-flow\nsrc: ./flows/escape.docs-flow.yml\n\`\`\`\n`,
  );

  const data = await generateFixture(fixture, publishRoot);
  const page = generatedPage(data, "index.md");
  const inside = generatedFlow(page, "flow-1");
  const escaped = generatedFlow(page, "flow-2");

  assert.equal(inside.document.id, "inside-publish-root");
  assert.equal(escaped.document, undefined);
  assert.ok(
    escaped.diagnostics.some((diagnostic) => /outside|publish|symlink|root/i.test(diagnostic.message)),
    JSON.stringify(escaped.diagnostics),
  );
  assert.doesNotMatch(escaped.fallbackText, /outside-publish-root/);

  await access(path.join(fixture.generatedSiteDir, "public"));
  const publicFiles = await listFiles(path.join(fixture.generatedSiteDir, "public"));
  assert.equal(publicFiles.some((file) => file.endsWith(".docs-flow.yml")), false);
});
