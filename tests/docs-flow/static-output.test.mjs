import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { loadSmoothDocsConfig } from "../../scripts/config.mjs";

const execFileAsync = promisify(execFile);
const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RAW_INLINE_CANARY = "RAW_INLINE_FLOW_SOURCE_CANARY_9576e2";
const RAW_EXTERNAL_CANARY = "RAW_EXTERNAL_FLOW_SOURCE_CANARY_80c63f";
const VIEWER_TITLE = "Static viewer remains available 3b885e";
const LOCAL_SOURCE_PATH = "/Users/static-flow-secret/private/parking.ts#L42";
const EXTERNAL_FLOW_FILE = "reusable-secret.docs-flow.yml";

function markdownFixture() {
  return `# Static flow page

Reader-visible prose remains in the generated page.

\`\`\`smooth-flow
# ${RAW_INLINE_CANARY}
version: 1
id: static-parking-start
kind: workflow
title: ${VIEWER_TITLE}
description: A read-only workflow remains usable in static output.
direction: right
lanes:
  - id: reader
    label: Reader
nodes:
  - id: scan
    lane: reader
    type: action
    label: Scan the code
    links:
      - kind: source
        href: ${LOCAL_SOURCE_PATH}
        label: Local source must be removed
      - kind: source
        href: https://example.com/public/parking.ts#L42
        label: Public source remains safe
  - id: finish
    lane: reader
    type: service
    label: Finish
edges:
  - id: scan-finish
    from: scan
    to: finish
stories:
  - id: happy-path
    label: Happy path
    steps:
      - node: scan
      - edge: scan-finish
      - node: finish
\`\`\`

The reusable source below deliberately remains unpublished.

\`\`\`smooth-flow
src: ./${EXTERNAL_FLOW_FILE}
height: 480
\`\`\`
`;
}

function externalFlowFixture() {
  return `# ${RAW_EXTERNAL_CANARY}
version: 1
id: reusable-secret
kind: workflow
title: Reusable source must not be published raw
direction: down
nodes:
  - id: only
    type: action
    label: Only
edges: []
`;
}

async function createProject(t) {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "smooth-docs-static-flow-"));
  const docsDir = path.join(projectDir, "docs");
  const outDir = path.join(projectDir, "site");

  await mkdir(docsDir, { recursive: true });
  await writeFile(
    path.join(projectDir, "smooth-docs.yml"),
    [
      "site_name: Static Flow Test",
      "site_key: docs",
      "docs_dir: docs",
      "out_dir: site",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(path.join(docsDir, "index.md"), markdownFixture(), "utf8");
  await writeFile(
    path.join(docsDir, "ordinary.md"),
    "# Ordinary page\n\nThis page intentionally contains no interactive flow.\n",
    "utf8",
  );
  await writeFile(path.join(docsDir, EXTERNAL_FLOW_FILE), externalFlowFixture(), "utf8");

  const config = loadSmoothDocsConfig({ kitRoot: KIT_ROOT, projectDir });
  const generatedProjectDir = path.dirname(config.generatedSiteDir);
  t.after(async () => {
    await rm(projectDir, { recursive: true, force: true });
    await rm(generatedProjectDir, { recursive: true, force: true });
  });

  return { projectDir, outDir, config };
}

async function readGeneratedDocsData(generatedAllDir) {
  const generated = await readFile(path.join(generatedAllDir, "docs-data.ts"), "utf8");
  const match = generated.match(
    /export const docsDataBySite: Record<SiteKey, DocsData> = ([\s\S]*);\n$/,
  );
  assert.ok(match, "generated docs data has the documented JSON module shape");
  return { generated, docsDataBySite: JSON.parse(match[1]) };
}

async function readStaticTextFiles(root) {
  const contents = [];

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(target);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/\.(?:css|html?|js|json|map|svg|txt|xml)$/i.test(entry.name)) continue;
      contents.push(await readFile(target, "utf8"));
    }
  }

  await visit(root);
  return contents.join("\n");
}

