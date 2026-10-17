import * as React from "react";
import {
    ArrowLeftToLine,
    ArrowRightToLine,
    ChevronLeft,
    ChevronRight,
    Columns3,
    GitBranchPlus,
    LayoutDashboard,
    ListTree,
    ListVideo,
    LocateFixed,
    Maximize2,
    Network,
    Plus,
    Redo2,
    RotateCcw,
    Save,
    Search,
    SquarePen,
    ImageDown,
    Eye,
    Pencil,
    PanelTopClose,
    Undo2,
    X,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import type { FlowEditorStatus, FlowFocusMode } from "#smooth-docs/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DocsFlowToolbarProps = {
    className?: string;
    editing?: boolean;
    status?: FlowEditorStatus;
    canEdit?: boolean;
    canAddNode?: boolean;
    canAddConnection?: boolean;
    canAutoLayout?: boolean;
    canEditSelection?: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
    canSave?: boolean;
    canDiscard?: boolean;
    busy?: boolean;
    editButtonRef?: React.Ref<HTMLButtonElement>;
    editLabelParts?: readonly [string, string];
    searchQuery?: string;
    searchMatchIndex?: number;
    searchMatchCount?: number;
    focusMode?: FlowFocusMode;
    linearView?: boolean;
    onEdit?: () => void;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onResetPan?: () => void;
    onFitView?: () => void;
    onSearchQueryChange?: (query: string) => void;
    onPreviousMatch?: () => void;
    onNextMatch?: () => void;
    onShowWholeGraph?: () => void;
    onFocusUpstream?: () => void;
    onFocusDownstream?: () => void;
    onRequestLinearView?: () => void;
    onRequestCanvasView?: () => void;
    onExportPng?: () => void;
    exporting?: boolean;
    compact?: boolean;
    onCloseTools?: () => void;
    onAddNode?: () => void;
    onAddConnection?: () => void;
    onManageLanes?: () => void;
    onEditSelection?: () => void;
    onEditStories?: () => void;
    onAutoLayout?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onSave?: () => void;
    onDiscard?: () => void;
    onCloseEditor?: () => void;
};

const STATUS_LABELS: Record<FlowEditorStatus, string> = {
    closed: "Editor closed",
    loading: "Loading flow source",
    clean: "No unsaved changes",
    dirty: "Unsaved changes",
    saving: "Saving changes",
    conflict: "Conflict requires attention",
    error: "Editor error",
};

