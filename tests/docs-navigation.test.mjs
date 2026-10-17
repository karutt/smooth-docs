import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDocsNavigation } from "../themes/default/src/lib/docs-navigation.ts";

const pages = {
  docs: new Set(["/", "/getting-started/", "/guide/", "/日本語/"]),
  other: new Set(["/", "/guide/"]),
};
const current = "http://localhost:8101/docs/getting-started/";

test("routes generated, relative and site-prefixed links using loaded docs data", () => {
  for (const href of ["/guide/", "/docs/guide/", "../guide/", "/guide/index.html"]) {
    assert.deepEqual(resolveDocsNavigation(href, current, "docs", pages), {
      site: "docs", pagePath: "/guide/", search: "", hash: "",
    });
  }
  assert.equal(resolveDocsNavigation("/guide/", current, "other", pages)?.site, "other");
  assert.equal(resolveDocsNavigation("/other/guide/", current, "docs", pages)?.site, "other");
});

test("preserves query strings and heading fragments across pages", () => {
  assert.deepEqual(resolveDocsNavigation("/docs/guide/?mode=preview#details", current, "docs", pages), {
    site: "docs", pagePath: "/guide/", search: "?mode=preview", hash: "#details",
  });
  assert.equal(resolveDocsNavigation("/%E6%97%A5%E6%9C%AC%E8%AA%9E/", current, "docs", pages)?.pagePath, "/日本語/");
});

test("leaves external URLs, assets, missing pages and same-document fragments to the browser", () => {
  for (const href of ["https://example.com/guide/", "mailto:test@example.com", "/file.pdf", "/missing/", "#details", "http://[invalid"]) {
    assert.equal(resolveDocsNavigation(href, current, "docs", pages), null);
  }
});
