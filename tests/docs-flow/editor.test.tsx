import { describe, expect, it } from "vitest";
import type { FlowDocument, FlowEditorSession } from "../../src/docs-flow/types";
import {
  createFlowEditorSession,
  flowEditorReducer,
} from "../../themes/default/src/components/docs-flow/flow-editor-reducer";

const REVISION = `sha256:${"a".repeat(64)}`;
const FLOW_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function workflow(): FlowDocument {
  return {
    version: 1,
    id: "parking-start",
    kind: "workflow",
    title: "Parking start",
    description: "Start a parking session",
    direction: "right",
    lanes: [
      { id: "user", label: "User" },
      { id: "backend", label: "Backend" },
    ],
    nodes: [
      {
        id: "scan",
        type: "action",
        label: "Scan",
        lane: "user",
        position: { x: 0, y: 0 },
      },
      {
        id: "validate",
        type: "decision",
        label: "Validate",
        lane: "backend",
        position: { x: 240, y: 0 },
      },
      {
        id: "finish",
        type: "service",
        label: "Finish",
        lane: "backend",
        position: { x: 480, y: 0 },
      },
    ],
    edges: [
      { id: "scan-validate", from: "scan", to: "validate" },
      { id: "validate-finish", from: "validate", to: "finish" },
      { id: "scan-finish", from: "scan", to: "finish", style: "async" },
    ],
    stories: [
      {
        id: "happy-path",
        label: "Happy path",
        steps: [
          { node: "scan" },
          { edge: "scan-validate" },
          { node: "validate" },
          { edge: "validate-finish" },
          { node: "finish" },
          { edge: "scan-finish" },
        ],
      },
    ],
  };
}

function session(document = workflow()): FlowEditorSession {
  return createFlowEditorSession(document, REVISION);
}

