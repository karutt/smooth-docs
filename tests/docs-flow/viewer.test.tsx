import * as React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Ajv2020 from "ajv/dist/2020.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CompiledFlow,
  CompiledFlowLayout,
  FlowDocument,
  FlowEdge,
  FlowNode,
} from "#smooth-docs/types";
import flowSchema from "../../src/docs-flow/schema.json";

const validateMaximumFixture = new Ajv2020({
  allErrors: true,
  strict: true,
  strictNumbers: true,
}).compile(flowSchema);

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
    focusedEdgeIds?: string[];
    focusedNodeIds?: string[];
    onEdgeSelect?: (edgeId: string | undefined) => void;
    onNodeSelect?: (nodeId: string | undefined) => void;
    searchMatchNodeIds?: string[];
    selectedEdgeId?: string;
    selectedNodeId?: string;
  };

  const MockCanvas = ReactModule.forwardRef(function MockCanvas(
    {
      document,
      focusedEdgeIds,
      focusedNodeIds,
      onEdgeSelect,
      onNodeSelect,
      searchMatchNodeIds = [],
      selectedEdgeId,
      selectedNodeId,
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
      <section aria-label={`${document.title} test canvas`}>
        <div aria-label="Canvas nodes">
          {document.nodes.map((node) => (
            <button
              aria-label={`Canvas node ${node.label}`}
              data-focused={
                focusedNodeIds === undefined || focusedNodeIds.includes(node.id)
                  ? "true"
                  : "false"
              }
              data-search-match={searchMatchNodeIds.includes(node.id) ? "true" : "false"}
              data-selected={selectedNodeId === node.id ? "true" : "false"}
              key={node.id}
              onClick={() => onNodeSelect?.(node.id)}
              type="button"
            >
              {node.label}
            </button>
          ))}
        </div>
        <div aria-label="Canvas connections">
          {document.edges.map((edge) => (
            <button
              aria-label={`Canvas connection ${edge.label || edge.id}`}
              data-focused={
                focusedEdgeIds === undefined || focusedEdgeIds.includes(edge.id)
                  ? "true"
                  : "false"
              }
              data-selected={selectedEdgeId === edge.id ? "true" : "false"}
              key={edge.id}
              onClick={() => onEdgeSelect?.(edge.id)}
              type="button"
            >
              {edge.label || edge.id}
            </button>
          ))}
        </div>
      </section>
    );
  });

  return { default: MockCanvas };
});

import DocsFlowBlock from "@/components/docs-flow/DocsFlowBlock";

const coreNodes: FlowNode[] = [
  {
    id: "receive-request",
    type: "action",
    label: "Receive request",
    description: "Accept a new payment request from the checkout page.",
    lane: "client",
  },
  {
    id: "validate-request",
    type: "decision",
    label: "Validate request",
    description: "Check the submitted account and amount.",
    lane: "api",
  },
  {
    id: "risk-review",
    type: "service",
    label: "Risk review",
    description: "Evaluate fraud rules before authorization.",
    lane: "api",
  },
  {
    id: "authorize-payment",
    type: "external",
    label: "Authorize payment",
    description: "Request an authorization hold from the payment provider.",
    lane: "provider",
    owner: "Payments team",
    status: "Active",
    risk: "high",
    links: [
      {
        kind: "external",
        href: "https://example.com/payment-authorization",
        label: "Authorization guide",
      },
    ],
  },
  {
    id: "capture-funds",
    type: "service",
    label: "Capture funds",
    description: "Capture an approved authorization.",
    lane: "provider",
  },
  {
    id: "decline-request",
    type: "action",
    label: "Decline request",
    description: "Record the provider rejection.",
    lane: "api",
  },
  {
    id: "create-receipt",
    type: "service",
    label: "Create receipt",
    description: "Create the final receipt after capture.",
    lane: "api",
  },
  {
    id: "notify-customer",
    type: "action",
    label: "Notify customer",
    description: "Send the completed receipt.",
    lane: "client",
  },
  {
    id: "write-audit",
    type: "note",
    label: "Write audit record",
    description: "Retain the customer-facing delivery result for support.",
    lane: "api",
  },
];

