import * as React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import type {
    CompiledFlow,
    CompiledFlowLayout,
    FlowDocument,
    FlowSourceReference,
} from "#smooth-docs/types";
import { Button } from "@/components/ui/button";
import DocsFlowLinearView, { DocsFlowDiagnostics } from "./DocsFlowLinearView";
import DocsFlowStoryPlayer, { type DocsFlowStoryHighlight } from "./DocsFlowStoryPlayer";
import DocsFlowToolbar from "./DocsFlowToolbar";
import type { DocsFlowCanvasHandle } from "./DocsFlowCanvas";

type DocsFlowBlockProps = {
    flow: CompiledFlow;
};

type RenderableFlow = CompiledFlow & {
    document: FlowDocument;
    layout: CompiledFlowLayout;
};

type EditableRenderableFlow = RenderableFlow & {
    source: FlowSourceReference;
};

type ViewerErrorBoundaryProps = {
    children: React.ReactNode;
    resetKey: string;
    fallback: (retry: () => void) => React.ReactNode;
    onRetry: () => void;
};

type ViewerErrorBoundaryState = {
    error: Error | null;
};

function isRenderableFlow(flow: CompiledFlow): flow is RenderableFlow {
    return Boolean(
        flow.document &&
            flow.layout &&
            !flow.diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    );
}

function createLazyCanvas() {
    return React.lazy(() => import("./DocsFlowCanvas"));
}

const LazyEditor = import.meta.env.DEV
    ? React.lazy(() => import("./DocsFlowEditor"))
    : null;

function isEditableRenderableFlow(flow: RenderableFlow): flow is EditableRenderableFlow {
    return Boolean(flow.source?.editable);
}

class ViewerErrorBoundary extends React.Component<
    ViewerErrorBoundaryProps,
    ViewerErrorBoundaryState
> {
    state: ViewerErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ViewerErrorBoundaryState {
        return { error };
    }

    componentDidUpdate(previousProps: ViewerErrorBoundaryProps) {
        if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }

    private retry = () => {
        this.setState({ error: null });
        this.props.onRetry();
    };

    render() {
        if (this.state.error) return this.props.fallback(this.retry);
        return this.props.children;
    }
}

function LoadingFallback({ flow }: { flow: RenderableFlow }) {
    return (
        <div aria-busy="true">
            <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground" role="status">
                Loading the interactive workflow. A complete text view is available below.
            </p>
            <DocsFlowLinearView flow={flow} showDiagnostics={false} />
        </div>
    );
}

function ViewerFailureFallback({
    flow,
    onRetry,
    onRequestLinearView,
}: {
    flow: RenderableFlow;
    onRetry: () => void;
    onRequestLinearView: () => void;
}) {
    return (
        <div>
            <aside className="rounded-lg border border-destructive/50 bg-destructive/10 p-4" role="alert">
                <p className="font-semibold text-destructive">The interactive diagram could not be loaded.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    Retry the viewer, or continue with the complete text representation below.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={onRetry} size="sm" type="button" variant="outline">
                        <RotateCcw aria-hidden="true" className="mr-2 size-4" />
                        Retry diagram
                    </Button>
                    <Button onClick={onRequestLinearView} size="sm" type="button" variant="ghost">
                        Keep text view
                    </Button>
                </div>
            </aside>
            <DocsFlowLinearView flow={flow} showDiagnostics={false} />
        </div>
    );
}

