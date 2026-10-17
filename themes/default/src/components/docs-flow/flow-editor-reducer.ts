import type {
    FlowDocument,
    FlowEdge,
    FlowEditorSession,
    FlowLane,
    FlowNode,
    FlowPosition,
    FlowStory,
    FlowStoryStep,
} from "#smooth-docs/types";

const HISTORY_LIMIT = 100;
const FLOW_ID_LIMIT = 64;

type NewFlowLane = Omit<FlowLane, "id"> & { id?: string };
type NewFlowNode = Omit<FlowNode, "id"> & { id?: string };
type NewFlowEdge = Omit<FlowEdge, "id"> & { id?: string };
type NewFlowStory = Omit<FlowStory, "id"> & { id?: string };

export type FlowEditorAction =
    | {
          type: "document/update";
          changes: Partial<Pick<FlowDocument, "title" | "description" | "direction">>;
      }
    | { type: "lane/add"; lane: NewFlowLane }
    | {
          type: "lane/update";
          id: string;
          changes: Partial<Omit<FlowLane, "id">>;
      }
    | { type: "lane/reorder"; id: string; toIndex: number }
    | { type: "lane/delete"; id: string }
    | { type: "node/add"; node: NewFlowNode }
    | {
          type: "node/update";
          id: string;
          changes: Partial<Omit<FlowNode, "id" | "position">>;
      }
    | { type: "node/move"; id: string; position: FlowPosition }
    | { type: "node/delete"; id: string }
    | { type: "edge/add"; edge: NewFlowEdge }
    | {
          type: "edge/update";
          id: string;
          changes: Partial<Omit<FlowEdge, "id">>;
      }
    | { type: "edge/delete"; id: string }
    | { type: "story/add"; story: NewFlowStory }
    | {
          type: "story/update";
          id: string;
          changes: Partial<Omit<FlowStory, "id" | "steps">>;
      }
    | { type: "story/reorder"; id: string; toIndex: number }
    | { type: "story/delete"; id: string }
    | { type: "story/step/add"; storyId: string; step: FlowStoryStep; toIndex?: number }
    | { type: "story/step/reorder"; storyId: string; fromIndex: number; toIndex: number }
    | { type: "story/step/delete"; storyId: string; index: number }
    | { type: "history/undo" }
    | { type: "history/redo" }
    | { type: "history/discard" };

export function createFlowEditorSession(
    document: FlowDocument,
    revision: string,
): FlowEditorSession {
    return {
        status: "clean",
        baseDocument: cloneDocument(document),
        draftDocument: cloneDocument(document),
        baseRevision: revision,
        undo: [],
        redo: [],
        diagnostics: [],
    };
}

export function flowEditorReducer(
    state: FlowEditorSession,
    action: FlowEditorAction,
): FlowEditorSession {
    switch (action.type) {
        case "document/update":
            return commitDocument(state, {
                ...state.draftDocument,
                ...pickChanges(action.changes, ["title", "description", "direction"]),
            });

        case "lane/add": {
            const lanes = state.draftDocument.lanes ?? [];
            const lane = createLane(action.lane, lanes);
            return commitDocument(state, {
                ...state.draftDocument,
                lanes: [...lanes, lane],
            });
        }

        case "lane/update":
            return updateLane(state, action.id, action.changes);

        case "lane/reorder":
            return reorderLane(state, action.id, action.toIndex);

        case "lane/delete":
            return deleteLane(state, action.id);

        case "node/add": {
            const node = createNode(action.node, state.draftDocument.nodes);
            return commitDocument(state, {
                ...state.draftDocument,
                nodes: [...state.draftDocument.nodes, node],
            });
        }

        case "node/update":
            return updateNode(state, action.id, action.changes);

        case "node/move":
            return moveNode(state, action.id, action.position);

        case "node/delete":
            return deleteNode(state, action.id);

        case "edge/add": {
            const edge = createEdge(action.edge, state.draftDocument.edges);
            return commitDocument(state, {
                ...state.draftDocument,
                edges: [...state.draftDocument.edges, edge],
            });
        }

        case "edge/update":
            return updateEdge(state, action.id, action.changes);

        case "edge/delete":
            return deleteEdge(state, action.id);

        case "story/add":
            return addStory(state, action.story);

        case "story/update":
            return updateStory(state, action.id, action.changes);

        case "story/reorder":
            return reorderStory(state, action.id, action.toIndex);

        case "story/delete":
            return deleteStory(state, action.id);

        case "story/step/add":
            return addStoryStep(state, action.storyId, action.step, action.toIndex);

        case "story/step/reorder":
            return reorderStoryStep(state, action.storyId, action.fromIndex, action.toIndex);

        case "story/step/delete":
            return deleteStoryStep(state, action.storyId, action.index);

        case "history/undo":
            return undo(state);

        case "history/redo":
            return redo(state);

        case "history/discard":
            return discard(state);

        default:
            return state;
    }
}

