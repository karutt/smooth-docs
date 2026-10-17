import * as React from "react";
import {
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    type Edge,
    type EdgeProps,
} from "@xyflow/react";
import { AlertTriangle, ArrowRight, Radio, type LucideIcon } from "lucide-react";
import type { FlowEdge, FlowEdgeStyle } from "#smooth-docs/types";

export type DocsFlowEdgeData = Record<string, unknown> & {
    edge: FlowEdge;
    meaning: FlowEdgeStyle;
    storyState?: "completed" | "current";
    storyMotion?: "animated" | "instant";
    storyPlaying?: boolean;
};

export type DocsFlowCanvasEdge = Edge<DocsFlowEdgeData, "docsFlowEdge">;

const edgePresentation: Record<
    FlowEdgeStyle,
    { dasharray?: string; icon: LucideIcon; label: string; stroke: string }
> = {
    normal: {
        icon: ArrowRight,
        label: "Flow",
        stroke: "hsl(var(--muted-foreground))",
    },
    error: {
        dasharray: "9 5",
        icon: AlertTriangle,
        label: "Error path",
        stroke: "hsl(var(--destructive))",
    },
    async: {
        dasharray: "2 6",
        icon: Radio,
        label: "Async",
        stroke: "hsl(var(--primary))",
    },
};

export const DocsFlowEdge = React.memo(function DocsFlowEdge({
    data,
    markerEnd,
    selected,
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
}: EdgeProps<DocsFlowCanvasEdge>) {
    const meaning = data?.meaning ?? "normal";
    const presentation = edgePresentation[meaning];
    const storyState = data?.storyState;
    const storyMotion = data?.storyMotion ?? "animated";
    const storyPlaying = Boolean(data?.storyPlaying);
    const storyActive = Boolean(storyState);
    const Icon = presentation.icon;
    const [path, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 10,
    });
    const visibleLabel = data?.edge.label || presentation.label;

    return (
        <>
            <BaseEdge
                className={storyState === "current" && storyPlaying ? "docs-flow-edge-path--current" : undefined}
                path={path}
                markerEnd={markerEnd}
                interactionWidth={20}
                style={{
                    stroke: storyActive ? "hsl(var(--primary))" : presentation.stroke,
                    strokeDasharray: storyState === "current" ? "10 7" : presentation.dasharray,
                    strokeLinecap: "round",
                    strokeWidth: selected || storyActive ? 3 : 2,
                }}
            />
            {storyState === "current" && storyPlaying && storyMotion === "animated" ? (
                <path
                    aria-hidden="true"
                    className="docs-flow-story-traveler"
                    d="M -7 -4 L 2 0 L -7 4 Z"
                    fill="hsl(var(--primary))"
                >
                    <animateMotion dur="900ms" path={path} repeatCount="indefinite" rotate="auto" />
                </path>
            ) : null}
            <EdgeLabelRenderer>
                <div
                    className='pointer-events-none absolute z-20 flex items-center gap-1 rounded-full border bg-background/95 px-2 py-1 text-[0.65rem] font-medium text-foreground shadow-sm backdrop-blur'
                    data-flow-edge-style={meaning}
                    style={{
                        zIndex: 20,
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                    }}>
                    <Icon className='h-3 w-3 shrink-0' aria-hidden='true' />
                    <span className='max-w-40 truncate'>{visibleLabel}</span>
                </div>
            </EdgeLabelRenderer>
        </>
    );
});