export default function DocsFlowBlock({ flow }: DocsFlowBlockProps) {
    const currentRenderable = isRenderableFlow(flow);
    const [lastGoodFlow, setLastGoodFlow] = React.useState<RenderableFlow | null>(() =>
        currentRenderable ? flow : null,
    );
    const [linearView, setLinearView] = React.useState(false);
    const [editing, setEditing] = React.useState(false);
    const [toolsOpen, setToolsOpen] = React.useState(false);
    const [selectedNodeId, setSelectedNodeId] = React.useState<string>();
    const [selectedEdgeId, setSelectedEdgeId] = React.useState<string>();
    const [searchQuery, setSearchQuery] = React.useState("");
    const [searchMatchIndex, setSearchMatchIndex] = React.useState(0);
    const [focusMode, setFocusMode] = React.useState<"all" | "upstream" | "downstream">("all");
    const [focusedNodeIds, setFocusedNodeIds] = React.useState<string[]>();
    const [focusedEdgeIds, setFocusedEdgeIds] = React.useState<string[]>();
    const [canvasReady, setCanvasReady] = React.useState(false);
    const [exporting, setExporting] = React.useState(false);
    const [storyHighlight, setStoryHighlight] = React.useState<DocsFlowStoryHighlight>({
        edgeIds: [],
        nodeIds: [],
        playing: false,
        motion: "animated",
    });
    const [viewerGeneration, setViewerGeneration] = React.useState(0);
    const editButtonRef = React.useRef<HTMLButtonElement>(null);
    const viewerRef = React.useRef<HTMLDivElement>(null);
    const canvasRef = React.useRef<DocsFlowCanvasHandle>(null);
    const pendingCanvasCommands = React.useRef<Array<(canvas: DocsFlowCanvasHandle) => void>>([]);
    const setCanvasHandle = React.useCallback((canvas: DocsFlowCanvasHandle | null) => {
        canvasRef.current = canvas;
        setCanvasReady(Boolean(canvas));
        if (!canvas) return;
        const commands = pendingCanvasCommands.current.splice(0);
        commands.forEach((command) => command(canvas));
    }, []);
    const runCanvasCommand = React.useCallback(
        (command: (canvas: DocsFlowCanvasHandle) => void) => {
            if (canvasRef.current) command(canvasRef.current);
            else pendingCanvasCommands.current.push(command);
        },
        [],
    );
    const LazyCanvas = React.useMemo(createLazyCanvas, [viewerGeneration]);

    React.useEffect(() => {
        setLastGoodFlow((previous) => {
            if (isRenderableFlow(flow)) return flow;
            return previous?.embedId === flow.embedId ? previous : null;
        });
    }, [flow]);

    const retainedFlow = lastGoodFlow?.embedId === flow.embedId ? lastGoodFlow : null;
    const displayFlow = currentRenderable ? flow : retainedFlow;
    const showingLastGood = !currentRenderable && displayFlow !== null;
    const searchMatchNodeIds = React.useMemo(() => {
        if (!displayFlow) return [];
        const query = searchQuery.trim().toLocaleLowerCase();
        if (!query) return [];
        return displayFlow.document.nodes
            .filter((node) =>
                `${node.label} ${node.description ?? ""}`.toLocaleLowerCase().includes(query),
            )
            .map((node) => node.id);
    }, [displayFlow, searchQuery]);

    React.useEffect(() => {
        if (searchMatchNodeIds.length === 0) {
            setSearchMatchIndex(0);
            return;
        }
        const normalizedIndex =
            ((searchMatchIndex % searchMatchNodeIds.length) + searchMatchNodeIds.length) %
            searchMatchNodeIds.length;
        if (normalizedIndex !== searchMatchIndex) setSearchMatchIndex(normalizedIndex);
        const nodeId = searchMatchNodeIds[normalizedIndex];
        setSelectedNodeId(nodeId);
        setSelectedEdgeId(undefined);
        canvasRef.current?.focusNode(nodeId);
    }, [searchMatchIndex, searchMatchNodeIds]);

    React.useEffect(() => {
        if (editing && displayFlow && !isEditableRenderableFlow(displayFlow)) {
            setEditing(false);
        }
    }, [displayFlow, editing]);

    if (!displayFlow) {
        return <DocsFlowLinearView flow={flow} />;
    }

    if (editing && LazyEditor && isEditableRenderableFlow(displayFlow)) {
        const closeEditor = () => {
            setEditing(false);
            setToolsOpen(true);
            window.setTimeout(() => editButtonRef.current?.focus(), 0);
        };
        return (
            <React.Suspense
                fallback={
                    <p
                        aria-live="polite"
                        className="not-prose my-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
                        role="status"
                    >
                        Loading flow editor…
                    </p>
                }
            >
                <LazyEditor flow={displayFlow} onClose={closeEditor} />
            </React.Suspense>
        );
    }

    if (linearView) {
        return (
            <div
                className="not-prose relative my-6 overflow-auto rounded-xl border bg-background p-4 pt-16 shadow-sm"
                style={{ maxHeight: displayFlow.view.height ?? 560 }}
            >
                {toolsOpen ? (
                    <div className="absolute left-1/2 top-3 z-30 max-w-[calc(100%-1.5rem)] -translate-x-1/2 overflow-x-auto p-0.5">
                        <DocsFlowToolbar
                            canEdit={Boolean(LazyEditor && isEditableRenderableFlow(displayFlow))}
                            compact
                            editButtonRef={editButtonRef}
                            editLabelParts={import.meta.env.DEV ? ["Edit", "flow"] : undefined}
                            focusMode={focusMode}
                            linearView
                            onCloseTools={() => setToolsOpen(false)}
                            onEdit={() => {
                                setEditing(true);
                                setToolsOpen(false);
                            }}
                            onNextMatch={() => setSearchMatchIndex((index) => index + 1)}
                            onPreviousMatch={() => setSearchMatchIndex((index) => index - 1)}
                            onRequestCanvasView={() => setLinearView(false)}
                            onSearchQueryChange={(query) => {
                                setSearchQuery(query);
                                setSearchMatchIndex(0);
                            }}
                            onShowWholeGraph={() => restoreWholeGraph()}
                            searchMatchCount={searchMatchNodeIds.length}
                            searchMatchIndex={searchMatchIndex}
                            searchQuery={searchQuery}
                        />
                    </div>
                ) : (
                    <Button
                        aria-label="Show workflow tools"
                        className="absolute left-3 top-3 z-30 size-9 rounded-xl bg-background/95 shadow-lg"
                        onClick={() => setToolsOpen(true)}
                        size="icon"
                        type="button"
                        variant="outline"
                    >
                        <SlidersHorizontal aria-hidden="true" className="size-4" />
                    </Button>
                )}
                {showingLastGood ? (
                    <DocsFlowDiagnostics
                        className="mb-4"
                        diagnostics={flow.diagnostics}
                        fallbackText={flow.fallbackText}
                        showingLastGood
                    />
                ) : null}
                <DocsFlowLinearView
                    className="my-0 border-0 shadow-none"
                    flow={displayFlow}
                    onFocusDownstream={(nodeId) => focusFromNode(nodeId, "downstream")}
                    onFocusUpstream={(nodeId) => focusFromNode(nodeId, "upstream")}
                    onNodeSelect={setSelectedNodeId}
                    onRestoreAll={() => restoreWholeGraph()}
                    selectedNodeId={selectedNodeId}
                    showDiagnostics={!showingLastGood}
                />
            </div>
        );
    }

    const viewerId = `docs-flow-viewer-${flow.embedId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
    return (
        <section
            className="not-prose my-6"
            aria-label={`${displayFlow.document.title} workflow${canvasReady ? "" : " loading"}`}
        >
            <div
                className="relative overflow-hidden rounded-xl border bg-background shadow-sm"
                id={viewerId}
                ref={viewerRef}
            >
                {flow.diagnostics.length > 0 || showingLastGood ? (
                    <DocsFlowDiagnostics
                        className="absolute left-3 right-3 top-3 z-30 shadow-lg"
                        diagnostics={flow.diagnostics}
                        fallbackText={showingLastGood ? flow.fallbackText : undefined}
                        showingLastGood={showingLastGood}
                    />
                ) : null}
                <ViewerErrorBoundary
                    fallback={(retry) => (
                        <ViewerFailureFallback
                            flow={displayFlow}
                            onRequestLinearView={() => setLinearView(true)}
                            onRetry={retry}
                        />
                    )}
                    onRetry={() => setViewerGeneration((generation) => generation + 1)}
                    resetKey={`${flow.embedId}:${viewerGeneration}`}
                >
                    <React.Suspense fallback={<LoadingFallback flow={displayFlow} />}>
                        <LazyCanvas
                            className="rounded-none border-0"
                            ref={setCanvasHandle}
                            document={displayFlow.document}
                            focusedEdgeIds={focusedEdgeIds}
                            focusedNodeIds={focusedNodeIds}
                            height={displayFlow.view.height}
                            layout={displayFlow.layout}
                            onEdgeSelect={(edgeId) => {
                                setSelectedEdgeId(edgeId);
                                if (edgeId) setSelectedNodeId(undefined);
                            }}
                            onNodeSelect={(nodeId) => {
                                setSelectedNodeId(nodeId);
                                if (nodeId) setSelectedEdgeId(undefined);
                            }}
                            searchMatchNodeIds={searchMatchNodeIds}
                            selectedEdgeId={selectedEdgeId}
                            selectedNodeId={selectedNodeId}
                            storyActiveEdgeIds={storyHighlight.edgeIds}
                            storyActiveNodeIds={storyHighlight.nodeIds}
                            storyCurrentEdgeId={storyHighlight.currentEdgeId}
                            storyCurrentNodeId={storyHighlight.currentNodeId}
                            storyPlaying={storyHighlight.playing}
                            storyMotion={storyHighlight.motion}
                        />
                    </React.Suspense>
                </ViewerErrorBoundary>
                {toolsOpen ? (
                    <div className="absolute left-1/2 top-3 z-30 max-w-[calc(100%-1.5rem)] -translate-x-1/2 overflow-x-auto p-0.5">
                        <DocsFlowToolbar
                            canEdit={Boolean(LazyEditor && isEditableRenderableFlow(displayFlow))}
                            compact
                            editButtonRef={editButtonRef}
                            editLabelParts={import.meta.env.DEV ? ["Edit", "flow"] : undefined}
                            exporting={exporting}
                            focusMode={focusMode}
                            onCloseTools={() => setToolsOpen(false)}
                            onEdit={() => {
                                setEditing(true);
                                setToolsOpen(false);
                            }}
                            onExportPng={() => void exportPng()}
                            onFitView={() => runCanvasCommand((canvas) => canvas.fitView())}
                            onFocusDownstream={selectedNodeId ? () => focusFromNode(selectedNodeId, "downstream") : undefined}
                            onFocusUpstream={selectedNodeId ? () => focusFromNode(selectedNodeId, "upstream") : undefined}
                            onNextMatch={() => setSearchMatchIndex((index) => index + 1)}
                            onPreviousMatch={() => setSearchMatchIndex((index) => index - 1)}
                            onRequestLinearView={() => setLinearView(true)}
                            onResetPan={() => runCanvasCommand((canvas) => canvas.resetPan())}
                            onSearchQueryChange={(query) => {
                                setSearchQuery(query);
                                setSearchMatchIndex(0);
                            }}
                            onShowWholeGraph={() => restoreWholeGraph()}
                            onZoomIn={() => runCanvasCommand((canvas) => canvas.zoomIn())}
                            onZoomOut={() => runCanvasCommand((canvas) => canvas.zoomOut())}
                            searchMatchCount={searchMatchNodeIds.length}
                            searchMatchIndex={searchMatchIndex}
                            searchQuery={searchQuery}
                        />
                    </div>
                ) : (
                    <Button
                        aria-label="Show workflow tools"
                        className="absolute left-3 top-3 z-30 size-9 rounded-xl bg-background/95 shadow-lg backdrop-blur"
                        disabled={!canvasReady}
                        onClick={() => setToolsOpen(true)}
                        size="icon"
                        title="Show workflow tools"
                        type="button"
                        variant="outline"
                    >
                        <SlidersHorizontal aria-hidden="true" className="size-4" />
                    </Button>
                )}
                <div className="absolute bottom-3 left-3 z-30" hidden={!toolsOpen}>
                    <DocsFlowStoryPlayer
                        compact
                        document={displayFlow.document}
                        initialStoryId={displayFlow.view.story}
                        onHighlightChange={setStoryHighlight}
                    />
                </div>
            </div>
        </section>
    );

    function focusFromNode(nodeId: string, mode: "upstream" | "downstream") {
        const traversal = collectTraversal(displayFlow!.document, nodeId, mode);
        setSelectedNodeId(nodeId);
        setSelectedEdgeId(undefined);
        setFocusMode(mode);
        setFocusedNodeIds(traversal.nodeIds);
        setFocusedEdgeIds(traversal.edgeIds);
        canvasRef.current?.focusNode(nodeId);
    }

    function restoreWholeGraph() {
        setFocusMode("all");
        setFocusedNodeIds(undefined);
        setFocusedEdgeIds(undefined);
        canvasRef.current?.fitView();
    }

    async function exportPng() {
        const element = viewerRef.current?.querySelector<HTMLElement>(".react-flow__viewport") ??
            viewerRef.current?.querySelector<HTMLElement>(".docs-flow-canvas");
        if (!element || exporting) return;
        setExporting(true);
        try {
            const { exportFlowPng } = await import("./DocsFlowExport");
            await exportFlowPng({
                document: displayFlow!.document,
                element,
                layout: displayFlow!.layout,
            });
        } finally {
            setExporting(false);
        }
    }
}

function collectTraversal(
    document: FlowDocument,
    nodeId: string,
    mode: "upstream" | "downstream",
) {
    const nodeIds = new Set([nodeId]);
    const edgeIds = new Set<string>();
    const queue = [nodeId];
    for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index];
        for (const edge of document.edges) {
            if (mode === "upstream" ? edge.to !== current : edge.from !== current) continue;
            const related = mode === "upstream" ? edge.from : edge.to;
            edgeIds.add(edge.id);
            if (!nodeIds.has(related)) {
                nodeIds.add(related);
                queue.push(related);
            }
        }
    }
    return {
        nodeIds: document.nodes.filter((node) => nodeIds.has(node.id)).map((node) => node.id),
        edgeIds: document.edges.filter((edge) => edgeIds.has(edge.id)).map((edge) => edge.id),
    };
}