export default function DocsFlowToolbar({
    className,
    editing = false,
    status = "closed",
    canEdit = false,
    canAddNode = true,
    canAddConnection = true,
    canAutoLayout = true,
    canEditSelection = false,
    canUndo = false,
    canRedo = false,
    canSave = false,
    canDiscard = false,
    busy = false,
    editButtonRef,
    editLabelParts,
    searchQuery = "",
    searchMatchIndex = 0,
    searchMatchCount = 0,
    focusMode = "all",
    linearView = false,
    onEdit,
    onZoomIn,
    onZoomOut,
    onResetPan,
    onFitView,
    onSearchQueryChange,
    onPreviousMatch,
    onNextMatch,
    onShowWholeGraph,
    onFocusUpstream,
    onFocusDownstream,
    onRequestLinearView,
    onRequestCanvasView,
    onExportPng,
    exporting = false,
    compact = false,
    onCloseTools,
    onAddNode,
    onAddConnection,
    onManageLanes,
    onEditSelection,
    onEditStories,
    onAutoLayout,
    onUndo,
    onRedo,
    onSave,
    onDiscard,
    onCloseEditor,
}: DocsFlowToolbarProps) {
    if (!editing) {
        const normalizedMatchIndex =
            searchMatchCount > 0
                ? ((searchMatchIndex % searchMatchCount) + searchMatchCount) % searchMatchCount
                : 0;
        const matchStatus = searchQuery.trim()
            ? searchMatchCount > 0
                ? `${normalizedMatchIndex + 1} of ${searchMatchCount} matches`
                : "No matches"
            : "Search nodes by label or description";

        if (compact) {
            const iconButton = "size-8 shrink-0";
            return (
                <div
                    aria-label="Workflow reader controls"
                    role="toolbar"
                    className={cn(
                        "flex max-w-full items-center gap-1 rounded-xl border bg-background/95 p-1.5 shadow-xl backdrop-blur",
                        className,
                    )}
                    data-flow-export-exclude="true"
                >
                    <Button aria-label="View mode" aria-pressed="true" className={iconButton} size="icon" type="button" variant="secondary">
                        <Eye aria-hidden="true" className="size-4" />
                    </Button>
                    {canEdit && onEdit && editLabelParts ? (
                        <Button
                            ref={editButtonRef}
                            aria-label={editLabelParts.join(" ")}
                            className={iconButton}
                            onClick={onEdit}
                            size="icon"
                            title={editLabelParts.join(" ")}
                            type="button"
                            variant="ghost"
                        >
                            <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                    ) : null}
                    <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
                    {onZoomIn ? <Button aria-label="Zoom in" className={iconButton} onClick={onZoomIn} size="icon" title="Zoom in" type="button" variant="ghost"><ZoomIn aria-hidden="true" className="size-4" /></Button> : null}
                    {onZoomOut ? <Button aria-label="Zoom out" className={iconButton} onClick={onZoomOut} size="icon" title="Zoom out" type="button" variant="ghost"><ZoomOut aria-hidden="true" className="size-4" /></Button> : null}
                    {onResetPan ? <Button aria-label="Reset pan" className={iconButton} onClick={onResetPan} size="icon" title="Reset pan" type="button" variant="ghost"><LocateFixed aria-hidden="true" className="size-4" /></Button> : null}
                    {onFitView ? <Button aria-label="Fit diagram" className={iconButton} onClick={onFitView} size="icon" title="Fit diagram" type="button" variant="ghost"><Maximize2 aria-hidden="true" className="size-4" /></Button> : null}
                    {onShowWholeGraph ? <Button aria-label="Show whole graph" aria-pressed={focusMode === "all"} className={iconButton} onClick={onShowWholeGraph} size="icon" title="Show whole graph" type="button" variant={focusMode === "all" ? "secondary" : "ghost"}><Network aria-hidden="true" className="size-4" /></Button> : null}
                    {onFocusUpstream ? <Button aria-label="Focus upstream" className={iconButton} onClick={onFocusUpstream} size="icon" title="Focus upstream" type="button" variant={focusMode === "upstream" ? "secondary" : "ghost"}><ArrowLeftToLine aria-hidden="true" className="size-4" /></Button> : null}
                    {onFocusDownstream ? <Button aria-label="Focus downstream" className={iconButton} onClick={onFocusDownstream} size="icon" title="Focus downstream" type="button" variant={focusMode === "downstream" ? "secondary" : "ghost"}><ArrowRightToLine aria-hidden="true" className="size-4" /></Button> : null}
                    <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
                    {onSearchQueryChange ? (
                        <div className="relative w-40 sm:w-52">
                            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                                aria-label="Search workflow nodes"
                                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onChange={(event) => onSearchQueryChange(event.target.value)}
                                placeholder="Search nodes"
                                type="search"
                                value={searchQuery}
                            />
                        </div>
                    ) : null}
                    <span aria-live="polite" className="max-w-24 truncate px-1 text-xs text-muted-foreground">{matchStatus}</span>
                    {onPreviousMatch ? <Button aria-label="Previous match" className={iconButton} disabled={searchMatchCount === 0} onClick={onPreviousMatch} size="icon" type="button" variant="ghost"><ChevronLeft aria-hidden="true" className="size-4" /></Button> : null}
                    {onNextMatch ? <Button aria-label="Next match" className={iconButton} disabled={searchMatchCount === 0} onClick={onNextMatch} size="icon" type="button" variant="ghost"><ChevronRight aria-hidden="true" className="size-4" /></Button> : null}
                    {linearView && onRequestCanvasView ? (
                        <Button aria-label="View diagram" className={iconButton} onClick={onRequestCanvasView} size="icon" title="View diagram" type="button" variant="ghost">
                            <Network aria-hidden="true" className="size-4" />
                        </Button>
                    ) : !linearView && onRequestLinearView ? (
                        <Button aria-label="View as text" className={iconButton} onClick={onRequestLinearView} size="icon" title="View as text" type="button" variant="ghost">
                            <ListTree aria-hidden="true" className="size-4" />
                        </Button>
                    ) : null}
                    {!linearView && onExportPng ? <Button aria-label="Export PNG" className={iconButton} disabled={exporting} onClick={onExportPng} size="icon" title="Export PNG" type="button" variant="ghost"><ImageDown aria-hidden="true" className="size-4" /></Button> : null}
                    {onCloseTools ? <Button aria-label="Hide workflow tools" className={iconButton} onClick={onCloseTools} size="icon" title="Hide workflow tools" type="button" variant="ghost"><PanelTopClose aria-hidden="true" className="size-4" /></Button> : null}
                </div>
            );
        }

        return (
            <div
                aria-label="Workflow reader controls"
                role="toolbar"
                className={cn(
                    "flex flex-col gap-3 rounded-lg border bg-muted/20 p-3",
                    className,
                )}
            >
                <div className="flex flex-wrap items-center gap-2">
                    {onZoomIn ? (
                        <Button aria-label="Zoom in" onClick={onZoomIn} size="icon" type="button" variant="outline">
                            <ZoomIn aria-hidden="true" className="size-4" />
                        </Button>
                    ) : null}
                    {onZoomOut ? (
                        <Button aria-label="Zoom out" onClick={onZoomOut} size="icon" type="button" variant="outline">
                            <ZoomOut aria-hidden="true" className="size-4" />
                        </Button>
                    ) : null}
                    {onResetPan ? (
                        <Button onClick={onResetPan} size="sm" type="button" variant="outline">
                            <LocateFixed aria-hidden="true" className="mr-2 size-4" />
                            Reset pan
                        </Button>
                    ) : null}
                    {onFitView ? (
                        <Button onClick={onFitView} size="sm" type="button" variant="outline">
                            <Maximize2 aria-hidden="true" className="mr-2 size-4" />
                            Fit diagram
                        </Button>
                    ) : null}
                    {onShowWholeGraph ? (
                        <Button
                            aria-pressed={focusMode === "all"}
                            onClick={onShowWholeGraph}
                            size="sm"
                            type="button"
                            variant={focusMode === "all" ? "secondary" : "outline"}
                        >
                            <Network aria-hidden="true" className="mr-2 size-4" />
                            Show whole graph
                        </Button>
                    ) : null}
                    <span className="flex-1" />
                    {linearView && onRequestCanvasView ? (
                        <Button onClick={onRequestCanvasView} size="sm" type="button" variant="outline">
                            <Network aria-hidden="true" className="mr-2 size-4" />
                            View diagram
                        </Button>
                    ) : !linearView && onRequestLinearView ? (
                        <Button onClick={onRequestLinearView} size="sm" type="button" variant="outline">
                            <ListTree aria-hidden="true" className="mr-2 size-4" />
                            View as text
                        </Button>
                    ) : null}
                    {!linearView && onExportPng ? (
                        <Button
                            disabled={exporting}
                            onClick={onExportPng}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            <ImageDown aria-hidden="true" className="mr-2 size-4" />
                            {exporting ? "Exporting…" : "Export PNG"}
                        </Button>
                    ) : null}
                    {canEdit && onEdit && editLabelParts ? (
                        <Button ref={editButtonRef} onClick={onEdit} size="sm" type="button" variant="outline">
                            {editLabelParts.join(" ")}
                        </Button>
                    ) : null}
                </div>

                {onSearchQueryChange ? (
                    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                        <div className="relative min-w-52 flex-1 sm:max-w-md">
                            <Search
                                aria-hidden="true"
                                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                aria-label="Search workflow nodes"
                                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                onChange={(event) => onSearchQueryChange(event.target.value)}
                                placeholder="Search nodes"
                                type="search"
                                value={searchQuery}
                            />
                        </div>
                        <p aria-live="polite" className="min-w-36 text-sm text-muted-foreground">
                            {matchStatus}
                        </p>
                        <Button
                            aria-label="Previous match"
                            disabled={searchMatchCount === 0 || !onPreviousMatch}
                            onClick={onPreviousMatch}
                            size="icon"
                            type="button"
                            variant="ghost"
                        >
                            <ChevronLeft aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                            aria-label="Next match"
                            disabled={searchMatchCount === 0 || !onNextMatch}
                            onClick={onNextMatch}
                            size="icon"
                            type="button"
                            variant="ghost"
                        >
                            <ChevronRight aria-hidden="true" className="size-4" />
                        </Button>
                    </div>
                ) : null}
            </div>
        );
    }

    const mutationDisabled =
        busy ||
        status === "loading" ||
        status === "saving" ||
        status === "conflict" ||
        status === "error";

    if (compact) {
        const iconButton = "size-8 shrink-0";
        return (
            <div
                aria-label="Flow editing controls"
                role="toolbar"
                className={cn(
                    "flex max-w-full items-center gap-1 rounded-xl border bg-background/95 p-1.5 shadow-xl backdrop-blur",
                    className,
                )}
                data-flow-export-exclude="true"
            >
                <Button aria-label="Close editor" className={iconButton} onClick={onCloseEditor} size="icon" title="View mode" type="button" variant="ghost">
                    <Eye aria-hidden="true" className="size-4" />
                </Button>
                <Button aria-label="Edit mode" aria-pressed="true" className={iconButton} size="icon" title="Edit mode" type="button" variant="secondary">
                    <Pencil aria-hidden="true" className="size-4" />
                </Button>
                <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
                <Button aria-label="Add node" className={iconButton} disabled={mutationDisabled || !canAddNode} onClick={onAddNode} size="icon" title="Add node" type="button" variant="ghost"><Plus aria-hidden="true" className="size-4" /></Button>
                <Button aria-label="Add connection" className={iconButton} disabled={mutationDisabled || !canAddConnection} onClick={onAddConnection} size="icon" title="Add connection" type="button" variant="ghost"><GitBranchPlus aria-hidden="true" className="size-4" /></Button>
                {onManageLanes ? <Button aria-label="Manage lanes" className={iconButton} disabled={mutationDisabled} onClick={onManageLanes} size="icon" title="Manage lanes" type="button" variant="ghost"><Columns3 aria-hidden="true" className="size-4" /></Button> : null}
                {onEditSelection ? <Button aria-label="Edit selection" className={iconButton} disabled={mutationDisabled || !canEditSelection} onClick={onEditSelection} size="icon" title="Edit selection" type="button" variant="ghost"><SquarePen aria-hidden="true" className="size-4" /></Button> : null}
                {onEditStories ? <Button aria-label="Edit stories" className={iconButton} disabled={mutationDisabled} onClick={onEditStories} size="icon" title="Edit stories" type="button" variant="ghost"><ListVideo aria-hidden="true" className="size-4" /></Button> : null}
                <Button aria-label="Auto Layout" className={iconButton} disabled={mutationDisabled || !canAutoLayout} onClick={onAutoLayout} size="icon" title="Auto Layout" type="button" variant="ghost"><LayoutDashboard aria-hidden="true" className="size-4" /></Button>
                <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
                <Button aria-label="Undo" className={iconButton} disabled={mutationDisabled || !canUndo} onClick={onUndo} size="icon" title="Undo" type="button" variant="ghost"><Undo2 aria-hidden="true" className="size-4" /></Button>
                <Button aria-label="Redo" className={iconButton} disabled={mutationDisabled || !canRedo} onClick={onRedo} size="icon" title="Redo" type="button" variant="ghost"><Redo2 aria-hidden="true" className="size-4" /></Button>
                <span className="max-w-28 truncate px-2 text-xs text-muted-foreground" role="status" aria-live="polite">{STATUS_LABELS[status]}</span>
                <Button aria-label="Discard" className={iconButton} disabled={busy || status === "loading" || status === "saving" || !canDiscard} onClick={onDiscard} size="icon" title="Discard" type="button" variant="ghost"><RotateCcw aria-hidden="true" className="size-4" /></Button>
                <Button aria-label="Save" className={iconButton} disabled={busy || status === "loading" || status === "saving" || !canSave} onClick={onSave} size="icon" title="Save" type="button"><Save aria-hidden="true" className="size-4" /></Button>
            </div>
        );
    }

    return (
        <div
            aria-label="Flow editing controls"
            role="toolbar"
            className={cn(
                "flex flex-col gap-3 rounded-lg border bg-muted/20 p-3",
                className,
            )}
        >
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    disabled={mutationDisabled || !canAddNode}
                    onClick={onAddNode}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    <Plus aria-hidden="true" className="mr-2 size-4" />
                    Add node
                </Button>
                <Button
                    disabled={mutationDisabled || !canAddConnection}
                    onClick={onAddConnection}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    <GitBranchPlus aria-hidden="true" className="mr-2 size-4" />
                    Add connection
                </Button>
                <Button
                    disabled={mutationDisabled || !canAutoLayout}
                    onClick={onAutoLayout}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    <LayoutDashboard aria-hidden="true" className="mr-2 size-4" />
                    Auto Layout
                </Button>
                <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
                <Button
                    disabled={mutationDisabled || !canUndo}
                    onClick={onUndo}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    <Undo2 aria-hidden="true" className="mr-2 size-4" />
                    Undo
                </Button>
                <Button
                    disabled={mutationDisabled || !canRedo}
                    onClick={onRedo}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    <Redo2 aria-hidden="true" className="mr-2 size-4" />
                    Redo
                </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                    {STATUS_LABELS[status]}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        disabled={busy || status === "loading" || status === "saving" || !canDiscard}
                        onClick={onDiscard}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        <RotateCcw aria-hidden="true" className="mr-2 size-4" />
                        Discard
                    </Button>
                    <Button
                        disabled={busy || status === "loading" || status === "saving" || !canSave}
                        onClick={onSave}
                        size="sm"
                        type="button"
                    >
                        <Save aria-hidden="true" className="mr-2 size-4" />
                        Save
                    </Button>
                    <Button
                        onClick={onCloseEditor}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        <X aria-hidden="true" className="mr-2 size-4" />
                        Close editor
                    </Button>
                </div>
            </div>
        </div>
    );
}
