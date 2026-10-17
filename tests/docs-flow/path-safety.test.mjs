import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  atomicWriteFile,
  readFileBounded,
  resolveExternalFlowPath,
} from "../../scripts/docs-flow/files.mjs";

const SOURCE_MODULE_PATH = "../../scripts/docs-flow/source.mjs";

async function createFixture(t) {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "smooth-docs-path-safety-"));
  const docsRoot = path.join(sandbox, "docs");
  const pagePath = path.join(docsRoot, "guide", "index.md");
  const flowPath = path.join(docsRoot, "guide", "flows", "valid.docs-flow.yml");

  await mkdir(path.dirname(flowPath), { recursive: true });
  await writeFile(pagePath, "# Guide\n", "utf8");
  await writeFile(flowPath, "version: 1\n", "utf8");

  t.after(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  return { sandbox, docsRoot, pagePath, flowPath };
}

test("resolveExternalFlowPath resolves a valid page-relative flow to its canonical path", async (t) => {
  const { docsRoot, pagePath, flowPath } = await createFixture(t);

  const resolved = await resolveExternalFlowPath({
    docsRoot,
    pagePath,
    src: "./flows/valid.docs-flow.yml",
  });

  assert.equal(resolved, await realpath(flowPath));
});

test("resolveExternalFlowPath rejects traversal with POSIX or Windows separators", async (t) => {
  const { docsRoot, pagePath } = await createFixture(t);

  for (const src of [
    "../outside.docs-flow.yml",
    "flows/../../outside.docs-flow.yml",
    "..\\outside.docs-flow.yml",
    "flows\\..\\..\\outside.docs-flow.yml",
  ]) {
    await assert.rejects(
      resolveExternalFlowPath({ docsRoot, pagePath, src }),
      `expected traversal to be rejected: ${JSON.stringify(src)}`,
    );
  }
});

test("resolveExternalFlowPath rejects absolute, UNC, drive, URL, query, and fragment sources", async (t) => {
  const { docsRoot, pagePath } = await createFixture(t);

  for (const src of [
    "/tmp/outside.docs-flow.yml",
    "//server/share/outside.docs-flow.yml",
    "\\\\server\\share\\outside.docs-flow.yml",
    "C:\\outside.docs-flow.yml",
    "C:/outside.docs-flow.yml",
    "C:outside.docs-flow.yml",
    "https://example.test/outside.docs-flow.yml",
    "flows/valid.docs-flow.yml?raw=1",
    "flows/valid.docs-flow.yml#section",
  ]) {
    await assert.rejects(
      resolveExternalFlowPath({ docsRoot, pagePath, src }),
      `expected non-relative source to be rejected: ${JSON.stringify(src)}`,
    );
  }
});

test("resolveExternalFlowPath rejects non-canonical flow extensions", async (t) => {
  const { docsRoot, pagePath } = await createFixture(t);

  for (const src of [
    "flows/flow.yml",
    "flows/flow.yaml",
    "flows/flow.docs-flow.yaml",
    "flows/flow.docs-flow.json",
    "flows/flow.DOCS-FLOW.YML",
  ]) {
    await assert.rejects(
      resolveExternalFlowPath({ docsRoot, pagePath, src }),
      `expected bad extension to be rejected: ${JSON.stringify(src)}`,
    );
  }
});

test("resolveExternalFlowPath rejects NUL bytes before filesystem access", async (t) => {
  const { docsRoot, pagePath } = await createFixture(t);

  await assert.rejects(
    resolveExternalFlowPath({
      docsRoot,
      pagePath,
      src: "flows/valid\0.docs-flow.yml",
    }),
  );
});

