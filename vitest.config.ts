import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "#smooth-docs/types",
        replacement: path.resolve(repositoryRoot, "src/types.ts"),
      },
      {
        find: "#smooth-docs-theme",
        replacement: path.resolve(repositoryRoot, "themes/default/src"),
      },
      {
        find: "@",
        replacement: path.resolve(repositoryRoot, "themes/default/src"),
      },
    ],
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    globals: true,
    include: ["tests/docs-flow/**/*.test.ts", "tests/docs-flow/**/*.test.tsx", "tests/mermaid-export.test.ts"],
    setupFiles: ["./tests/docs-flow/setup.ts"],
  },
});
