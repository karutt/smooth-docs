import * as React from "react";
import {
    BookOpen,
    Command as CommandIcon,
    Copy,
    FileText,
    Link as LinkIcon,
    Maximize2,
    Moon,
    Plus,
    Sun,
    Trash2,
} from "lucide-react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import type { DocsData, SiteKey } from "@/types";
import { createPageSearchFilter } from "@/lib/page-search";

type Theme = "dark" | "light";

export default function ActionCommandDialog({
    availableSites,
    canCopyPath,
    canCreateMarkdown,
    canDeleteMarkdown,
    canEditMarkdown,
    canPromoteDraft,
    docsData,
    editMode,
    getSiteLabel,
    onCopyMarkdown,
    onCopyPath,
    onCopyUrl,
    onCreateMarkdown,
    onDeleteMarkdown,
    onNavigate,
    onNextSite,
    onOpenChange,
    onPromoteDraft,
    onSiteChange,
    onThemeChange,
    onToggleEditMode,
    onZenModeToggle,
    open,
    site,
    theme,
    zenMode,
}: {
    availableSites: ReadonlyArray<SiteKey>;
    canCopyPath: boolean;
    canCreateMarkdown: boolean;
    canDeleteMarkdown: boolean;
    canEditMarkdown: boolean;
    canPromoteDraft: boolean;
    docsData: DocsData;
    editMode: boolean;
    getSiteLabel: (site: SiteKey) => string;
    onCopyMarkdown: () => void;
    onCopyPath: () => void;
    onCopyUrl: () => void;
    onCreateMarkdown: () => void;
    onDeleteMarkdown: () => void;
    onNavigate: (url: string) => void;
    onNextSite: () => void;
    onOpenChange: (open: boolean) => void;
    onPromoteDraft: () => void;
    onSiteChange: (site: SiteKey) => void;
    onThemeChange: React.Dispatch<React.SetStateAction<Theme>>;
    onToggleEditMode: () => void;
    onZenModeToggle: () => void;
    open: boolean;
    site: SiteKey;
    theme: Theme;
    zenMode: boolean;
}) {
    const filter = React.useMemo(
        () => createPageSearchFilter(docsData.pages),
        [docsData.pages],
    );

    const run = React.useCallback(
        (action: () => void | Promise<void>) => {
            onOpenChange(false);
            void action();
        },
        [onOpenChange],
    );

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange} title='Smooth Docs actions' commandProps={{ filter }}>
            <CommandInput placeholder='Search docs or run an action...' />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                <CommandGroup heading='Actions'>
                    <CommandItem
                        value='toggle zen mode focus'
                        onSelect={() => run(onZenModeToggle)}>
                        <Maximize2 className='h-4 w-4 text-muted-foreground' />
                        <span>{zenMode ? "Exit zen mode" : "Enter zen mode"}</span>
                        <CommandShortcut>Z</CommandShortcut>
                    </CommandItem>
                    {import.meta.env.DEV && canEditMarkdown && (
                        <CommandItem
                            value='toggle edit mode markdown editor'
                            onSelect={() => run(onToggleEditMode)}>
                            <FileText className='h-4 w-4 text-muted-foreground' />
                            <span>{editMode ? "Exit edit mode" : "Edit current Markdown"}</span>
                        </CommandItem>
                    )}
                    {import.meta.env.DEV && canCreateMarkdown && (
                        <CommandItem
                            value='create add new markdown file page'
                            onSelect={() => run(onCreateMarkdown)}>
                            <Plus className='h-4 w-4 text-muted-foreground' />
                            <span>Create Markdown file</span>
                        </CommandItem>
                    )}
                    <CommandItem value='copy markdown md source' onSelect={() => run(onCopyMarkdown)}>
                        <FileText className='h-4 w-4 text-muted-foreground' />
                        <span>Copy current page markdown</span>
                        <CommandShortcut>⌘⌥M</CommandShortcut>
                    </CommandItem>
                    {import.meta.env.DEV && canCopyPath && (
                        <CommandItem value='copy path source file' onSelect={() => run(onCopyPath)}>
                            <Copy className='h-4 w-4 text-muted-foreground' />
                            <span>Copy current page path</span>
                            <CommandShortcut>⌘P</CommandShortcut>
                        </CommandItem>
                    )}
                    <CommandItem value='copy url link' onSelect={() => run(onCopyUrl)}>
                        <LinkIcon className='h-4 w-4 text-muted-foreground' />
                        <span>Copy current URL</span>
                        <CommandShortcut>⌘U</CommandShortcut>
                    </CommandItem>
                    <CommandItem
                        value='toggle theme dark light'
                        onSelect={() =>
                            run(() =>
                                onThemeChange((current) => (current === "dark" ? "light" : "dark")),
                            )
                        }>
                        {theme === "dark" ? (
                            <Sun className='h-4 w-4 text-muted-foreground' />
                        ) : (
                            <Moon className='h-4 w-4 text-muted-foreground' />
                        )}
                        <span>Switch to {theme === "dark" ? "light" : "dark"} theme</span>
                        <CommandShortcut>⌘⌥L</CommandShortcut>
                    </CommandItem>
                    {availableSites.length > 1 && (
                        <CommandItem value='switch next docs site' onSelect={() => run(onNextSite)}>
                            <CommandIcon className='h-4 w-4 text-muted-foreground' />
                            <span>Toggle docs site</span>
                            <CommandShortcut>⌘⇧I</CommandShortcut>
                        </CommandItem>
                    )}
                    {availableSites.map((targetSite) => (
                        <CommandItem
                            key={targetSite}
                            value={`switch ${targetSite} ${getSiteLabel(targetSite)}`}
                            onSelect={() => run(() => onSiteChange(targetSite))}>
                            <CommandIcon className='h-4 w-4 text-muted-foreground' />
                            <span>Open {getSiteLabel(targetSite)}</span>
                        </CommandItem>
                    ))}
                    {import.meta.env.DEV && canPromoteDraft && (
                        <CommandItem
                            value='copy publish current draft markdown published'
                            onSelect={() => run(onPromoteDraft)}>
                            <FileText className='h-4 w-4 text-muted-foreground' />
                            <span>Publish current draft</span>
                        </CommandItem>
                    )}
                    {import.meta.env.DEV && canDeleteMarkdown && (
                        <CommandItem
                            value='delete current markdown md file'
                            onSelect={() => run(onDeleteMarkdown)}>
                            <Trash2 className='h-4 w-4 text-muted-foreground' />
                            <span>Delete current Markdown</span>
                        </CommandItem>
                    )}
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading={`${getSiteLabel(site)} pages`}>
                    {docsData.pages.map((page) => (
                        <CommandItem
                            key={page.url}
                            value={`open ${page.title} ${page.sourcePath} ${page.text}`}
                            onSelect={() => run(() => onNavigate(page.url))}>
                            <BookOpen className='h-4 w-4 text-muted-foreground' />
                            <div className='flex min-w-0 flex-col'>
                                <span className='truncate'>{page.title}</span>
                                <span className='truncate text-xs text-muted-foreground'>
                                    {page.sourcePath}
                                </span>
                            </div>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
