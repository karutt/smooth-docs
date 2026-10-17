import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CompiledFlow,
  FlowDocument,
  FlowEditorSession,
  FlowStory,
  FlowStoryStep,
} from "#smooth-docs/types";

const canvasHarness = vi.hoisted(() => ({
  fitView: vi.fn(),
  focusNode: vi.fn(),
  resetPan: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
}));

vi.mock("@/components/docs-flow/DocsFlowCanvas", async () => {
  const ReactModule = await import("react");

  type MockCanvasProps = {
    document: FlowDocument;
    storyActiveEdgeIds?: string[];
    storyActiveNodeIds?: string[];
    storyCurrentEdgeId?: string;
    storyCurrentNodeId?: string;
    storyMotion?: "animated" | "instant";
    storyPlaying?: boolean;
  };

  const MockCanvas = ReactModule.forwardRef(function MockCanvas(
    {
      document,
      storyActiveEdgeIds = [],
      storyActiveNodeIds = [],
      storyCurrentEdgeId,
      storyCurrentNodeId,
      storyMotion = "animated",
      storyPlaying = false,
    }: MockCanvasProps,
    ref,
  ) {
    ReactModule.useImperativeHandle(ref, () => ({
      fitView: canvasHarness.fitView,
      focusNode: canvasHarness.focusNode,
      resetPan: canvasHarness.resetPan,
      zoomIn: canvasHarness.zoomIn,
      zoomOut: canvasHarness.zoomOut,
    }));

    return (
      <section
        aria-label={`${document.title} story canvas`}
        data-story-motion={storyMotion}
        data-story-playing={storyPlaying ? "true" : "false"}
      >
        {document.nodes.map((node) => (
          <span
            data-story-active={storyActiveNodeIds.includes(node.id) ? "true" : "false"}
            data-story-current={storyCurrentNodeId === node.id ? "true" : "false"}
            key={node.id}
          >
            {node.label}
          </span>
        ))}
        {document.edges.map((edge) => (
          <span
            data-story-active={storyActiveEdgeIds.includes(edge.id) ? "true" : "false"}
            data-story-current={storyCurrentEdgeId === edge.id ? "true" : "false"}
            key={edge.id}
          >
            {edge.label || edge.id}
          </span>
        ))}
      </section>
    );
  });

  return { default: MockCanvas };
});

import DocsFlowBlock from "@/components/docs-flow/DocsFlowBlock";
import {
  createFlowEditorSession,
  flowEditorReducer,
} from "@/components/docs-flow/flow-editor-reducer";

const initialRevision = `sha256:${"a".repeat(64)}`;

const documentFixture: FlowDocument = {
  version: 1,
  id: "order-workflow",
  kind: "workflow",
  title: "Order workflow",
  direction: "right",
  lanes: [
    { id: "customer", label: "Customer" },
    { id: "service", label: "Order service" },
  ],
  nodes: [
    { id: "start", type: "action", label: "Start order", lane: "customer" },
    { id: "validate", type: "decision", label: "Validate order", lane: "service" },
    { id: "charge", type: "external", label: "Charge payment", lane: "service" },
    { id: "retry", type: "service", label: "Retry payment", lane: "service" },
    { id: "finish", type: "action", label: "Confirm order", lane: "customer" },
  ],
  edges: [
    { id: "start-validate", from: "start", to: "validate", label: "Submit" },
    { id: "validate-charge", from: "validate", to: "charge", label: "Valid" },
    { id: "charge-retry", from: "charge", to: "retry", label: "Retry" },
    { id: "retry-charge", from: "retry", to: "charge", label: "Try again" },
    { id: "charge-finish", from: "charge", to: "finish", label: "Paid" },
  ],
  stories: [
    {
      id: "happy-path",
      label: "Happy path",
      steps: [
        { node: "start" },
        { edge: "start-validate" },
        { node: "validate" },
        { edge: "validate-charge" },
        { node: "charge" },
        { edge: "charge-finish" },
        { node: "finish" },
      ],
    },
    {
      id: "retry-path",
      label: "Retry path",
      description: "Payment fails once and is retried.",
      steps: [
        { node: "charge" },
        { edge: "charge-retry" },
        { node: "retry" },
        { edge: "retry-charge" },
        { node: "charge" },
      ],
    },
  ],
};

