import assert from "node:assert/strict";
import { test } from "node:test";
import { createPageSearchFilter, createPageSearchIndex, pageSearchValue, scorePageSearch } from "../themes/default/src/lib/page-search.ts";

const pages = [
  { title: "Roblox UI", sourcePath: "docs/roblox-ui/index.md", text: "TextBox TextButton Frame" },
  { title: "基本部品", sourcePath: "docs/roblox-ui/基本部品/index.md", text: "TextBox" },
  { title: "TextBox examples", sourcePath: "docs/examples.md", text: "TextBox" },
  { title: "TextBox", sourcePath: "docs/roblox-ui/基本部品/TextBox.md", text: "Very long documentation. ".repeat(2000) },
];

function rank(search, documents = pages) {
  return documents.map((page) => ({ title: page.title, score: scorePageSearch(createPageSearchIndex(page), search) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ title }) => title);
}

test("TextBox title ranks above folders, prefix matches and body mentions regardless of body length", () => {
  assert.deepEqual(rank("TextBox"), ["TextBox", "TextBox examples", "Roblox UI", "基本部品"]);
});

test("title matching ignores case, width and word separators", () => {
  for (const query of ["textbox", "  TEXTBOX  ", "ＴｅｘｔＢｏｘ", "text box", "text-box"]) {
    assert.equal(rank(query)[0], "TextBox");
  }
});

test("retains path, multiword and generated body text search", () => {
  const documents = [
    { title: "Guide", sourcePath: "docs/TextBox.md", text: "Custom reader-visible workflow node" },
    { title: "Settings", sourcePath: "docs/settings.md", text: "Workflow setup guide" },
  ];
  assert.deepEqual(rank("textbox", documents), ["Guide"]);
  assert.deepEqual(rank("reader-visible workflow", documents), ["Guide"]);
  assert.deepEqual(rank("guide custom", documents), ["Guide"]);
  assert.deepEqual(rank("missing identifier", documents), []);
});

test("keeps fuzzy title matches but rejects scattered letters in body text", () => {
  assert.equal(rank("txtbox")[0], "TextBox");
  assert.deepEqual(rank("abc", [{ title: "Guide", sourcePath: "docs/guide.md", text: "a long body content" }]), []);
});

test("uses field-aware scores in the command menu while preserving action search", () => {
  const filter = createPageSearchFilter(pages);
  assert.ok(filter(pageSearchValue(pages[3]), "textbox") > filter("open textbox", "textbox"));
  assert.ok(filter("toggle theme dark light", "theme") > 0);
  assert.equal(filter(pageSearchValue(pages[0]), "reader-visible"), 0);
});
