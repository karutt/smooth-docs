import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(repositoryRoot, "themes/default/src"),
    },
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
    include: ["tests/codex-chat/**/*.test.ts", "tests/codex-chat/**/*.test.tsx"],
    setupFiles: ["./tests/codex-chat/setup.ts"],
  },
});
