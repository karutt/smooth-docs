import * as React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompiledFlow, FlowDocument } from "#smooth-docs/types";

vi.mock("@/components/docs-flow/DocsFlowCanvas", async () => {
  const ReactModule = await import("react");
  const MockCanvas = ReactModule.forwardRef(function MockCanvas(
    {
      document,
      onEdgeSelect,
      onNodeSelect,
      selectedEdgeId,
      selectedNodeId,
    }: {
      document: FlowDocument;
      onEdgeSelect?: (id: string) => void;
      onNodeSelect?: (id: string) => void;
      selectedEdgeId?: string;
      selectedNodeId?: string;
    },
    ref,
  ) {
    ReactModule.useImperativeHandle(ref, () => ({
      fitView: vi.fn(),
      focusNode: vi.fn(),
      resetPan: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
    }));
    return (
      <div aria-label={`${document.title} canvas`} role="img">
        {document.nodes.map((node) => (
          <button
            aria-label={`Canvas node ${node.label}`}
            aria-pressed={selectedNodeId === node.id}
            key={node.id}
            onClick={() => onNodeSelect?.(node.id)}
            type="button"
          />
        ))}
        {document.edges.map((edge) => (
          <button
            aria-label={`Canvas connection ${edge.label || edge.id}`}
            aria-pressed={selectedEdgeId === edge.id}
            key={edge.id}
            onClick={() => onEdgeSelect?.(edge.id)}
            type="button"
          />
        ))}
      </div>
    );
  });
  return { default: MockCanvas };
});

import DocsFlowBlock from "@/components/docs-flow/DocsFlowBlock";

const initialRevision = `sha256:${"a".repeat(64)}`;
const savedRevision = `sha256:${"b".repeat(64)}`;

const initialDocument: FlowDocument = {
  version: 1,
  id: "parking-start",
  kind: "workflow",
  title: "Parking start",
  direction: "right",
  lanes: [
    { id: "user", label: "User" },
    { id: "backend", label: "Backend" },
  ],
  nodes: [
    { id: "scan", type: "action", label: "Scan QR", lane: "user" },
    { id: "validate", type: "decision", label: "Validate", lane: "backend" },
  ],
  edges: [
    {
      id: "scan-validate",
      from: "scan",
      to: "validate",
      label: "Submit code",
      style: "normal",
    },
  ],
};

const compiledFlow: CompiledFlow = {
  embedId: "parking-start-inline-1",
  document: initialDocument,
  layout: {
    direction: "right",
    nodes: {
      scan: { x: 40, y: 40, width: 220, height: 104 },
      validate: { x: 360, y: 40, width: 220, height: 104 },
    },
    lanes: {
      user: { x: 0, y: 0, width: 300, height: 184 },
      backend: { x: 320, y: 0, width: 300, height: 184 },
    },
    computedNodeIds: ["scan", "validate"],
  },
  view: { height: 480 },
  diagnostics: [],
  searchText: "Parking start Scan QR Validate Submit code User Backend",
  source: {
    kind: "inline",
    pageSourcePath: "docs/docs/interactive-flow.md",
    flowId: "parking-start",
    revision: initialRevision,
    editable: true,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFlowApi(saveMode: "success" | "conflict" = "success") {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input), "http://localhost");

      if (url.pathname === "/__smooth-docs/flow/source" && !init?.method) {
        return jsonResponse({
          document: structuredClone(initialDocument),
          source: compiledFlow.source,
          diagnostics: [],
        });
      }

      if (url.pathname === "/__smooth-docs/flow/save" && init?.method === "POST") {
        const request = JSON.parse(String(init.body)) as {
          sourcePath: string;
          flowId: string;
          document: FlowDocument;
        };

        if (saveMode === "conflict") {
          return jsonResponse({
            code: "REVISION_CONFLICT",
            message: "The flow changed after editing started.",
            currentRevision: savedRevision,
            currentDocument: structuredClone(initialDocument),
          }, 409);
        }

        return jsonResponse({
          ok: true,
          sourcePath: request.sourcePath,
          flowId: request.flowId,
          revision: savedRevision,
          document: request.document,
          docsDataBySite: {},
          generatedAt: 1_787_700_000_000,
        });
      }

      throw new Error(`Unexpected flow API request: ${init?.method ?? "GET"} ${url.pathname}`);
    },
  );

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function activateWithKeyboard(
  user: ReturnType<typeof userEvent.setup>,
  control: HTMLElement,
) {
  control.focus();
  expect(control).toHaveFocus();
  await user.keyboard("{Enter}");
}

