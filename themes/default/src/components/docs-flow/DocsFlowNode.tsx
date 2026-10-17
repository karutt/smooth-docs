import * as React from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
    CirclePlay,
    GitBranch,
    Globe2,
    Server,
    StickyNote,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowDirection, FlowLane, FlowNode, FlowNodeType } from "#smooth-docs/types";

export type DocsFlowNodeData = Record<string, unknown> & {
    direction: FlowDirection;
    node: FlowNode;
};

export type DocsFlowLaneData = Record<string, unknown> & {
    lane: FlowLane;
};

export type DocsFlowContentCanvasNode = Node<DocsFlowNodeData, "docsFlowNode">;
export type DocsFlowLaneCanvasNode = Node<DocsFlowLaneData, "docsFlowLane">;

const nodePresentation: Record<
    FlowNodeType,
    { className: string; icon: LucideIcon; label: string }
> = {
    action: {
        className: "rounded-xl border-solid",
        icon: CirclePlay,
        label: "Action",
    },
    decision: {
        className: "rounded-[1.75rem] border-2 border-solid",
        icon: GitBranch,
        label: "Decision",
    },
    service: {
        className: "rounded-lg border-4 border-double",
        icon: Server,
        label: "Service",
    },
    external: {
        className: "rounded-full border-2 border-dashed",
        icon: Globe2,
        label: "External system",
    },
    note: {
        className: "rounded-sm border-l-4 border-l-primary",
        icon: StickyNote,
        label: "Note",
    },
};

export const DocsFlowNode = React.memo(function DocsFlowNode({
    data,
    isConnectable,
    selected,
}: NodeProps<DocsFlowContentCanvasNode>) {
    const { direction, node } = data;
    const presentation = nodePresentation[node.type];
    const Icon = presentation.icon;
    const targetPosition = direction === "down" ? Position.Top : Position.Left;
    const sourcePosition = direction === "down" ? Position.Bottom : Position.Right;

    return (
        <article
            className={cn(
                "relative flex h-full w-full min-w-0 flex-col justify-center border bg-card px-4 py-3 text-card-foreground shadow-sm",
                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
                presentation.className,
                selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
            data-flow-node-type={node.type}>
            <Handle
                type='target'
                position={targetPosition}
                isConnectable={isConnectable}
                className='!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground'
            />
            <div className='flex min-w-0 items-start gap-3'>
                <span
                    className='mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground'
                    aria-hidden='true'>
                    <Icon className='h-4 w-4' />
                </span>
                <div className='min-w-0 flex-1'>
                    <span className='block text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground'>
                        {presentation.label}
                    </span>
                    <h3 className='line-clamp-2 break-words text-sm font-semibold leading-5'>
                        {node.label}
                    </h3>
                    {(node.status || node.risk) && (
                        <div className='mt-1.5 flex flex-wrap gap-1 text-[0.65rem] text-muted-foreground'>
                            {node.status && <span className='rounded bg-muted px-1.5 py-0.5'>{node.status}</span>}
                            {node.risk && (
                                <span className='rounded border px-1.5 py-0.5'>Risk: {node.risk}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <Handle
                type='source'
                position={sourcePosition}
                isConnectable={isConnectable}
                className='!h-2.5 !w-2.5 !border-2 !border-background !bg-foreground'
            />
        </article>
    );
});

export const DocsFlowLaneNode = React.memo(function DocsFlowLaneNode({
    data,
}: NodeProps<DocsFlowLaneCanvasNode>) {
    return (
        <section
            className='h-full w-full rounded-xl border border-dashed bg-muted/20'
            data-flow-lane={data.lane.id}>
            <header className='pointer-events-none absolute left-3 top-2 max-w-[calc(100%-1.5rem)] rounded-md bg-background/90 px-2 py-1 shadow-sm backdrop-blur'>
                <h3 className='truncate text-xs font-semibold text-foreground'>{data.lane.label}</h3>
                {data.lane.description && (
                    <p className='line-clamp-1 text-[0.65rem] text-muted-foreground'>
                        {data.lane.description}
                    </p>
                )}
            </header>
        </section>
    );
});
