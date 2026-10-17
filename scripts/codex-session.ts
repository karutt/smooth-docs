import path from "node:path";

type RpcRequest = (method: string, params: Record<string, unknown>) => Promise<Record<string, unknown>>;

export function isSmoothDocsCodexSession(value: unknown, cwd: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const thread = value as Record<string, unknown>;
  if (typeof thread.cwd === "string" && thread.cwd) return path.resolve(thread.cwd) === path.resolve(cwd);
  return typeof thread.preview === "string" &&
    thread.preview.includes("You are being prompted from the Smooth Docs Kit browser preview.");
}

export async function deleteCodexSession({
  threadId,
  cwd,
  request,
  isRunning,
}: {
  threadId: string;
  cwd: string;
  request: RpcRequest;
  isRunning: () => boolean;
}) {
  if (!threadId.trim()) throw new Error("Thread id is required");
  if (isRunning()) throw new Error("Stop the active turn before deleting a session");
  // Inspect stored metadata without loading the conversation into memory.
  const result = await request("thread/read", { threadId, includeTurns: false });
  if (!isSmoothDocsCodexSession(result.thread, cwd)) {
    throw new Error("This session does not belong to this docs project");
  }
  const thread = result.thread as Record<string, unknown>;
  const status = thread.status as { type?: string } | null | undefined;
  if (status?.type === "active") throw new Error("Stop the active turn before deleting a session");
  if (isRunning()) throw new Error("Stop the active turn before deleting a session");
  await request("thread/delete", { threadId });
}
