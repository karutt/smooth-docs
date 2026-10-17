import { EventEmitter } from "node:events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createManagedCodexBridge, stopCodexProcess } from "../../scripts/codex-process";

afterEach(() => vi.useRealTimers());

function childProcess() {
  return Object.assign(new EventEmitter(), { exitCode: null, signalCode: null, kill: vi.fn(() => true) });
}

describe("Codex process ownership", () => {
  it("waits for process exit, rather than just sending a signal, before handing off its writer lock", async () => {
    const child = childProcess();
    let closed = false;
    const shutdown = stopCodexProcess(child as unknown as ChildProcessWithoutNullStreams).then(() => { closed = true; });
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    await Promise.resolve();
    expect(closed).toBe(false);
    child.emit("close", 0, "SIGTERM");
    await shutdown;
    expect(closed).toBe(true);
  });

  it("finishes terminating an owned process that ignores graceful shutdown", async () => {
    vi.useFakeTimers();
    const child = childProcess();
    const shutdown = stopCodexProcess(child as unknown as ChildProcessWithoutNullStreams);
    await vi.advanceTimersByTimeAsync(2000);
    expect(child.kill).toHaveBeenLastCalledWith("SIGKILL");
    child.emit("close", null, "SIGKILL");
    await shutdown;
  });

  it("replaces the same project's bridge after config reload and waits for all earlier shutdowns", async () => {
    const scope = `test-${crypto.randomUUID()}`;
    let release!: () => void;
    const closing = new Promise<void>((resolve) => { release = resolve; });
    const dispose = vi.fn(() => closing);
    createManagedCodexBridge(scope, () => ({ dispose }));
    let ready = false;
    const next = createManagedCodexBridge(scope, (previousShutdown) => {
      void previousShutdown.then(() => { ready = true; });
      return { dispose: () => previousShutdown };
    });
    expect(dispose).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(ready).toBe(false);
    release();
    await next.dispose();
    expect(ready).toBe(true);
  });

  it("does not close a bridge for a different docs project", () => {
    const dispose = vi.fn(async () => {});
    createManagedCodexBridge(`test-${crypto.randomUUID()}`, () => ({ dispose }));
    createManagedCodexBridge(`test-${crypto.randomUUID()}`, () => ({ dispose: async () => {} }));
    expect(dispose).not.toHaveBeenCalled();
  });
});