test("static build retains read-only flow data without authoring or local source metadata", async (t) => {
  const { projectDir, outDir, config } = await createProject(t);

  await execFileAsync(
    process.execPath,
    [path.join(KIT_ROOT, "bin/smooth-docs.mjs"), "build", projectDir],
    {
      cwd: KIT_ROOT,
      env: { ...process.env },
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  const { generated, docsDataBySite } = await readGeneratedDocsData(config.generatedAllDir);
  const page = docsDataBySite.docs.pages.find(
    (candidate) => candidate.kind === "page" && candidate.sourcePath === "docs/docs/index.md",
  );
  assert.ok(page, "the fixture page is generated");
  const flow = Object.values(page.flows ?? {}).find(
    (candidate) => candidate.document?.id === "static-parking-start",
  );
  assert.ok(
    flow,
    `the valid flow remains available to the static viewer: ${JSON.stringify(page.flows)}`,
  );
  assert.equal(flow.document.title, VIEWER_TITLE);
  assert.ok(flow.layout, "precomputed read-only layout remains available");
  assert.equal(flow.source, undefined, "FlowSourceReference is development-only");
  assert.equal(page.absolutePath, "", "the static page omits its absolute filesystem path");
  assert.equal("revision" in flow, false);
  assert.equal("editable" in flow, false);
  const ordinaryPage = docsDataBySite.docs.pages.find(
    (candidate) => candidate.kind === "page" && candidate.sourcePath === "docs/docs/ordinary.md",
  );
  assert.ok(ordinaryPage, "the ordinary fixture page is generated");
  assert.equal(ordinaryPage.flows, undefined, "ordinary page data has no flow payload");

  const links = flow.document.nodes.flatMap((node) => node.links ?? []);
  assert.equal(
    links.some((link) => link.href === LOCAL_SOURCE_PATH),
    false,
    "local source links are removed",
  );
  assert.equal(
    links.some((link) => link.href === "https://example.com/public/parking.ts#L42"),
    true,
    "public source links remain useful to readers",
  );
  assert.doesNotMatch(page.markdown, new RegExp(RAW_INLINE_CANARY));
  assert.match(page.markdown, /smooth-flow source omitted from static output/);
  assert.doesNotMatch(generated, /sha256:[0-9a-f]{64}/);
  assert.doesNotMatch(generated, /"revision"\s*:/);
  assert.doesNotMatch(generated, /"editable"\s*:/);

  const staticOutput = await readStaticTextFiles(outDir);
  assert.match(staticOutput, new RegExp(VIEWER_TITLE));
  for (const secret of [
    projectDir,
    config.docsDir,
    LOCAL_SOURCE_PATH,
    RAW_INLINE_CANARY,
    RAW_EXTERNAL_CANARY,
    EXTERNAL_FLOW_FILE,
  ]) {
    assert.doesNotMatch(staticOutput, new RegExp(escapeRegExp(secret)));
  }
  assert.doesNotMatch(staticOutput, /sha256:[0-9a-f]{64}/);
  assert.doesNotMatch(staticOutput, /\/Users\//);
  assert.doesNotMatch(staticOutput, /\/__smooth-docs\/flow(?:\/|["'`?])/);
  assert.doesNotMatch(staticOutput, /\b(?:Edit flow|Save flow|Discard changes)\b/i);
  assert.doesNotMatch(staticOutput, /["'](?:editable|canEditFlow)["']\s*:\s*(?:true|!0)/);

  const assetNames = await readdir(path.join(outDir, "assets"));
  const viewerChunks = assetNames.filter((name) => /DocsFlow(?:Block|Canvas|Story|Export)/.test(name));
  assert.ok(viewerChunks.length > 0, "flow viewer/export code remains split into lazy chunks");
  assert.equal(
    assetNames.some((name) => /DocsFlowEditor/.test(name)),
    false,
    "the development-only editor chunk is tree-shaken from static output",
  );
  const ordinaryRouteHtml = await readFile(path.join(outDir, "docs", "ordinary", "index.html"), "utf8");
  for (const chunk of viewerChunks) {
    assert.doesNotMatch(
      ordinaryRouteHtml,
      new RegExp(escapeRegExp(chunk)),
      `ordinary page does not preload lazy flow chunk ${chunk}`,
    );
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
