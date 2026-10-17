import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodexSessionsPanel } from "../../themes/default/src/components/CodexSessionsPanel";

function setup(onDelete = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  const onResume = vi.fn();
  const triggerRef = React.createRef<HTMLButtonElement>();
  render(<>
    <button ref={triggerRef}>Sessions trigger</button>
    <button>Outside</button>
    <CodexSessionsPanel busy={false} currentThreadId='one' loading={false}
      onClose={onClose} onDelete={onDelete} onRefresh={vi.fn()} onResume={onResume}
      sessions={[{ id: "one", name: "My session", updatedAt: 0, status: "idle" }]}
      triggerRef={triggerRef} />
  </>);
  return { onClose, onResume, onDelete };
}

describe("Codex sessions panel", () => {
  it("closes outside the list, but keeps inside and trigger interactions intact", () => {
    const { onClose } = setup();
    fireEvent.pointerDown(screen.getByText("My session"));
    fireEvent.pointerDown(screen.getByText("Sessions trigger"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes only the list on Escape", () => {
    const { onClose } = setup();
    const bubble = vi.fn();
    document.addEventListener("keydown", bubble);
    try {
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledOnce();
      expect(bubble).not.toHaveBeenCalled();
    } finally { document.removeEventListener("keydown", bubble); }
  });

  it("asks before deleting, focuses Cancel, and never resumes or deletes on cancellation", async () => {
    const { onDelete, onResume, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete session: My session" }));
    expect(screen.getByRole("alertdialog", { name: "Delete session?" })).toBeVisible();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onDelete).not.toHaveBeenCalled();
    expect(onResume).not.toHaveBeenCalled();
  });

  it("deletes only after confirmation and prevents duplicate submissions", async () => {
    let complete!: () => void;
    const onDelete = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
    setup(onDelete);
    fireEvent.click(screen.getByRole("button", { name: "Delete session: My session" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete", exact: true }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith("one");
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    complete();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("keeps the confirmation and original session when deletion fails", async () => {
    setup(vi.fn().mockRejectedValue(new Error("Session is in use")));
    fireEvent.click(screen.getByRole("button", { name: "Delete session: My session" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete", exact: true }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Session is in use");
    expect(screen.getByRole("alertdialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("My session")).toBeVisible();
  });
});
