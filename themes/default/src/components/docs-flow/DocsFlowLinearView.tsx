import * as React from "react";
import { ExternalLink } from "lucide-react";
import type {
    CompiledFlow,
    FlowDiagnostic,
    FlowDocument,
    FlowEdge,
    FlowLink,
    FlowNode,
    FlowStoryStep,
} from "#smooth-docs/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DocsFlowInspector, { type DocsFlowInspectorTarget } from "./DocsFlowInspector";
import type { FlowEditorAction } from "./flow-editor-reducer";

export type DocsFlowLinearActiveForm = "node-add" | "edge-add" | "lane-add";

export type DocsFlowLinearViewProps = {
    flow: CompiledFlow;
    className?: string;
    showDiagnostics?: boolean;
    onRequestCanvasView?: () => void;
    canvasViewLabel?: string;
    editing?: boolean;
    document?: FlowDocument;
    editDiagnostics?: FlowDiagnostic[];
    activeForm?: DocsFlowLinearActiveForm | null;
    onCommand?: (command: FlowEditorAction) => void;
    onAnnounce?: (message: string) => void;
    onFormComplete?: () => void;
    selectedNodeId?: string;
    onNodeSelect?: (nodeId: string | undefined) => void;
    onFocusUpstream?: (nodeId: string) => void;
    onFocusDownstream?: (nodeId: string) => void;
    onRestoreAll?: () => void;
};

type DocsFlowDiagnosticsProps = {
    diagnostics: FlowDiagnostic[];
    fallbackText?: string;
    showingLastGood?: boolean;
    className?: string;
};

const NODE_TYPE_LABELS: Record<FlowNode["type"], string> = {
    action: "Action",
    decision: "Decision",
    service: "Service",
    external: "External system",
    note: "Note",
};

const EDGE_STYLE_LABELS: Record<NonNullable<FlowEdge["style"]>, string> = {
    normal: "Normal",
    error: "Error path",
    async: "Asynchronous",
};