test("resolveExternalFlowPath enforces an active publish root in addition to the docs root", async (t) => {
  const { docsRoot } = await createFixture(t);
  const publishRoot = path.join(docsRoot, "published");
  const pagePath = path.join(publishRoot, "index.md");
  const publishedFlow = path.join(publishRoot, "flows", "public.docs-flow.yml");
  const privateFlow = path.join(docsRoot, "private", "private.docs-flow.yml");

  await mkdir(path.dirname(publishedFlow), { recursive: true });
  await mkdir(path.dirname(privateFlow), { recursive: true });
  await writeFile(pagePath, "# Published\n", "utf8");
  await writeFile(publishedFlow, "version: 1\n", "utf8");
  await writeFile(privateFlow, "version: 1\n", "utf8");

  assert.equal(
    await resolveExternalFlowPath({
      docsRoot,
      publishRoot,
      pagePath,
      src: "./flows/public.docs-flow.yml",
    }),
    await realpath(publishedFlow),
  );

  await assert.rejects(
    resolveExternalFlowPath({
      docsRoot,
      publishRoot,
      pagePath,
      src: "../private/private.docs-flow.yml",
    }),
  );
});

test("resolveExternalFlowPath rejects a symlink that escapes the docs root", async (t) => {
  const { sandbox, docsRoot, pagePath } = await createFixture(t);
  const outsideRoot = path.join(sandbox, "outside");
  const outsideFlow = path.join(outsideRoot, "secret.docs-flow.yml");
  const escapingLink = path.join(docsRoot, "guide", "linked-outside");

  await mkdir(outsideRoot, { recursive: true });
  await writeFile(outsideFlow, "secret: true\n", "utf8");
  await symlink(outsideRoot, escapingLink, "dir");

  await assert.rejects(
    resolveExternalFlowPath({
      docsRoot,
      pagePath,
      src: "./linked-outside/secret.docs-flow.yml",
    }),
  );

  assert.equal(await readFile(outsideFlow, "utf8"), "secret: true\n");
});

test("atomicWriteFile replaces the target, preserves its mode, and leaves no sibling temporary file", async (t) => {
  const { sandbox } = await createFixture(t);
  const targetDir = path.join(sandbox, "atomic-success");
  const targetPath = path.join(targetDir, "flow.docs-flow.yml");

  await mkdir(targetDir, { recursive: true });
  await writeFile(targetPath, "before\n", "utf8");
  await chmod(targetPath, 0o640);

  const originalMode = (await stat(targetPath)).mode & 0o777;
  await atomicWriteFile(targetPath, Buffer.from("after\n", "utf8"));

  assert.equal(await readFile(targetPath, "utf8"), "after\n");
  assert.equal((await stat(targetPath)).mode & 0o777, originalMode);
  assert.deepEqual(await readdir(targetDir), ["flow.docs-flow.yml"]);
});

test("atomicWriteFile cleans up its sibling temporary file when replacement fails", async (t) => {
  const { sandbox } = await createFixture(t);
  const targetDir = path.join(sandbox, "atomic-failure");
  const targetPath = path.join(targetDir, "blocked.docs-flow.yml");
  const markerPath = path.join(targetPath, "marker.txt");

  await mkdir(targetPath, { recursive: true });
  await writeFile(markerPath, "unchanged\n", "utf8");

  await assert.rejects(
    atomicWriteFile(targetPath, Buffer.from("must-not-replace-directory\n", "utf8")),
  );

  assert.equal(await readFile(markerPath, "utf8"), "unchanged\n");
  assert.deepEqual(await readdir(targetDir), ["blocked.docs-flow.yml"]);
});

test("external targets are derived from the current page reference, never a client-selected path", async (t) => {
  const { sandbox, docsRoot, pagePath, flowPath } = await createFixture(t);
  const outsidePath = path.join(sandbox, "client-selected.docs-flow.yml");
  await writeFile(outsidePath, "outside: unchanged\n", "utf8");

  const resolved = await resolveExternalFlowPath({
    docsRoot,
    pagePath,
    src: "./flows/valid.docs-flow.yml",
    targetPath: outsidePath,
    canonicalPath: outsidePath,
  });

  assert.equal(resolved, await realpath(flowPath));
  assert.notEqual(resolved, await realpath(outsidePath));
  assert.equal(await readFile(outsidePath, "utf8"), "outside: unchanged\n");
});

