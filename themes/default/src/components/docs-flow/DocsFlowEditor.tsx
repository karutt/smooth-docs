import * as React from "react";
import type {
    CompiledFlow,
    CompiledFlowLayout,
    FlowDiagnostic,
    FlowDocument,
    FlowEditorSession,
    FlowSourceReference,
} from "#smooth-docs/types";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import DocsFlowCanvas from "./DocsFlowCanvas";
import DocsFlowInspector, {
    DocsFlowStoriesEditor,
    type DocsFlowInspectorTarget,
} from "./DocsFlowInspector";
import { DocsFlowDiagnostics } from "./DocsFlowLinearView";
import DocsFlowToolbar from "./DocsFlowToolbar";
import {
    createFlowEditorSession,
    flowEditorReducer,
    type FlowEditorAction,
} from "./flow-editor-reducer";

const FLOW_API_ROOT = "/__smooth-docs/flow";
const HISTORY_LIMIT = 100;

export type EditableCompiledFlow = CompiledFlow & {
    document: FlowDocument;
    layout: CompiledFlowLayout;
    source: FlowSourceReference;
};

export type FlowSaveResult = {
    ok: true;
    sourcePath: string;
    flowId: string;
    revision: string;
    document: FlowDocument;
    docsDataBySite?: unknown;
    generatedAt?: number;
};

export type DocsFlowEditorProps = {
    flow: EditableCompiledFlow;
    onClose: () => void;
    onSaved?: (result: FlowSaveResult) => void;
};

type FlowSourceResult = {
    document: FlowDocument;
    source: FlowSourceReference;
    diagnostics?: FlowDiagnostic[];
};

type FlowLayoutResult = {
    layout: CompiledFlowLayout;
    diagnostics?: FlowDiagnostic[];
};

type FlowConflictResult = {
    code?: string;
    message?: string;
    currentRevision?: string;
    currentDocument?: FlowDocument;
    diagnostics?: FlowDiagnostic[];
};

type ApiErrorResult = {
    code?: string;
    message?: string;
    diagnostics?: FlowDiagnostic[];
};

