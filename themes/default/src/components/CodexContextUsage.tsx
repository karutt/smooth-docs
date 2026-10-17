import type { CodexContextUsage } from "../../../../src/codex-chat";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function CodexContextUsageIndicator({ usage }: { usage: CodexContextUsage | null | undefined }) {
    if (!usage) return null;
    const percent = Math.min(100, Math.max(0, usage.usedTokens / usage.contextWindow * 100));
    const label = `${Math.round(percent)}% context used · ${usage.usedTokens.toLocaleString()} / ${usage.contextWindow.toLocaleString()} tokens`;
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        role='meter'
                        tabIndex={0}
                        aria-label='Context usage'
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percent}
                        aria-valuetext={label}
                        className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring'>
                        <svg viewBox='0 0 20 20' className='h-4 w-4' aria-hidden='true'>
                            <circle cx='10' cy='10' r='7' fill='none' stroke='currentColor' strokeWidth='3' opacity='0.25' />
                            <circle cx='10' cy='10' r='7' fill='none' stroke='currentColor' strokeWidth='3'
                                pathLength='100' strokeDasharray={`${percent} 100`} transform='rotate(-90 10 10)' />
                        </svg>
                    </span>
                </TooltipTrigger>
                <TooltipContent side='top' className='max-w-64'>
                    <p>{label}</p>
                    <p className='mt-1 text-muted-foreground'>Based on the latest response.</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
