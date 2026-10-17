import * as React from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompiledFlowLayout, FlowDocument } from "#smooth-docs/types";

const imageHarness = vi.hoisted(() => ({
  toPng: vi.fn(),
}));

vi.mock("html-to-image", () => ({
  toPng: imageHarness.toPng,
}));

// @ts-expect-error -- T059 introduces this production module after these failure-first tests.
import {
  computeFlowExportBounds,
  createFlowPngFilename,
  exportFlowPng,
} from "@/components/docs-flow/DocsFlowExport";

const flowDocument: FlowDocument = {
  version: 1,
  id: "payment-processing",
  kind: "workflow",
  title: "Payment processing",
  direction: "right",
  lanes: [{ id: "payments", label: "Payments" }],
  nodes: [
    { id: "receive", type: "action", label: "Receive", lane: "payments" },
    { id: "capture", type: "service", label: "Capture", lane: "payments" },
  ],
  edges: [{ id: "receive-capture", from: "receive", to: "capture" }],
};

const layout: CompiledFlowLayout = {
  direction: "right",
  lanes: {
    payments: { x: -120, y: -80, width: 1_000, height: 700 },
  },
  nodes: {
    receive: { x: 40, y: 40, width: 220, height: 104 },
    capture: { x: 920, y: 720, width: 220, height: 104 },
  },
  computedNodeIds: ["receive", "capture"],
};

function ExportFixture() {
  return (
    <div
      data-testid="viewport"
      style={{
        backgroundColor: "rgb(12, 13, 14)",
        height: 320,
        transform: "translate(-900px, -400px) scale(2.5)",
        width: 480,
      }}
    >
      <div className="react-flow__node" data-testid="ordinary-node">Receive</div>
      <div
        aria-selected="true"
        className="react-flow__node selected"
        data-selected="true"
        data-testid="selected-node"
      >
        Capture
      </div>
      <svg className="react-flow__edge" data-testid="edge" />
      <div className="react-flow__controls" data-testid="controls">Controls</div>
      <div className="react-flow__minimap" data-testid="minimap">Minimap</div>
      <div className="react-flow__handle" data-testid="handle">Handle</div>
      <div className="react-flow__selection" data-testid="selection-box">Selection</div>
      <div aria-label="Workflow reader controls" data-testid="reader-toolbar">Toolbar</div>
      <div data-flow-editor="true" data-testid="editor">Editor</div>
      <div data-flow-export-exclude="true" data-testid="explicit-exclusion">Transient</div>
    </div>
  );
}

afterEach(() => {
  imageHarness.toPng.mockReset();
  vi.restoreAllMocks();
  document.documentElement.className = "";
  delete document.documentElement.dataset.docsTheme;
});

describe("DocsFlow whole-graph PNG export", () => {
  it("computes bounds from every lane and node instead of the current viewport", () => {
    expect(computeFlowExportBounds(layout)).toEqual({
      x: -120,
      y: -80,
      width: 1_260,
      height: 904,
    });
  });

  it("fits the full graph, retains the current theme, and excludes transient selection UI", async () => {
    document.documentElement.classList.add("dark");
    document.documentElement.dataset.docsTheme = "dracula";
    const { getByTestId } = render(<ExportFixture />);
    const viewport = getByTestId("viewport");
    const selectedNode = getByTestId("selected-node");
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    let capturedNode: HTMLElement | undefined;
    let capturedOptions: Record<string, unknown> | undefined;
    imageHarness.toPng.mockImplementation(
      async (node: HTMLElement, options: Record<string, unknown>) => {
        capturedNode = node;
        capturedOptions = options;
        const capturedSelection = node.querySelector<HTMLElement>(
          '[data-testid="selected-node"]',
        );
        expect(capturedSelection).not.toHaveClass("selected");
        expect(capturedSelection).not.toHaveAttribute("aria-selected", "true");
        expect(capturedSelection).not.toHaveAttribute("data-selected", "true");
        return "data:image/png;base64,c21vb3RoLWRvY3M=";
      },
    );

    await exportFlowPng({
      document: flowDocument,
      element: viewport,
      layout,
      padding: 32,
    });

    expect(imageHarness.toPng).toHaveBeenCalledTimes(1);
    expect(capturedNode).toBeInstanceOf(HTMLElement);
    expect(capturedNode?.ownerDocument.documentElement).toHaveClass("dark");
    expect(capturedNode?.ownerDocument.documentElement).toHaveAttribute(
      "data-docs-theme",
      "dracula",
    );
    expect(capturedOptions).toMatchObject({
      width: 1_324,
      height: 968,
      backgroundColor: "rgb(12, 13, 14)",
      style: {
        width: "1324px",
        height: "968px",
        transform: "translate(152px, 112px) scale(1)",
        transformOrigin: "top left",
      },
    });
    expect(JSON.stringify(capturedOptions)).not.toContain("scale(2.5)");
    expect(JSON.stringify(capturedOptions)).not.toContain("-900px");

    const filter = capturedOptions?.filter as ((node: HTMLElement) => boolean) | undefined;
    expect(filter).toBeTypeOf("function");
    for (const transientId of [
      "controls",
      "minimap",
      "handle",
      "selection-box",
      "reader-toolbar",
      "editor",
      "explicit-exclusion",
    ]) {
      expect(filter?.(capturedNode!.querySelector(`[data-testid="${transientId}"]`)!)).toBe(
        false,
      );
    }
    expect(filter?.(capturedNode!.querySelector('[data-testid="ordinary-node"]')!)).toBe(true);
    expect(filter?.(capturedNode!.querySelector('[data-testid="selected-node"]')!)).toBe(true);
    expect(filter?.(capturedNode!.querySelector('[data-testid="edge"]')!)).toBe(true);

    expect(selectedNode).toHaveClass("selected");
    expect(selectedNode).toHaveAttribute("aria-selected", "true");
    expect(selectedNode).toHaveAttribute("data-selected", "true");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("generates a stable safe filename and falls back to the document id", () => {
    expect(createFlowPngFilename(flowDocument)).toBe("payment-processing.png");
    expect(
      createFlowPngFilename({
        ...flowDocument,
        id: "safe-workflow-id",
        title: "../../",
      }),
    ).toBe("safe-workflow-id.png");
    expect(
      createFlowPngFilename({
        ...flowDocument,
        title: "  Réview   & Capture / Final  ",
      }),
    ).toBe("review-capture-final.png");
  });
});