async function expectAnnouncement(message: RegExp) {
  await waitFor(() => {
    const regions = Array.from(
      document.querySelectorAll<HTMLElement>('[role="status"][aria-live]'),
    );
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.map((region) => region.textContent ?? "").join(" ")).toMatch(message);
  });
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  const trigger = await screen.findByRole("button", { name: "Show workflow tools" });
  await waitFor(() => expect(trigger).toBeEnabled());
  await user.click(trigger);
  const edit = await screen.findByRole("button", { name: "Edit flow" });
  expect(edit.className).toMatch(/focus-visible:(?:ring|outline)/);
  await activateWithKeyboard(user, edit);
  await screen.findByRole("heading", { name: /edit flow.*parking start/i });
}

async function editCanvasNode(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
  await activateWithKeyboard(
    user,
    await screen.findByRole("button", { name: label }),
  );
  await activateWithKeyboard(user, screen.getByRole("button", { name: "Edit selection" }));
}

async function editCanvasConnection(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
  await activateWithKeyboard(
    user,
    await screen.findByRole("button", { name: label }),
  );
  await activateWithKeyboard(user, screen.getByRole("button", { name: "Edit selection" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DocsFlow keyboard editor", () => {
  it("creates and changes nodes and connections, assigns a lane, undoes/redoes, and saves", async () => {
    const user = userEvent.setup();
    const fetchMock = installFlowApi();
    render(<DocsFlowBlock flow={compiledFlow} />);

    await openEditor(user);
    await expectAnnouncement(/editing.*parking start/i);
    expect(screen.queryByRole("complementary", { name: "Flow properties" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const addNode = screen.getByRole("button", { name: "Add node" });
    expect(addNode.className).toMatch(/focus-visible:(?:ring|outline)/);
    await activateWithKeyboard(user, addNode);

    const addNodeForm = await screen.findByRole("form", { name: "Add node" });
    await user.selectOptions(within(addNodeForm).getByLabelText("Node type"), "external");
    await user.type(within(addNodeForm).getByLabelText("Node label"), "Notify");
    await user.selectOptions(within(addNodeForm).getByLabelText("Lane"), "user");
    await activateWithKeyboard(
      user,
      within(addNodeForm).getByRole("button", { name: "Create node" }),
    );
    await expectAnnouncement(/node.*notify.*created/i);

    await editCanvasNode(user, /canvas node.*notify/i);
    const editNodeForm = await screen.findByRole("form", { name: /edit node.*notify/i });
    const nodeLabel = within(editNodeForm).getByLabelText("Node label");
    await user.clear(nodeLabel);
    await user.type(nodeLabel, "Notification service");
    await user.selectOptions(within(editNodeForm).getByLabelText("Lane"), "backend");
    await activateWithKeyboard(
      user,
      within(editNodeForm).getByRole("button", { name: "Apply node changes" }),
    );
    await expectAnnouncement(/node.*updated/i);

    await activateWithKeyboard(user, screen.getByRole("button", { name: "Add connection" }));
    const addConnectionForm = await screen.findByRole("form", { name: "Add connection" });
    await user.selectOptions(within(addConnectionForm).getByLabelText("Source node"), "scan");
    await user.selectOptions(
      within(addConnectionForm).getByLabelText("Target node"),
      within(addConnectionForm).getByRole("option", { name: "Notification service" }),
    );
    await user.type(
      within(addConnectionForm).getByLabelText("Connection label"),
      "Notify asynchronously",
    );
    await user.selectOptions(
      within(addConnectionForm).getByLabelText("Connection meaning"),
      "async",
    );
    await activateWithKeyboard(
      user,
      within(addConnectionForm).getByRole("button", { name: "Create connection" }),
    );
    await expectAnnouncement(/connection.*created/i);

    await editCanvasConnection(user, /canvas connection.*notify asynchronously/i);
    const editConnectionForm = await screen.findByRole("form", {
      name: /edit connection.*notify asynchronously/i,
    });
    await user.selectOptions(
      within(editConnectionForm).getByLabelText("Connection meaning"),
      "error",
    );
    await activateWithKeyboard(
      user,
      within(editConnectionForm).getByRole("button", { name: "Apply connection changes" }),
    );
    await expectAnnouncement(/connection.*updated/i);

    await activateWithKeyboard(user, screen.getByRole("button", { name: "Undo" }));
    await expectAnnouncement(/undid/i);
    await activateWithKeyboard(user, screen.getByRole("button", { name: "Redo" }));
    await expectAnnouncement(/redid/i);

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeEnabled();
    await activateWithKeyboard(user, save);
    await expectAnnouncement(/flow.*saved/i);

    const saveCall = fetchMock.mock.calls.find(([input, init]) => {
      const url = new URL(String(input), "http://localhost");
      return url.pathname === "/__smooth-docs/flow/save" && init?.method === "POST";
    });
    expect(saveCall).toBeDefined();

    const request = JSON.parse(String(saveCall?.[1]?.body)) as {
      sourcePath: string;
      flowId: string;
      baseRevision: string;
      document: FlowDocument;
    };
    expect(request).toMatchObject({
      sourcePath: "docs/docs/interactive-flow.md",
      flowId: "parking-start",
      baseRevision: initialRevision,
    });
    expect(request.document.nodes).toContainEqual(
      expect.objectContaining({
        type: "external",
        label: "Notification service",
        lane: "backend",
      }),
    );
    expect(request.document.edges).toContainEqual(
      expect.objectContaining({
        from: "scan",
        label: "Notify asynchronously",
        style: "error",
      }),
    );
  });

  it("discards a keyboard-created draft, announces it, and restores focus on exit", async () => {
    const user = userEvent.setup();
    const fetchMock = installFlowApi();
    render(<DocsFlowBlock flow={compiledFlow} />);

    await openEditor(user);
    await editCanvasNode(user, /canvas node.*scan qr/i);

    const editNodeForm = await screen.findByRole("form", { name: /edit node.*scan qr/i });
    const nodeLabel = within(editNodeForm).getByLabelText("Node label");
    await user.clear(nodeLabel);
    await user.type(nodeLabel, "Changed but not saved");
    await activateWithKeyboard(
      user,
      within(editNodeForm).getByRole("button", { name: "Apply node changes" }),
    );
    expect(
      await screen.findByRole("button", { name: /canvas node.*changed but not saved/i }),
    ).toBeVisible();

    await activateWithKeyboard(
      user,
      screen.getByRole("button", { name: "Discard" }),
    );
    await expectAnnouncement(/changes.*discarded/i);
    expect(await screen.findByRole("button", { name: /canvas node.*scan qr/i })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /canvas node.*changed but not saved/i }),
    ).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);

    await activateWithKeyboard(user, screen.getByRole("button", { name: "Close editor" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /edit flow.*parking start/i }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Edit flow" })).toHaveFocus();
  });

  it("announces a save conflict, retains the draft, and exposes explicit recovery controls", async () => {
    const user = userEvent.setup();
    installFlowApi("conflict");
    render(<DocsFlowBlock flow={compiledFlow} />);
    await openEditor(user);

    await editCanvasNode(user, /canvas node.*scan qr/i);
    const form = await screen.findByRole("form", { name: /edit node.*scan qr/i });
    const label = within(form).getByLabelText("Node label");
    await user.clear(label);
    await user.type(label, "Conflicting local scan");
    await activateWithKeyboard(
      user,
      within(form).getByRole("button", { name: "Apply node changes" }),
    );
    await activateWithKeyboard(user, screen.getByRole("button", { name: "Save" }));

    await expectAnnouncement(/save conflict/i);
    const conflict = screen.getByRole("button", { name: "Reload source" }).closest('[role="alert"]')!;
    expect(conflict).toHaveTextContent(/source changed/i);
    expect(within(conflict).getByRole("button", { name: "Reload source" })).toBeVisible();
    expect(within(conflict).getByRole("button", { name: "Reconcile draft" })).toBeVisible();
    expect(screen.getByRole("button", { name: /canvas node.*conflicting local scan/i })).toBeVisible();
  });

  it("keeps an invalid workflow readable through the semantic fallback", () => {
    render(
      <DocsFlowBlock
        flow={{
          embedId: "invalid-flow",
          diagnostics: [{
            code: "EDGE_TARGET_NOT_FOUND",
            severity: "error",
            message: "Connection target missing-node does not exist.",
          }],
          fallbackText: "version: 1\ntitle: Invalid but readable workflow",
          searchText: "Invalid but readable workflow",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/target missing-node/i);
    expect(screen.getByText(/invalid but readable workflow/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Edit flow" })).not.toBeInTheDocument();
  });
});
