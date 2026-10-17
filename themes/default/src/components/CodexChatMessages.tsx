import type { ReactNode } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import type { CodexChatMessage } from "../../../../src/codex-chat";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function CodexChatMessages({
    messages,
    working,
    renderContent,
}: {
    messages: CodexChatMessage[];
    working: boolean;
    renderContent: (content: string) => ReactNode;
}) {
    const groups: Array<{ id: string; messages: CodexChatMessage[] }> = [];
    for (const message of messages) {
        const previous = groups.at(-1);
        if (message.role === "assistant" && message.turnId &&
            previous?.messages[0].role === "assistant" &&
            previous.messages[0].turnId === message.turnId) {
            previous.messages.push(message);
        } else {
            groups.push({ id: message.turnId && message.role === "assistant" ? message.turnId : message.id, messages: [message] });
        }
    }

    return groups.map((group, index) => {
        const message = group.messages[0];
        const pending = working && index === groups.length - 1;
        if (message.role !== "assistant") {
            return (
                <div key={group.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                        "min-w-0 text-base leading-7",
                        message.role === "user"
                            ? "max-w-[85%] rounded-3xl bg-muted px-5 py-3 text-foreground sm:max-w-[75%]"
                            : "w-full rounded-xl bg-destructive/10 px-4 py-3 text-destructive",
                    )}>
                        {renderContent(message.content)}
                    </div>
                </div>
            );
        }

        const activity = group.messages.filter((entry) =>
            (entry.kind === "reasoning" || entry.kind === "commentary") && entry.content,
        );
        const answers = group.messages.filter((entry) =>
            entry.kind !== "reasoning" && entry.kind !== "commentary" && entry.content,
        );
        if (!activity.length && !answers.length && !pending) return null;

        return (
            <div key={group.id} className='flex w-full min-w-0 flex-col gap-4'>
                {activity.length > 0 && (
                    <Collapsible className='text-muted-foreground'>
                        <CollapsibleTrigger className='group inline-flex items-center gap-2 rounded-md py-1 text-left text-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
                            <ChevronRight aria-hidden='true' className='h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90' />
                            Thinking &amp; progress
                            {pending && <Loader2 aria-label='Working' className='h-3.5 w-3.5 animate-spin' />}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className='mt-3 space-y-4 border-l-2 pl-4'>
                                {activity.map((entry) => (
                                    <div key={entry.id}>
                                        {renderContent(entry.content)}
                                    </div>
                                ))}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
                {answers.length > 0 ? (
                    <div className='w-full min-w-0 text-base leading-7 text-foreground'>
                        {renderContent(answers.map((entry) => entry.content).join("\n\n"))}
                    </div>
                ) : pending && activity.length === 0 ? (
                    <span className='inline-flex items-center gap-2 py-1 text-sm text-muted-foreground'>
                        <Loader2 className='h-3.5 w-3.5 animate-spin' />
                        Working
                    </span>
                ) : null}
            </div>
        );
    });
}
