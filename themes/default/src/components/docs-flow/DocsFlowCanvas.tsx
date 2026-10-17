import * as React from "react";
import {
    Background,
    BackgroundVariant,
    MarkerType,
    ReactFlow,
    type Connection,
    type EdgeTypes,
    type NodeTypes,
    type ReactFlowInstance,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { CompiledFlowLayout, FlowDocument, FlowEdgeStyle, FlowNode } from "#smooth-docs/types";
import {
    DocsFlowEdge,
    type DocsFlowCanvasEdge,
    type DocsFlowEdgeData,
} from "./DocsFlowEdge";
import {
    DocsFlowLaneNode,
    DocsFlowNode,
    type DocsFlowContentCanvasNode,
    type DocsFlowLaneCanvasNode,
} from "./DocsFlowNode";

export type DocsFlowCanvasNode = DocsFlowContentCanvasNode | DocsFlowLaneCanvasNode;

export type DocsFlowCanvasProps = {
    className?: string;
    document: FlowDocument;
    editable?: boolean;
    height?: number | string;
    layout: CompiledFlowLayout;
    onConnect?: (connection: Connection) => void;
    onEdgeDelete?: (edgeId: string) => void;
    onEdgeReconnect?: (edgeId: string, connection: Connection) => void;
    onEdgeSelect?: (edgeId: string | undefined) => void;
    onNodeDelete?: (nodeId: string) => void;
    onNodeMove?: (nodeId: string, position: { x: number; y: number }) => void;
    onNodeSelect?: (nodeId: string | undefined) => void;
    selectedEdgeId?: string;
    selectedNodeId?: string;
    searchMatchNodeIds?: string[];
    focusedEdgeIds?: string[];
    focusedNodeIds?: string[];
    storyActiveEdgeIds?: string[];
    storyActiveNodeIds?: string[];
    storyCurrentEdgeId?: string;
    storyCurrentNodeId?: string;
    storyPlaying?: boolean;
    storyMotion?: "animated" | "instant";
};

export type DocsFlowCanvasHandle = {
    zoomIn: () => void;
    zoomOut: () => void;
    resetPan: () => void;
    fitView: () => void;
    focusNode: (nodeId: string) => void;
};

export type DocsFlowTraversalMode = "all" | "direct" | "upstream" | "downstream";

export type DocsFlowTraversal = {
    nodeIds: string[];
    edgeIds: string[];
};

export type DocsFlowCanvasProjection = {
    edges: DocsFlowCanvasEdge[];
    nodes: DocsFlowCanvasNode[];
};

const nodeTypes = {
    docsFlowLane: DocsFlowLaneNode,
    docsFlowNode: DocsFlowNode,
} satisfies NodeTypes;

const edgeTypes = {
    docsFlowEdge: DocsFlowEdge,
} satisfies EdgeTypes;

const fitViewOptions = { padding: 0.16, maxZoom: 1.25 } as const;

export function projectFlowToReactFlow(
    document: FlowDocument,
    layout: CompiledFlowLayout,
    selection: {
        editable?: boolean;
        selectedEdgeId?: string;
        selectedNodeId?: string;
        searchMatchNodeIds?: string[];
        focusedEdgeIds?: string[];
        focusedNodeIds?: string[];
        storyActiveEdgeIds?: string[];
        storyActiveNodeIds?: string[];
        storyCurrentEdgeId?: string;
        storyCurrentNodeId?: string;
        storyPlaying?: boolean;
        storyMotion?: "animated" | "instant";
    } = {},
): DocsFlowCanvasProjection {
    const lanesById = new Map((document.lanes ?? []).map((lane) => [lane.id, lane]));
    const nodeLabelsById = new Map(document.nodes.map((node) => [node.id, node.label]));
    const searchMatches = new Set(selection.searchMatchNodeIds ?? []);
    const focusedNodes =
        selection.focusedNodeIds === undefined ? undefined : new Set(selection.focusedNodeIds);
    const focusedEdges =
        selection.focusedEdgeIds === undefined ? undefined : new Set(selection.focusedEdgeIds);
    const storyNodes = new Set(selection.storyActiveNodeIds ?? []);
    const storyEdges = new Set(selection.storyActiveEdgeIds ?? []);
    const laneNodes: DocsFlowLaneCanvasNode[] = [];

    for (const lane of document.lanes ?? []) {
        const box = layout.lanes[lane.id];
        if (!box) continue;
        laneNodes.push({
            id: `lane:${lane.id}`,
            type: "docsFlowLane",
            position: { x: box.x, y: box.y },
            data: { lane },
            style: { width: box.width, height: box.height },
            selectable: false,
            draggable: false,
            connectable: false,
            focusable: false,
            deletable: false,
            zIndex: 0,
            ariaLabel: `Lane: ${lane.label}`,
        });
    }

    const contentNodes: DocsFlowContentCanvasNode[] = [];
    for (const [nodeIndex, node] of document.nodes.entries()) {
        const box = layout.nodes[node.id];
        if (!box) continue;
        const laneBox = node.lane ? layout.lanes[node.lane] : undefined;
        const hasLaneParent = Boolean(node.lane && lanesById.has(node.lane) && laneBox);
        const isFocused = focusedNodes === undefined || focusedNodes.has(node.id);
        const isSearchMatch = searchMatches.has(node.id);
        contentNodes.push({
            id: node.id,
            type: "docsFlowNode",
            position: {
                x: hasLaneParent ? box.x - laneBox!.x : box.x,
                y: hasLaneParent ? box.y - laneBox!.y : box.y,
            },
            data: { direction: layout.direction, node },
            style: { width: box.width, height: box.height },
            parentId: hasLaneParent ? `lane:${node.lane}` : undefined,
            extent: hasLaneParent ? "parent" : undefined,
            selectable: true,
            draggable: Boolean(selection.editable),
            connectable: Boolean(selection.editable),
            focusable: true,
            deletable: Boolean(selection.editable),
            selected: node.id === selection.selectedNodeId,
            className: cn(
                "transition-opacity",
                !isFocused && "opacity-20",
                isSearchMatch && "rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background",
                storyNodes.has(node.id) && "docs-flow-story-active",
                selection.storyPlaying && selection.storyCurrentNodeId === node.id && "docs-flow-story-current",
            ),
            zIndex: isSearchMatch || node.id === selection.selectedNodeId ? 3 : 1,
            ariaLabel: nodeAriaLabel(node, lanesById.get(node.lane ?? "")?.label),
            domAttributes: {
                "aria-posinset": nodeIndex + 1,
                "aria-setsize": document.nodes.length,
            },
        });
    }

    const edges: DocsFlowCanvasEdge[] = document.edges.map((edge) => {
        const meaning: FlowEdgeStyle = edge.style ?? "normal";
        const storyState = selection.storyCurrentEdgeId === edge.id
            ? "current"
            : storyEdges.has(edge.id)
              ? "completed"
              : undefined;
        const data: DocsFlowEdgeData = {
            edge,
            meaning,
            storyState,
            storyMotion: selection.storyMotion ?? "animated",
            storyPlaying: Boolean(selection.storyPlaying),
        };
        const isFocused = focusedEdges === undefined || focusedEdges.has(edge.id);
        return {
            id: edge.id,
            type: "docsFlowEdge",
            source: edge.from,
            target: edge.to,
            data,
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 18,
                height: 18,
                color: storyState ? "hsl(var(--primary))" : undefined,
            },
            animated: meaning === "async" || (storyState === "current" && selection.storyPlaying && selection.storyMotion !== "instant"),
            selectable: true,
            focusable: true,
            deletable: Boolean(selection.editable),
            selected: edge.id === selection.selectedEdgeId,
            className: cn(
                "transition-opacity",
                !isFocused && "opacity-15",
                storyEdges.has(edge.id) && "docs-flow-story-active",
            ),
            zIndex: 2,
            ariaLabel: edgeAriaLabel(
                nodeLabelsById.get(edge.from) ?? edge.from,
                nodeLabelsById.get(edge.to) ?? edge.to,
                edge.label,
                meaning,
            ),
        };
    });

    return { nodes: [...laneNodes, ...contentNodes], edges };
}

