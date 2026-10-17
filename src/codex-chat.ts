export type CodexChatMessage = {
  id: string;
  role: "assistant" | "system" | "user";
  content: string;
  kind?: "answer" | "commentary" | "reasoning";
  turnId?: string;
};

export type CodexChatMessageUpdate = {
  message: CodexChatMessage;
  append?: boolean;
};

export type CodexContextUsage = {
  usedTokens: number;
  contextWindow: number;
};

export function normalizeCodexContextUsage(value: unknown): CodexContextUsage | null {
  const usage = object(value);
  const usedTokens = object(usage?.last)?.totalTokens;
  const contextWindow = usage?.modelContextWindow;
  if (typeof usedTokens !== "number" || !Number.isFinite(usedTokens) || usedTokens < 0
    || typeof contextWindow !== "number" || !Number.isFinite(contextWindow) || contextWindow <= 0) return null;
  return { usedTokens, contextWindow };
}

type CodexItem = Record<string, unknown>;

function object(value: unknown): CodexItem | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as CodexItem : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function textParts(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text) : [];
}

export function normalizeCodexThreadItem(value: unknown): Omit<CodexChatMessage, "id"> & {
  id: string | null;
} | null {
  const item = object(value);
  if (!item) return null;
  const id = text(item.id) || null;

  if (item.type === "agentMessage" || item.type === "plan") {
    return {
      id,
      role: "assistant",
      content: text(item.text),
      kind: item.type === "plan" || item.phase === "commentary" ? "commentary" : "answer",
    };
  }

  if (item.type === "reasoning") {
    return {
      id,
      role: "assistant",
      content: textParts(item.summary).filter(Boolean).join("\n\n"),
      kind: "reasoning",
    };
  }

  if (item.type === "userMessage") {
    const content = Array.isArray(item.content)
      ? item.content.map((value) => {
          const input = object(value);
          if (input?.type === "text") return text(input.text);
          if (input?.type === "image" && input.url) return `![image](${text(input.url)})`;
          if (input?.type === "localImage" && input.path) return `![image](${text(input.path)})`;
          if ((input?.type === "mention" || input?.type === "skill") && input.name) return `@${text(input.name)}`;
          return "";
        }).filter(Boolean).join("\n\n")
      : "";
    const marker = "\nUser request:\n";
    return {
      id,
      role: "user",
      content: content.includes(marker) ? content.slice(content.lastIndexOf(marker) + marker.length).trim() : content.trim(),
    };
  }

  return null;
}

export function extractCodexThreadMessages(thread: CodexItem | null, threadId: string) {
  const messages: CodexChatMessage[] = [];
  const turns = Array.isArray(thread?.turns) ? thread.turns : [];

  for (const value of turns) {
    const turn = object(value);
    if (!turn) continue;
    const turnId = text(turn.id) || `turn-${messages.length}`;
    const items = Array.isArray(turn.items) ? turn.items : [];
    for (const value of items) {
      const message = normalizeCodexThreadItem(value);
      if (!message?.content.trim()) continue;
      messages.push({
        ...message,
        id: `${threadId}:${turnId}:${message.id ?? messages.length}`,
        turnId,
        content: message.content.trim(),
      });
    }
    const error = text(object(turn.error)?.message);
    if (error) messages.push({ id: `${threadId}:${turnId}:error`, role: "system", content: error, turnId });
  }

  return messages;
}

// Preserve item boundaries and phase metadata; completed items replace streamed snapshots.
export class CodexMessageStream {
  private items = new Map<string, CodexItem>();

  reset() {
    this.items.clear();
  }

  handle(method: string, params: CodexItem): CodexChatMessageUpdate | null {
    const lifecycle = method === "item/started" || method === "item/completed";
    const item = lifecycle ? object(params.item) : null;
    const itemId = text(item?.id) || text(params.itemId);
    const turnId = text(params.turnId);
    if (!itemId || !turnId) return null;
    const id = `${text(params.threadId)}:${turnId}:${itemId}`;
    const previousMessage = normalizeCodexThreadItem(this.items.get(id));
    let next: CodexItem;

    if (lifecycle && item) {
      next = item;
    } else if (method === "item/agentMessage/delta" || method === "item/plan/delta") {
      const previous = this.items.get(id) ?? {
        id: itemId,
        type: method === "item/plan/delta" ? "plan" : "agentMessage",
      };
      next = { ...previous, text: text(previous.text) + text(params.delta) };
    } else if (method === "item/reasoning/summaryTextDelta") {
      const previous = this.items.get(id) ?? { id: itemId, type: "reasoning" };
      const summary = textParts(previous.summary);
      const index = typeof params.summaryIndex === "number" && Number.isInteger(params.summaryIndex)
        && params.summaryIndex >= 0 ? params.summaryIndex : 0;
      summary[index] = (summary[index] ?? "") + text(params.delta);
      next = { ...previous, summary };
    } else {
      return null;
    }

    this.items.set(id, next);
    const message = normalizeCodexThreadItem(next);
    if (!message || message.role !== "assistant") return null;
    const append = !lifecycle && previousMessage !== null && previousMessage.kind === message.kind
      && message.content.startsWith(previousMessage.content);
    return {
      message: {
        ...message,
        id,
        turnId,
        content: append ? message.content.slice(previousMessage.content.length) : message.content,
      },
      append,
    };
  }
}

export function upsertCodexChatMessage(messages: CodexChatMessage[], message: CodexChatMessage, append = false) {
  const index = messages.findIndex((entry) => entry.id === message.id);
  if (index === -1) return message.content ? [...messages, message] : messages;
  return messages.map((entry, i) => i === index
    ? { ...message, content: append ? entry.content + message.content : message.content }
    : entry);
}