function addStory(state: FlowEditorSession, input: NewFlowStory) {
    const stories = state.draftDocument.stories ?? [];
    if (stories.length >= 32 || input.steps.length === 0 || input.steps.length > 300) return state;
    if (!input.steps.every((step) => isValidStoryStep(state.draftDocument, step))) return state;
    const story: FlowStory = {
        id: createUniqueId(input.id ?? input.label, "story", stories.map((item) => item.id)),
        label: input.label,
        ...pickDefined(input, ["description"]),
        steps: input.steps.map((step) => ({ ...step })),
    };
    return commitDocument(state, { ...state.draftDocument, stories: [...stories, story] });
}

function updateStory(
    state: FlowEditorSession,
    id: string,
    changes: Partial<Omit<FlowStory, "id" | "steps">>,
) {
    const stories = state.draftDocument.stories ?? [];
    if (!stories.some((story) => story.id === id)) return state;
    const allowedChanges = pickChanges(changes, ["label", "description"]);
    return commitDocument(state, {
        ...state.draftDocument,
        stories: stories.map((story) =>
            story.id === id ? { ...story, ...allowedChanges } : story,
        ),
    });
}

function reorderStory(state: FlowEditorSession, id: string, requestedIndex: number) {
    const stories = state.draftDocument.stories ?? [];
    const fromIndex = stories.findIndex((story) => story.id === id);
    if (fromIndex < 0 || !Number.isFinite(requestedIndex) || stories.length < 2) return state;
    const toIndex = Math.max(0, Math.min(stories.length - 1, Math.trunc(requestedIndex)));
    if (toIndex === fromIndex) return state;
    const next = [...stories];
    const [story] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, story);
    return commitDocument(state, { ...state.draftDocument, stories: next });
}

function deleteStory(state: FlowEditorSession, id: string) {
    const stories = state.draftDocument.stories ?? [];
    if (!stories.some((story) => story.id === id)) return state;
    const next = stories.filter((story) => story.id !== id);
    return commitDocument(state, {
        ...state.draftDocument,
        ...(next.length > 0 ? { stories: next } : { stories: undefined }),
    });
}

function addStoryStep(
    state: FlowEditorSession,
    storyId: string,
    step: FlowStoryStep,
    requestedIndex?: number,
) {
    const stories = state.draftDocument.stories ?? [];
    const story = stories.find((item) => item.id === storyId);
    if (!story || story.steps.length >= 300 || !isValidStoryStep(state.draftDocument, step)) {
        return state;
    }
    const toIndex = requestedIndex === undefined || !Number.isFinite(requestedIndex)
        ? story.steps.length
        : Math.max(0, Math.min(story.steps.length, Math.trunc(requestedIndex)));
    const steps = [...story.steps];
    steps.splice(toIndex, 0, { ...step });
    return commitDocument(state, {
        ...state.draftDocument,
        stories: stories.map((item) => item.id === storyId ? { ...item, steps } : item),
    });
}

function reorderStoryStep(
    state: FlowEditorSession,
    storyId: string,
    requestedFromIndex: number,
    requestedToIndex: number,
) {
    const stories = state.draftDocument.stories ?? [];
    const story = stories.find((item) => item.id === storyId);
    if (!story || !Number.isFinite(requestedFromIndex) || !Number.isFinite(requestedToIndex)) {
        return state;
    }
    const fromIndex = Math.trunc(requestedFromIndex);
    if (fromIndex < 0 || fromIndex >= story.steps.length) return state;
    const toIndex = Math.max(0, Math.min(story.steps.length - 1, Math.trunc(requestedToIndex)));
    if (fromIndex === toIndex) return state;
    const steps = [...story.steps];
    const [step] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, step);
    return commitDocument(state, {
        ...state.draftDocument,
        stories: stories.map((item) => item.id === storyId ? { ...item, steps } : item),
    });
}

function deleteStoryStep(state: FlowEditorSession, storyId: string, requestedIndex: number) {
    const stories = state.draftDocument.stories ?? [];
    const story = stories.find((item) => item.id === storyId);
    const index = Math.trunc(requestedIndex);
    if (!story || !Number.isFinite(requestedIndex) || index < 0 || index >= story.steps.length) {
        return state;
    }
    const steps = story.steps.filter((_, stepIndex) => stepIndex !== index);
    if (steps.length === 0) return state;
    return commitDocument(state, {
        ...state.draftDocument,
        stories: stories.map((item) => item.id === storyId ? { ...item, steps } : item),
    });
}

