import * as React from "react";
import { Check, Pause, Play, RotateCcw } from "lucide-react";
import type { FlowDocument, FlowStory } from "#smooth-docs/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DocsFlowStoryHighlight = {
    edgeIds: string[];
    nodeIds: string[];
    currentEdgeId?: string;
    currentNodeId?: string;
    playing: boolean;
    motion: "animated" | "instant";
};

export type DocsFlowStoryPlayerProps = {
    document: FlowDocument;
    initialStoryId?: string;
    onHighlightChange?: (highlight: DocsFlowStoryHighlight) => void;
    className?: string;
    compact?: boolean;
};

const STEP_INTERVAL_MS = 1_200;

export default function DocsFlowStoryPlayer({
    document,
    initialStoryId,
    onHighlightChange,
    className,
    compact = false,
}: DocsFlowStoryPlayerProps) {
    const stories = document.stories ?? [];
    const initial = stories.some((story) => story.id === initialStoryId)
        ? initialStoryId
        : stories[0]?.id;
    const [storyId, setStoryId] = React.useState(initial);
    const [stepIndex, setStepIndex] = React.useState(0);
    const [playing, setPlaying] = React.useState(false);
    const [complete, setComplete] = React.useState(false);
    const reducedMotion = prefersReducedMotion();
    const story = stories.find((item) => item.id === storyId);
    const invalidSteps = story ? getInvalidSteps(document, story) : [];
    const playable = Boolean(story && story.steps.length > 0 && invalidSteps.length === 0);

    React.useEffect(() => {
        if (storyId && stories.some((item) => item.id === storyId)) return;
        setStoryId(initial);
        setStepIndex(0);
        setPlaying(false);
        setComplete(false);
    }, [initial, stories, storyId]);

    React.useEffect(() => {
        if (!playing || !story || !playable) return;
        const timer = window.setTimeout(() => {
            setStepIndex((current) => {
                if (current + 1 < story.steps.length) return current + 1;
                setPlaying(false);
                setComplete(true);
                return current;
            });
        }, STEP_INTERVAL_MS);
        return () => window.clearTimeout(timer);
    }, [playable, playing, stepIndex, story]);

    const highlight = React.useMemo(
        () => collectHighlight(story, playable ? stepIndex : -1, reducedMotion, playing),
        [playable, playing, reducedMotion, stepIndex, story],
    );

    React.useEffect(() => {
        onHighlightChange?.(highlight);
    }, [highlight, onHighlightChange]);

    if (stories.length === 0) return null;

    const statusText = complete && story
        ? `${story.label} story complete`
        : story
          ? `${story.label}, step ${Math.min(stepIndex + 1, story.steps.length)} of ${story.steps.length}`
          : "No story selected";

    return (
        <section
            aria-label="Workflow story player"
            className={cn(
                "flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-lg backdrop-blur",
                compact && "h-11 max-w-[min(30rem,calc(100%-1.5rem))] flex-nowrap gap-1 overflow-hidden p-1.5",
                className,
            )}
            data-flow-reader-control="true"
        >
            <label className={cn("min-w-40 text-xs font-medium", compact && "w-36 min-w-0 shrink")}>
                <span className={compact ? "sr-only" : undefined}>Story</span>
                <select
                    aria-label="Story"
                    className={cn(
                        "block h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        !compact && "mt-1 h-9 px-3 text-sm",
                    )}
                    onChange={(event) => {
                        setStoryId(event.target.value);
                        setStepIndex(0);
                        setPlaying(false);
                        setComplete(false);
                    }}
                    value={storyId ?? ""}
                >
                    {stories.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                </select>
            </label>

            <div className="flex items-center gap-1">
                <Button
                    aria-label={playing ? "Pause story" : "Play story"}
                    disabled={!playable || complete}
                    onClick={() => setPlaying((current) => !current)}
                    size={compact ? "icon" : "sm"}
                    type="button"
                    variant="outline"
                >
                    {playing ? <Pause aria-hidden="true" className={cn("size-4", !compact && "mr-2")} /> : <Play aria-hidden="true" className={cn("size-4", !compact && "mr-2")} />}
                    {compact ? <span className="sr-only">{playing ? "Pause" : "Play"}</span> : playing ? "Pause" : "Play"}
                </Button>
                <Button
                    aria-label="Reset story"
                    disabled={!story}
                    onClick={() => {
                        setPlaying(false);
                        setComplete(false);
                        setStepIndex(0);
                    }}
                    size={compact ? "icon" : "sm"}
                    type="button"
                    variant="ghost"
                >
                    <RotateCcw aria-hidden="true" className={cn("size-4", !compact && "mr-2")} />
                    {compact ? <span className="sr-only">Reset</span> : "Reset"}
                </Button>
            </div>

            <p
                aria-label={story ? `Story progress: step ${stepIndex + 1} of ${story.steps.length}${complete ? ", complete" : ""}` : "Story progress: no steps"}
                className={cn(
                    "whitespace-nowrap text-xs font-medium tabular-nums",
                    compact && "flex h-8 min-w-10 items-center justify-center rounded-md bg-muted px-2",
                )}
            >
                {compact
                    ? complete
                        ? <Check aria-hidden="true" className="size-4" />
                        : story
                          ? `${stepIndex + 1}/${story.steps.length}`
                          : "—"
                    : complete
                      ? "Story complete"
                      : story
                        ? `Step ${stepIndex + 1} of ${story.steps.length}`
                        : "No steps"}
            </p>

            <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
                {statusText}
            </p>

            {!compact && story?.description ? (
                <p className="basis-full text-sm text-muted-foreground">{story.description}</p>
            ) : null}
            {!playable && story ? (
                <p className="basis-full text-sm text-destructive" role="alert">
                    {story.label} is unavailable because one or more story steps are invalid.
                </p>
            ) : null}
        </section>
    );
}

function collectHighlight(
    story: FlowStory | undefined,
    stepIndex: number,
    reducedMotion: boolean,
    playing: boolean,
): DocsFlowStoryHighlight {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    if (story && stepIndex >= 0) {
        story.steps.slice(0, stepIndex + 1).forEach((step) => {
            if ("node" in step) nodeIds.add(step.node);
            else edgeIds.add(step.edge);
        });
    }
    return {
        nodeIds: [...nodeIds],
        edgeIds: [...edgeIds],
        currentNodeId: story && stepIndex >= 0 && "node" in story.steps[stepIndex]
            ? story.steps[stepIndex].node
            : undefined,
        currentEdgeId: story && stepIndex >= 0 && "edge" in story.steps[stepIndex]
            ? story.steps[stepIndex].edge
            : undefined,
        playing,
        motion: reducedMotion ? "instant" : "animated",
    };
}

function getInvalidSteps(document: FlowDocument, story: FlowStory) {
    const nodeIds = new Set(document.nodes.map((node) => node.id));
    const edgeIds = new Set(document.edges.map((edge) => edge.id));
    return story.steps.filter((step) =>
        "node" in step ? !nodeIds.has(step.node) : !edgeIds.has(step.edge),
    );
}

function prefersReducedMotion() {
    return typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