export default function DocsFlowEditor({ flow, onClose, onSaved }: DocsFlowEditorProps) {
    const headingId = React.useId();
    const requestGenerationRef = React.useRef(0);
    const [source, setSource] = React.useState(flow.source);
    const [layout, setLayout] = React.useState(flow.layout);
    const [session, setSession] = React.useState<FlowEditorSession>(() => ({
        ...createFlowEditorSession(flow.document, flow.source.revision),
        status: "loading",
    }));
    const [inspectorTarget, setInspectorTarget] = React.useState<DocsFlowInspectorTarget | null>(null);
    const [selectedNodeId, setSelectedNodeId] = React.useState<string>();
    const [selectedEdgeId, setSelectedEdgeId] = React.useState<string>();
    const [laneMenuOpen, setLaneMenuOpen] = React.useState(false);
    const [storyEditorOpen, setStoryEditorOpen] = React.useState(false);
    const [layoutPending, setLayoutPending] = React.useState(false);
    const [announcement, setAnnouncement] = React.useState("");

    const announce = React.useCallback((message: string) => {
        setAnnouncement("");
        window.setTimeout(() => setAnnouncement(message), 0);
    }, []);

    const loadSource = React.useCallback(
        async (reason: "initial" | "reload" | "retry") => {
            const generation = requestGenerationRef.current + 1;
            requestGenerationRef.current = generation;
            setSession((current) => ({ ...current, status: "loading" }));

            try {
                const query = new URLSearchParams({
                    sourcePath: flow.source.pageSourcePath,
                    flowId: flow.source.flowId,
                });
                const response = await fetch(`${FLOW_API_ROOT}/source?${query}`);
                const payload = await readJson<FlowSourceResult & ApiErrorResult>(response);
                if (requestGenerationRef.current !== generation) return;

                if (!response.ok || !payload.document || !payload.source) {
                    setSession((current) => ({
                        ...current,
                        status: "error",
                        diagnostics: diagnosticsFromPayload(
                            payload,
                            "FLOW_SOURCE_LOAD_FAILED",
                            "The editable flow source could not be loaded.",
                        ),
                    }));
                    announce("Flow source could not be loaded");
                    return;
                }

                const next = createFlowEditorSession(payload.document, payload.source.revision);
                next.diagnostics = payload.diagnostics ?? [];
                next.status = payload.source.editable ? "clean" : "error";
                if (!payload.source.editable && next.diagnostics.length === 0) {
                    next.diagnostics = [
                        {
                            code: "SOURCE_NOT_EDITABLE",
                            severity: "error",
                            message: "This flow source is not editable from the local authoring server.",
                        },
                    ];
                }
                setSource(payload.source);
                setSession(next);
                setInspectorTarget(null);
                setSelectedNodeId(undefined);
                setSelectedEdgeId(undefined);
                setLaneMenuOpen(false);
                setStoryEditorOpen(false);
                announce(
                    reason === "initial"
                        ? `Editing ${payload.document.title}`
                        : reason === "reload"
                          ? "Flow source reloaded and local changes discarded"
                          : "Flow source loaded",
                );
            } catch (error) {
                if (requestGenerationRef.current !== generation) return;
                setSession((current) => ({
                    ...current,
                    status: "error",
                    diagnostics: [requestFailureDiagnostic(error, "FLOW_SOURCE_LOAD_FAILED")],
                }));
                announce("Flow source could not be loaded");
            }
        },
        [announce, flow.source.flowId, flow.source.pageSourcePath],
    );

    React.useEffect(() => {
        void loadSource("initial");
        return () => {
            requestGenerationRef.current += 1;
        };
    }, [loadSource]);

    const hasUnsavedWork =
        session.status === "dirty" || session.status === "saving" || session.status === "conflict";

    React.useEffect(() => {
        if (!hasUnsavedWork) return;
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasUnsavedWork]);

    const dispatch = React.useCallback((command: FlowEditorAction) => {
        setSession((current) => {
            if (
                current.status === "loading" ||
                current.status === "saving" ||
                current.status === "conflict" ||
                current.status === "error"
            ) {
                return current;
            }
            return flowEditorReducer(current, command);
        });
    }, []);

    const handleUndo = React.useCallback(() => {
        setSession((current) => {
            const next = flowEditorReducer(current, { type: "history/undo" });
            if (next !== current) announce("Undid last change");
            return next;
        });
    }, [announce]);

    const handleRedo = React.useCallback(() => {
        setSession((current) => {
            const next = flowEditorReducer(current, { type: "history/redo" });
            if (next !== current) announce("Redid last change");
            return next;
        });
    }, [announce]);

    const handleDiscard = React.useCallback(() => {
        setSession((current) => flowEditorReducer(current, { type: "history/discard" }));
        setInspectorTarget(null);
        setLaneMenuOpen(false);
        setStoryEditorOpen(false);
        setLayout(flow.layout);
        announce("Changes discarded");
    }, [announce, flow.layout]);

    const handleClose = React.useCallback(() => {
        if (
            hasUnsavedWork &&
            typeof window.confirm === "function" &&
            !window.confirm("Discard unsaved flow changes and close the editor?")
        ) {
            return;
        }
        onClose();
    }, [hasUnsavedWork, onClose]);

    const handleSave = React.useCallback(async () => {
        if (
            session.status !== "dirty" ||
            session.diagnostics.some((diagnostic) => diagnostic.severity === "error")
        ) {
            return;
        }

        const snapshot = session;
        setSession((current) => ({ ...current, status: "saving" }));
        try {
            const response = await fetch(`${FLOW_API_ROOT}/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourcePath: source.pageSourcePath,
                    flowId: source.flowId,
                    baseRevision: snapshot.baseRevision,
                    document: snapshot.draftDocument,
                }),
            });
            const payload = await readJson<FlowSaveResult & FlowConflictResult & ApiErrorResult>(response);

            const savedDocument = payload.document;
            const savedRevision = payload.revision;
            if (response.ok && payload.ok && savedDocument && savedRevision) {
                const result = {
                    ...payload,
                    ok: true as const,
                    document: savedDocument,
                    revision: savedRevision,
                } as FlowSaveResult;
                const next = createFlowEditorSession(savedDocument, savedRevision);
                setSession(next);
                setSource((current) => ({ ...current, revision: savedRevision }));
                setInspectorTarget(null);
                announce("Flow saved");
                onSaved?.(result);
                return;
            }

            if (response.status === 409) {
                const diagnostics = diagnosticsFromPayload(
                    payload,
                    "REVISION_CONFLICT",
                    "The flow changed after editing started.",
                );
                setSession((current) => ({
                    ...current,
                    status: "conflict",
                    diagnostics,
                    conflict: {
                        currentRevision: payload.currentRevision ?? current.baseRevision,
                        currentDocument: payload.currentDocument,
                        diagnostics,
                    },
                }));
                announce("Flow save conflict. Reload or reconcile the draft");
                return;
            }

            const diagnostics = diagnosticsFromPayload(
                payload,
                "FLOW_SAVE_FAILED",
                "The flow could not be saved.",
            );
            setSession((current) => ({
                ...current,
                status: "dirty",
                diagnostics,
            }));
            announce("Flow could not be saved. Draft changes were retained");
        } catch (error) {
            setSession((current) => ({
                ...current,
                status: "dirty",
                diagnostics: [requestFailureDiagnostic(error, "FLOW_SAVE_FAILED")],
            }));
            announce("Flow could not be saved. Draft changes were retained");
        }
    }, [announce, onSaved, session, source.flowId, source.pageSourcePath]);

    const handleAutoLayout = React.useCallback(async () => {
        if (layoutPending || session.status === "loading" || session.status === "saving") return;
        setLayoutPending(true);
        try {
            const response = await fetch(`${FLOW_API_ROOT}/layout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ document: session.draftDocument, scope: "all" }),
            });
            const payload = await readJson<FlowLayoutResult & ApiErrorResult>(response);
            const nextLayout = payload.layout;
            if (!response.ok || !nextLayout) {
                const diagnostics = diagnosticsFromPayload(
                    payload,
                    "FLOW_LAYOUT_FAILED",
                    "The flow could not be laid out.",
                );
                setSession((current) => ({ ...current, diagnostics }));
                announce("Auto layout failed. Draft changes were retained");
                return;
            }

            setSession((current) => applyLayoutAsOneCommand(current, nextLayout));
            setLayout(nextLayout);
            announce("Auto layout applied");
        } catch (error) {
            setSession((current) => ({
                ...current,
                diagnostics: [requestFailureDiagnostic(error, "FLOW_LAYOUT_FAILED")],
            }));
            announce("Auto layout failed. Draft changes were retained");
        } finally {
            setLayoutPending(false);
        }
    }, [announce, layoutPending, session.draftDocument, session.status]);

    const handleReconcile = React.useCallback(() => {
        setSession((current) => {
            if (!current.conflict) return current;
            const { conflict: _conflict, ...withoutConflict } = current;
            return {
                ...withoutConflict,
                status: "dirty",
                baseDocument: current.conflict.currentDocument
                    ? structuredClone(current.conflict.currentDocument)
                    : current.baseDocument,
                baseRevision: current.conflict.currentRevision,
                diagnostics: [],
            };
        });
        announce("Draft retained and rebased for manual reconciliation");
    }, [announce]);

    const busy = layoutPending || session.status === "loading" || session.status === "saving";
    const hasErrors = session.diagnostics.some((diagnostic) => diagnostic.severity === "error");
    const editorHeight = Math.max(flow.view.height ?? 640, 640);
    const selectedTarget: DocsFlowInspectorTarget | null = selectedNodeId
        ? { kind: "node", mode: "edit", id: selectedNodeId }
        : selectedEdgeId
          ? { kind: "edge", mode: "edit", id: selectedEdgeId }
          : null;

    const closeTransientUi = React.useCallback(() => {
        setInspectorTarget(null);
        setLaneMenuOpen(false);
        setStoryEditorOpen(false);
    }, []);

    React.useEffect(() => {
        if (!inspectorTarget && !laneMenuOpen && !storyEditorOpen) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            closeTransientUi();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [closeTransientUi, inspectorTarget, laneMenuOpen, storyEditorOpen]);

    const openInspector = React.useCallback((target: DocsFlowInspectorTarget) => {
        setInspectorTarget(target);
        setLaneMenuOpen(false);
        setStoryEditorOpen(false);
    }, []);

    const handleNodeMove = React.useCallback((id: string, position: { x: number; y: number }) => {
        dispatch({ type: "node/move", id, position });
        setLayout((current) => {
            const box = current.nodes[id];
            if (!box) return current;
            return {
                ...current,
                nodes: { ...current.nodes, [id]: { ...box, ...position } },
            };
        });
        announce("Node moved");
    }, [announce, dispatch]);

    return (
        <section
            aria-labelledby={headingId}
            aria-busy={busy || undefined}
            className="not-prose relative overflow-hidden rounded-xl border bg-muted/10 shadow-sm"
            data-flow-editor="true"
            style={{ height: editorHeight }}
        >
            <h2 className="sr-only" id={headingId}>
                Edit flow: {session.draftDocument.title}
            </h2>

            <div className="sr-only" aria-atomic="true" aria-live="polite" role="status">
                {announcement}
            </div>

            <DocsFlowCanvas
                className="rounded-none border-0"
                document={session.draftDocument}
                editable={!busy && session.status !== "conflict" && session.status !== "error"}
                height="100%"
                layout={layout}
                onConnect={(connection) => {
                    if (!connection.source || !connection.target) return;
                    dispatch({
                        type: "edge/add",
                        edge: { from: connection.source, to: connection.target, style: "normal" },
                    });
                    announce("Connection created");
                }}
                onEdgeDelete={(id) => {
                    dispatch({ type: "edge/delete", id });
                    setSelectedEdgeId(undefined);
                    announce("Connection deleted");
                }}
                onEdgeReconnect={(id, connection) => {
                    if (!connection.source || !connection.target) return;
                    dispatch({
                        type: "edge/update",
                        id,
                        changes: { from: connection.source, to: connection.target },
                    });
                    announce("Connection reconnected");
                }}
                onEdgeSelect={(id) => {
                    setSelectedEdgeId(id);
                    if (id) setSelectedNodeId(undefined);
                }}
                onNodeDelete={(id) => {
                    dispatch({ type: "node/delete", id });
                    setSelectedNodeId(undefined);
                    announce("Node deleted");
                }}
                onNodeMove={handleNodeMove}
                onNodeSelect={(id) => {
                    setSelectedNodeId(id);
                    if (id) setSelectedEdgeId(undefined);
                }}
                selectedEdgeId={selectedEdgeId}
                selectedNodeId={selectedNodeId}
            />

            <div className="absolute left-1/2 top-3 z-30 max-w-[calc(100%-1.5rem)] -translate-x-1/2 overflow-x-auto">
                <DocsFlowToolbar
                    compact
                    editing
                    status={session.status}
                    busy={layoutPending}
                    canAddNode={session.draftDocument.nodes.length < 100}
                    canAddConnection={
                        session.draftDocument.nodes.length > 0 && session.draftDocument.edges.length < 150
                    }
                    canAutoLayout={session.draftDocument.nodes.length > 0}
                    canEditSelection={Boolean(selectedTarget)}
                    canUndo={session.undo.length > 0}
                    canRedo={session.redo.length > 0}
                    canSave={session.status === "dirty" && !hasErrors}
                    canDiscard={hasUnsavedWork || session.undo.length > 0}
                    onAddNode={() => openInspector({ kind: "node", mode: "add" })}
                    onAddConnection={() => openInspector({ kind: "edge", mode: "add" })}
                    onAutoLayout={() => void handleAutoLayout()}
                    onEditSelection={() => selectedTarget && openInspector(selectedTarget)}
                    onEditStories={() => {
                        setStoryEditorOpen(true);
                        setInspectorTarget(null);
                        setLaneMenuOpen(false);
                    }}
                    onManageLanes={() => {
                        setLaneMenuOpen(true);
                        setInspectorTarget(null);
                        setStoryEditorOpen(false);
                    }}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onSave={() => void handleSave()}
                    onDiscard={handleDiscard}
                    onCloseEditor={handleClose}
                />
            </div>

            {inspectorTarget ? (
                <div
                    aria-label="Edit workflow item"
                    aria-modal="true"
                    className="absolute bottom-3 right-3 top-16 z-40 w-[min(23rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl border bg-background/98 p-4 shadow-2xl backdrop-blur"
                    role="dialog"
                >
                    <DocsFlowInspector
                        className="mt-0"
                        diagnostics={session.diagnostics}
                        document={session.draftDocument}
                        key={`${inspectorTarget.kind}-${inspectorTarget.mode}-${inspectorTarget.id ?? "new"}`}
                        onAnnounce={announce}
                        onCancel={() => setInspectorTarget(null)}
                        onCommand={dispatch}
                        target={inspectorTarget}
                    />
                </div>
            ) : null}

            {laneMenuOpen ? (
                <div
                    aria-label="Manage lanes"
                    aria-modal="true"
                    className="absolute right-3 top-16 z-40 w-[min(20rem,calc(100%-1.5rem))] rounded-xl border bg-background/98 p-3 shadow-2xl backdrop-blur"
                    role="dialog"
                >
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">Lanes</p>
                        <Button aria-label="Close lane manager" onClick={() => setLaneMenuOpen(false)} size="icon" type="button" variant="ghost"><X aria-hidden="true" className="size-4" /></Button>
                    </div>
                    <div className="mt-2 space-y-1">
                        {(session.draftDocument.lanes ?? []).map((lane, index, lanes) => (
                            <div className="flex items-center gap-1 rounded-md border p-1.5" key={lane.id}>
                                <button className="min-w-0 flex-1 truncate px-2 text-left text-sm" onClick={() => openInspector({ kind: "lane", mode: "edit", id: lane.id })} type="button">{lane.label}</button>
                                <Button aria-label={`Move lane ${lane.label} earlier`} disabled={index === 0} onClick={() => dispatch({ type: "lane/reorder", id: lane.id, toIndex: index - 1 })} size="icon" type="button" variant="ghost">↑</Button>
                                <Button aria-label={`Move lane ${lane.label} later`} disabled={index === lanes.length - 1} onClick={() => dispatch({ type: "lane/reorder", id: lane.id, toIndex: index + 1 })} size="icon" type="button" variant="ghost">↓</Button>
                                <Button aria-label={`Delete lane ${lane.label}`} onClick={() => dispatch({ type: "lane/delete", id: lane.id })} size="icon" type="button" variant="ghost">×</Button>
                            </div>
                        ))}
                    </div>
                    <Button className="mt-3 w-full" onClick={() => openInspector({ kind: "lane", mode: "add" })} size="sm" type="button" variant="outline">Add lane</Button>
                </div>
            ) : null}

            {storyEditorOpen ? (
                <div
                    aria-label="Edit stories"
                    aria-modal="true"
                    className="absolute bottom-3 right-3 top-16 z-40 w-[min(28rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl border bg-background/98 p-3 shadow-2xl backdrop-blur"
                    role="dialog"
                >
                    <div className="mb-2 flex justify-end">
                        <Button aria-label="Close story editor" onClick={() => setStoryEditorOpen(false)} size="icon" type="button" variant="ghost"><X aria-hidden="true" className="size-4" /></Button>
                    </div>
                    <DocsFlowStoriesEditor
                        document={session.draftDocument}
                        onAnnounce={announce}
                        onCommand={dispatch}
                    />
                </div>
            ) : null}

            {session.diagnostics.length > 0 || session.status === "conflict" || session.status === "error" ? (
                <div className="absolute bottom-3 left-3 z-30 max-h-56 w-[min(28rem,calc(100%-1.5rem))] overflow-auto rounded-xl bg-background/95 shadow-xl">
                    {session.diagnostics.length > 0 ? <DocsFlowDiagnostics diagnostics={session.diagnostics} /> : null}
                    {session.status === "conflict" ? (
                        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3" role="alert">
                            <p className="text-sm font-semibold">The source changed while this flow was being edited.</p>
                            <div className="mt-2 flex gap-2">
                                <Button onClick={() => void loadSource("reload")} size="sm" type="button" variant="outline">Reload source</Button>
                                <Button onClick={handleReconcile} size="sm" type="button">Reconcile draft</Button>
                            </div>
                        </div>
                    ) : null}
                    {session.status === "error" ? <Button onClick={() => void loadSource("retry")} size="sm" type="button" variant="outline">Retry source</Button> : null}
                </div>
            ) : null}
        </section>
    );
}

