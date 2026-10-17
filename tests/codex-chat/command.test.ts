// @vitest-environment node
import { describe, expect, it } from "vitest";
import { selectNewestCodexCommand } from "../../scripts/codex-command";

describe("Codex executable selection", () => {
  it("uses the newer bundled CLI even when an older CLI occurs first in PATH", () => {
    const versions: Record<string, string> = {
      "/pnpm/codex": "codex-cli 0.145.0",
      "/app/codex": "codex-cli 0.162.0-alpha.17.2",
      "/broken/codex": "",
    };
    expect(selectNewestCodexCommand(Object.keys(versions), (command) => versions[command])).toBe("/app/codex");
    versions["/pnpm/codex"] = "codex-cli 0.163.0";
    expect(selectNewestCodexCommand(Object.keys(versions), (command) => versions[command])).toBe("/pnpm/codex");
  });

  it("compares numeric versions and prefers stable builds on an equal version", () => {
    expect(selectNewestCodexCommand(["0.9.0", "0.10.0-alpha.1", "0.10.0"], (version) => `codex-cli ${version}`)).toBe("0.10.0");
    expect(selectNewestCodexCommand(["0.162.0-alpha.9", "0.162.0-alpha.17.2"], (version) => `codex-cli ${version}`)).toBe("0.162.0-alpha.17.2");
    expect(selectNewestCodexCommand(["broken"], () => "not an executable")).toBeNull();
  });
});
