import { describe, expect, it } from "vitest";
import {
  CodexMessageStream,
  extractCodexThreadMessages,
  upsertCodexChatMessage,
  type CodexChatMessage,
} from "../../src/codex-chat";

const context = { threadId: "thread-1", turnId: "turn-1" };

describe("Codex conversation items", () => {
  it("keeps reasoning, commentary and answers separate and replaces deltas on completion", () => {
    const stream = new CodexMessageStream();
    let messages: CodexChatMessage[] = [];
    const receive = (method: string, params: Record<string, unknown>) => {
      const update = stream.handle(method, { ...context, ...params });
      if (update) messages = upsertCodexChatMessage(messages, update.message, update.append);
    };
    receive("item/started", { item: { id: "r", type: "reasoning", summary: [] } });
    receive("item/reasoning/summaryTextDelta", { itemId: "r", summaryIndex: 0, delta: "Check " });
    receive("item/reasoning/summaryTextDelta", { itemId: "r", summaryIndex: 0, delta: "the docs." });
    receive("item/reasoning/summaryTextDelta", { itemId: "r", summaryIndex: 1, delta: "Found the cause." });
    receive("item/started", { item: { id: "c", type: "agentMessage", phase: "commentary", text: "" } });
    receive("item/agentMessage/delta", { itemId: "c", delta: "Checking the implementation." });
    receive("item/started", { item: { id: "a", type: "agentMessage", phase: "final_answer", text: "" } });
    receive("item/agentMessage/delta", { itemId: "a", delta: "Fixed" });
    receive("item/completed", { item: { id: "a", type: "agentMessage", phase: "final_answer", text: "Fixed it." } });
    receive("item/completed", { item: { id: "a", type: "agentMessage", phase: "final_answer", text: "Fixed it." } });

    expect(messages.map(({ kind, content }) => ({ kind, content }))).toEqual([
      { kind: "reasoning", content: "Check the docs.\n\nFound the cause." },
      { kind: "commentary", content: "Checking the implementation." },
      { kind: "answer", content: "Fixed it." },
    ]);
    expect(messages.every((message) => message.turnId === "turn-1")).toBe(true);
  });

  it("corrects a message phase supplied only on completion and scopes repeated ids to their turn", () => {
    const stream = new CodexMessageStream();
    const initial = stream.handle("item/agentMessage/delta", { ...context, itemId: "a", delta: "Checking." })!.message;
    const completed = stream.handle("item/completed", {
      ...context, item: { id: "a", type: "agentMessage", phase: "commentary", text: "Checking." },
    })!.message;
    expect(upsertCodexChatMessage([initial], completed)).toEqual([{ ...initial, kind: "commentary" }]);
    const next = stream.handle("item/agentMessage/delta", { ...context, turnId: "turn-2", itemId: "a", delta: "Done." })!.message;
    expect(next.id).not.toBe(initial.id);
    expect(next.content).toBe("Done.");
  });

  it("sends only the newly streamed text rather than retransmitting the whole response", () => {
    const stream = new CodexMessageStream();
    stream.handle("item/agentMessage/delta", { ...context, itemId: "a", delta: "A long response" });
    expect(stream.handle("item/agentMessage/delta", { ...context, itemId: "a", delta: " continues." })).toMatchObject({
      append: true,
      message: { content: " continues." },
    });
  });

  it("restores the same kinds and ids from history, preserving user inputs and turn errors", () => {
    const messages = extractCodexThreadMessages({ turns: [{ id: "turn-1", items: [
      { id: "u", type: "userMessage", content: [{ type: "text", text: "Context\nUser request:\nFix this" }] },
      { id: "r", type: "reasoning", summary: ["Check the docs.", "Found the cause."], content: ["raw content"] },
      { id: "c", type: "agentMessage", phase: "commentary", text: "Checking." },
      { id: "a", type: "agentMessage", phase: "final_answer", text: "Done." },
      { id: "legacy", type: "agentMessage", text: "Older reply." },
    ], error: { message: "Interrupted" } }] }, "thread-1");
    expect(messages.map((message) => message.kind)).toEqual([undefined, "reasoning", "commentary", "answer", "answer", undefined]);
    expect(messages[0].content).toBe("Fix this");
    expect(messages[1].content).toBe("Check the docs.\n\nFound the cause.");
    expect(messages[1].id).toBe("thread-1:turn-1:r");
    expect(messages.at(-1)).toMatchObject({ role: "system", content: "Interrupted" });
  });
});