const fillerNodes: FlowNode[] = Array.from({ length: 11 }, (_, index) => ({
  id: `archive-step-${index + 1}`,
  type: index % 2 === 0 ? "service" : "action",
  label: `Archive step ${index + 1}`,
  description: `Long-running archival stage ${index + 1}.`,
  lane: "archive",
}));

const coreEdges: FlowEdge[] = [
  {
    id: "receive-validate",
    from: "receive-request",
    to: "validate-request",
    label: "Submit",
  },
  {
    id: "validate-authorize",
    from: "validate-request",
    to: "authorize-payment",
    label: "Validated",
  },
  {
    id: "receive-risk",
    from: "receive-request",
    to: "risk-review",
    label: "Screen",
  },
  {
    id: "risk-authorize",
    from: "risk-review",
    to: "authorize-payment",
    label: "Approved risk",
  },
  {
    id: "authorize-capture",
    from: "authorize-payment",
    to: "capture-funds",
    label: "Approved",
  },
  {
    id: "authorize-decline",
    from: "authorize-payment",
    to: "decline-request",
    label: "Rejected",
    style: "error",
  },
  {
    id: "capture-receipt",
    from: "capture-funds",
    to: "create-receipt",
    label: "Captured",
  },
  {
    id: "receipt-notify",
    from: "create-receipt",
    to: "notify-customer",
    label: "Receipt ready",
  },
  {
    id: "notify-audit",
    from: "notify-customer",
    to: "write-audit",
    label: "Delivered",
  },
  {
    id: "audit-archive",
    from: "write-audit",
    to: "archive-step-1",
    label: "Archive",
    style: "async",
  },
];

const fillerEdges: FlowEdge[] = fillerNodes.slice(1).map((node, index) => ({
  id: `archive-${index + 1}-${index + 2}`,
  from: fillerNodes[index].id,
  to: node.id,
  label: `Stage ${index + 1}`,
}));

const documentFixture: FlowDocument = {
  version: 1,
  id: "payment-reader",
  kind: "workflow",
  title: "Payment processing",
  description: "A large reader-oriented payment workflow.",
  direction: "right",
  lanes: [
    { id: "client", label: "Client" },
    { id: "api", label: "API" },
    { id: "provider", label: "Payment provider" },
    { id: "archive", label: "Archive" },
  ],
  nodes: [...coreNodes, ...fillerNodes],
  edges: [...coreEdges, ...fillerEdges],
};

const nodeLayout = Object.fromEntries(
  documentFixture.nodes.map((node, index) => [
    node.id,
    {
      x: 40 + (index % 5) * 280,
      y: 40 + Math.floor(index / 5) * 160,
      width: 220,
      height: 104,
    },
  ]),
) as CompiledFlowLayout["nodes"];

const compiledFlow: CompiledFlow = {
  embedId: "payment-reader-1",
  document: documentFixture,
  layout: {
    direction: "right",
    nodes: nodeLayout,
    lanes: {
      client: { x: 0, y: 0, width: 1440, height: 160 },
      api: { x: 0, y: 180, width: 1440, height: 160 },
      provider: { x: 0, y: 360, width: 1440, height: 160 },
      archive: { x: 0, y: 540, width: 1440, height: 480 },
    },
    computedNodeIds: documentFixture.nodes.map((node) => node.id),
  },
  view: { height: 620 },
  diagnostics: [],
  searchText: documentFixture.nodes
    .flatMap((node) => [node.label, node.description])
    .filter(Boolean)
    .join(" "),
};

const maximumLanes: NonNullable<FlowDocument["lanes"]> = Array.from(
  { length: 32 },
  (_, index) => ({
    id: `scale-lane-${index + 1}`,
    label: `Scale lane ${index + 1}`,
  }),
);