test("external source preparation re-derives ownership and conflicts if the page reference changed while editing", async (t) => {
  const { docsRoot, pagePath, flowPath } = await createFixture(t);
  const alternatePath = path.join(path.dirname(flowPath), "alternate.docs-flow.yml");
  const sourceModule = await import(SOURCE_MODULE_PATH);
  assert.equal(
    typeof sourceModule.loadExternalFlowSource,
    "function",
    "source.mjs must expose bounded external ownership loading",
  );
  assert.equal(
    typeof sourceModule.prepareExternalFlowSave,
    "function",
    "source.mjs must expose target-only external save preparation",
  );

  const originalFlow = externalFlowYaml("Shared original");
  const alternateFlow = externalFlowYaml("Shared alternate");
  const originalPage = externalReferenceMarkdown("./flows/valid.docs-flow.yml");
  const changedPage = externalReferenceMarkdown("./flows/alternate.docs-flow.yml");
  await writeFile(flowPath, originalFlow, "utf8");
  await writeFile(alternatePath, alternateFlow, "utf8");
  await writeFile(pagePath, originalPage, "utf8");

  const loaded = await sourceModule.loadExternalFlowSource({
    docsRoot,
    pagePath,
    pageSourcePath: "docs/docs/guide/index.md",
    flowId: "shared-external-flow",
  });
  assert.equal(loaded.targetPath, await realpath(flowPath));
  assert.equal(loaded.reference, "./flows/valid.docs-flow.yml");
  assert.match(loaded.revision, /^sha256:[0-9a-f]{64}$/);

  await writeFile(pagePath, changedPage, "utf8");
  await assert.rejects(
    sourceModule.prepareExternalFlowSave({
      docsRoot,
      pagePath,
      pageSourcePath: "docs/docs/guide/index.md",
      flowId: "shared-external-flow",
      baseRevision: loaded.revision,
      candidateDocument: {
        ...loaded.document,
        title: "An edit based on the original reference",
      },
    }),
    (error) => error?.code === "REVISION_CONFLICT" || /revision|reference|changed/i.test(error?.message),
  );

  assert.equal(await readFile(flowPath, "utf8"), originalFlow);
  assert.equal(await readFile(alternatePath, "utf8"), alternateFlow);
});

test("bounded reads reject files outside every allowed docs root without returning their bytes", async (t) => {
  const { sandbox, docsRoot } = await createFixture(t);
  const outsidePath = path.join(sandbox, "outside-read-secret.docs-flow.yml");
  await writeFile(outsidePath, "OUTSIDE_READ_SECRET_783d\n", "utf8");

  await assert.rejects(
    readFileBounded(outsidePath, {
      encoding: "utf8",
      maxBytes: 512 * 1024,
      allowedRoots: [docsRoot],
    }),
    (error) => error?.code === "FLOW_PATH_FORBIDDEN",
  );
  assert.equal(await readFile(outsidePath, "utf8"), "OUTSIDE_READ_SECRET_783d\n");
});

test("atomic writes reject an outside-root target before creating a temporary file", async (t) => {
  const { sandbox, docsRoot } = await createFixture(t);
  const outsideDir = path.join(sandbox, "outside-write");
  const outsidePath = path.join(outsideDir, "outside.docs-flow.yml");
  await mkdir(outsideDir, { recursive: true });
  await writeFile(outsidePath, "outside: unchanged\n", "utf8");

  await assert.rejects(
    atomicWriteFile(outsidePath, Buffer.from("outside: overwritten\n"), {
      allowedRoots: [docsRoot],
    }),
    (error) => error?.code === "FLOW_PATH_FORBIDDEN",
  );

  assert.equal(await readFile(outsidePath, "utf8"), "outside: unchanged\n");
  assert.deepEqual(await readdir(outsideDir), ["outside.docs-flow.yml"]);
});

