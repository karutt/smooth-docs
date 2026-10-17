import type { ChildProcessWithoutNullStreams } from "node:child_process";

type ManagedBridge = { dispose(): Promise<void> };
const registryKey = Symbol.for("smooth-docs-kit.codex-chat-bridges");
const runtime = globalThis as typeof globalThis & { [registryKey]?: Map<string, ManagedBridge> };

// Vite reloads its config in the same Node process. Keep track of the old
// bridge even when the HTTP server is reused and does not emit "close".
export function createManagedCodexBridge<T extends ManagedBridge>(
  scope: string,
  create: (previousShutdown: Promise<void>) => T,
): T {
  const bridges = runtime[registryKey] ??= new Map();
  const previousShutdown = bridges.get(scope)?.dispose() ?? Promise.resolve();
  const bridge = create(previousShutdown);
  bridges.set(scope, bridge);
  return bridge;
}

export function stopCodexProcess(child: ChildProcessWithoutNullStreams | null): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
    timer.unref();
    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}