describe("flow editor domain reducer", () => {
  it("creates a clean session and immutably applies document, lane, node, edge, and position commands", () => {
    const source = workflow();
    const sourceSnapshot = structuredClone(source);
    const initial = session(source);

    expect(initial).toEqual({
      status: "clean",
      baseDocument: source,
      draftDocument: source,
      baseRevision: REVISION,
      undo: [],
      redo: [],
      diagnostics: [],
    });
    expect(initial.baseDocument).not.toBe(source);
    expect(initial.draftDocument).not.toBe(source);

    let current = flowEditorReducer(initial, {
      type: "document/update",
      changes: {
        title: "Parking start v2",
        description: "Updated description",
        direction: "down",
      },
    });
    current = flowEditorReducer(current, {
      type: "lane/update",
      id: "backend",
      changes: { label: "Parking API", description: "Application services" },
    });
    current = flowEditorReducer(current, {
      type: "lane/reorder",
      id: "backend",
      toIndex: 0,
    });
    current = flowEditorReducer(current, {
      type: "node/update",
      id: "scan",
      changes: {
        type: "service",
        label: "Scan QR",
        description: "Read the parking code",
        lane: "backend",
        owner: "Parking team",
        status: "ready",
        risk: "medium",
        links: [{ kind: "docs", href: "./parking.md", label: "Parking docs" }],
      },
    });
    current = flowEditorReducer(current, {
      type: "node/move",
      id: "scan",
      position: { x: 125.5, y: -40 },
    });
    current = flowEditorReducer(current, {
      type: "edge/update",
      id: "scan-validate",
      changes: {
        from: "scan",
        to: "finish",
        label: "Skip validation",
        style: "error",
      },
    });

    expect(source).toEqual(sourceSnapshot);
    expect(initial.draftDocument).toEqual(sourceSnapshot);
    expect(current.status).toBe("dirty");
    expect(current.baseDocument).toEqual(sourceSnapshot);
    expect(current.draftDocument.title).toBe("Parking start v2");
    expect(current.draftDocument.direction).toBe("down");
    expect(current.draftDocument.lanes?.map((lane) => lane.id)).toEqual(["backend", "user"]);
    expect(current.draftDocument.lanes?.[0]).toMatchObject({
      label: "Parking API",
      description: "Application services",
    });
    expect(current.draftDocument.nodes.find((node) => node.id === "scan")).toEqual({
      id: "scan",
      type: "service",
      label: "Scan QR",
      description: "Read the parking code",
      lane: "backend",
      owner: "Parking team",
      status: "ready",
      risk: "medium",
      links: [{ kind: "docs", href: "./parking.md", label: "Parking docs" }],
      position: { x: 125.5, y: -40 },
    });
    expect(current.draftDocument.edges.find((edge) => edge.id === "scan-validate")).toEqual({
      id: "scan-validate",
      from: "scan",
      to: "finish",
      label: "Skip validation",
      style: "error",
    });
    expect(current.undo).toHaveLength(6);
    expect(current.redo).toEqual([]);
  });

  it("generates deterministic, schema-safe, unique IDs that stay stable after property edits", () => {
    const initial = session();
    const addLane = {
      type: "lane/add" as const,
      lane: { label: "Quality assurance", description: "Review boundary" },
    };
    const firstLaneResult = flowEditorReducer(initial, addLane);
    const repeatedLaneResult = flowEditorReducer(initial, addLane);
    const laneId = firstLaneResult.draftDocument.lanes?.at(-1)?.id;

    expect(laneId).toBeDefined();
    expect(laneId).toBe(repeatedLaneResult.draftDocument.lanes?.at(-1)?.id);
    expect(laneId).toMatch(FLOW_ID_PATTERN);
    expect(new Set(firstLaneResult.draftDocument.lanes?.map((lane) => lane.id)).size).toBe(
      firstLaneResult.draftDocument.lanes?.length,
    );

    const addNode = {
      type: "node/add" as const,
      node: {
        type: "action" as const,
        label: "Review request",
        lane: laneId,
      },
    };
    const firstNodeResult = flowEditorReducer(firstLaneResult, addNode);
    const repeatedNodeResult = flowEditorReducer(firstLaneResult, addNode);
    const nodeId = firstNodeResult.draftDocument.nodes.at(-1)?.id;

    expect(nodeId).toBe(repeatedNodeResult.draftDocument.nodes.at(-1)?.id);
    expect(nodeId).toMatch(FLOW_ID_PATTERN);

    const duplicateLabelResult = flowEditorReducer(firstNodeResult, addNode);
    const duplicateNodeId = duplicateLabelResult.draftDocument.nodes.at(-1)?.id;
    expect(duplicateNodeId).toMatch(FLOW_ID_PATTERN);
    expect(duplicateNodeId).not.toBe(nodeId);

    const addEdge = {
      type: "edge/add" as const,
      edge: { from: "scan", to: nodeId! },
    };
    const firstEdgeResult = flowEditorReducer(duplicateLabelResult, addEdge);
    const repeatedEdgeResult = flowEditorReducer(duplicateLabelResult, addEdge);
    const edgeId = firstEdgeResult.draftDocument.edges.at(-1)?.id;

    expect(edgeId).toBe(repeatedEdgeResult.draftDocument.edges.at(-1)?.id);
    expect(edgeId).toMatch(FLOW_ID_PATTERN);
    expect(new Set(firstEdgeResult.draftDocument.edges.map((edge) => edge.id)).size).toBe(
      firstEdgeResult.draftDocument.edges.length,
    );

    const renamed = flowEditorReducer(firstEdgeResult, {
      type: "node/update",
      id: nodeId!,
      changes: { label: "Approve request" },
    });
    const renamedNode = renamed.draftDocument.nodes.find((node) => node.id === nodeId);
    expect(renamedNode).toMatchObject({ id: nodeId, label: "Approve request" });
  });

  it("deletes dependent edge, lane, and story references as one undoable domain command", () => {
    const initial = session();
    const afterNodeDelete = flowEditorReducer(initial, {
      type: "node/delete",
      id: "validate",
    });

    expect(afterNodeDelete.draftDocument.nodes.map((node) => node.id)).toEqual(["scan", "finish"]);
    expect(afterNodeDelete.draftDocument.edges.map((edge) => edge.id)).toEqual(["scan-finish"]);
    expect(afterNodeDelete.draftDocument.stories?.[0].steps).toEqual([
      { node: "scan" },
      { node: "finish" },
      { edge: "scan-finish" },
    ]);
    expect(afterNodeDelete.undo).toHaveLength(1);

    const restored = flowEditorReducer(afterNodeDelete, { type: "history/undo" });
    expect(restored.draftDocument).toEqual(initial.draftDocument);

    const afterLaneDelete = flowEditorReducer(initial, {
      type: "lane/delete",
      id: "backend",
    });
    expect(afterLaneDelete.draftDocument.lanes?.map((lane) => lane.id)).toEqual(["user"]);
    expect(
      afterLaneDelete.draftDocument.nodes
        .filter((node) => node.id === "validate" || node.id === "finish")
        .every((node) => node.lane === undefined),
    ).toBe(true);
    expect(afterLaneDelete.undo).toHaveLength(1);

    const afterEdgeDelete = flowEditorReducer(initial, {
      type: "edge/delete",
      id: "scan-finish",
    });
    expect(afterEdgeDelete.draftDocument.edges.some((edge) => edge.id === "scan-finish")).toBe(
      false,
    );
    expect(afterEdgeDelete.draftDocument.stories?.[0].steps).not.toContainEqual({
      edge: "scan-finish",
    });
    expect(afterEdgeDelete.undo).toHaveLength(1);
  });

  it("bounds undo and redo history at 100 domain states and clears redo after a new command", () => {
    let current = session();

    for (let index = 1; index <= 105; index += 1) {
      current = flowEditorReducer(current, {
        type: "document/update",
        changes: { title: `Revision ${index}` },
      });
    }

    expect(current.undo).toHaveLength(100);
    expect(current.draftDocument.title).toBe("Revision 105");

    for (let index = 0; index < 100; index += 1) {
      current = flowEditorReducer(current, { type: "history/undo" });
    }

    expect(current.undo).toEqual([]);
    expect(current.redo).toHaveLength(100);
    expect(current.draftDocument.title).toBe("Revision 5");

    const exhaustedUndo = flowEditorReducer(current, { type: "history/undo" });
    expect(exhaustedUndo).toBe(current);

    for (let index = 0; index < 100; index += 1) {
      current = flowEditorReducer(current, { type: "history/redo" });
    }

    expect(current.redo).toEqual([]);
    expect(current.undo).toHaveLength(100);
    expect(current.draftDocument.title).toBe("Revision 105");

    current = flowEditorReducer(current, { type: "history/undo" });
    expect(current.redo).toHaveLength(1);
    current = flowEditorReducer(current, {
      type: "document/update",
      changes: { title: "A new branch" },
    });
    expect(current.redo).toEqual([]);
  });

  it("discard restores the server-confirmed base and clears draft history", () => {
    const initial = session();
    let current = flowEditorReducer(initial, {
      type: "node/move",
      id: "scan",
      position: { x: 999, y: 333 },
    });
    current = flowEditorReducer(current, {
      type: "node/update",
      id: "scan",
      changes: { label: "Unsaved scan" },
    });

    const discarded = flowEditorReducer(current, { type: "history/discard" });

    expect(discarded.status).toBe("clean");
    expect(discarded.draftDocument).toEqual(initial.baseDocument);
    expect(discarded.baseDocument).toEqual(initial.baseDocument);
    expect(discarded.baseRevision).toBe(REVISION);
    expect(discarded.undo).toEqual([]);
    expect(discarded.redo).toEqual([]);
    expect(discarded.diagnostics).toEqual([]);
  });

  it("ignores viewport-only actions and persists only explicit authored node positions", () => {
    const initial = session();
    const afterViewport = flowEditorReducer(
      initial,
      {
        type: "viewport/change",
        viewport: { x: 180, y: -90, zoom: 1.75 },
        selectedNodeId: "scan",
        measured: { width: 320, height: 180 },
      } as never,
    );

    expect(afterViewport).toBe(initial);
    expect(afterViewport.undo).toEqual([]);
    expect(afterViewport).not.toHaveProperty("viewport");
    expect(afterViewport.draftDocument).not.toHaveProperty("viewport");

    const afterMove = flowEditorReducer(initial, {
      type: "node/move",
      id: "scan",
      position: { x: 80, y: 140 },
    });
    const movedNode = afterMove.draftDocument.nodes.find((node) => node.id === "scan");

    expect(movedNode?.position).toEqual({ x: 80, y: 140 });
    expect(movedNode).not.toHaveProperty("viewport");
    expect(movedNode).not.toHaveProperty("selected");
    expect(movedNode).not.toHaveProperty("width");
    expect(movedNode).not.toHaveProperty("height");
    expect(afterMove.undo).toHaveLength(1);
  });
});