function isValidStoryStep(document: FlowDocument, step: FlowStoryStep) {
    return "node" in step
        ? document.nodes.some((node) => node.id === step.node)
        : document.edges.some((edge) => edge.id === step.edge);
}

function updateLane(
    state: FlowEditorSession,
    id: string,
    changes: Partial<Omit<FlowLane, "id">>,
) {
    const lanes = state.draftDocument.lanes ?? [];
    if (!lanes.some((lane) => lane.id === id)) return state;

    const allowedChanges = pickChanges(changes, ["label", "description"]);
    return commitDocument(state, {
        ...state.draftDocument,
        lanes: lanes.map((lane) =>
            lane.id === id
                ? {
                      ...lane,
                      ...allowedChanges,
                  }
                : lane,
        ),
    });
}

function reorderLane(state: FlowEditorSession, id: string, requestedIndex: number) {
    const lanes = state.draftDocument.lanes ?? [];
    const fromIndex = lanes.findIndex((lane) => lane.id === id);
    if (fromIndex < 0 || !Number.isFinite(requestedIndex) || lanes.length < 2) return state;

    const toIndex = Math.max(0, Math.min(lanes.length - 1, Math.trunc(requestedIndex)));
    if (fromIndex === toIndex) return state;

    const reordered = [...lanes];
    const [lane] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, lane);
    return commitDocument(state, { ...state.draftDocument, lanes: reordered });
}

function deleteLane(state: FlowEditorSession, id: string) {
    const lanes = state.draftDocument.lanes ?? [];
    if (!lanes.some((lane) => lane.id === id)) return state;

    return commitDocument(state, {
        ...state.draftDocument,
        lanes: lanes.filter((lane) => lane.id !== id),
        nodes: state.draftDocument.nodes.map((node) => {
            if (node.lane !== id) return node;
            const { lane: _lane, ...unassignedNode } = node;
            return unassignedNode;
        }),
    });
}

function updateNode(
    state: FlowEditorSession,
    id: string,
    changes: Partial<Omit<FlowNode, "id" | "position">>,
) {
    if (!state.draftDocument.nodes.some((node) => node.id === id)) return state;

    const allowedChanges = pickChanges(changes, [
        "type",
        "label",
        "description",
        "lane",
        "owner",
        "status",
        "risk",
        "links",
    ]);
    return commitDocument(state, {
        ...state.draftDocument,
        nodes: state.draftDocument.nodes.map((node) =>
            node.id === id
                ? {
                      ...node,
                      ...allowedChanges,
                  }
                : node,
        ),
    });
}

function moveNode(state: FlowEditorSession, id: string, position: FlowPosition) {
    if (!state.draftDocument.nodes.some((node) => node.id === id)) return state;

    return commitDocument(state, {
        ...state.draftDocument,
        nodes: state.draftDocument.nodes.map((node) =>
            node.id === id
                ? {
                      ...node,
                      position: { x: position.x, y: position.y },
                  }
                : node,
        ),
    });
}

function deleteNode(state: FlowEditorSession, id: string) {
    if (!state.draftDocument.nodes.some((node) => node.id === id)) return state;

    const removedEdgeIds = new Set(
        state.draftDocument.edges
            .filter((edge) => edge.from === id || edge.to === id)
            .map((edge) => edge.id),
    );
    const stories = cleanStoryReferences(state.draftDocument, {
        nodeIds: new Set([id]),
        edgeIds: removedEdgeIds,
    });

    return commitDocument(state, {
        ...state.draftDocument,
        nodes: state.draftDocument.nodes.filter((node) => node.id !== id),
        edges: state.draftDocument.edges.filter((edge) => !removedEdgeIds.has(edge.id)),
        ...(stories === undefined ? { stories: undefined } : { stories }),
    });
}

function updateEdge(
    state: FlowEditorSession,
    id: string,
    changes: Partial<Omit<FlowEdge, "id">>,
) {
    if (!state.draftDocument.edges.some((edge) => edge.id === id)) return state;

    const allowedChanges = pickChanges(changes, ["from", "to", "label", "style"]);
    return commitDocument(state, {
        ...state.draftDocument,
        edges: state.draftDocument.edges.map((edge) =>
            edge.id === id
                ? {
                      ...edge,
                      ...allowedChanges,
                  }
                : edge,
        ),
    });
}

function deleteEdge(state: FlowEditorSession, id: string) {
    if (!state.draftDocument.edges.some((edge) => edge.id === id)) return state;

    const stories = cleanStoryReferences(state.draftDocument, {
        nodeIds: new Set(),
        edgeIds: new Set([id]),
    });
    return commitDocument(state, {
        ...state.draftDocument,
        edges: state.draftDocument.edges.filter((edge) => edge.id !== id),
        ...(stories === undefined ? { stories: undefined } : { stories }),
    });
}

