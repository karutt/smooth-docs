import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodexChatMessages } from "../../themes/default/src/components/CodexChatMessages";
import type { CodexChatMessage } from "../../src/codex-chat";

const messages: CodexChatMessage[] = [
  { id: "u", role: "user", content: "Fix this", turnId: "turn-1" },
  { id: "r", role: "assistant", kind: "reasoning", content: "Checking the docs.", turnId: "turn-1" },
  { id: "c", role: "assistant", kind: "commentary", content: "Updating the code.", turnId: "turn-1" },
  { id: "a", role: "assistant", kind: "answer", content: "Fixed it.", turnId: "turn-1" },
];
const renderContent = (content: string) => <p>{content}</p>;

describe("Codex chat display", () => {
  it("folds reasoning and progress by default while keeping the answer visible", () => {
    render(<CodexChatMessages messages={messages} working={false} renderContent={renderContent} />);
    const toggle = screen.getByRole("button", { name: "Thinking & progress" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Checking the docs.")).not.toBeInTheDocument();
    expect(screen.queryByText("Updating the code.")).not.toBeInTheDocument();
    expect(screen.getByText("Fixed it.")).toBeVisible();
    fireEvent.click(toggle);
    expect(screen.getByText("Checking the docs.")).toBeVisible();
    expect(screen.getByText("Updating the code.")).toBeVisible();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Fixed it.")).toBeVisible();
  });

  it("preserves expansion as streaming items update and gives the next turn its own fold", () => {
    const { rerender } = render(<CodexChatMessages messages={messages.slice(0, 3)} working renderContent={renderContent} />);
    fireEvent.click(screen.getByRole("button", { name: /Thinking & progress/ }));
    rerender(<CodexChatMessages messages={[...messages,
      { id: "u2", role: "user", content: "Next request", turnId: "turn-2" },
      { id: "r2", role: "assistant", kind: "reasoning", content: "Thinking again.", turnId: "turn-2" },
    ]} working renderContent={renderContent} />);
    const toggles = screen.getAllByRole("button", { name: /Thinking & progress/ });
    expect(toggles[0]).toHaveAttribute("aria-expanded", "true");
    expect(toggles[1]).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Fixed it.")).toBeVisible();
    expect(screen.queryByText("Thinking again.")).not.toBeInTheDocument();
  });

  it("does not leave a Working placeholder after stopping or completing a turn", () => {
    render(<CodexChatMessages messages={[{ id: "pending", role: "assistant", content: "" }]} working={false} renderContent={renderContent} />);
    expect(screen.queryByText("Working")).not.toBeInTheDocument();
  });
});
