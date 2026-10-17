import { describe, expect, it, vi } from "vitest";
import { deleteCodexSession } from "../../scripts/codex-session";

const cwd = "/docs/project";

describe("Codex session deletion", () => {
  it("reads metadata without resuming, then permanently deletes the owned session", async () => {
    const request = vi.fn().mockResolvedValueOnce({ thread: { id: "session", cwd } }).mockResolvedValueOnce({});
    await deleteCodexSession({ cwd, threadId: "session", request, isRunning: () => false });
    expect(request.mock.calls).toEqual([
      ["thread/read", { threadId: "session", includeTurns: false }],
      ["thread/delete", { threadId: "session" }],
    ]);
  });

  it("rejects sessions in another project even if their preview mentions Smooth Docs", async () => {
    const request = vi.fn().mockResolvedValue({ thread: {
      cwd: "/docs/another-project",
      preview: "You are being prompted from the Smooth Docs Kit browser preview.",
    } });
    await expect(deleteCodexSession({ cwd, threadId: "other", request, isRunning: () => false }))
      .rejects.toThrow("does not belong");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects a running turn before any RPC and rechecks after the metadata read", async () => {
    const request = vi.fn().mockResolvedValue({ thread: { cwd } });
    await expect(deleteCodexSession({ cwd, threadId: "session", request, isRunning: () => true }))
      .rejects.toThrow("Stop the active turn");
    expect(request).not.toHaveBeenCalled();
    const isRunning = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    await expect(deleteCodexSession({ cwd, threadId: "session", request, isRunning }))
      .rejects.toThrow("Stop the active turn");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("keeps API failures visible instead of treating a failed delete as success", async () => {
    const request = vi.fn().mockResolvedValueOnce({ thread: { cwd } })
      .mockRejectedValueOnce(new Error("Session is in use"));
    await expect(deleteCodexSession({ cwd, threadId: "session", request, isRunning: () => false }))
      .rejects.toThrow("Session is in use");
  });

  it("rejects an active session reported by the app server", async () => {
    const request = vi.fn().mockResolvedValue({ thread: { cwd, status: { type: "active" } } });
    await expect(deleteCodexSession({ cwd, threadId: "session", request, isRunning: () => false }))
      .rejects.toThrow("Stop the active turn");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