test("atomic replacement rejects a target symlink swapped outside the docs root before rename", async (t) => {
  const { sandbox, docsRoot, flowPath } = await createFixture(t);
  const outsidePath = path.join(sandbox, "outside-target.docs-flow.yml");
  await writeFile(outsidePath, "outside target remains\n", "utf8");

  await assert.rejects(
    atomicWriteFile(flowPath, Buffer.from("replacement must not commit\n"), {
      allowedRoots: [docsRoot],
      beforeRename: async () => {
        await rm(flowPath);
        await symlink(outsidePath, flowPath, "file");
      },
    }),
    (error) => error?.code === "FLOW_PATH_FORBIDDEN",
  );

  assert.equal(await readFile(outsidePath, "utf8"), "outside target remains\n");
  assert.deepEqual(
    (await readdir(path.dirname(flowPath))).filter((name) => name.endsWith(".tmp")),
    [],
  );
});

test("atomic replacement rejects a parent symlink swap and cleans the canonical sibling temporary", async (t) => {
  const { sandbox, docsRoot, flowPath } = await createFixture(t);
  const originalParent = path.dirname(flowPath);
  const retainedParent = path.join(path.dirname(originalParent), "retained-flows");
  const outsideParent = path.join(sandbox, "outside-parent");
  const outsideTarget = path.join(outsideParent, path.basename(flowPath));
  await mkdir(outsideParent, { recursive: true });
  await writeFile(outsideTarget, "outside parent remains\n", "utf8");

  await assert.rejects(
    atomicWriteFile(flowPath, Buffer.from("replacement must not escape\n"), {
      allowedRoots: [docsRoot],
      beforeRename: async () => {
        await rename(originalParent, retainedParent);
        await symlink(outsideParent, originalParent, "dir");
      },
    }),
    (error) => error?.code === "FLOW_PATH_FORBIDDEN",
  );

  assert.equal(await readFile(outsideTarget, "utf8"), "outside parent remains\n");
  assert.equal(await readFile(path.join(retainedParent, path.basename(flowPath)), "utf8"), "version: 1\n");
  assert.deepEqual(
    (await readdir(retainedParent)).filter((name) => name.endsWith(".tmp")),
    [],
  );
});

test("external flow replacement is target-only, atomic, mode-preserving, and leaves its page untouched", async (t) => {
  const { docsRoot, pagePath, flowPath } = await createFixture(t);
  const pageBefore = externalReferenceMarkdown("./flows/valid.docs-flow.yml");
  const nextFlow = externalFlowYaml("Atomically replaced external flow");
  await writeFile(pagePath, pageBefore, "utf8");
  await writeFile(flowPath, externalFlowYaml("Original external flow"), "utf8");
  await chmod(flowPath, 0o640);
  const originalMode = (await stat(flowPath)).mode & 0o777;

  await atomicWriteFile(flowPath, Buffer.from(nextFlow), { allowedRoots: [docsRoot] });

  assert.equal(await readFile(pagePath, "utf8"), pageBefore);
  assert.equal(await readFile(flowPath, "utf8"), nextFlow);
  assert.equal((await stat(flowPath)).mode & 0o777, originalMode);
  assert.deepEqual(await readdir(path.dirname(flowPath)), ["valid.docs-flow.yml"]);
});

function externalReferenceMarkdown(src) {
  return `# Guide\n\n\`\`\`smooth-flow\nsrc: ${src}\nheight: 480\n\`\`\`\n`;
}

function externalFlowYaml(title) {
  return [
    "version: 1",
    "id: shared-external-flow",
    "kind: workflow",
    `title: ${title}`,
    "direction: right",
    "nodes:",
    "  - id: start",
    "    type: action",
    "    label: Start",
    "edges: []",
    "",
  ].join("\n");
}