function applyLayoutAsOneCommand(session: FlowEditorSession, layout: CompiledFlowLayout) {
    const nodes = session.draftDocument.nodes.map((node) => {
        const box = layout.nodes[node.id];
        if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.y)) return node;
        return { ...node, position: { x: box.x, y: box.y } };
    });
    const document = { ...session.draftDocument, nodes };
    if (JSON.stringify(document) === JSON.stringify(session.draftDocument)) return session;

    return {
        ...session,
        status: "dirty" as const,
        draftDocument: structuredClone(document),
        undo: [...session.undo, session.draftDocument].slice(-HISTORY_LIMIT),
        redo: [],
        diagnostics: [],
    };
}

async function readJson<T>(response: Response): Promise<Partial<T>> {
    try {
        return (await response.json()) as Partial<T>;
    } catch {
        return {};
    }
}

function diagnosticsFromPayload(
    payload: Partial<ApiErrorResult>,
    fallbackCode: string,
    fallbackMessage: string,
) {
    if (Array.isArray(payload.diagnostics) && payload.diagnostics.length > 0) {
        return payload.diagnostics;
    }
    return [
        {
            code: payload.code ?? fallbackCode,
            severity: "error" as const,
            message: payload.message ?? fallbackMessage,
        },
    ];
}

function requestFailureDiagnostic(error: unknown, code: string): FlowDiagnostic {
    return {
        code,
        severity: "error",
        message: error instanceof Error ? error.message : "The local authoring request failed.",
    };
}