const compiledFlow: CompiledFlow = {
  embedId: "order-workflow-inline-1",
  document: documentFixture,
  layout: {
    direction: "right",
    nodes: Object.fromEntries(
      documentFixture.nodes.map((node, index) => [
        node.id,
        { x: 40 + index * 260, y: 40, width: 220, height: 104 },
      ]),
    ),
    lanes: {
      customer: { x: 0, y: 0, width: 1360, height: 180 },
      service: { x: 0, y: 200, width: 1360, height: 180 },
    },
    computedNodeIds: documentFixture.nodes.map((node) => node.id),
  },
  view: { story: "happy-path", height: 520 },
  diagnostics: [],
  searchText: "Order workflow Happy path Retry path Start Validate Charge Retry Confirm",
  source: {
    kind: "inline",
    pageSourcePath: "docs/order.md",
    flowId: "order-workflow",
    revision: initialRevision,
    editable: true,
  },
};

type StoryEditorAction =
  | { type: "story/add"; story: Omit<FlowStory, "id"> & { id?: string } }
  | { type: "story/update"; id: string; changes: Partial<Omit<FlowStory, "id" | "steps">> }
  | { type: "story/reorder"; id: string; toIndex: number }
  | { type: "story/delete"; id: string }
  | { type: "story/step/add"; storyId: string; step: FlowStoryStep; toIndex?: number }
  | { type: "story/step/reorder"; storyId: string; fromIndex: number; toIndex: number }
  | { type: "story/step/delete"; storyId: string; index: number };

function reduceStory(state: FlowEditorSession, action: StoryEditorAction) {
  return flowEditorReducer(state, action as never);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFlowApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/__smooth-docs/flow/source" && !init?.method) {
        return jsonResponse({
          document: structuredClone(documentFixture),
          source: compiledFlow.source,
          diagnostics: [],
        });
      }
      throw new Error(`Unexpected flow API request: ${init?.method ?? "GET"} ${url.pathname}`);
    }),
  );
}

function setReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: matches && query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function activeState(label: string) {
  return screen.getByText(label).getAttribute("data-story-active");
}

function currentState(label: string) {
  return screen.getByText(label).getAttribute("data-story-current");
}

async function showStory(label: string) {
  const user = userEvent.setup();
  render(<DocsFlowBlock flow={compiledFlow} />);
  await screen.findByRole("region", { name: "Order workflow story canvas" });
  await user.click(screen.getByRole("button", { name: "Show workflow tools" }));
  await user.selectOptions(screen.getByRole("combobox", { name: "Story" }), label);
  return user;
}