const maximumNodeTypes: FlowNode["type"][] = [
  "action",
  "decision",
  "service",
  "external",
  "note",
];
const maximumNodes: FlowNode[] = Array.from({ length: 100 }, (_, index) => ({
  id: `scale-node-${index + 1}`,
  type: maximumNodeTypes[index % maximumNodeTypes.length],
  label: `Maximum node ${index + 1}`,
  description:
    index === 95
      ? "Unique performance search needle in the thirty-second lane."
      : `Maximum-size workflow node ${index + 1}.`,
  lane: maximumLanes[index % maximumLanes.length].id,
}));
const maximumChainEdges: FlowEdge[] = Array.from({ length: 99 }, (_, index) => ({
  id: `scale-chain-${index + 1}`,
  from: maximumNodes[index].id,
  to: maximumNodes[index + 1].id,
}));
const maximumCrossEdges: FlowEdge[] = Array.from({ length: 51 }, (_, index) => ({
  id: `scale-cross-${index + 1}`,
  from: maximumNodes[index].id,
  to: maximumNodes[(index + 17) % maximumNodes.length].id,
  label: `Cross path ${index + 1}`,
}));
const maximumEdges = [...maximumChainEdges, ...maximumCrossEdges];
const maximumStories: NonNullable<FlowDocument["stories"]> = Array.from(
  { length: 32 },
  (_, index) => {
    const edge = maximumEdges[index];
    return {
      id: `scale-story-${index + 1}`,
      label: `Scale story ${index + 1}`,
      steps: [{ node: edge.from }, { edge: edge.id }, { node: edge.to }],
    };
  },
);

const maximumDocumentFixture: FlowDocument = {
  version: 1,
  id: "maximum-reader-scale",
  kind: "workflow",
  title: "Maximum reader scale",
  description: "The documented maximum workflow used for interaction timing checks.",
  direction: "right",
  lanes: maximumLanes,
  nodes: maximumNodes,
  edges: maximumEdges,
  stories: maximumStories,
};

const maximumLayout: CompiledFlowLayout = {
  direction: "right",
  nodes: Object.fromEntries(
    maximumNodes.map((node, index) => [
      node.id,
      {
        x: 40 + (index % 10) * 260,
        y: 40 + Math.floor(index / 10) * 140,
        width: 220,
        height: 104,
      },
    ]),
  ),
  lanes: Object.fromEntries(
    maximumLanes.map((lane, index) => [
      lane.id,
      {
        x: 0,
        y: index * 140,
        width: 2640,
        height: 124,
      },
    ]),
  ),
  computedNodeIds: maximumNodes.map((node) => node.id),
};

const maximumCompiledFlow: CompiledFlow = {
  embedId: "maximum-reader-scale-1",
  document: maximumDocumentFixture,
  layout: maximumLayout,
  view: { height: 760 },
  diagnostics: [],
  searchText: maximumDocumentFixture.nodes
    .flatMap((node) => [node.label, node.description])
    .filter(Boolean)
    .join(" "),
};

beforeEach(() => {
  Object.values(canvasHarness).forEach((mock) => mock.mockClear());
});

async function openReaderTools(user: ReturnType<typeof userEvent.setup>) {
  const trigger = await screen.findByRole("button", { name: "Show workflow tools" });
  await waitFor(() => expect(trigger).toBeEnabled());
  await user.click(trigger);
  return screen.findByRole("toolbar", { name: "Workflow reader controls" });
}