function cleanStoryReferences(
    document: FlowDocument,
    removed: { nodeIds: Set<string>; edgeIds: Set<string> },
) {
    if (document.stories === undefined) return undefined;

    return document.stories
        .map((story) => ({
            ...story,
            steps: story.steps.filter((step) => {
                if ("node" in step) return !removed.nodeIds.has(step.node);
                return !removed.edgeIds.has(step.edge);
            }),
        }))
        .filter((story) => story.steps.length > 0);
}

function createLane(input: NewFlowLane, existing: FlowLane[]): FlowLane {
    const id = createUniqueId(input.id ?? input.label, "lane", existing.map((lane) => lane.id));
    return {
        id,
        label: input.label,
        ...pickDefined(input, ["description"]),
    };
}

function createNode(input: NewFlowNode, existing: FlowNode[]): FlowNode {
    const id = createUniqueId(input.id ?? input.label, "node", existing.map((node) => node.id));
    return {
        id,
        type: input.type,
        label: input.label,
        ...pickDefined(input, [
            "description",
            "lane",
            "owner",
            "status",
            "risk",
            "links",
            "position",
        ]),
    };
}

function createEdge(input: NewFlowEdge, existing: FlowEdge[]): FlowEdge {
    const id = createUniqueId(
        input.id ?? `${input.from}-${input.to}`,
        "edge",
        existing.map((edge) => edge.id),
    );
    return {
        id,
        from: input.from,
        to: input.to,
        ...pickDefined(input, ["label", "style"]),
    };
}

function createUniqueId(candidate: string, fallback: string, existingIds: string[]) {
    const used = new Set(existingIds);
    const normalizedCandidate = candidate
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const prefixed = /^[a-z]/.test(normalizedCandidate)
        ? normalizedCandidate
        : `${fallback}${normalizedCandidate ? `-${normalizedCandidate}` : ""}`;
    const base = prefixed.slice(0, FLOW_ID_LIMIT).replace(/-+$/g, "") || fallback;

    if (!used.has(base)) return base;

    for (let suffix = 2; ; suffix += 1) {
        const suffixText = `-${suffix}`;
        const shortenedBase = base
            .slice(0, FLOW_ID_LIMIT - suffixText.length)
            .replace(/-+$/g, "");
        const id = `${shortenedBase}${suffixText}`;
        if (!used.has(id)) return id;
    }
}

function commitDocument(state: FlowEditorSession, candidate: FlowDocument) {
    if (documentsEqual(state.draftDocument, candidate)) return state;

    return {
        ...state,
        status: "dirty" as const,
        draftDocument: cloneDocument(candidate),
        undo: appendBounded(state.undo, state.draftDocument),
        redo: [],
        diagnostics: [],
    };
}

function undo(state: FlowEditorSession) {
    const previous = state.undo.at(-1);
    if (previous === undefined) return state;

    return {
        ...state,
        status: "dirty" as const,
        draftDocument: previous,
        undo: state.undo.slice(0, -1),
        redo: appendBounded(state.redo, state.draftDocument),
        diagnostics: [],
    };
}

function redo(state: FlowEditorSession) {
    const next = state.redo.at(-1);
    if (next === undefined) return state;

    return {
        ...state,
        status: "dirty" as const,
        draftDocument: next,
        undo: appendBounded(state.undo, state.draftDocument),
        redo: state.redo.slice(0, -1),
        diagnostics: [],
    };
}

function discard(state: FlowEditorSession): FlowEditorSession {
    const { conflict: _conflict, ...session } = state;
    return {
        ...session,
        status: "clean",
        draftDocument: cloneDocument(state.baseDocument),
        undo: [],
        redo: [],
        diagnostics: [],
    };
}

function appendBounded(history: FlowDocument[], document: FlowDocument) {
    return [...history, document].slice(-HISTORY_LIMIT);
}

function documentsEqual(left: FlowDocument, right: FlowDocument) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function cloneDocument(document: FlowDocument) {
    return structuredClone(document);
}

function pickChanges<T extends object, K extends keyof T>(
    source: Partial<T>,
    keys: readonly K[],
): Partial<Pick<T, K>> {
    const picked: Partial<Pick<T, K>> = {};
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            picked[key] = source[key];
        }
    }
    return picked;
}

function pickDefined<T extends object, K extends keyof T>(
    source: T,
    keys: readonly K[],
): Partial<Pick<T, K>> {
    const picked: Partial<Pick<T, K>> = {};
    for (const key of keys) {
        if (source[key] !== undefined) picked[key] = source[key];
    }
    return picked;
}