const DocsFlowCanvas = React.memo(React.forwardRef<DocsFlowCanvasHandle, DocsFlowCanvasProps>(function DocsFlowCanvas({
    className,
    document,
    editable = false,
    height = 560,
    layout,
    onConnect,
    onEdgeDelete,
    onEdgeReconnect,
    onEdgeSelect,
    onNodeDelete,
    onNodeMove,
    onNodeSelect,
    selectedEdgeId,
    selectedNodeId,
    searchMatchNodeIds,
    focusedEdgeIds,
    focusedNodeIds,
    storyActiveEdgeIds,
    storyActiveNodeIds,
    storyCurrentEdgeId,
    storyCurrentNodeId,
    storyPlaying = false,
    storyMotion = "animated",
}: DocsFlowCanvasProps, forwardedRef) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const instanceRef = React.useRef<ReactFlowInstance<DocsFlowCanvasNode, DocsFlowCanvasEdge> | null>(null);
    const previousHadFocusSubset = React.useRef(false);
    const projection = React.useMemo(
        () =>
            projectFlowToReactFlow(document, layout, {
                editable,
                selectedEdgeId,
                selectedNodeId,
                searchMatchNodeIds,
                focusedEdgeIds,
                focusedNodeIds,
                storyActiveEdgeIds,
                storyActiveNodeIds,
                storyCurrentEdgeId,
                storyCurrentNodeId,
                storyPlaying,
                storyMotion,
            }),
        [
            document,
            editable,
            focusedEdgeIds,
            focusedNodeIds,
            layout,
            searchMatchNodeIds,
            selectedEdgeId,
            selectedNodeId,
            storyActiveEdgeIds,
            storyActiveNodeIds,
            storyCurrentEdgeId,
            storyCurrentNodeId,
            storyPlaying,
            storyMotion,
        ],
    );
    const animationDuration = prefersReducedMotion() ? 0 : 180;
    const fitView = React.useCallback(() => {
        void instanceRef.current?.fitView({ ...fitViewOptions, duration: animationDuration });
    }, [animationDuration]);
    const focusNode = React.useCallback(
        (nodeId: string) => {
            const box = layout.nodes[nodeId];
            const instance = instanceRef.current;
            if (box && instance) {
                void instance.setCenter(box.x + box.width / 2, box.y + box.height / 2, {
                    duration: animationDuration,
                    zoom: Math.max(instance.getZoom(), 1),
                });
            }
            window.requestAnimationFrame(() => {
                containerRef.current
                    ?.querySelector<HTMLElement>(`[data-id="${nodeId}"]`)
                    ?.focus();
            });
        },
        [animationDuration, layout.nodes],
    );
    React.useImperativeHandle(
        forwardedRef,
        () => ({
            zoomIn: () => {
                void instanceRef.current?.zoomIn({ duration: animationDuration });
            },
            zoomOut: () => {
                void instanceRef.current?.zoomOut({ duration: animationDuration });
            },
            resetPan: () => {
                const instance = instanceRef.current;
                if (!instance) return;
                const viewport = instance.getViewport();
                void instance.setViewport(
                    { x: 0, y: 0, zoom: viewport.zoom },
                    { duration: animationDuration },
                );
            },
            fitView,
            focusNode,
        }),
        [animationDuration, fitView, focusNode],
    );

    React.useEffect(() => {
        if (selectedNodeId) focusNode(selectedNodeId);
    }, [focusNode, selectedNodeId]);

    React.useEffect(() => {
        const hasFocusSubset = focusedNodeIds !== undefined || focusedEdgeIds !== undefined;
        if (previousHadFocusSubset.current && !hasFocusSubset) fitView();
        previousHadFocusSubset.current = hasFocusSubset;
    }, [fitView, focusedEdgeIds, focusedNodeIds]);
    const handleNodeClick = React.useCallback(
        (_event: React.MouseEvent, node: DocsFlowCanvasNode) => {
            if (node.type === "docsFlowNode") onNodeSelect?.(node.id);
        },
        [onNodeSelect],
    );
    const handleEdgeClick = React.useCallback(
        (_event: React.MouseEvent, edge: DocsFlowCanvasEdge) => onEdgeSelect?.(edge.id),
        [onEdgeSelect],
    );
    const clearSelection = React.useCallback(() => {
        onNodeSelect?.(undefined);
        onEdgeSelect?.(undefined);
    }, [onEdgeSelect, onNodeSelect]);
    const handleNodeDragStop = React.useCallback(
        (_event: MouseEvent | TouchEvent, node: DocsFlowCanvasNode) => {
            if (!editable || node.type !== "docsFlowNode") return;
            const laneId = document.nodes.find((item) => item.id === node.id)?.lane;
            const laneBox = laneId ? layout.lanes[laneId] : undefined;
            onNodeMove?.(node.id, {
                x: node.position.x + (laneBox?.x ?? 0),
                y: node.position.y + (laneBox?.y ?? 0),
            });
        },
        [document.nodes, editable, layout.lanes, onNodeMove],
    );
    const handleKeyboardNavigation = React.useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
                return;
            }
            const current = (event.target as HTMLElement).closest<HTMLElement>("[aria-posinset]");
            if (!current) return;
            const currentPosition = Number(current.getAttribute("aria-posinset"));
            if (!Number.isInteger(currentPosition)) return;
            const currentIndex = currentPosition - 1;

            let nextIndex = currentIndex;
            if (event.key === "Home") nextIndex = 0;
            else if (event.key === "End") nextIndex = document.nodes.length - 1;
            else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = currentIndex - 1;
            else nextIndex = currentIndex + 1;
            nextIndex = Math.max(0, Math.min(document.nodes.length - 1, nextIndex));
            const nextNode = document.nodes[nextIndex];
            if (!nextNode || nextIndex === currentIndex) return;

            event.preventDefault();
            onNodeSelect?.(nextNode.id);
            focusNode(nextNode.id);
        },
        [document.nodes, focusNode, onNodeSelect],
    );

    return (
        <div
            ref={containerRef}
            className={cn(
                "docs-flow-canvas not-prose relative w-full overflow-hidden rounded-xl border bg-background",
                className,
            )}
            style={{ height }}
            role='region'
            onKeyDownCapture={handleKeyboardNavigation}
            aria-label={`${document.title} workflow diagram`}
            data-story-motion={storyMotion}>
            <ReactFlow<DocsFlowCanvasNode, DocsFlowCanvasEdge>
                nodes={projection.nodes}
                edges={projection.edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                nodesDraggable={editable}
                nodesConnectable={editable}
                edgesReconnectable={editable}
                elementsSelectable
                nodesFocusable
                edgesFocusable
                deleteKeyCode={editable ? ["Backspace", "Delete"] : null}
                selectionKeyCode={null}
                multiSelectionKeyCode={null}
                panOnDrag
                panOnScroll
                zoomOnDoubleClick={false}
                minZoom={0.1}
                maxZoom={2}
                fitView
                fitViewOptions={fitViewOptions}
                onInit={(instance) => {
                    instanceRef.current = instance;
                    if (selectedNodeId) focusNode(selectedNodeId);
                }}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onConnect={(connection) => editable && onConnect?.(connection)}
                onEdgesDelete={(edges) => {
                    if (!editable) return;
                    edges.forEach((edge) => onEdgeDelete?.(edge.id));
                }}
                onReconnect={(edge, connection) =>
                    editable && onEdgeReconnect?.(edge.id, connection)
                }
                onNodeDragStop={handleNodeDragStop}
                onPaneClick={clearSelection}
                onNodesDelete={(nodes) => {
                    if (!editable) return;
                    nodes.forEach((node) => {
                        if (node.type === "docsFlowNode") onNodeDelete?.(node.id);
                    });
                }}
                aria-label={`${document.title} interactive workflow canvas`}>
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            </ReactFlow>
        </div>
    );
}));