describe("DocsFlow reader exploration", () => {
  it("offers explicit zoom, pan reset, and fit commands backed by the canvas", async () => {
    const user = userEvent.setup();
    render(<DocsFlowBlock flow={compiledFlow} />);
    await screen.findByRole("region", { name: "Payment processing workflow" });

    expect(screen.queryByRole("toolbar", { name: "Workflow reader controls" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Search workflow nodes" })).not.toBeInTheDocument();
    await openReaderTools(user);
    expect(screen.getByRole("button", { name: "View mode" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    await user.click(screen.getByRole("button", { name: /reset pan/i }));
    await user.click(screen.getByRole("button", { name: /fit (?:diagram|view)/i }));

    expect(canvasHarness.zoomIn).toHaveBeenCalledTimes(1);
    expect(canvasHarness.zoomOut).toHaveBeenCalledTimes(1);
    expect(canvasHarness.resetPan).toHaveBeenCalledTimes(1);
    expect(canvasHarness.fitView).toHaveBeenCalledTimes(1);
  });

  it("searches labels and descriptions, marks every match, and navigates in source order", async () => {
    const user = userEvent.setup();
    render(<DocsFlowBlock flow={compiledFlow} />);
    await screen.findByRole("region", { name: "Payment processing workflow" });
    await openReaderTools(user);

    await user.type(screen.getByRole("searchbox", { name: "Search workflow nodes" }), "customer");

    const labelMatch = screen.getByRole("button", { name: "Canvas node Notify customer" });
    const descriptionMatch = screen.getByRole("button", {
      name: "Canvas node Write audit record",
    });
    expect(labelMatch).toHaveAttribute("data-search-match", "true");
    expect(descriptionMatch).toHaveAttribute("data-search-match", "true");
    expect(screen.getByText(/1 of 2 matches/i)).toBeVisible();
    expect(labelMatch).toHaveAttribute("data-selected", "true");
    expect(canvasHarness.focusNode).toHaveBeenLastCalledWith("notify-customer");

    await user.click(screen.getByRole("button", { name: "Next match" }));
    expect(screen.getByText(/2 of 2 matches/i)).toBeVisible();
    expect(descriptionMatch).toHaveAttribute("data-selected", "true");
    expect(canvasHarness.focusNode).toHaveBeenLastCalledWith("write-audit");

    await user.click(screen.getByRole("button", { name: "Previous match" }));
    expect(screen.getByText(/1 of 2 matches/i)).toBeVisible();
    expect(labelMatch).toHaveAttribute("data-selected", "true");
  });

  it("shows selected-node attributes, safe links, and direct incoming and outgoing relations", async () => {
    const user = userEvent.setup();
    render(<DocsFlowBlock flow={compiledFlow} />);

    await user.click(
      await screen.findByRole("button", { name: "Canvas node Authorize payment" }),
    );

    expect(screen.queryByRole("region", {
      name: "Node details: Authorize payment",
    })).not.toBeInTheDocument();
    await openReaderTools(user);
    await user.click(screen.getByRole("button", { name: "View as text" }));
    await user.click(await screen.findByRole("button", {
      name: "View node details Authorize payment",
    }));

    const details = await screen.findByRole("region", {
      name: "Node details: Authorize payment",
    });
    expect(within(details).getByText(/request an authorization hold/i)).toBeVisible();
    expect(within(details).getByText("Payments team")).toBeVisible();
    expect(within(details).getByText("Active")).toBeVisible();
    expect(within(details).getByText("high")).toBeVisible();
    expect(
      within(details).getByRole("link", { name: "Authorization guide" }),
    ).toHaveAttribute("href", "https://example.com/payment-authorization");

    const incoming = within(details).getByRole("list", { name: "Incoming connections" });
    expect(within(incoming).getByText(/validate request/i)).toBeVisible();
    expect(within(incoming).getByText(/risk review/i)).toBeVisible();
    const outgoing = within(details).getByRole("list", { name: "Outgoing connections" });
    expect(within(outgoing).getByText(/capture funds/i)).toBeVisible();
    expect(within(outgoing).getByText(/decline request/i)).toBeVisible();
    expect(within(outgoing).getByText(/error path/i)).toBeVisible();
  });

  it("focuses complete upstream/downstream paths and restores the whole graph", async () => {
    const user = userEvent.setup();
    render(<DocsFlowBlock flow={compiledFlow} />);
    await openReaderTools(user);

    await user.click(
      await screen.findByRole("button", { name: "Canvas node Authorize payment" }),
    );
    await user.click(screen.getByRole("button", { name: "Focus upstream" }));

    expect(screen.getByRole("button", { name: "Canvas node Receive request" })).toHaveAttribute(
      "data-focused",
      "true",
    );
    expect(screen.getByRole("button", { name: "Canvas node Validate request" })).toHaveAttribute(
      "data-focused",
      "true",
    );
    expect(screen.getByRole("button", { name: "Canvas node Risk review" })).toHaveAttribute(
      "data-focused",
      "true",
    );
    expect(screen.getByRole("button", { name: "Canvas node Capture funds" })).toHaveAttribute(
      "data-focused",
      "false",
    );
    expect(screen.getByRole("button", { name: "Canvas connection Validated" })).toHaveAttribute(
      "data-focused",
      "true",
    );
    expect(screen.getByRole("button", { name: "Canvas connection Approved" })).toHaveAttribute(
      "data-focused",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Focus downstream" }));
    expect(screen.getByRole("button", { name: "Canvas node Receive request" })).toHaveAttribute(
      "data-focused",
      "false",
    );
    expect(screen.getByRole("button", { name: "Canvas node Capture funds" })).toHaveAttribute(
      "data-focused",
      "true",
    );
    expect(screen.getByRole("button", { name: "Canvas node Decline request" })).toHaveAttribute(
      "data-focused",
      "true",
    );
    expect(screen.getByRole("button", { name: "Canvas node Archive step 11" })).toHaveAttribute(
      "data-focused",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Show whole graph" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Canvas node Receive request" })).toHaveAttribute(
        "data-focused",
        "true",
      );
      expect(screen.getByRole("button", { name: "Canvas node Archive step 11" })).toHaveAttribute(
        "data-focused",
        "true",
      );
    });
  });

  it("keeps search and selection feedback under 200ms at every collection maximum", async () => {
    const user = userEvent.setup();
    expect(
      validateMaximumFixture(maximumDocumentFixture),
      JSON.stringify(validateMaximumFixture.errors),
    ).toBe(true);
    expect(maximumDocumentFixture.lanes).toHaveLength(32);
    expect(maximumDocumentFixture.nodes).toHaveLength(100);
    expect(maximumDocumentFixture.edges).toHaveLength(150);
    expect(maximumDocumentFixture.stories).toHaveLength(32);

    render(<DocsFlowBlock flow={maximumCompiledFlow} />);
    await screen.findByRole("button", { name: "Canvas node Maximum node 1" });
    await openReaderTools(user);

    const searchbox = screen.getByRole("searchbox", { name: "Search workflow nodes" });
    const searchTarget = screen.getByRole("button", { name: "Canvas node Maximum node 96" });
    const selectionTarget = screen.getByRole("button", { name: "Canvas node Maximum node 100" });
    const searchStartedAt = performance.now();
    fireEvent.change(searchbox, {
      target: { value: "performance search needle" },
    });
    expect(searchTarget.getAttribute("data-search-match")).toBe("true");
    const searchFeedbackMs = performance.now() - searchStartedAt;
    await waitFor(() => {
      expect(screen.getByText(/1 of 1 matches/i)).toBeVisible();
    });

    const selectionStartedAt = performance.now();
    fireEvent.click(selectionTarget);
    expect(selectionTarget.getAttribute("data-selected")).toBe("true");
    const selectionFeedbackMs = performance.now() - selectionStartedAt;
    expect(
      screen.queryByRole("region", { name: "Node details: Maximum node 100" }),
    ).not.toBeInTheDocument();

    expect(searchFeedbackMs).toBeLessThan(200);
    expect(selectionFeedbackMs).toBeLessThan(200);
  });
});
