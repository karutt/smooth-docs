import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { loadSmoothDocsConfig } from "../../scripts/config.mjs";

const execFileAsync = promisify(execFile);
const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ACTION_COMMAND_DIALOG = path.join(
  KIT_ROOT,
  "themes/default/src/components/ActionCommandDialog.tsx",
);

const NODE_ONLY_TEXT = "Quasar settlement authorization narrative 8f2d9c";
const NODE_ONLY_DESCRIPTION = "Requires the orbital reviewer before capture 41ac7e";
const FLOW_ID = "internal-quasar-flow-9d73";
const NODE_ID = "internal-quasar-node-6c21";
const EDGE_ID = "internal-quasar-edge-47b8";
const RAW_YAML_CANARY = "RAW_FLOW_YAML_SEARCH_CANARY_19ea";

function workflowPage() {
  return `# Checkout workflow

This prose deliberately does not describe the private workflow node.

\`\`\`smooth-flow
# ${RAW_YAML_CANARY}
version: 1
id: ${FLOW_ID}
kind: workflow
title: Checkout lifecycle
direction: right
nodes:
  - id: start
    type: action
    label: Begin checkout
  - id: ${NODE_ID}
    type: service
    label: ${NODE_ONLY_TEXT}
    description: ${NODE_ONLY_DESCRIPTION}
edges:
  - id: ${EDGE_ID}
    from: start
    to: ${NODE_ID}
\`\`\`
`;
}

async function createProject(t) {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "smooth-docs-flow-search-"));
  const docsDir = path.join(projectDir, "docs");
  await mkdir(docsDir, { recursive: true });
  await writeFile(
    path.join(projectDir, "smooth-docs.yml"),
    [
      "site_name: Flow Search Test",
      "site_key: docs",
      "docs_dir: docs",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(path.join(docsDir, "workflow.md"), workflowPage(), "utf8");
  await writeFile(
    path.join(docsDir, "other.md"),
    "# Other page\n\nThis page must not inherit text from a neighboring flow.\n",
    "utf8",
  );

  const config = loadSmoothDocsConfig({ kitRoot: KIT_ROOT, projectDir });
  const generatedProjectDir = path.dirname(config.generatedSiteDir);
  t.after(async () => {
    await rm(projectDir, { recursive: true, force: true });
    await rm(generatedProjectDir, { recursive: true, force: true });
  });

  return { projectDir, config };
}

async function generateDocsData(projectDir, config) {
  await execFileAsync(
    process.execPath,
    [path.join(KIT_ROOT, "scripts/generate-all-content.mjs"), "docs"],
    {
      cwd: KIT_ROOT,
      env: { ...process.env, SMOOTH_DOCS_PROJECT_DIR: projectDir },
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  const generated = await readFile(path.join(config.generatedAllDir, "docs-data.ts"), "utf8");
  const match = generated.match(
    /export const docsDataBySite: Record<SiteKey, DocsData> = ([\s\S]*);\n$/,
  );
  assert.ok(match, "generated docs data has the documented JSON module shape");
  return JSON.parse(match[1]).docs;
}

test("generation adds reader-visible flow text only to its owning page search text", async (t) => {
  const { projectDir, config } = await createProject(t);
  const docsData = await generateDocsData(projectDir, config);
  const workflow = docsData.pages.find(
    (page) => page.kind === "page" && page.sourcePath === "docs/docs/workflow.md",
  );
  const other = docsData.pages.find(
    (page) => page.kind === "page" && page.sourcePath === "docs/docs/other.md",
  );

  assert.ok(workflow, "the flow's owning page is generated");
  assert.ok(other, "the unrelated page is generated");
  assert.match(workflow.text, new RegExp(NODE_ONLY_TEXT));
  assert.match(workflow.text, new RegExp(NODE_ONLY_DESCRIPTION));
  assert.doesNotMatch(other.text, new RegExp(NODE_ONLY_TEXT));
  assert.doesNotMatch(other.text, new RegExp(NODE_ONLY_DESCRIPTION));

  for (const implementationDetail of [FLOW_ID, NODE_ID, EDGE_ID, RAW_YAML_CANARY]) {
    assert.doesNotMatch(
      workflow.text,
      new RegExp(implementationDetail),
      `${implementationDetail} must not become a page-search keyword`,
    );
  }
  assert.doesNotMatch(workflow.text, /\bversion:\s*1\b/);
  assert.doesNotMatch(workflow.text, /\b(?:nodes|edges):\s*(?:\n|$)/);

  const compiledFlow = Object.values(workflow.flows ?? {}).find(
    (flow) => flow.document?.id === FLOW_ID,
  );
  assert.ok(compiledFlow, "the flow remains available to its owning page");
  assert.match(compiledFlow.searchText, new RegExp(NODE_ONLY_TEXT));
  assert.doesNotMatch(compiledFlow.searchText, new RegExp(NODE_ID));
});

test("the command dialog searches page.text without indexing markdown or compiled flow objects", async () => {
  const source = await readFile(ACTION_COMMAND_DIALOG, "utf8");
  const pagesMapStart = source.indexOf("docsData.pages.map");
  assert.notEqual(pagesMapStart, -1, "the command dialog renders generated pages");

  const pageItemStart = source.indexOf("<CommandItem", pagesMapStart);
  const pageItemEnd = source.indexOf("</CommandItem>", pageItemStart);
  assert.notEqual(pageItemStart, -1, "the pages group renders a command item");
  assert.notEqual(pageItemEnd, -1, "the page command item is complete");
  const pageCommandItem = source.slice(pageItemStart, pageItemEnd);

  const valueAttribute = pageCommandItem.match(/\bvalue=\{([\s\S]*?)\}\s+onSelect=/)?.[1];
  assert.ok(valueAttribute, "the page command exposes an explicit search value");
  assert.match(
    valueAttribute,
    /page\.text/,
    "node-only generated text participates in command-dialog matching",
  );
  assert.doesNotMatch(
    valueAttribute,
    /page\.(?:markdown|html|flows)|JSON\.stringify\s*\(\s*page\s*\)/,
    "raw Markdown, YAML-bearing objects, and internal IDs are not indexed",
  );
  assert.match(pageCommandItem, /onNavigate\(page\.url\)/, "a match opens the owning page route");
});