beforeEach(() => {
  setReducedMotion(false);
  Object.values(canvasHarness).forEach((mock) => mock.mockClear());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DocsFlow stories", () => {
  it("selects a named story and plays its authored node and edge order", async () => {
    await showStory("Happy path");

    expect(screen.getByRole("region", { name: "Workflow story player" })).toHaveClass("h-11", "flex-nowrap");
    expect(screen.getByLabelText("Story progress: step 1 of 7")).toHaveTextContent("1/7");
    expect(activeState("Start order")).toBe("true");
    expect(activeState("Submit")).toBe("false");

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Play story" }));
    act(() => vi.advanceTimersToNextTimer());

    expect(screen.getByLabelText("Story progress: step 2 of 7")).toHaveTextContent("2/7");
    expect(activeState("Start order")).toBe("true");
    expect(activeState("Submit")).toBe("true");
    expect(currentState("Submit")).toBe("true");
    expect(screen.getByRole("region", { name: "Order workflow story canvas" })).toHaveAttribute(
      "data-story-playing",
      "true",
    );
    expect(activeState("Validate order")).toBe("false");

    act(() => vi.advanceTimersToNextTimer());
    expect(screen.getByLabelText("Story progress: step 3 of 7")).toHaveTextContent("3/7");
    expect(activeState("Validate order")).toBe("true");
    expect(activeState("Valid")).toBe("false");
  });

  it("pauses without losing progress, resets, and announces completion", async () => {
    await showStory("Retry path");
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Play story" }));
    act(() => vi.advanceTimersToNextTimer());
    expect(screen.getByLabelText("Story progress: step 2 of 5")).toHaveTextContent("2/5");

    fireEvent.click(screen.getByRole("button", { name: "Pause story" }));
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByLabelText("Story progress: step 2 of 5")).toHaveTextContent("2/5");

    fireEvent.click(screen.getByRole("button", { name: "Reset story" }));
    expect(screen.getByLabelText("Story progress: step 1 of 5")).toHaveTextContent("1/5");
    expect(activeState("Charge payment")).toBe("true");
    expect(activeState("Retry")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Play story" }));
    for (let index = 0; index < 6; index += 1) {
      act(() => vi.advanceTimersToNextTimer());
    }

    expect(screen.getByLabelText("Story progress: step 5 of 5, complete")).toBeVisible();
    expect(screen.queryByText("Story complete")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/retry path.*complete/i);
    expect(screen.queryByRole("button", { name: "Pause story" })).not.toBeInTheDocument();
  });

  it("adds, reorders, edits, and deletes stories and their ordered steps as undoable commands", () => {
    const initial = createFlowEditorSession(documentFixture, initialRevision);
    let current = reduceStory(initial, {
      type: "story/add",
      story: {
        label: "Manual review",
        description: "An operator resolves a failed payment.",
        steps: [{ node: "validate" }],
      },
    });
    const storyId = current.draftDocument.stories?.at(-1)?.id;

    expect(storyId).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
    expect(current.undo).toHaveLength(1);

    current = reduceStory(current, {
      type: "story/update",
      id: storyId!,
      changes: { label: "Operator review" },
    });
    current = reduceStory(current, {
      type: "story/step/add",
      storyId: storyId!,
      step: { edge: "validate-charge" },
    });
    current = reduceStory(current, {
      type: "story/step/add",
      storyId: storyId!,
      step: { node: "charge" },
    });
    current = reduceStory(current, {
      type: "story/step/reorder",
      storyId: storyId!,
      fromIndex: 2,
      toIndex: 1,
    });
    current = reduceStory(current, {
      type: "story/step/delete",
      storyId: storyId!,
      index: 2,
    });
    current = reduceStory(current, { type: "story/reorder", id: storyId!, toIndex: 0 });

    expect(current.draftDocument.stories?.[0]).toEqual({
      id: storyId,
      label: "Operator review",
      description: "An operator resolves a failed payment.",
      steps: [{ node: "validate" }, { node: "charge" }],
    });
    expect(current.undo).toHaveLength(7);

    current = reduceStory(current, { type: "story/delete", id: storyId! });
    expect(current.draftDocument.stories?.some((story) => story.id === storyId)).toBe(false);
    expect(current.undo).toHaveLength(8);

    const restored = flowEditorReducer(current, { type: "history/undo" });
    expect(restored.draftDocument.stories?.[0]?.id).toBe(storyId);
  });

  it("rejects invalid story references in editing and disables invalid authored stories", async () => {
    const initial = createFlowEditorSession(documentFixture, initialRevision);
    const invalidEdit = reduceStory(initial, {
      type: "story/step/add",
      storyId: "happy-path",
      step: { node: "missing-node" },
    });
    expect(invalidEdit).toBe(initial);

    const invalidDocument: FlowDocument = {
      ...documentFixture,
      stories: [
        {
          id: "broken-path",
          label: "Broken path",
          steps: [{ node: "missing-node" }, { edge: "missing-edge" }],
        },
      ],
    };
    render(
      <DocsFlowBlock
        flow={{
          ...compiledFlow,
          document: invalidDocument,
          view: { ...compiledFlow.view, story: "broken-path" },
        }}
      />,
    );

    await screen.findByRole("region", { name: "Order workflow story canvas" });
    fireEvent.click(screen.getByRole("button", { name: "Show workflow tools" }));
    expect(screen.getByRole("button", { name: "Play story" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/broken path.*invalid|unavailable.*step/i);
  });

  it("stops playback immediately when edit mode opens", async () => {
    installFlowApi();
    await showStory("Happy path");
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Play story" }));
    act(() => vi.advanceTimersToNextTimer());
    expect(screen.getByLabelText("Story progress: step 2 of 7")).toHaveTextContent("2/7");

    fireEvent.click(screen.getByRole("button", { name: "Edit flow" }));
    await act(async () => undefined);
    vi.useRealTimers();

    await screen.findByRole("heading", { name: /edit flow.*order workflow/i });
    expect(screen.queryByRole("button", { name: "Pause story" })).not.toBeInTheDocument();
    expect(screen.queryByText(/step 2 of 7/i)).not.toBeInTheDocument();
  });

  it("uses instant story transitions when reduced motion is requested", async () => {
    setReducedMotion(true);
    await showStory("Happy path");

    expect(screen.getByRole("region", { name: "Order workflow story canvas" })).toHaveAttribute(
      "data-story-motion",
      "instant",
    );

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Play story" }));
    act(() => vi.advanceTimersToNextTimer());
    expect(screen.getByLabelText("Story progress: step 2 of 7")).toHaveTextContent("2/7");
    expect(activeState("Submit")).toBe("true");
  });
});