DocsFlowCanvas.displayName = "DocsFlowCanvas";

export function collectFlowTraversal(
    document: FlowDocument,
    nodeId: string,
    mode: DocsFlowTraversalMode,
): DocsFlowTraversal {
    if (mode === "all") {
        return {
            nodeIds: document.nodes.map((node) => node.id),
            edgeIds: document.edges.map((edge) => edge.id),
        };
    }
    if (!document.nodes.some((node) => node.id === nodeId)) return { nodeIds: [], edgeIds: [] };

    const nodeIds = new Set([nodeId]);
    const edgeIds = new Set<string>();
    if (mode === "direct") {
        for (const edge of document.edges) {
            if (edge.from !== nodeId && edge.to !== nodeId) continue;
            edgeIds.add(edge.id);
            nodeIds.add(edge.from);
            nodeIds.add(edge.to);
        }
    } else {
        const queue = [nodeId];
        for (let index = 0; index < queue.length; index += 1) {
            const current = queue[index];
            for (const edge of document.edges) {
                const adjacent =
                    mode === "upstream" && edge.to === current
                        ? edge.from
                        : mode === "downstream" && edge.from === current
                          ? edge.to
                          : undefined;
                if (!adjacent) continue;
                edgeIds.add(edge.id);
                if (nodeIds.has(adjacent)) continue;
                nodeIds.add(adjacent);
                queue.push(adjacent);
            }
        }
    }

    return {
        nodeIds: document.nodes.filter((node) => nodeIds.has(node.id)).map((node) => node.id),
        edgeIds: document.edges.filter((edge) => edgeIds.has(edge.id)).map((edge) => edge.id),
    };
}

function prefersReducedMotion() {
    return typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function nodeAriaLabel(node: FlowNode, laneLabel?: string) {
    const details = [
        `${node.type} node: ${node.label}`,
        laneLabel ? `Lane: ${laneLabel}` : null,
        node.status ? `Status: ${node.status}` : null,
        node.risk ? `Risk: ${node.risk}` : null,
    ].filter(Boolean);
    return details.join(". ");
}

function edgeAriaLabel(
    source: string,
    target: string,
    label: string | undefined,
    meaning: FlowEdgeStyle,
) {
    const meaningLabel = meaning === "error" ? "Error path" : meaning === "async" ? "Async" : "Flow";
    return `${meaningLabel} edge from ${source} to ${target}${label ? `: ${label}` : ""}`;
}

export default DocsFlowCanvas;
