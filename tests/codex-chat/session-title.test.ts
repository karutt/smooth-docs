import { describe, expect, it, vi } from "vitest";
import { CodexSessionTitles } from "../../scripts/codex-session-title";

const cwd = "/docs/project";
const history = { cwd, turns: [{ id: "turn", items: [
  { type: "userMessage", content: [{ type: "text", text: "Preview context\nUser request:\nTextBoxの検索順位を改善して" }] },
  { type: "reasoning", summary: ["private progress"] },
  { type: "agentMessage", phase: "commentary", text: "調査します" },
  { type: "agentMessage", phase: "final_answer", text: "完全一致のページタイトルを優先しました。" },
] }] };

function setup(request = vi.fn(async (_method: string, params: Record<string, unknown>) => (
  params.includeTurns ? { thread: history } : { thread: { cwd } }
))) {
  const generate = vi.fn(async (_excerpt: string, _signal: AbortSignal) => "TextBox検索の順位改善");
  const onUpdated = vi.fn();
  const onError = vi.fn();
  const titles = new CodexSessionTitles({ cwd, request, generate, onUpdated, onError });
  return { titles, request, generate, onUpdated, onError };
}

describe("Codex session titles", () => {
  it("summarizes only the user request and answer, then persists a name once", async () => {
    const { titles, request, generate, onUpdated } = setup();
    await titles.schedule("session");
    await titles.schedule("session");
    expect(generate).toHaveBeenCalledOnce();
    expect(JSON.parse(generate.mock.calls[0][0])).toEqual({
      question: "TextBoxの検索順位を改善して", answer: "完全一致のページタイトルを優先しました。",
    });
    expect(request).toHaveBeenLastCalledWith("thread/name/set", { threadId: "session", name: "TextBox検索の順位改善" });
    expect(onUpdated).toHaveBeenCalledWith("session", "TextBox検索の順位改善");
  });

  it("preserves an existing name and never generates a title for another project", async () => {
    for (const thread of [{ cwd, name: "My own title" }, { cwd: "/other/project" }]) {
      const { titles, generate, request } = setup(vi.fn().mockResolvedValue({ thread }));
      await titles.schedule("session");
      expect(generate).not.toHaveBeenCalled();
      expect(request).toHaveBeenCalledOnce();
    }
  });

  it("does not overwrite a name changed while generation was running", async () => {
    const request = vi.fn().mockResolvedValueOnce({ thread: { cwd } })
      .mockResolvedValueOnce({ thread: history }).mockResolvedValueOnce({ thread: { cwd, name: "Renamed elsewhere" } });
    const { titles, generate, onUpdated } = setup(request);
    await titles.schedule("session");
    expect(generate).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(3);
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("cancels generation on deletion without renaming or showing an error", async () => {
    const { titles, generate, request, onUpdated, onError } = setup();
    let started!: () => void;
    const generating = new Promise<void>((resolve) => { started = resolve; });
    generate.mockImplementation((_excerpt, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
      started();
    }));
    const done = titles.schedule("session");
    await generating;
    titles.cancel("session");
    await done;
    expect(request).toHaveBeenCalledTimes(2);
    expect(onUpdated).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("leaves an unanswered or failed conversation unchanged", async () => {
    const request = vi.fn().mockResolvedValueOnce({ thread: { cwd } })
      .mockResolvedValueOnce({ thread: { cwd, turns: [] } });
    const { titles, generate } = setup(request);
    await titles.schedule("session");
    expect(generate).not.toHaveBeenCalled();
    const failed = setup();
    failed.generate.mockRejectedValueOnce(new Error("Offline"));
    await failed.titles.schedule("session");
    expect(failed.onUpdated).not.toHaveBeenCalled();
    expect(failed.onError).toHaveBeenCalledOnce();
  });

  it("deduplicates queued jobs, serializes workers, and bounds the excerpt", async () => {
    const longHistory = structuredClone(history);
    longHistory.turns[0].items[0].content![0].text = "a".repeat(5000);
    const { titles, generate } = setup(vi.fn(async (_method, params) => ({ thread: params.includeTurns ? longHistory : { cwd } })));
    let release!: (name: string) => void;
    let started!: () => void;
    const generating = new Promise<void>((resolve) => { started = resolve; });
    generate.mockImplementationOnce(() => new Promise<string>((resolve) => { release = resolve; started(); }));
    const first = titles.schedule("first");
    titles.schedule("first");
    const second = titles.schedule("second");
    await generating;
    expect(generate).toHaveBeenCalledOnce();
    expect(JSON.parse(generate.mock.calls[0][0]).question).toHaveLength(2400);
    release("First title");
    await Promise.all([first, second]);
    expect(generate).toHaveBeenCalledTimes(2);
    await titles.dispose();
    await titles.schedule("third");
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