function safeDomId(value: string) {
    return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

function safeFlowHref(link: FlowLink) {
    const href = link.href;
    if (
        typeof href !== "string" ||
        href.length === 0 ||
        href.trim() !== href ||
        /[\u0000-\u001f\u007f]/.test(href) ||
        href.startsWith("//") ||
        href.startsWith("\\") ||
        /^[A-Za-z]:/.test(href) ||
        /^\/(?:Users|home|private|var\/folders)\//.test(href)
    ) {
        return null;
    }

    const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(href)?.[1]?.toLowerCase();
    if (scheme && scheme !== "http" && scheme !== "https") return null;
    if (link.kind === "external" && !scheme) return null;
    return href;
}

function FlowLinks({ links }: { links?: FlowLink[] }) {
    if (!links || links.length === 0) return null;

    return (
        <div className="mt-3">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Links
            </h5>
            <ul className="mt-1 space-y-1">
                {links.map((link, index) => {
                    const href = safeFlowHref(link);
                    const label = link.label || (href ? link.href : "Unavailable link");
                    return (
                        <li key={`${link.kind}-${index}-${link.href}`}>
                            {href ? (
                                <a
                                    className="inline-flex max-w-full items-center gap-1 break-all text-sm text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    href={href}
                                    rel={link.kind === "external" ? "noreferrer" : undefined}
                                    target={link.kind === "external" ? "_blank" : undefined}
                                >
                                    {label}
                                    {link.kind === "external" ? (
                                        <ExternalLink aria-hidden="true" className="size-3.5" />
                                    ) : null}
                                </a>
                            ) : (
                                <span className="text-sm text-muted-foreground">{label}</span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function NodeDetails({
    node,
    headingId,
    editing,
    onDelete,
    onDuplicate,
    onEdit,
    onReadDetails,
    selected,
}: {
    node: FlowNode;
    headingId: string;
    editing?: boolean;
    onDelete?: () => void;
    onDuplicate?: () => void;
    onEdit?: () => void;
    onReadDetails?: () => void;
    selected?: boolean;
}) {
    const metadata = [
        node.owner ? ["Owner", node.owner] : null,
        node.status ? ["Status", node.status] : null,
        node.risk ? ["Risk", node.risk] : null,
    ].filter((entry): entry is [string, string] => entry !== null);

    return (
        <article aria-labelledby={headingId} className="min-w-0 rounded-lg border bg-card p-4 text-card-foreground">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 id={headingId} className="break-words font-semibold">
                    {node.label}
                </h4>
                <span className="rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {NODE_TYPE_LABELS[node.type]}
                </span>
            </div>
            {node.description ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {node.description}
                </p>
            ) : null}
            {metadata.length > 0 ? (
                <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                    {metadata.map(([term, value]) => (
                        <React.Fragment key={term}>
                            <dt className="font-medium">{term}</dt>
                            <dd className="text-muted-foreground">{value}</dd>
                        </React.Fragment>
                    ))}
                </dl>
            ) : null}
            <FlowLinks links={node.links} />
            {editing ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                    <Button onClick={onEdit} size="sm" type="button" variant="outline">
                        Edit node {node.label}
                    </Button>
                    <Button onClick={onDuplicate} size="sm" type="button" variant="outline">
                        Duplicate node {node.label}
                    </Button>
                    <Button onClick={onDelete} size="sm" type="button" variant="ghost">
                        Delete node {node.label}
                    </Button>
                </div>
            ) : (
                <div className="mt-4 border-t pt-3">
                    <Button
                        aria-pressed={selected}
                        onClick={onReadDetails}
                        size="sm"
                        type="button"
                        variant={selected ? "secondary" : "outline"}
                    >
                        View node details {node.label}
                    </Button>
                </div>
            )}
        </article>
    );
}

function NodeList({
    nodes,
    idPrefix,
    emptyLabel,
    editing,
    onCommand,
    onAnnounce,
    onEditNode,
    onReadNode,
    selectedNodeId,
}: {
    nodes: FlowNode[];
    idPrefix: string;
    emptyLabel: string;
    editing?: boolean;
    onCommand?: (command: FlowEditorAction) => void;
    onAnnounce?: (message: string) => void;
    onEditNode?: (node: FlowNode) => void;
    onReadNode?: (node: FlowNode) => void;
    selectedNodeId?: string;
}) {
    if (nodes.length === 0) {
        return <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>;
    }

    return (
        <ol className="mt-3 space-y-3">
            {nodes.map((node, index) => {
                const headingId = `${idPrefix}-node-${safeDomId(node.id)}-${index}`;
                return (
                    <li key={node.id}>
                        <NodeDetails
                            editing={editing}
                            headingId={headingId}
                            node={node}
                            onDelete={() => {
                                onCommand?.({ type: "node/delete", id: node.id });
                                onAnnounce?.(`Node ${node.label} deleted.`);
                            }}
                            onDuplicate={() => {
                                const { id: _id, ...copy } = node;
                                onCommand?.({
                                    type: "node/add",
                                    node: {
                                        ...copy,
                                        label: `${node.label} copy`,
                                        links: copy.links?.map((link) => ({ ...link })),
                                        position: copy.position
                                            ? { x: copy.position.x + 32, y: copy.position.y + 32 }
                                            : undefined,
                                    },
                                });
                                onAnnounce?.(`Node ${node.label} duplicated.`);
                            }}
                            onEdit={() => onEditNode?.(node)}
                            onReadDetails={() => onReadNode?.(node)}
                            selected={selectedNodeId === node.id}
                        />
                    </li>
                );
            })}
        </ol>
    );
}

function FlowLanes({
    document,
    idPrefix,
    editing,
    onCommand,
    onAnnounce,
    onEditLane,
    onEditNode,
    onReadNode,
    selectedNodeId,
}: {
    document: FlowDocument;
    idPrefix: string;
    editing?: boolean;
    onCommand?: (command: FlowEditorAction) => void;
    onAnnounce?: (message: string) => void;
    onEditLane?: (laneId: string) => void;
    onEditNode?: (node: FlowNode) => void;
    onReadNode?: (node: FlowNode) => void;
    selectedNodeId?: string;
}) {
    const lanes = document.lanes ?? [];
    const knownLaneIds = new Set(lanes.map((lane) => lane.id));
    const unassignedNodes = document.nodes.filter(
        (node) => !node.lane || !knownLaneIds.has(node.lane),
    );

    return (
        <section aria-labelledby={`${idPrefix}-lanes`} className="mt-6">
            <h3 id={`${idPrefix}-lanes`} className="text-lg font-semibold">
                {lanes.length > 0 ? "Lanes and nodes" : "Nodes"}
            </h3>
            <div className="mt-3 space-y-5">
                {lanes.map((lane, laneIndex) => {
                    const laneHeadingId = `${idPrefix}-lane-${safeDomId(lane.id)}-${laneIndex}`;
                    const laneNodes = document.nodes.filter((node) => node.lane === lane.id);
                    return (
                        <section
                            key={lane.id}
                            aria-labelledby={laneHeadingId}
                            className="min-w-0 rounded-xl border bg-muted/20 p-4"
                        >
                            <h4 id={laneHeadingId} className="font-semibold">
                                {lane.label}
                            </h4>
                            {lane.description ? (
                                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                                    {lane.description}
                                </p>
                            ) : null}
                            {editing ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Button
                                        onClick={() => onEditLane?.(lane.id)}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        Edit lane {lane.label}
                                    </Button>
                                    <Button
                                        disabled={laneIndex === 0}
                                        onClick={() => {
                                            onCommand?.({
                                                type: "lane/reorder",
                                                id: lane.id,
                                                toIndex: laneIndex - 1,
                                            });
                                            onAnnounce?.(`Lane ${lane.label} moved earlier.`);
                                        }}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        Move lane {lane.label} earlier
                                    </Button>
                                    <Button
                                        disabled={laneIndex === lanes.length - 1}
                                        onClick={() => {
                                            onCommand?.({
                                                type: "lane/reorder",
                                                id: lane.id,
                                                toIndex: laneIndex + 1,
                                            });
                                            onAnnounce?.(`Lane ${lane.label} moved later.`);
                                        }}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        Move lane {lane.label} later
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            onCommand?.({ type: "lane/delete", id: lane.id });
                                            onAnnounce?.(`Lane ${lane.label} deleted; its nodes are now unassigned.`);
                                        }}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        Delete lane {lane.label}
                                    </Button>
                                </div>
                            ) : null}
                            <NodeList
                                editing={editing}
                                emptyLabel="No nodes in this lane."
                                idPrefix={laneHeadingId}
                                nodes={laneNodes}
                                onAnnounce={onAnnounce}
                                onCommand={onCommand}
                                onEditNode={onEditNode}
                                onReadNode={onReadNode}
                                selectedNodeId={selectedNodeId}
                            />
                        </section>
                    );
                })}

                {unassignedNodes.length > 0 ? (
                    <section
                        aria-labelledby={`${idPrefix}-unassigned`}
                        className="min-w-0 rounded-xl border bg-muted/20 p-4"
                    >
                        <h4 id={`${idPrefix}-unassigned`} className="font-semibold">
                            {lanes.length > 0 ? "Unassigned nodes" : "Workflow nodes"}
                        </h4>
                        <NodeList
                            editing={editing}
                            emptyLabel="No unassigned nodes."
                            idPrefix={`${idPrefix}-unassigned`}
                            nodes={unassignedNodes}
                            onAnnounce={onAnnounce}
                            onCommand={onCommand}
                            onEditNode={onEditNode}
                            onReadNode={onReadNode}
                            selectedNodeId={selectedNodeId}
                        />
                    </section>
                ) : null}
            </div>
        </section>
    );
}

function edgeSummary(edge: FlowEdge, nodes: Map<string, FlowNode>) {
    const from = nodes.get(edge.from)?.label ?? edge.from;
    const to = nodes.get(edge.to)?.label ?? edge.to;
    return `${from} to ${to}`;
}

function FlowEdges({
    document,
    idPrefix,
    editing,
    onCommand,
    onAnnounce,
    onEditEdge,
}: {
    document: FlowDocument;
    idPrefix: string;
    editing?: boolean;
    onCommand?: (command: FlowEditorAction) => void;
    onAnnounce?: (message: string) => void;
    onEditEdge?: (edgeId: string) => void;
}) {
    const nodes = new Map(document.nodes.map((node) => [node.id, node]));

    return (
        <section aria-labelledby={`${idPrefix}-edges`} className="mt-6">
            <h3 id={`${idPrefix}-edges`} className="text-lg font-semibold">
                Connections
            </h3>
            {document.edges.length > 0 ? (
                <ol className="mt-3 space-y-2">
                    {document.edges.map((edge) => {
                        const accessibleName = edge.label || edgeSummary(edge, nodes);
                        return (
                        <li className="min-w-0 break-words rounded-lg border px-4 py-3 text-sm" key={edge.id}>
                            <span className="font-medium">{edgeSummary(edge, nodes)}</span>
                            {edge.label ? <span className="ml-2">— {edge.label}</span> : null}
                            <span className="ml-2 text-muted-foreground">
                                ({EDGE_STYLE_LABELS[edge.style ?? "normal"]})
                            </span>
                            {editing ? (
                                <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                                    <Button
                                        onClick={() => onEditEdge?.(edge.id)}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        Edit connection {accessibleName}
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            onCommand?.({ type: "edge/delete", id: edge.id });
                                            onAnnounce?.(`Connection ${accessibleName} deleted.`);
                                        }}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        Delete connection {accessibleName}
                                    </Button>
                                </div>
                            ) : null}
                        </li>
                        );
                    })}
                </ol>
            ) : (
                <p className="mt-3 text-sm text-muted-foreground">No connections.</p>
            )}
        </section>
    );
}

function storyStepLabel(
    step: FlowStoryStep,
    nodes: Map<string, FlowNode>,
    edges: Map<string, FlowEdge>,
) {
    if ("node" in step) return `Node: ${nodes.get(step.node)?.label ?? step.node}`;
    const edge = edges.get(step.edge);
    return edge ? `Connection: ${edge.label || edgeSummary(edge, nodes)}` : `Connection: ${step.edge}`;
}

function FlowStories({ document, idPrefix }: { document: FlowDocument; idPrefix: string }) {
    const stories = document.stories ?? [];
    if (stories.length === 0) return null;

    const nodes = new Map(document.nodes.map((node) => [node.id, node]));
    const edges = new Map(document.edges.map((edge) => [edge.id, edge]));

    return (
        <section aria-labelledby={`${idPrefix}-stories`} className="mt-6">
            <h3 id={`${idPrefix}-stories`} className="text-lg font-semibold">
                Named paths
            </h3>
            <ol className="mt-3 space-y-4">
                {stories.map((story, storyIndex) => {
                    const headingId = `${idPrefix}-story-${safeDomId(story.id)}-${storyIndex}`;
                    return (
                        <li className="rounded-lg border p-4" key={story.id}>
                            <h4 id={headingId} className="font-semibold">
                                {story.label}
                            </h4>
                            {story.description ? (
                                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                                    {story.description}
                                </p>
                            ) : null}
                            <ol aria-labelledby={headingId} className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                                {story.steps.map((step, stepIndex) => (
                                    <li key={`${story.id}-${stepIndex}`}>
                                        {storyStepLabel(step, nodes, edges)}
                                    </li>
                                ))}
                            </ol>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

export function DocsFlowDiagnostics({
    diagnostics,
    fallbackText,
    showingLastGood = false,
    className,
}: DocsFlowDiagnosticsProps) {
    if (diagnostics.length === 0 && !fallbackText) return null;
    const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "error");

    return (
        <aside
            aria-live={hasErrors ? "assertive" : "polite"}
            className={cn(
                "rounded-lg border p-4 text-sm",
                hasErrors
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-border bg-muted/40 text-foreground",
                className,
            )}
            role={hasErrors ? "alert" : "status"}
        >
            <p className="font-semibold">
                {hasErrors ? "This workflow could not be updated." : "Workflow notice"}
            </p>
            {showingLastGood ? (
                <p className="mt-1">The last valid diagram remains visible while this is corrected.</p>
            ) : null}
            {diagnostics.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                    {diagnostics.map((diagnostic, index) => {
                        const location =
                            diagnostic.line !== undefined
                                ? ` (line ${diagnostic.line}${
                                      diagnostic.column !== undefined
                                          ? `, column ${diagnostic.column}`
                                          : ""
                                  })`
                                : "";
                        return (
                            <li key={`${diagnostic.code}-${diagnostic.subjectId ?? "flow"}-${index}`}>
                                {diagnostic.message}
                                {location}
                            </li>
                        );
                    })}
                </ul>
            ) : null}
            {fallbackText ? (
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-background/80 p-3 font-mono text-xs text-foreground">
                    {fallbackText}
                </pre>
            ) : null}
        </aside>
    );
}

export default function DocsFlowLinearView({
    flow,
    className,
    showDiagnostics = true,
    onRequestCanvasView,
    canvasViewLabel = "View interactive diagram",
    editing = false,
    document: documentOverride,
    editDiagnostics,
    activeForm,
    onCommand,
    onAnnounce,
    onFormComplete,
    selectedNodeId,
    onNodeSelect,
    onFocusUpstream,
    onFocusDownstream,
    onRestoreAll,
}: DocsFlowLinearViewProps) {
    const reactId = React.useId();
    const idPrefix = `docs-flow-linear-${safeDomId(flow.embedId)}-${safeDomId(reactId)}`;
    const document = documentOverride ?? flow.document;
    const [inspectorTarget, setInspectorTarget] = React.useState<DocsFlowInspectorTarget | null>(null);
    const [announcement, setAnnouncement] = React.useState("");
    const [localSelectedNodeId, setLocalSelectedNodeId] = React.useState<string | undefined>();
    const editable = editing && Boolean(onCommand);
    const readerSelectedNodeId = onNodeSelect ? selectedNodeId : localSelectedNodeId;

    React.useEffect(() => {
        if (!editable || !activeForm) return;
        const kind = activeForm === "node-add" ? "node" : activeForm === "edge-add" ? "edge" : "lane";
        setInspectorTarget({ kind, mode: "add" });
    }, [activeForm, editable]);

    const announce = React.useCallback((message: string) => {
        setAnnouncement(message);
        onAnnounce?.(message);
    }, [onAnnounce]);

    const closeInspector = React.useCallback(() => {
        setInspectorTarget(null);
        onFormComplete?.();
    }, [onFormComplete]);

    const selectReaderNode = React.useCallback((nodeId: string | undefined) => {
        if (!onNodeSelect) setLocalSelectedNodeId(nodeId);
        onNodeSelect?.(nodeId);
    }, [onNodeSelect]);

    if (!document) {
        return (
            <section className={cn("not-prose my-6 min-w-0 max-w-full overflow-hidden", className)} aria-labelledby={`${idPrefix}-unavailable`}>
                <h2 id={`${idPrefix}-unavailable`} className="text-lg font-semibold">
                    Workflow unavailable
                </h2>
                <DocsFlowDiagnostics
                    className="mt-3"
                    diagnostics={flow.diagnostics}
                    fallbackText={flow.fallbackText}
                />
            </section>
        );
    }

    return (
        <section className={cn("not-prose my-6 min-w-0 max-w-full overflow-hidden", className)} aria-labelledby={`${idPrefix}-title`}>
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 id={`${idPrefix}-title`} className="text-xl font-semibold">
                        {document.title}
                    </h2>
                    {document.description ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                            {document.description}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                    {editable ? (
                        <Button
                            onClick={() => setInspectorTarget({ kind: "lane", mode: "add" })}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            Add lane
                        </Button>
                    ) : null}
                    {onRequestCanvasView ? (
                        <Button onClick={onRequestCanvasView} size="sm" type="button" variant="outline">
                            {canvasViewLabel}
                        </Button>
                    ) : null}
                </div>
            </header>

            {editable ? (
                <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
                    {announcement}
                </p>
            ) : null}

            {showDiagnostics ? (
                <DocsFlowDiagnostics
                    className="mt-4"
                    diagnostics={flow.diagnostics}
                    fallbackText={flow.fallbackText}
                />
            ) : null}
            {editable && inspectorTarget ? (
                <DocsFlowInspector
                    diagnostics={editDiagnostics ?? flow.diagnostics}
                    document={document}
                    key={`${inspectorTarget.kind}-${inspectorTarget.mode}-${inspectorTarget.id ?? "new"}`}
                    onAnnounce={announce}
                    onCancel={closeInspector}
                    onCommand={onCommand!}
                    target={inspectorTarget}
                />
            ) : null}
            {!editable && readerSelectedNodeId ? (
                <DocsFlowInspector
                    document={document}
                    mode="read"
                    nodeId={readerSelectedNodeId}
                    onFocusDownstream={onFocusDownstream ? (nodeId) => {
                        onFocusDownstream(nodeId);
                        announce(`Showing nodes downstream from ${document.nodes.find((node) => node.id === nodeId)?.label ?? nodeId}.`);
                    } : undefined}
                    onFocusUpstream={onFocusUpstream ? (nodeId) => {
                        onFocusUpstream(nodeId);
                        announce(`Showing nodes upstream from ${document.nodes.find((node) => node.id === nodeId)?.label ?? nodeId}.`);
                    } : undefined}
                    onRestoreAll={onRestoreAll ? () => {
                        onRestoreAll();
                        announce("Showing the whole graph.");
                    } : undefined}
                    onSelectNode={selectReaderNode}
                />
            ) : null}
            <FlowLanes
                document={document}
                editing={editable}
                idPrefix={idPrefix}
                onAnnounce={announce}
                onCommand={onCommand}
                onEditLane={(id) => setInspectorTarget({ kind: "lane", mode: "edit", id })}
                onEditNode={(node) => setInspectorTarget({ kind: "node", mode: "edit", id: node.id })}
                onReadNode={(node) => selectReaderNode(node.id)}
                selectedNodeId={readerSelectedNodeId}
            />
            <FlowEdges
                document={document}
                editing={editable}
                idPrefix={idPrefix}
                onAnnounce={announce}
                onCommand={onCommand}
                onEditEdge={(id) => setInspectorTarget({ kind: "edge", mode: "edit", id })}
            />
            <FlowStories document={document} idPrefix={idPrefix} />
        </section>
    );
}
