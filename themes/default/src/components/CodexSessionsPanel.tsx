import * as React from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CodexSessionListItem = {
    id: string;
    name: string;
    updatedAt: number;
    status: string;
};

export function CodexSessionsPanel({
    busy,
    currentThreadId,
    loading,
    onClose,
    onDelete,
    onRefresh,
    onResume,
    sessions,
    triggerRef,
}: {
    busy: boolean;
    currentThreadId: string | null;
    loading: boolean;
    onClose: () => void;
    onDelete: (threadId: string) => Promise<void>;
    onRefresh: () => void;
    onResume: (threadId: string) => void;
    sessions: CodexSessionListItem[];
    triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
    const panelRef = React.useRef<HTMLDivElement>(null);
    const cancelRef = React.useRef<HTMLButtonElement>(null);
    const deleteButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<CodexSessionListItem | null>(null);
    const [deleting, setDeleting] = React.useState(false);
    const [error, setError] = React.useState("");

    React.useEffect(() => {
        const onPointerDown = (event: PointerEvent) => {
            if (deleteTarget || !(event.target instanceof Node)) return;
            if (panelRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
            onClose();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (deleteTarget || event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("keydown", onKeyDown, true);
        };
    }, [deleteTarget, onClose, triggerRef]);

    const confirmDelete = async () => {
        if (!deleteTarget || deleting || busy) return;
        setDeleting(true);
        setError("");
        try {
            await onDelete(deleteTarget.id);
            setDeleteTarget(null);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Failed to delete session");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <div
                ref={panelRef}
                role='region'
                aria-label='Codex sessions'
                className='docs-chat-sessions absolute right-4 top-16 z-10 max-h-[50vh] w-[calc(100%_-_2rem)] max-w-[26rem] overflow-y-auto overflow-x-hidden rounded-2xl border bg-background p-3 shadow-lg'>
                <div className='mb-2 flex items-center justify-between gap-2'>
                    <span className='text-sm font-medium'>Sessions</span>
                    <Button type='button' variant='ghost' size='sm' className='h-7 px-2 text-xs'
                        disabled={loading || busy || deleting} onClick={onRefresh}>
                        Refresh
                    </Button>
                </div>
                {loading ? (
                    <div className='py-3 text-center text-sm text-muted-foreground'>Loading...</div>
                ) : sessions.length === 0 ? (
                    <div className='py-3 text-center text-sm text-muted-foreground'>No sessions</div>
                ) : (
                    <div className='space-y-1'>
                        {sessions.map((session) => (
                            <div key={session.id} className={cn(
                                "group flex min-w-0 items-center rounded-xl transition-colors hover:bg-muted focus-within:bg-muted",
                                session.id === currentThreadId && "bg-muted",
                            )}>
                                <button type='button'
                                    className='flex min-w-0 flex-1 flex-col rounded-xl px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
                                    disabled={busy || deleting} onClick={() => onResume(session.id)}>
                                    <span className='w-full truncate font-medium'>{session.name}</span>
                                    <span className='w-full truncate text-xs text-muted-foreground'>
                                        {formatTimestamp(session.updatedAt)} · {session.status}
                                    </span>
                                </button>
                                <Button type='button' variant='ghost' size='icon'
                                    className='mr-1 h-8 w-8 shrink-0 rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100'
                                    aria-label={`Delete session: ${session.name}`}
                                    disabled={busy || deleting || session.status === "active"}
                                    onClick={(event) => {
                                        deleteButtonRef.current = event.currentTarget;
                                        setError("");
                                        setDeleteTarget(session);
                                    }}>
                                    <X className='h-4 w-4' />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <Dialog open={deleteTarget !== null} onOpenChange={(open) => {
                if (!open && !deleting) setDeleteTarget(null);
            }}>
                <DialogContent role='alertdialog' showCloseButton={false} className='max-w-md'
                    onPointerDownOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => {
                        event.stopPropagation();
                        if (deleting) event.preventDefault();
                    }}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        (deleteButtonRef.current?.isConnected ? deleteButtonRef.current : triggerRef.current)?.focus();
                    }}
                    onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus(); }}>
                    <DialogTitle>Delete session?</DialogTitle>
                    <DialogDescription className='break-words'>
                        Permanently delete “{deleteTarget?.name}” and any child conversations? This cannot be undone.
                    </DialogDescription>
                    {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
                    <div className='flex justify-end gap-2'>
                        <Button ref={cancelRef} type='button' variant='outline' disabled={deleting}
                            onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button type='button' variant='destructive' disabled={deleting || busy}
                            onClick={() => void confirmDelete()}>
                            {deleting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                            {deleting ? "Deleting..." : "Delete"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function formatTimestamp(value: number) {
    if (!value) return "Unknown time";
    return new Date(value * 1000).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
}
