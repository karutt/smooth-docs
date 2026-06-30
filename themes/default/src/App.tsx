import * as React from "react";
import { docsDataBySite as initialDocsDataBySite } from "#docs-data";
import {
    BookOpen,
    ChevronRight,
    Code2,
    Command as CommandIcon,
    Copy,
    Eye,
    FileText,
    Folder,
    Layout,
    Link as LinkIcon,
    Maximize2,
    Minus,
    Moon,
    Palette,
    PanelRight,
    PencilLine,
    Pin,
    Plus,
    RotateCcw,
    Settings as SettingsIcon,
    Sun,
    Trash2,
    Type,
    X,
} from "lucide-react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import {
    Sidebar as SidebarRoot,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarTrigger,
    useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle";
import type { AllDocsData, DocPage, DocsData, NavItem, SiteKey } from "@/types";
import { cn } from "@/lib/utils";
import hljs from "highlight.js/lib/core";
import markdown from "highlight.js/lib/languages/markdown";
import { toast } from "sonner";

hljs.registerLanguage("markdown", markdown);

type Theme = "dark" | "light";

type RouteState = {
    site: SiteKey;
    pagePath: string;
};

type DocsContentUpdatePayload = {
    docsDataBySite?: AllDocsData;
    generatedAt?: number;
    refreshThemeStylesheet?: boolean;
};

type ArticleBlock = { type: "html"; html: string } | { type: "accordion"; data: DocsAccordionData };

type DocsAccordionData = {
    multiple: boolean;
    items: Array<{
        title: string;
        html: string;
        open: boolean;
    }>;
};

type MermaidZoomState = {
    title: string;
    svgHtml: string;
    width: number;
    height: number;
};

type PinnedBlock = {
    id: string;
    label: string;
    html: string;
};

type PinMenuRequest = {
    x: number;
    y: number;
    selectedMarkdown?: string;
    block?: {
        label: string;
        markdown?: string;
        html: string;
        sourceElement: HTMLElement;
    };
};

type PinToastState = {
    id: number;
    message: string;
};

type FolderSuggestion = {
    path: string;
};

type PromoteDraftResult = {
    sourcePath: string;
    destinationPath: string;
    url: string;
    docsDataBySite?: AllDocsData;
    generatedAt?: number;
};

type CreateMarkdownResult = {
    sourcePath: string;
    site: SiteKey;
    url: string;
    docsDataBySite?: AllDocsData;
    generatedAt?: number;
};

type DeleteMarkdownResult = {
    sourcePath: string;
    site: SiteKey;
    docsDataBySite?: AllDocsData;
    generatedAt?: number;
};

type SaveMarkdownResult = {
    sourcePath: string;
    site: SiteKey;
};

type EditorSaveStatus = "saved" | "dirty" | "saving" | "error";

type MainWidthSetting = "narrow" | "default" | "wide" | "full";
type DensitySetting = "compact" | "comfortable" | "spacious";
type CodeFontFamilySetting = "mono" | "system" | "serif";
type CodeFontSizeSetting = "12" | "13" | "14" | "15" | "16";
type EditorFontSizeSetting =
    | "10"
    | "11"
    | "12"
    | "13"
    | "14"
    | "15"
    | "16"
    | "17"
    | "18"
    | "19"
    | "20"
    | "21"
    | "22"
    | "23"
    | "24";
type CodeLineHeightSetting = "tight" | "normal" | "relaxed";
type CodeMaxHeightSetting = "360" | "480" | "640" | "none";
type CodeThemeSetting =
    | "github-dark"
    | "github-light"
    | "atom-one-dark"
    | "atom-one-light"
    | "night-owl"
    | "nord"
    | "monokai"
    | "quiet-light"
    | "solarized-light"
    | "xcode-light";
type MermaidDensitySetting = "compact" | "comfortable" | "spacious";
type SettingsSectionId = "general" | "layout" | "sidebar" | "code" | "editor" | "diagrams";

type DocsUiSettings = {
    mainWidth: MainWidthSetting;
    density: DensitySetting;
    autoHideHeader: boolean;
    showBreadcrumbs: boolean;
    reduceMotion: boolean;
    leftSidebarWrap: boolean;
    rightSidebarWrap: boolean;
    pinPanelWrap: boolean;
    showRightSidebar: boolean;
    codeTheme: CodeThemeSetting;
    codeFontFamily: CodeFontFamilySetting;
    codeFontSize: CodeFontSizeSetting;
    codeLineHeight: CodeLineHeightSetting;
    codeWrap: boolean;
    codeMaxHeight: CodeMaxHeightSetting;
    editorFontSize: EditorFontSizeSetting;
    editorWrap: boolean;
    mermaidDensity: MermaidDensitySetting;
};

type Size = {
    width: number;
    height: number;
};

const PIN_STORAGE_KEY = "smooth-docs-kit-pin-blocks";
const UI_SETTINGS_STORAGE_KEY = "smooth-docs-kit-ui-settings";
const PIN_FONT_STEP_KEY = "smooth-docs-kit-pin-font-step";
const PIN_PANEL_WIDTH_KEY = "smooth-docs-kit-pin-panel-width";
const LEFT_SIDEBAR_WIDTH_KEY = "smooth-docs-kit-left-sidebar-width";
const TOC_PANEL_WIDTH_KEY = "smooth-docs-kit-toc-panel-width";
const MAX_PINNED_BLOCKS = 6;
const DEFAULT_LEFT_SIDEBAR_WIDTH = 264;
const MIN_LEFT_SIDEBAR_WIDTH = 220;
const MAX_LEFT_SIDEBAR_WIDTH = 360;
const DEFAULT_TOC_PANEL_WIDTH = 268;
const MIN_TOC_PANEL_WIDTH = 220;
const MAX_TOC_PANEL_WIDTH = 360;
const DEFAULT_PIN_PANEL_WIDTH = 400;
const MIN_PIN_PANEL_WIDTH = 320;
const MAX_PIN_PANEL_WIDTH = 760;
const DEFAULT_PIN_FONT_STEP_INDEX = 6;
const PINNABLE_TAGS = new Set([
    "TABLE",
    "UL",
    "OL",
    "P",
    "DL",
    "BLOCKQUOTE",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
]);
const PIN_FONT_STEPS = [
    0.72, 0.79, 0.86, 0.93, 1, 1.07, 1.14, 1.22, 1.3, 1.38, 1.47, 1.56, 1.66, 1.78, 1.9,
];
const EDITOR_FONT_SIZE_OPTIONS: EditorFontSizeSetting[] = [
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "21",
    "22",
    "23",
    "24",
];

const DEFAULT_UI_SETTINGS: DocsUiSettings = {
    mainWidth: "default",
    density: "comfortable",
    autoHideHeader: true,
    showBreadcrumbs: true,
    reduceMotion: false,
    leftSidebarWrap: false,
    rightSidebarWrap: false,
    pinPanelWrap: false,
    showRightSidebar: true,
    codeTheme: "github-dark",
    codeFontFamily: "mono",
    codeFontSize: "14",
    codeLineHeight: "normal",
    codeWrap: false,
    codeMaxHeight: "640",
    editorFontSize: "14",
    editorWrap: false,
    mermaidDensity: "comfortable",
};

const CODE_THEME_OPTIONS: Array<{
    value: CodeThemeSetting;
    label: string;
    colorScheme: Theme;
}> = [
    { value: "github-dark", label: "GitHub Dark", colorScheme: "dark" },
    { value: "atom-one-dark", label: "Atom One Dark", colorScheme: "dark" },
    { value: "night-owl", label: "Night Owl", colorScheme: "dark" },
    { value: "nord", label: "Nord", colorScheme: "dark" },
    { value: "monokai", label: "Monokai", colorScheme: "dark" },
    { value: "github-light", label: "GitHub Light", colorScheme: "light" },
    { value: "atom-one-light", label: "Atom One Light", colorScheme: "light" },
    { value: "quiet-light", label: "Quiet Light", colorScheme: "light" },
    { value: "solarized-light", label: "Solarized Light", colorScheme: "light" },
    { value: "xcode-light", label: "Xcode Light", colorScheme: "light" },
];
const CODE_THEME_VALUES = CODE_THEME_OPTIONS.map((option) => option.value);

const MIN_MERMAID_ZOOM_SCALE = 0.1;
const MAX_MERMAID_ZOOM_SCALE = 5;
const MERMAID_ZOOM_VIEWPORT_PADDING = 48;

type TableOfContentsItem = {
    id: string;
    title: string;
    level: number;
};

type PageBreadcrumbItem = {
    title: string;
    url?: string;
};

const siteLabels: Record<string, string> = {
    docs: "Docs",
    published: "Published",
    draft: "Draft",
};

const availableSites = Object.keys(initialDocsDataBySite) as SiteKey[];
const fallbackSite = availableSites[0] ?? "docs";

export function App() {
    const [liveDocsDataBySite, setLiveDocsDataBySite] =
        React.useState<AllDocsData>(initialDocsDataBySite);
    const [route, setRoute] = React.useState<RouteState>(() => readRoute());
    const [commandOpen, setCommandOpen] = React.useState(false);
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [promoteDraftOpen, setPromoteDraftOpen] = React.useState(false);
    const [createMarkdownOpen, setCreateMarkdownOpen] = React.useState(false);
    const [deleteMarkdownOpen, setDeleteMarkdownOpen] = React.useState(false);
    const [editMode, setEditMode] = React.useState(false);
    const [editorText, setEditorText] = React.useState("");
    const [editorSaveStatus, setEditorSaveStatus] = React.useState<EditorSaveStatus>("saved");
    const [editorSaveError, setEditorSaveError] = React.useState("");
    const [editorSavedAt, setEditorSavedAt] = React.useState<number | null>(null);
    const [theme, setTheme] = React.useState<Theme>(() => getInitialTheme());
    const [uiSettings, setUiSettings] = React.useState<DocsUiSettings>(() => readUiSettings());
    const [headerVisible, setHeaderVisible] = React.useState(true);
    const [zenMode, setZenMode] = React.useState(false);
    const [sidebarOpen, setSidebarOpen] = React.useState(true);
    const [leftSidebarWidth, setLeftSidebarWidth] = React.useState(() => readLeftSidebarWidth());
    const [tocPanelWidth, setTocPanelWidth] = React.useState(() => readTocPanelWidth());

    const docsData =
        liveDocsDataBySite[route.site] ??
        liveDocsDataBySite[fallbackSite] ??
        initialDocsDataBySite[fallbackSite];
    const currentPage =
        docsData.pages.find((page) => page.url === route.pagePath) ?? docsData.pages[0];
    const pinPageKey = React.useMemo(
        () => getPinPageKey(route.site, currentPage.url),
        [currentPage.url, route.site],
    );
    const [pinnedBlocks, setPinnedBlocks] = React.useState<PinnedBlock[]>(() =>
        readPinnedBlocks(pinPageKey),
    );
    const [pinMenu, setPinMenu] = React.useState<PinMenuRequest | null>(null);
    const [pinToast, setPinToast] = React.useState<PinToastState | null>(null);
    const [pinFontStepIndex, setPinFontStepIndex] = React.useState(() => readPinFontStepIndex());
    const [pinPanelWidth, setPinPanelWidth] = React.useState(() => readPinPanelWidth());
    const suppressHeaderScrollRef = React.useRef(false);
    const suppressHeaderScrollTimeoutRef = React.useRef<number | null>(null);
    const editorTextRef = React.useRef("");
    const editorLastSavedTextRef = React.useRef("");
    const editorSaveTimerRef = React.useRef<number | null>(null);
    const editorSaveRequestRef = React.useRef(0);
    const editorSavedChangesRef = React.useRef(false);
    const pageUrls = React.useMemo(
        () => new Set(docsData.pages.map((page) => page.url)),
        [docsData.pages],
    );
    const tableOfContents = React.useMemo(
        () => extractTableOfContents(currentPage.html),
        [currentPage.html],
    );
    const pageBreadcrumbs = React.useMemo(
        () => buildPageBreadcrumbs(route.site, docsData.nav, currentPage),
        [currentPage, docsData.nav, route.site],
    );
    const hasPinnedBlocks = pinnedBlocks.length > 0;
    const hasSidePanel = hasPinnedBlocks || tableOfContents.length > 0;
    const canEditMarkdown = isDocsMarkdownSourcePath(currentPage.sourcePath);
    const canRenderSidePanel = !zenMode && !editMode && hasSidePanel;
    const rightSidebarOpen = canRenderSidePanel && uiSettings.showRightSidebar;

    React.useEffect(() => {
        setPinnedBlocks(readPinnedBlocks(pinPageKey));
        setPinMenu(null);
    }, [pinPageKey]);

    const applyDocsContentUpdate = React.useCallback((payload: DocsContentUpdatePayload) => {
        if (payload.docsDataBySite) {
            setLiveDocsDataBySite(payload.docsDataBySite);
        }

        if (payload.refreshThemeStylesheet) {
            refreshThemeStylesheet(payload.generatedAt ?? Date.now());
        }
    }, []);

    React.useEffect(() => {
        const hot = import.meta.hot;
        if (!hot) return;

        hot.on("smooth-docs:content-update", applyDocsContentUpdate);
        return () => hot.off("smooth-docs:content-update", applyDocsContentUpdate);
    }, [applyDocsContentUpdate]);

    React.useEffect(() => {
        const nextDocsData = liveDocsDataBySite[route.site] ?? liveDocsDataBySite[fallbackSite];
        if (!nextDocsData) return;

        const hasCurrentPage = nextDocsData.pages.some((page) => page.url === route.pagePath);
        const hasCurrentSite = Boolean(liveDocsDataBySite[route.site]);
        if (hasCurrentSite && hasCurrentPage) return;

        const nextSite = hasCurrentSite ? route.site : fallbackSite;
        const nextPagePath = nextDocsData.pages[0]?.url ?? "/";
        history.replaceState(null, "", toSiteUrl(nextSite, nextPagePath));
        setRoute({ site: nextSite, pagePath: nextPagePath });
    }, [liveDocsDataBySite, route.pagePath, route.site]);

    const syncEditorFromPage = React.useCallback((markdown: string) => {
        if (editorSaveTimerRef.current !== null) {
            window.clearTimeout(editorSaveTimerRef.current);
            editorSaveTimerRef.current = null;
        }

        setEditorText(markdown);
        setEditorSaveStatus("saved");
        setEditorSaveError("");
        setEditorSavedAt(null);
        editorTextRef.current = markdown;
        editorLastSavedTextRef.current = markdown;
        editorSavedChangesRef.current = false;
    }, []);

    React.useEffect(() => {
        setEditMode(false);
        syncEditorFromPage(currentPage.markdown);
    }, [currentPage.sourcePath, syncEditorFromPage]);

    React.useEffect(() => {
        if (editMode) return;

        syncEditorFromPage(currentPage.markdown);
    }, [currentPage.markdown, editMode, syncEditorFromPage]);

    React.useEffect(() => {
        editorTextRef.current = editorText;
    }, [editorText]);

    const navigateTo = React.useCallback(
        (url: string, nextSite = route.site) => {
            const nextPath = normalizePath(url);
            history.pushState(null, "", toSiteUrl(nextSite, nextPath));
            setRoute({ site: nextSite, pagePath: nextPath });
            window.scrollTo({ top: 0, behavior: "instant" });
        },
        [route.site],
    );

    const switchSite = React.useCallback(
        (nextSite: SiteKey) => {
            navigateTo(currentPage.url, nextSite);
        },
        [currentPage.url, navigateTo],
    );

    const toggleTheme = React.useCallback(() => {
        setTheme((current) => (current === "dark" ? "light" : "dark"));
    }, []);

    const toggleZenMode = React.useCallback(() => {
        setZenMode((current) => !current);
    }, []);

    const toggleRightSidebar = React.useCallback(() => {
        setUiSettings((current) => ({
            ...current,
            showRightSidebar: !current.showRightSidebar,
        }));
    }, []);

    const updateUiSetting = React.useCallback(
        <K extends keyof DocsUiSettings>(key: K, value: DocsUiSettings[K]) => {
            setUiSettings((current) => ({ ...current, [key]: value }));
        },
        [],
    );

    const resetUiSettings = React.useCallback(() => {
        setUiSettings(DEFAULT_UI_SETTINGS);
        setPinFontStepIndex(DEFAULT_PIN_FONT_STEP_INDEX);
        writeStorageValue(PIN_FONT_STEP_KEY, String(DEFAULT_PIN_FONT_STEP_INDEX));
    }, []);

    const resetLayoutWidths = React.useCallback(() => {
        setLeftSidebarWidth(DEFAULT_LEFT_SIDEBAR_WIDTH);
        setTocPanelWidth(DEFAULT_TOC_PANEL_WIDTH);
        setPinPanelWidth(DEFAULT_PIN_PANEL_WIDTH);
        writeStorageValue(LEFT_SIDEBAR_WIDTH_KEY, String(DEFAULT_LEFT_SIDEBAR_WIDTH));
        writeStorageValue(TOC_PANEL_WIDTH_KEY, String(DEFAULT_TOC_PANEL_WIDTH));
        writeStorageValue(PIN_PANEL_WIDTH_KEY, String(DEFAULT_PIN_PANEL_WIDTH));
    }, []);

    const copyCurrentPageMarkdown = React.useCallback(() => {
        void copyWithToast(currentPage.markdown, "Copied page Markdown.");
    }, [currentPage.markdown]);

    const copyCurrentPagePath = React.useCallback(() => {
        void copyWithToast(currentPage.sourcePath, "Copied page path.");
    }, [currentPage.sourcePath]);

    const copyCurrentUrl = React.useCallback(() => {
        void copyWithToast(location.href, "Copied current URL.");
    }, []);

    const saveEditorText = React.useCallback(
        async (markdown: string, options: { toastOnError?: boolean } = {}) => {
            if (!canEditMarkdown) return false;

            const requestId = editorSaveRequestRef.current + 1;
            editorSaveRequestRef.current = requestId;
            setEditorSaveStatus("saving");
            setEditorSaveError("");

            try {
                const response = await fetch("/__smooth-docs/save-markdown", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sourcePath: currentPage.sourcePath,
                        markdown,
                    }),
                });
                const data = (await response.json()) as Partial<SaveMarkdownResult> & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(data.error ?? "Failed to save Markdown");
                }

                if (requestId !== editorSaveRequestRef.current) return true;

                editorLastSavedTextRef.current = markdown;
                editorSavedChangesRef.current = true;
                setEditorSaveStatus("saved");
                setEditorSavedAt(Date.now());
                return true;
            } catch (error) {
                if (requestId === editorSaveRequestRef.current) {
                    const message = error instanceof Error ? error.message : "Unknown error";
                    setEditorSaveStatus("error");
                    setEditorSaveError(message);
                    if (options.toastOnError) {
                        toast.error("Auto-save failed.", {
                            description: message,
                        });
                    }
                }

                return false;
            }
        },
        [canEditMarkdown, currentPage.sourcePath],
    );

    const saveEditorNow = React.useCallback(() => {
        if (editorSaveTimerRef.current !== null) {
            window.clearTimeout(editorSaveTimerRef.current);
            editorSaveTimerRef.current = null;
        }

        void saveEditorText(editorTextRef.current, { toastOnError: true });
    }, [saveEditorText]);

    const regenerateDocsContent = React.useCallback(async () => {
        const response = await fetch("/__smooth-docs/regenerate", {
            method: "POST",
        });
        const data = (await response.json().catch(() => ({}))) as DocsContentUpdatePayload & {
            error?: string;
        };

        if (response.status === 404) return;

        if (!response.ok) {
            throw new Error(data.error ?? "Failed to regenerate docs content");
        }

        applyDocsContentUpdate(data);
    }, [applyDocsContentUpdate]);

    const enterEditMode = React.useCallback(() => {
        if (!canEditMarkdown) {
            toast.error("Current page is not a Markdown file.");
            return;
        }

        setEditorText(currentPage.markdown);
        setEditorSaveStatus("saved");
        setEditorSaveError("");
        setEditorSavedAt(null);
        editorTextRef.current = currentPage.markdown;
        editorLastSavedTextRef.current = currentPage.markdown;
        editorSavedChangesRef.current = false;
        setEditMode(true);
    }, [canEditMarkdown, currentPage.markdown]);

    const exitEditMode = React.useCallback(async () => {
        if (editorSaveTimerRef.current !== null) {
            window.clearTimeout(editorSaveTimerRef.current);
            editorSaveTimerRef.current = null;
        }

        const currentMarkdown = editorTextRef.current;
        if (currentMarkdown !== editorLastSavedTextRef.current) {
            const saved = await saveEditorText(currentMarkdown, { toastOnError: true });
            if (!saved) return;
        }

        const shouldRefreshPreview = editorSavedChangesRef.current;

        if (shouldRefreshPreview) {
            try {
                await regenerateDocsContent();
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                toast.error("Failed to update preview.", {
                    description: message,
                });
                return;
            }
        }

        setEditMode(false);
    }, [regenerateDocsContent, saveEditorText]);

    const toggleEditMode = React.useCallback(() => {
        if (editMode) {
            void exitEditMode();
            return;
        }

        enterEditMode();
    }, [editMode, enterEditMode, exitEditMode]);

    const switchToNextSite = React.useCallback(() => {
        if (availableSites.length < 2) return;

        const currentIndex = availableSites.indexOf(route.site);
        const nextSite = availableSites[(currentIndex + 1) % availableSites.length];
        if (nextSite) switchSite(nextSite);
    }, [route.site, switchSite]);

    const suppressNextHeaderScroll = React.useCallback(() => {
        suppressHeaderScrollRef.current = true;

        if (suppressHeaderScrollTimeoutRef.current !== null) {
            window.clearTimeout(suppressHeaderScrollTimeoutRef.current);
        }

        suppressHeaderScrollTimeoutRef.current = window.setTimeout(() => {
            suppressHeaderScrollRef.current = false;
            suppressHeaderScrollTimeoutRef.current = null;
        }, 100);
    }, []);

    const showPinToast = React.useCallback((message: string) => {
        setPinToast({ id: Date.now(), message });
    }, []);

    const closePinMenu = React.useCallback(() => {
        setPinMenu(null);
    }, []);

    const dismissPinToast = React.useCallback(() => {
        setPinToast(null);
    }, []);

    React.useEffect(() => {
        if (!editMode || !canEditMarkdown) return;

        if (editorText === editorLastSavedTextRef.current) {
            setEditorSaveStatus("saved");
            return;
        }

        setEditorSaveStatus("dirty");

        if (editorSaveTimerRef.current !== null) {
            window.clearTimeout(editorSaveTimerRef.current);
        }

        editorSaveTimerRef.current = window.setTimeout(() => {
            editorSaveTimerRef.current = null;
            void saveEditorText(editorTextRef.current, { toastOnError: true });
        }, 900);

        return () => {
            if (editorSaveTimerRef.current !== null) {
                window.clearTimeout(editorSaveTimerRef.current);
                editorSaveTimerRef.current = null;
            }
        };
    }, [canEditMarkdown, editMode, editorText, saveEditorText]);

    React.useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!editMode) return;
            if (editorTextRef.current === editorLastSavedTextRef.current) return;

            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [editMode]);

    const savePinnedBlocksForCurrentPage = React.useCallback(
        (blocks: PinnedBlock[]) => {
            setPinnedBlocks(blocks);
            writePinnedBlocks(pinPageKey, blocks);
        },
        [pinPageKey],
    );

    const addPinnedBlock = React.useCallback(
        (request: NonNullable<PinMenuRequest["block"]>) => {
            if (pinnedBlocks.length >= MAX_PINNED_BLOCKS) {
                showPinToast(`Pinned blocks are limited to ${MAX_PINNED_BLOCKS}.`);
                return;
            }

            const nextBlocks = [
                ...pinnedBlocks,
                {
                    id: `pin-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    label: request.label,
                    html: preparePinnedBlockHtml(request.html),
                },
            ];

            savePinnedBlocksForCurrentPage(nextBlocks);
            setSidebarOpen(false);
            request.sourceElement.classList.add("docs-pin-source--pinned");
            window.setTimeout(() => {
                request.sourceElement.classList.remove("docs-pin-source--pinned");
            }, 800);
            showPinToast("Pinned block added.");
        },
        [pinnedBlocks, savePinnedBlocksForCurrentPage, showPinToast],
    );

    const removePinnedBlock = React.useCallback(
        (id: string) => {
            savePinnedBlocksForCurrentPage(pinnedBlocks.filter((block) => block.id !== id));
        },
        [pinnedBlocks, savePinnedBlocksForCurrentPage],
    );

    const clearPinnedBlocks = React.useCallback(() => {
        savePinnedBlocksForCurrentPage([]);
        showPinToast("Pinned blocks cleared.");
    }, [savePinnedBlocksForCurrentPage, showPinToast]);

    const changePinFontStep = React.useCallback((delta: number) => {
        setPinFontStepIndex((current) => {
            const next = clamp(current + delta, 0, PIN_FONT_STEPS.length - 1);
            writeStorageValue(PIN_FONT_STEP_KEY, String(next));
            return next;
        });
    }, []);

    const updatePinFontStepIndex = React.useCallback((index: number) => {
        const next = clamp(index, 0, PIN_FONT_STEPS.length - 1);
        setPinFontStepIndex(next);
        writeStorageValue(PIN_FONT_STEP_KEY, String(next));
    }, []);

    const updatePinPanelWidth = React.useCallback((width: number) => {
        const next = clampPinPanelWidth(width);
        setPinPanelWidth(next);
        writeStorageValue(PIN_PANEL_WIDTH_KEY, String(next));
    }, []);

    const updateLeftSidebarWidth = React.useCallback((width: number) => {
        const next = clampLeftSidebarWidth(width);
        setLeftSidebarWidth(next);
        writeStorageValue(LEFT_SIDEBAR_WIDTH_KEY, String(next));
    }, []);

    const updateTocPanelWidth = React.useCallback((width: number) => {
        const next = clampTocPanelWidth(width);
        setTocPanelWidth(next);
        writeStorageValue(TOC_PANEL_WIDTH_KEY, String(next));
    }, []);

    React.useEffect(() => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        localStorage.setItem("smooth-docs-theme", theme);
    }, [theme]);

    React.useEffect(() => {
        setUiSettings((current) => {
            if (isCodeThemeAvailableForTheme(current.codeTheme, theme)) return current;

            return {
                ...current,
                codeTheme: getDefaultCodeThemeForTheme(theme),
            };
        });
    }, [theme]);

    React.useEffect(() => {
        writeStorageValue(UI_SETTINGS_STORAGE_KEY, JSON.stringify(uiSettings));
    }, [uiSettings]);

    React.useEffect(() => {
        const onPopState = () => setRoute(readRoute());
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, []);

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const code = event.code;
            const primary = isPrimaryShortcut(event);

            if (primary && event.shiftKey && !event.altKey && code === "KeyB") {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                if (!event.repeat) toggleRightSidebar();
                return;
            }

            if (event.defaultPrevented) return;

            const plainPrimary = primary && !event.altKey && !event.shiftKey;
            const editableTarget = isEditableShortcutTarget(event.target);

            if (plainPrimary && code === "KeyK") {
                event.preventDefault();
                setCommandOpen((open) => !open);
                return;
            }

            if (plainPrimary && (code === "Comma" || event.key === ",")) {
                event.preventDefault();
                setSettingsOpen(true);
                return;
            }

            if (editableTarget) return;

            if (!primary && !event.altKey && !event.shiftKey && code === "KeyZ") {
                event.preventDefault();
                toggleZenMode();
                return;
            }

            if (primary && event.altKey && !event.shiftKey && code === "KeyL") {
                event.preventDefault();
                toggleTheme();
                return;
            }

            if (primary && event.altKey && !event.shiftKey && code === "KeyM") {
                event.preventDefault();
                copyCurrentPageMarkdown();
                return;
            }

            if (plainPrimary && code === "KeyP") {
                event.preventDefault();
                copyCurrentPagePath();
                return;
            }

            if (plainPrimary && code === "KeyU") {
                event.preventDefault();
                copyCurrentUrl();
                return;
            }

            if (primary && event.shiftKey && !event.altKey && code === "KeyI") {
                event.preventDefault();
                switchToNextSite();
                return;
            }
        };

        window.addEventListener("keydown", onKeyDown, { capture: true });
        return () => window.removeEventListener("keydown", onKeyDown, true);
    }, [
        copyCurrentPageMarkdown,
        copyCurrentPagePath,
        copyCurrentUrl,
        switchToNextSite,
        toggleRightSidebar,
        toggleTheme,
        toggleZenMode,
    ]);

    React.useEffect(() => {
        document.title = `${currentPage.title} | ${docsData.siteTitle}`;
    }, [currentPage.title, docsData.siteTitle]);

    React.useEffect(() => {
        if (!uiSettings.autoHideHeader) {
            setHeaderVisible(true);
            return;
        }

        let lastY = window.scrollY;
        let frameId: number | null = null;

        const onScroll = () => {
            if (frameId !== null) return;

            frameId = window.requestAnimationFrame(() => {
                const currentY = window.scrollY;
                const delta = currentY - lastY;

                if (suppressHeaderScrollRef.current) {
                    suppressHeaderScrollRef.current = false;
                    if (suppressHeaderScrollTimeoutRef.current !== null) {
                        window.clearTimeout(suppressHeaderScrollTimeoutRef.current);
                        suppressHeaderScrollTimeoutRef.current = null;
                    }
                    lastY = currentY;
                    frameId = null;
                    return;
                }

                if (currentY < 24) {
                    setHeaderVisible(true);
                } else if (delta > 8) {
                    setHeaderVisible(false);
                } else if (delta < -4) {
                    setHeaderVisible(true);
                }

                lastY = currentY;
                frameId = null;
            });
        };

        window.addEventListener("scroll", onScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", onScroll);
            if (frameId !== null) window.cancelAnimationFrame(frameId);
            if (suppressHeaderScrollTimeoutRef.current !== null) {
                window.clearTimeout(suppressHeaderScrollTimeoutRef.current);
                suppressHeaderScrollTimeoutRef.current = null;
            }
        };
    }, [uiSettings.autoHideHeader]);

    React.useEffect(() => {
        setHeaderVisible(true);
    }, [commandOpen, route.pagePath, route.site]);

    return (
        <SidebarProvider
            className={cn(uiSettings.reduceMotion && "docs-reduce-motion")}
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
            style={{ "--sidebar-width": `${leftSidebarWidth}px` } as React.CSSProperties}>
            {!zenMode && (
                <DocsSidebar
                    currentPath={currentPage.url}
                    items={docsData.nav}
                    onNavigate={(url) => navigateTo(url)}
                    onSettingsOpen={() => setSettingsOpen(true)}
                    onWidthChange={updateLeftSidebarWidth}
                    pageUrls={pageUrls}
                    siteTitle={docsData.siteTitle}
                    width={leftSidebarWidth}
                    wrapText={uiSettings.leftSidebarWrap}
                />
            )}

            <ActionCommandDialog
                canEditMarkdown={canEditMarkdown}
                docsData={docsData}
                editMode={editMode}
                onCopyMarkdown={copyCurrentPageMarkdown}
                onCopyPath={copyCurrentPagePath}
                onCopyUrl={copyCurrentUrl}
                onCreateMarkdown={() => setCreateMarkdownOpen(true)}
                onPromoteDraft={() => setPromoteDraftOpen(true)}
                onDeleteMarkdown={() => setDeleteMarkdownOpen(true)}
                onNavigate={navigateTo}
                onNextSite={switchToNextSite}
                onOpenChange={setCommandOpen}
                onSiteChange={switchSite}
                onThemeChange={setTheme}
                onToggleEditMode={toggleEditMode}
                onZenModeToggle={toggleZenMode}
                canPromoteDraft={
                    availableSites.includes("published") &&
                    route.site === "draft" &&
                    currentPage.sourcePath.startsWith("draft/docs/")
                }
                canDeleteMarkdown={isDocsMarkdownSourcePath(currentPage.sourcePath)}
                open={commandOpen}
                site={route.site}
                theme={theme}
                zenMode={zenMode}
            />

            <PromoteDraftDialog
                currentPage={currentPage}
                open={promoteDraftOpen && route.site === "draft"}
                onOpenChange={setPromoteDraftOpen}
                onPromoted={(url, payload) => {
                    applyDocsContentUpdate(payload);
                    navigateTo(url, "published");
                }}
            />

            <CreateMarkdownDialog
                currentPage={currentPage}
                open={createMarkdownOpen}
                onOpenChange={setCreateMarkdownOpen}
                onCreated={(site, url, payload) => {
                    applyDocsContentUpdate(payload);
                    navigateTo(url, site);
                }}
                site={route.site}
            />

            <DeleteMarkdownDialog
                currentPage={currentPage}
                open={deleteMarkdownOpen && isDocsMarkdownSourcePath(currentPage.sourcePath)}
                onOpenChange={setDeleteMarkdownOpen}
                onDeleted={(site, payload) => {
                    applyDocsContentUpdate(payload);
                    navigateTo("/", site);
                }}
            />

            <DocsSettingsDialog
                leftSidebarWidth={leftSidebarWidth}
                onLayoutWidthsReset={resetLayoutWidths}
                onOpenChange={setSettingsOpen}
                onPinFontStepChange={updatePinFontStepIndex}
                onSettingsChange={updateUiSetting}
                onSettingsReset={resetUiSettings}
                onThemeChange={setTheme}
                open={settingsOpen}
                pinFontStepIndex={pinFontStepIndex}
                pinPanelWidth={pinPanelWidth}
                settings={uiSettings}
                theme={theme}
                tocPanelWidth={tocPanelWidth}
            />

            <SidebarInset>
                {!zenMode && (
                    <header
                        className={cn(
                            "sticky top-0 z-40 border-b bg-background/95 transition-[transform,opacity] duration-300 ease-out",
                            headerVisible
                                ? "translate-y-0 opacity-100"
                                : "-translate-y-full opacity-0",
                        )}>
                        <div className='flex h-14 items-center gap-3 px-4 lg:px-6'>
                            <SidebarTrigger aria-label='Toggle navigation' />

                            <div className='ml-auto flex items-center gap-2'>
                                <SiteToggle site={route.site} onSiteChange={switchSite} />

                                <Button
                                    variant='ghost'
                                    size='icon'
                                    onClick={toggleTheme}
                                    aria-label={
                                        theme === "dark"
                                            ? "Switch to light theme"
                                            : "Switch to dark theme"
                                    }>
                                    {theme === "dark" ? (
                                        <Sun className='h-4 w-4' />
                                    ) : (
                                        <Moon className='h-4 w-4' />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </header>
                )}

                <main className='min-w-0 flex-1 px-4 md:px-8'>
                    <div
                        style={
                            {
                                "--docs-main-max-width": getMainMaxWidth(uiSettings.mainWidth),
                                "--docs-code-font-family": getCodeFontFamily(
                                    uiSettings.codeFontFamily,
                                ),
                                "--docs-code-font-size": `${uiSettings.codeFontSize}px`,
                                "--docs-code-line-height": getCodeLineHeight(
                                    uiSettings.codeLineHeight,
                                ),
                                "--docs-code-max-height": getCodeMaxHeight(
                                    uiSettings.codeMaxHeight,
                                ),
                                "--docs-editor-font-size": `${uiSettings.editorFontSize}px`,
                                "--docs-mermaid-padding": getMermaidPadding(
                                    uiSettings.mermaidDensity,
                                ),
                                "--docs-toc-width": `${tocPanelWidth}px`,
                                "--docs-pin-panel-width": `${pinPanelWidth}px`,
                            } as React.CSSProperties
                        }
                        className={cn(
                            "flex w-full flex-col gap-8",
                            `docs-density-${uiSettings.density}`,
                            `docs-code-theme-${uiSettings.codeTheme}`,
                            uiSettings.codeWrap && "docs-code-wrap",
                            uiSettings.editorWrap && "docs-editor-wrap",
                            canRenderSidePanel && "lg:flex-row lg:items-start",
                        )}>
                        <div className='min-w-0 flex-1 py-8'>
                            <div
                                className={cn(
                                    "mx-auto flex w-full flex-col gap-0",
                                    hasPinnedBlocks
                                        ? "max-w-none"
                                        : "max-w-[var(--docs-main-max-width)]",
                                )}>
                                <PageHeader
                                    breadcrumbs={pageBreadcrumbs}
                                    canEditMarkdown={canEditMarkdown}
                                    editMode={editMode}
                                    onEditModeToggle={toggleEditMode}
                                    onNavigate={navigateTo}
                                    page={currentPage}
                                    showBreadcrumbs={uiSettings.showBreadcrumbs}
                                />
                                {editMode ? (
                                    <MarkdownEditor
                                        key={`${route.site}-${currentPage.url}-editor`}
                                        fontSize={uiSettings.editorFontSize}
                                        onChange={setEditorText}
                                        onSaveNow={saveEditorNow}
                                        saveError={editorSaveError}
                                        savedAt={editorSavedAt}
                                        saveStatus={editorSaveStatus}
                                        sourcePath={currentPage.sourcePath}
                                        value={editorText}
                                        wrapText={uiSettings.editorWrap}
                                    />
                                ) : (
                                    <Article
                                        key={`${route.site}-${currentPage.url}`}
                                        page={currentPage}
                                        onPinMenuRequest={setPinMenu}
                                    />
                                )}
                            </div>
                        </div>

                        {canRenderSidePanel && hasPinnedBlocks ? (
                            <PinnedBlocksPanel
                                blocks={pinnedBlocks}
                                fontStepIndex={pinFontStepIndex}
                                headerVisible={headerVisible}
                                onClear={clearPinnedBlocks}
                                onFontStepChange={changePinFontStep}
                                open={rightSidebarOpen}
                                onRemove={removePinnedBlock}
                                onWidthChange={updatePinPanelWidth}
                                wrapText={uiSettings.pinPanelWrap}
                                width={pinPanelWidth}
                            />
                        ) : canRenderSidePanel ? (
                            <TableOfContents
                                items={tableOfContents}
                                headerVisible={headerVisible}
                                onJump={suppressNextHeaderScroll}
                                open={rightSidebarOpen}
                                onWidthChange={updateTocPanelWidth}
                                wrapText={uiSettings.rightSidebarWrap}
                                width={tocPanelWidth}
                            />
                        ) : null}
                    </div>
                </main>
            </SidebarInset>

            <PinContextMenu
                request={pinMenu}
                onClose={closePinMenu}
                onCopyMarkdown={(markdown) => {
                    void copyWithToast(markdown, "Copied Markdown.").then((copied) => {
                        if (copied) setPinMenu(null);
                    });
                }}
                onPin={(block) => {
                    addPinnedBlock(block);
                    setPinMenu(null);
                }}
            />
            <Toaster position='bottom-right' theme={theme} closeButton />
            <PinToast toast={pinToast} onDone={dismissPinToast} />
        </SidebarProvider>
    );
}

function TableOfContents({
    headerVisible,
    items,
    onJump,
    open,
    onWidthChange,
    wrapText,
    width,
}: {
    headerVisible: boolean;
    items: TableOfContentsItem[];
    onJump: () => void;
    open: boolean;
    onWidthChange: (width: number) => void;
    wrapText: boolean;
    width: number;
}) {
    const [activeId, setActiveId] = React.useState(items[0]?.id ?? "");

    React.useEffect(() => {
        setActiveId(items[0]?.id ?? "");
    }, [items]);

    React.useEffect(() => {
        if (items.length === 0) return;

        let frameId: number | null = null;

        const updateActiveHeading = () => {
            frameId = null;

            const offset = 96;
            let nextActiveId = items[0]?.id ?? "";

            for (const item of items) {
                const heading = document.getElementById(item.id);
                if (!heading) continue;

                if (heading.getBoundingClientRect().top <= offset) {
                    nextActiveId = item.id;
                } else {
                    break;
                }
            }

            setActiveId(nextActiveId);
        };

        const scheduleUpdate = () => {
            if (frameId !== null) return;
            frameId = window.requestAnimationFrame(updateActiveHeading);
        };

        updateActiveHeading();
        window.addEventListener("scroll", scheduleUpdate, { passive: true });
        window.addEventListener("resize", scheduleUpdate);

        return () => {
            window.removeEventListener("scroll", scheduleUpdate);
            window.removeEventListener("resize", scheduleUpdate);
            if (frameId !== null) window.cancelAnimationFrame(frameId);
        };
    }, [items]);

    if (items.length === 0) return null;

    const content = (
        <>
            <div className='mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground'>
                <BookOpen className='h-4 w-4' />
                <span>On this page</span>
            </div>
            <ol className='space-y-1'>
                {items.map((item) => (
                    <li key={item.id}>
                        <a
                            href={`#${encodeURIComponent(item.id)}`}
                            className={cn(
                                "block rounded-md px-2 py-1 text-sm leading-6 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                                item.level === 3 && "pl-5",
                                item.level >= 4 && "pl-8",
                                activeId === item.id &&
                                    "bg-accent font-medium text-accent-foreground",
                            )}
                            onClick={(event) => {
                                event.preventDefault();

                                const heading = document.getElementById(item.id);
                                if (!heading) return;

                                setActiveId(item.id);
                                onJump();
                                heading.scrollIntoView({ behavior: "auto", block: "start" });
                                history.replaceState(
                                    null,
                                    "",
                                    `${location.pathname}${location.search}#${encodeURIComponent(item.id)}`,
                                );
                            }}>
                            {item.title}
                        </a>
                    </li>
                ))}
            </ol>
        </>
    );

    return (
        <>
            <nav
                aria-label='Table of contents'
                className={cn(
                    "order-first rounded-md border bg-card px-4 py-3 lg:hidden",
                    !open && "hidden",
                    wrapText && "docs-toc-desktop--wrap",
                )}>
                {content}
            </nav>
            <aside
                aria-hidden={!open}
                className={cn(
                    "docs-toc-panel-desktop sticky hidden min-w-0 shrink-0 overflow-hidden transition-[width,top,height] duration-300 ease-smooth lg:block",
                    headerVisible ? "top-14 h-[calc(100vh-3.5rem)]" : "top-0 h-screen",
                    !open && "pointer-events-none",
                )}
                style={{ width: open ? "var(--docs-toc-width)" : "0px" }}>
                {open && (
                    <SidebarWidthResizer
                        ariaLabel='Resize table of contents'
                        side='right'
                        width={width}
                        onWidthChange={onWidthChange}
                    />
                )}
                <nav
                    aria-label='Table of contents'
                    className={cn(
                        "docs-toc-desktop h-full w-[var(--docs-toc-width)] overflow-y-auto border-l pb-1 pl-4 pr-0 pt-8",
                        wrapText && "docs-toc-desktop--wrap",
                    )}>
                    {content}
                </nav>
            </aside>
        </>
    );
}

function SidebarWidthResizer({
    ariaLabel,
    onWidthChange,
    side,
    width,
}: {
    ariaLabel: string;
    onWidthChange: (width: number) => void;
    side: "left" | "right";
    width: number;
}) {
    const widthRef = React.useRef(width);
    const dragRef = React.useRef<{ x: number; width: number } | null>(null);

    React.useEffect(() => {
        widthRef.current = width;
    }, [width]);

    React.useEffect(
        () => () => {
            document.body.classList.remove("docs-sidebar-resizing");
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        },
        [],
    );

    const beginResize = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;

        dragRef.current = { x: event.clientX, width: widthRef.current };
        event.currentTarget.setPointerCapture(event.pointerId);
        document.body.classList.add("docs-sidebar-resizing");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        event.preventDefault();
    }, []);

    const updateResize = React.useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!dragRef.current) return;

            const delta =
                side === "left"
                    ? event.clientX - dragRef.current.x
                    : dragRef.current.x - event.clientX;
            onWidthChange(dragRef.current.width + delta);
        },
        [onWidthChange, side],
    );

    const endResize = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;

        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        document.body.classList.remove("docs-sidebar-resizing");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    }, []);

    const resizeWithKeyboard = React.useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

            event.preventDefault();
            const delta = event.key === "ArrowRight" ? 24 : -24;
            onWidthChange(widthRef.current + (side === "left" ? delta : -delta));
        },
        [onWidthChange, side],
    );

    return (
        <div
            role='separator'
            aria-label={ariaLabel}
            aria-orientation='vertical'
            className='docs-sidebar-resizer'
            data-side={side}
            tabIndex={0}
            onKeyDown={resizeWithKeyboard}
            onPointerCancel={endResize}
            onPointerDown={beginResize}
            onPointerMove={updateResize}
            onPointerUp={endResize}
        />
    );
}

function PinnedBlocksPanel({
    blocks,
    fontStepIndex,
    headerVisible,
    onClear,
    onFontStepChange,
    open,
    onRemove,
    onWidthChange,
    wrapText,
    width,
}: {
    blocks: PinnedBlock[];
    fontStepIndex: number;
    headerVisible: boolean;
    onClear: () => void;
    onFontStepChange: (delta: number) => void;
    open: boolean;
    onRemove: (id: string) => void;
    onWidthChange: (width: number) => void;
    wrapText: boolean;
    width: number;
}) {
    const widthRef = React.useRef(width);
    const dragRef = React.useRef<{ x: number; width: number } | null>(null);
    const fontSizeStyle = {
        "--docs-pin-font-size": `${PIN_FONT_STEPS[fontStepIndex]}em`,
    } as React.CSSProperties;

    React.useEffect(() => {
        widthRef.current = width;
    }, [width]);

    const beginResize = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;

        dragRef.current = { x: event.clientX, width: widthRef.current };
        event.currentTarget.setPointerCapture(event.pointerId);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        event.preventDefault();
    }, []);

    const updateResize = React.useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!dragRef.current) return;

            const delta = dragRef.current.x - event.clientX;
            onWidthChange(dragRef.current.width + delta);
        },
        [onWidthChange],
    );

    const endResize = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;

        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    }, []);

    const resizeWithKeyboard = React.useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

            event.preventDefault();
            onWidthChange(widthRef.current + (event.key === "ArrowLeft" ? 24 : -24));
        },
        [onWidthChange],
    );

    const renderPanelContent = () => (
        <div className={cn("docs-pin-panel-shell", wrapText && "docs-pin-panel-shell--wrap")}>
            <div className='docs-pin-panel-header'>
                <div className='flex min-w-0 items-center gap-2'>
                    <Pin className='h-4 w-4 shrink-0 text-muted-foreground' />
                    <span className='truncate text-sm font-medium'>Pinned blocks</span>
                    <span className='rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'>
                        {blocks.length}
                    </span>
                </div>

                <div className='flex shrink-0 items-center gap-1'>
                    <Button
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7'
                        disabled={fontStepIndex === 0}
                        aria-label='Decrease pinned block text size'
                        onClick={() => onFontStepChange(-1)}>
                        <Minus className='h-3.5 w-3.5' />
                    </Button>
                    <Button
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7'
                        disabled={fontStepIndex === PIN_FONT_STEPS.length - 1}
                        aria-label='Increase pinned block text size'
                        onClick={() => onFontStepChange(1)}>
                        <Plus className='h-3.5 w-3.5' />
                    </Button>
                    <Button
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7'
                        aria-label='Clear pinned blocks'
                        onClick={onClear}>
                        <Trash2 className='h-3.5 w-3.5' />
                    </Button>
                </div>
            </div>

            <div className='docs-pin-panel-body' style={fontSizeStyle}>
                {blocks.map((block) => (
                    <section key={block.id} className='docs-pin-item'>
                        <div className='docs-pin-item-header'>
                            <div
                                className={cn(
                                    "min-w-0 text-sm font-medium text-muted-foreground",
                                    wrapText ? "break-words" : "truncate",
                                )}>
                                {block.label}
                            </div>
                            <Button
                                variant='ghost'
                                size='icon'
                                className='h-6 w-6 shrink-0'
                                aria-label={`Remove pinned block: ${block.label}`}
                                onClick={() => onRemove(block.id)}>
                                <X className='h-3.5 w-3.5' />
                            </Button>
                        </div>
                        <div
                            className='docs-pin-item-content docs-prose'
                            dangerouslySetInnerHTML={{ __html: block.html }}
                        />
                    </section>
                ))}
            </div>
        </div>
    );

    return (
        <>
            <section
                aria-label='Pinned blocks'
                className={cn(
                    "docs-pin-panel-mobile order-first rounded-md border bg-card lg:hidden",
                    !open && "hidden",
                )}>
                {renderPanelContent()}
            </section>

            <aside
                aria-label='Pinned blocks'
                aria-hidden={!open}
                className={cn(
                    "docs-pin-panel-desktop sticky hidden shrink-0 overflow-hidden transition-[width,top,height] duration-300 ease-smooth lg:block",
                    headerVisible ? "top-14 h-[calc(100vh-3.5rem)]" : "top-0 h-screen",
                    !open && "pointer-events-none",
                )}
                style={{ width: open ? "var(--docs-pin-panel-width)" : "0px" }}>
                <div className='w-[var(--docs-pin-panel-width)]'>
                    {open && (
                        <div
                            role='separator'
                            aria-label='Resize pinned blocks panel'
                            aria-orientation='vertical'
                            className='docs-pin-resizer'
                            tabIndex={0}
                            onKeyDown={resizeWithKeyboard}
                            onPointerCancel={endResize}
                            onPointerDown={beginResize}
                            onPointerMove={updateResize}
                            onPointerUp={endResize}
                        />
                    )}
                    {renderPanelContent()}
                </div>
            </aside>
        </>
    );
}

function PinContextMenu({
    onClose,
    onCopyMarkdown,
    onPin,
    request,
}: {
    onClose: () => void;
    onCopyMarkdown: (markdown: string) => void;
    onPin: (block: NonNullable<PinMenuRequest["block"]>) => void;
    request: PinMenuRequest | null;
}) {
    const ref = React.useRef<HTMLDivElement>(null);
    const [position, setPosition] = React.useState({ x: 0, y: 0 });

    React.useLayoutEffect(() => {
        if (!request) return;

        setPosition({ x: request.x, y: request.y });

        window.requestAnimationFrame(() => {
            const menu = ref.current;
            if (!menu) return;

            const rect = menu.getBoundingClientRect();
            const padding = 8;
            setPosition({
                x: Math.min(request.x, window.innerWidth - rect.width - padding),
                y: Math.min(request.y, window.innerHeight - rect.height - padding),
            });
        });
    }, [request]);

    React.useEffect(() => {
        if (!request) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (target instanceof Node && ref.current?.contains(target)) return;
            onClose();
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };

        const handleScroll = () => onClose();

        document.addEventListener("pointerdown", handlePointerDown, true);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown, true);
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("scroll", handleScroll);
        };
    }, [onClose, request]);

    if (!request) return null;

    const selectedMarkdown = request.selectedMarkdown;
    const block = request.block;
    const markdownToCopy = selectedMarkdown ?? block?.markdown;

    return (
        <div
            ref={ref}
            className='docs-pin-context-menu'
            style={{ left: position.x, top: position.y }}
            role='menu'>
            {markdownToCopy && (
                <button
                    type='button'
                    className='docs-pin-context-menu-item'
                    role='menuitem'
                    onClick={() => onCopyMarkdown(markdownToCopy)}>
                    <Copy className='h-3.5 w-3.5' />
                    <span className='min-w-0 truncate'>
                        {selectedMarkdown ? "Copy selected markdown" : "Copy block markdown"}
                    </span>
                </button>
            )}
            {block && (
                <button
                    type='button'
                    className='docs-pin-context-menu-item'
                    role='menuitem'
                    onClick={() => onPin(block)}>
                    <Pin className='h-3.5 w-3.5' />
                    <span className='min-w-0 truncate'>Pin block</span>
                </button>
            )}
        </div>
    );
}

function PinToast({ onDone, toast }: { onDone: () => void; toast: PinToastState | null }) {
    const [visible, setVisible] = React.useState(false);

    React.useEffect(() => {
        if (!toast) return;

        setVisible(false);
        const frame = window.requestAnimationFrame(() => setVisible(true));
        const hideTimer = window.setTimeout(() => setVisible(false), 1600);
        const doneTimer = window.setTimeout(onDone, 1900);

        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(hideTimer);
            window.clearTimeout(doneTimer);
        };
    }, [onDone, toast]);

    if (!toast) return null;

    return (
        <div className={cn("docs-pin-toast", visible && "docs-pin-toast--visible")} role='status'>
            {toast.message}
        </div>
    );
}

function ActionCommandDialog({
    canDeleteMarkdown,
    canEditMarkdown,
    canPromoteDraft,
    docsData,
    editMode,
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
    canDeleteMarkdown: boolean;
    canEditMarkdown: boolean;
    canPromoteDraft: boolean;
    docsData: DocsData;
    editMode: boolean;
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
    const run = React.useCallback(
        (action: () => void | Promise<void>) => {
            onOpenChange(false);
            void action();
        },
        [onOpenChange],
    );

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange} title='Smooth Docs actions'>
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
                    {canEditMarkdown && (
                        <CommandItem
                            value='toggle edit mode markdown editor'
                            onSelect={() => run(onToggleEditMode)}>
                            <FileText className='h-4 w-4 text-muted-foreground' />
                            <span>{editMode ? "Exit edit mode" : "Edit current Markdown"}</span>
                        </CommandItem>
                    )}
                    <CommandItem
                        value='create add new markdown file page'
                        onSelect={() => run(onCreateMarkdown)}>
                        <Plus className='h-4 w-4 text-muted-foreground' />
                        <span>Create Markdown file</span>
                    </CommandItem>
                    <CommandItem
                        value='copy markdown md source'
                        onSelect={() => run(onCopyMarkdown)}>
                        <FileText className='h-4 w-4 text-muted-foreground' />
                        <span>Copy current page markdown</span>
                        <CommandShortcut>⌘⌥M</CommandShortcut>
                    </CommandItem>
                    <CommandItem value='copy path source file' onSelect={() => run(onCopyPath)}>
                        <Copy className='h-4 w-4 text-muted-foreground' />
                        <span>Copy current page path</span>
                        <CommandShortcut>⌘P</CommandShortcut>
                    </CommandItem>
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
                    {canPromoteDraft && (
                        <CommandItem
                            value='copy publish current draft markdown published'
                            onSelect={() => run(onPromoteDraft)}>
                            <FileText className='h-4 w-4 text-muted-foreground' />
                            <span>Publish current draft</span>
                        </CommandItem>
                    )}
                    {canDeleteMarkdown && (
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
                            value={`open ${page.title} ${page.sourcePath}`}
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

function CreateMarkdownDialog({
    currentPage,
    onCreated,
    onOpenChange,
    open,
    site,
}: {
    currentPage: DocPage;
    onCreated: (site: SiteKey, url: string, payload: DocsContentUpdatePayload) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    site: SiteKey;
}) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const defaultFilePath = React.useMemo(() => {
        const relativePath = getSiteSourceRelativePath(currentPage.sourcePath, site);
        const folderPath = relativePath ? getPathDirName(relativePath) : "";

        return folderPath ? `${folderPath}/new.md` : "new.md";
    }, [currentPage.sourcePath, site]);
    const [filePath, setFilePath] = React.useState(defaultFilePath);
    const [folderSuggestions, setFolderSuggestions] = React.useState<FolderSuggestion[]>([]);
    const [selectedFolderIndex, setSelectedFolderIndex] = React.useState(0);
    const [loadingFolders, setLoadingFolders] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const filePreview = React.useMemo(
        () => `${site}/docs/${normalizeClientNewMarkdownPath(filePath)}`,
        [filePath, site],
    );

    React.useEffect(() => {
        if (!open) return;

        setFilePath(defaultFilePath);
        setSelectedFolderIndex(0);
        setSubmitting(false);
        window.requestAnimationFrame(() => inputRef.current?.focus());
    }, [defaultFilePath, open]);

    React.useEffect(() => {
        if (!open) return;

        const controller = new AbortController();
        const query = getDestinationFolderQuery(filePath);
        setLoadingFolders(true);

        void fetch(`/__smooth-docs/folders?site=${site}&query=${encodeURIComponent(query)}`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) throw new Error("Failed to load folder suggestions");

                const data = (await response.json()) as { folders?: FolderSuggestion[] };
                setFolderSuggestions(Array.isArray(data.folders) ? data.folders : []);
            })
            .catch((error) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setFolderSuggestions([]);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingFolders(false);
            });

        return () => controller.abort();
    }, [filePath, open, site]);

    React.useEffect(() => {
        setSelectedFolderIndex(0);
    }, [folderSuggestions]);

    const chooseFolder = React.useCallback(
        (folderPath: string) => {
            const fileName = getPathFileName(normalizeClientNewMarkdownPath(filePath)) || "new.md";
            setFilePath(joinDocsPath(folderPath, fileName));
            window.requestAnimationFrame(() => inputRef.current?.focus());
        },
        [filePath],
    );

    const submit = React.useCallback(async () => {
        if (submitting) return;

        setSubmitting(true);

        try {
            const response = await fetch("/__smooth-docs/create-markdown", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ site, filePath }),
            });
            const data = (await response.json().catch(() => ({}))) as Partial<CreateMarkdownResult> & {
                error?: string;
            };

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("Restart the dev server to enable file creation.");
                }

                throw new Error(data.error ?? "Failed to create Markdown file");
            }

            if (!data.url || !data.sourcePath || !data.site) {
                throw new Error("Invalid response from docs action");
            }

            toast.success("Created Markdown file.", {
                description: data.sourcePath,
            });
            onOpenChange(false);
            onCreated(data.site, data.url, data);
        } catch (error) {
            toast.error("Create failed.", {
                description: error instanceof Error ? error.message : "Unknown error",
            });
        } finally {
            setSubmitting(false);
        }
    }, [filePath, onCreated, onOpenChange, site, submitting]);

    const onInputKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "ArrowDown" && folderSuggestions.length > 0) {
                event.preventDefault();
                setSelectedFolderIndex((index) => (index + 1) % folderSuggestions.length);
                return;
            }

            if (event.key === "ArrowUp" && folderSuggestions.length > 0) {
                event.preventDefault();
                setSelectedFolderIndex(
                    (index) => (index - 1 + folderSuggestions.length) % folderSuggestions.length,
                );
                return;
            }

            if (event.key === "Enter") {
                event.preventDefault();
                const selectedFolder = folderSuggestions[selectedFolderIndex];
                if (selectedFolder) {
                    chooseFolder(selectedFolder.path);
                    return;
                }

                void submit();
            }
        },
        [chooseFolder, folderSuggestions, selectedFolderIndex, submit],
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-2xl'>
                <DialogTitle>Create Markdown file</DialogTitle>
                <DialogDescription>
                    Create a new Markdown file in the current docs site.
                </DialogDescription>

                <div className='space-y-2'>
                    <div className='flex items-center justify-between gap-4'>
                        <label className='text-sm font-medium' htmlFor='create-markdown-path'>
                            File path
                        </label>
                        <span className='truncate text-xs text-muted-foreground'>
                            {getSiteLabel(site)}
                        </span>
                    </div>
                    <Input
                        ref={inputRef}
                        id='create-markdown-path'
                        value={filePath}
                        onChange={(event) => setFilePath(event.target.value)}
                        onKeyDown={onInputKeyDown}
                        placeholder='notes/new-page.md'
                        spellCheck={false}
                    />
                    <p className='truncate text-xs text-muted-foreground'>{filePreview}</p>
                </div>

                <div className='overflow-hidden rounded-md border'>
                    <div className='flex items-center justify-between border-b px-3 py-2'>
                        <span className='text-xs font-medium text-muted-foreground'>
                            Folder suggestions
                        </span>
                        {loadingFolders && (
                            <span className='text-xs text-muted-foreground'>Loading...</span>
                        )}
                    </div>
                    <div className='max-h-56 overflow-y-auto p-1'>
                        {folderSuggestions.length === 0 ? (
                            <div className='px-2 py-5 text-center text-sm text-muted-foreground'>
                                No matching folders
                            </div>
                        ) : (
                            folderSuggestions.map((folder, index) => (
                                <button
                                    key={folder.path}
                                    type='button'
                                    className={cn(
                                        "flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none",
                                        index === selectedFolderIndex
                                            ? "bg-accent text-accent-foreground"
                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                    )}
                                    onClick={() => chooseFolder(folder.path)}
                                    onMouseEnter={() => setSelectedFolderIndex(index)}>
                                    <Folder className='h-4 w-4 shrink-0' />
                                    <span className='truncate'>{folder.path}/</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className='flex justify-end gap-2'>
                    <Button
                        type='button'
                        variant='outline'
                        disabled={submitting}
                        onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type='button' disabled={submitting} onClick={() => void submit()}>
                        {submitting ? "Creating..." : "Create"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function PromoteDraftDialog({
    currentPage,
    onOpenChange,
    onPromoted,
    open,
}: {
    currentPage: DocPage;
    onOpenChange: (open: boolean) => void;
    onPromoted: (url: string, payload: DocsContentUpdatePayload) => void;
    open: boolean;
}) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const sourceRelativePath = React.useMemo(
        () => getDraftSourceRelativePath(currentPage.sourcePath) ?? "",
        [currentPage.sourcePath],
    );
    const sourceFileName = getPathFileName(sourceRelativePath) || "index.md";
    const defaultDestinationPath = sourceRelativePath || sourceFileName;
    const [destinationPath, setDestinationPath] = React.useState(defaultDestinationPath);
    const [folderSuggestions, setFolderSuggestions] = React.useState<FolderSuggestion[]>([]);
    const [selectedFolderIndex, setSelectedFolderIndex] = React.useState(0);
    const [loadingFolders, setLoadingFolders] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const destinationPreview = React.useMemo(
        () => `published/docs/${normalizeClientDestinationPath(destinationPath, sourceFileName)}`,
        [destinationPath, sourceFileName],
    );

    React.useEffect(() => {
        if (!open) return;

        setDestinationPath(defaultDestinationPath);
        setSelectedFolderIndex(0);
        setSubmitting(false);
        window.requestAnimationFrame(() => inputRef.current?.focus());
    }, [defaultDestinationPath, open]);

    React.useEffect(() => {
        if (!open) return;

        const controller = new AbortController();
        const query = getDestinationFolderQuery(destinationPath);
        setLoadingFolders(true);

        void fetch(
            `/__smooth-docs/folders?site=published&query=${encodeURIComponent(query)}`,
            { signal: controller.signal },
        )
            .then(async (response) => {
                if (!response.ok) throw new Error("Failed to load folder suggestions");

                const data = (await response.json()) as { folders?: FolderSuggestion[] };
                setFolderSuggestions(Array.isArray(data.folders) ? data.folders : []);
            })
            .catch((error) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setFolderSuggestions([]);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingFolders(false);
            });

        return () => controller.abort();
    }, [destinationPath, open]);

    React.useEffect(() => {
        setSelectedFolderIndex(0);
    }, [folderSuggestions]);

    const chooseFolder = React.useCallback(
        (folderPath: string) => {
            setDestinationPath(joinDocsPath(folderPath, sourceFileName));
            window.requestAnimationFrame(() => inputRef.current?.focus());
        },
        [sourceFileName],
    );

    const submit = React.useCallback(async () => {
        if (submitting) return;
        if (!currentPage.sourcePath.startsWith("draft/docs/")) {
            toast.error("Current page is not a draft Markdown file.");
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch("/__smooth-docs/promote-draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourcePath: currentPage.sourcePath,
                    destinationPath,
                }),
            });
            const data = (await response.json()) as Partial<PromoteDraftResult> & {
                error?: string;
            };

            if (!response.ok) {
                throw new Error(data.error ?? "Failed to publish draft");
            }

            if (!data.url || !data.destinationPath) {
                throw new Error("Invalid response from docs action");
            }

            toast.success("Published draft.", {
                description: data.destinationPath,
            });
            onOpenChange(false);
            onPromoted(data.url, data);
        } catch (error) {
            toast.error("Publish failed.", {
                description: error instanceof Error ? error.message : "Unknown error",
            });
        } finally {
            setSubmitting(false);
        }
    }, [currentPage.sourcePath, destinationPath, onOpenChange, onPromoted, submitting]);

    const onInputKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "ArrowDown" && folderSuggestions.length > 0) {
                event.preventDefault();
                setSelectedFolderIndex((index) => (index + 1) % folderSuggestions.length);
                return;
            }

            if (event.key === "ArrowUp" && folderSuggestions.length > 0) {
                event.preventDefault();
                setSelectedFolderIndex(
                    (index) => (index - 1 + folderSuggestions.length) % folderSuggestions.length,
                );
                return;
            }

            if (event.key === "Enter") {
                event.preventDefault();
                const selectedFolder = folderSuggestions[selectedFolderIndex];
                if (selectedFolder) {
                    chooseFolder(selectedFolder.path);
                    return;
                }

                void submit();
            }
        },
        [chooseFolder, folderSuggestions, selectedFolderIndex, submit],
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-2xl'>
                <DialogTitle>Publish draft</DialogTitle>
                <DialogDescription>
                    Copy the current draft Markdown file into published. The draft file stays in
                    place.
                </DialogDescription>

                <div className='space-y-2'>
                    <div className='flex items-center justify-between gap-4'>
                        <label className='text-sm font-medium' htmlFor='promote-draft-path'>
                            Destination path
                        </label>
                        <span className='truncate text-xs text-muted-foreground'>
                            {currentPage.sourcePath}
                        </span>
                    </div>
                    <Input
                        ref={inputRef}
                        id='promote-draft-path'
                        value={destinationPath}
                        onChange={(event) => setDestinationPath(event.target.value)}
                        onKeyDown={onInputKeyDown}
                        placeholder='report/current-file.md'
                        spellCheck={false}
                    />
                    <p className='truncate text-xs text-muted-foreground'>{destinationPreview}</p>
                </div>

                <div className='overflow-hidden rounded-md border'>
                    <div className='flex items-center justify-between border-b px-3 py-2'>
                        <span className='text-xs font-medium text-muted-foreground'>
                            Folder suggestions
                        </span>
                        {loadingFolders && (
                            <span className='text-xs text-muted-foreground'>Loading...</span>
                        )}
                    </div>
                    <div className='max-h-56 overflow-y-auto p-1'>
                        {folderSuggestions.length === 0 ? (
                            <div className='px-2 py-5 text-center text-sm text-muted-foreground'>
                                No matching folders
                            </div>
                        ) : (
                            folderSuggestions.map((folder, index) => (
                                <button
                                    key={folder.path}
                                    type='button'
                                    className={cn(
                                        "flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none",
                                        index === selectedFolderIndex
                                            ? "bg-accent text-accent-foreground"
                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                    )}
                                    onClick={() => chooseFolder(folder.path)}
                                    onMouseEnter={() => setSelectedFolderIndex(index)}>
                                    <Folder className='h-4 w-4 shrink-0' />
                                    <span className='truncate'>{folder.path}/</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className='flex justify-end gap-2'>
                    <Button
                        type='button'
                        variant='outline'
                        disabled={submitting}
                        onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type='button' disabled={submitting} onClick={() => void submit()}>
                        {submitting ? "Publishing..." : "Publish"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DeleteMarkdownDialog({
    currentPage,
    onDeleted,
    onOpenChange,
    open,
}: {
    currentPage: DocPage;
    onDeleted: (site: SiteKey, payload: DocsContentUpdatePayload) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (open) setSubmitting(false);
    }, [open]);

    const submit = React.useCallback(async () => {
        if (submitting) return;
        if (!isDocsMarkdownSourcePath(currentPage.sourcePath)) {
            toast.error("Current page is not a Markdown file.");
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch("/__smooth-docs/delete-markdown", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sourcePath: currentPage.sourcePath }),
            });
            const data = (await response.json()) as Partial<DeleteMarkdownResult> & {
                error?: string;
            };

            if (!response.ok) {
                throw new Error(data.error ?? "Failed to delete Markdown");
            }

            const site = data.site ?? getSiteFromSourcePath(currentPage.sourcePath);
            if (!site) {
                throw new Error("Invalid response from docs action");
            }

            toast.success("Deleted Markdown.", {
                description: data.sourcePath ?? currentPage.sourcePath,
            });
            onOpenChange(false);
            onDeleted(site, data);
        } catch (error) {
            toast.error("Delete failed.", {
                description: error instanceof Error ? error.message : "Unknown error",
            });
        } finally {
            setSubmitting(false);
        }
    }, [currentPage.sourcePath, onDeleted, onOpenChange, submitting]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-lg'>
                <DialogTitle>Delete Markdown file</DialogTitle>
                <DialogDescription>
                    Delete the current Markdown file from disk. This does not move it to trash.
                </DialogDescription>

                <div className='rounded-md border bg-muted/30 px-3 py-2'>
                    <p className='truncate text-sm font-medium'>{currentPage.title}</p>
                    <p className='truncate text-xs text-muted-foreground'>
                        {currentPage.sourcePath}
                    </p>
                </div>

                <div className='flex justify-end gap-2'>
                    <Button
                        type='button'
                        variant='outline'
                        disabled={submitting}
                        onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        type='button'
                        variant='destructive'
                        disabled={submitting}
                        onClick={() => void submit()}>
                        {submitting ? "Deleting..." : "Delete"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DocsSettingsDialog({
    leftSidebarWidth,
    onLayoutWidthsReset,
    onOpenChange,
    onPinFontStepChange,
    onSettingsChange,
    onSettingsReset,
    onThemeChange,
    open,
    pinFontStepIndex,
    pinPanelWidth,
    settings,
    theme,
    tocPanelWidth,
}: {
    leftSidebarWidth: number;
    onLayoutWidthsReset: () => void;
    onOpenChange: (open: boolean) => void;
    onPinFontStepChange: (index: number) => void;
    onSettingsChange: <K extends keyof DocsUiSettings>(key: K, value: DocsUiSettings[K]) => void;
    onSettingsReset: () => void;
    onThemeChange: React.Dispatch<React.SetStateAction<Theme>>;
    open: boolean;
    pinFontStepIndex: number;
    pinPanelWidth: number;
    settings: DocsUiSettings;
    theme: Theme;
    tocPanelWidth: number;
}) {
    const [activeSection, setActiveSection] = React.useState<SettingsSectionId>("general");
    const pinFontPercent = Math.round(PIN_FONT_STEPS[pinFontStepIndex] * 100);
    const codeThemeOptions = getCodeThemeOptions(theme);

    const setSetting = React.useCallback(
        <K extends keyof DocsUiSettings>(key: K, value: DocsUiSettings[K]) => {
            onSettingsChange(key, value);
        },
        [onSettingsChange],
    );

    const sections: Array<{
        id: SettingsSectionId;
        label: string;
        icon: React.ComponentType<{ className?: string }>;
    }> = [
        { id: "general", label: "General", icon: Palette },
        { id: "layout", label: "Layout", icon: Layout },
        { id: "sidebar", label: "Sidebars", icon: PanelRight },
        { id: "code", label: "Code blocks", icon: Code2 },
        { id: "editor", label: "Editor", icon: Type },
        { id: "diagrams", label: "Diagrams", icon: Maximize2 },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='docs-settings-dialog grid h-[min(820px,calc(100vh-3rem))] w-[min(1120px,calc(100vw-2rem))] max-w-none grid-cols-[232px_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:rounded-lg'>
                <DialogTitle className='sr-only'>Settings</DialogTitle>
                <DialogDescription className='sr-only'>
                    Configure Smooth Docs appearance and reading preferences.
                </DialogDescription>

                <aside className='border-r bg-muted/35 p-3'>
                    <div className='mb-4 px-2 pt-1'>
                        <div className='text-xs font-medium text-muted-foreground'>Smooth Docs</div>
                        <div className='mt-1 text-sm font-semibold'>Settings</div>
                    </div>
                    <nav className='space-y-1'>
                        {sections.map((section) => {
                            const Icon = section.icon;
                            return (
                                <button
                                    key={section.id}
                                    type='button'
                                    className={cn(
                                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                                        activeSection === section.id
                                            ? "bg-accent text-accent-foreground"
                                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                                    )}
                                    onClick={() => setActiveSection(section.id)}>
                                    <Icon className='h-4 w-4 shrink-0' />
                                    <span className='truncate'>{section.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className='absolute bottom-3 left-3 w-[208px] border-t pt-3'>
                        <Button
                            type='button'
                            variant='outline'
                            className='h-9 w-full justify-start gap-2'
                            onClick={onSettingsReset}>
                            <RotateCcw className='h-4 w-4' />
                            Reset settings
                        </Button>
                    </div>
                </aside>

                <div className='min-h-0 overflow-y-auto px-12 py-10'>
                    <div className='mb-10'>
                        <h2 className='text-3xl font-semibold tracking-normal'>Settings</h2>
                        <p className='mt-2 text-sm text-muted-foreground'>
                            Tune the docs UI for reading, navigation, editing, and code review.
                        </p>
                    </div>

                    {activeSection === "general" && (
                        <SettingsSection title='General'>
                            <SettingRow
                                title='Theme'
                                description='Choose the color theme used by the docs UI.'>
                                <Select
                                    value={theme}
                                    onValueChange={(value) => onThemeChange(value as Theme)}>
                                    <SelectTrigger className='w-44'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='dark'>Dark mode</SelectItem>
                                        <SelectItem value='light'>Light mode</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingRow>
                            <SettingSwitch
                                title='Auto-hide top bar'
                                description='Hide the top controls while scrolling down.'
                                checked={settings.autoHideHeader}
                                onCheckedChange={(checked) =>
                                    setSetting("autoHideHeader", checked)
                                }
                            />
                            <SettingSwitch
                                title='Show breadcrumbs'
                                description='Display page hierarchy above the page title.'
                                checked={settings.showBreadcrumbs}
                                onCheckedChange={(checked) =>
                                    setSetting("showBreadcrumbs", checked)
                                }
                            />
                            <SettingSwitch
                                title='Reduce motion'
                                description='Disable most UI animations and transitions.'
                                checked={settings.reduceMotion}
                                onCheckedChange={(checked) => setSetting("reduceMotion", checked)}
                            />
                        </SettingsSection>
                    )}

                    {activeSection === "layout" && (
                        <SettingsSection title='Layout'>
                            <SettingRow
                                title='Main content width'
                                description='Set the maximum width of the reading column.'>
                                <Select
                                    value={settings.mainWidth}
                                    onValueChange={(value) =>
                                        setSetting("mainWidth", value as MainWidthSetting)
                                    }>
                                    <SelectTrigger className='w-44'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='narrow'>Narrow</SelectItem>
                                        <SelectItem value='default'>Default</SelectItem>
                                        <SelectItem value='wide'>Wide</SelectItem>
                                        <SelectItem value='full'>Full</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingRow>
                            <SettingRow
                                title='Reading density'
                                description='Change vertical rhythm in article content.'>
                                <Select
                                    value={settings.density}
                                    onValueChange={(value) =>
                                        setSetting("density", value as DensitySetting)
                                    }>
                                    <SelectTrigger className='w-44'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='compact'>Compact</SelectItem>
                                        <SelectItem value='comfortable'>Comfortable</SelectItem>
                                        <SelectItem value='spacious'>Spacious</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingRow>
                            <SettingRow
                                title='Panel widths'
                                description={`Left ${leftSidebarWidth}px, right ${tocPanelWidth}px, pinned ${pinPanelWidth}px.`}>
                                <Button
                                    type='button'
                                    variant='outline'
                                    className='h-9 gap-2'
                                    onClick={onLayoutWidthsReset}>
                                    <RotateCcw className='h-4 w-4' />
                                    Reset widths
                                </Button>
                            </SettingRow>
                        </SettingsSection>
                    )}

                    {activeSection === "sidebar" && (
                        <SettingsSection title='Sidebars'>
                            <SettingSwitch
                                title='Show right sidebar'
                                description='Show the table of contents or pinned block panel on desktop.'
                                checked={settings.showRightSidebar}
                                onCheckedChange={(checked) =>
                                    setSetting("showRightSidebar", checked)
                                }
                            />
                            <SettingSwitch
                                title='Wrap left sidebar text'
                                description='Allow long navigation titles to wrap instead of truncating.'
                                checked={settings.leftSidebarWrap}
                                onCheckedChange={(checked) =>
                                    setSetting("leftSidebarWrap", checked)
                                }
                            />
                            <SettingSwitch
                                title='Wrap right sidebar text'
                                description='Allow table of contents titles to wrap.'
                                checked={settings.rightSidebarWrap}
                                onCheckedChange={(checked) =>
                                    setSetting("rightSidebarWrap", checked)
                                }
                            />
                            <SettingSwitch
                                title='Wrap pinned panel text'
                                description='Allow pinned block labels and content to wrap.'
                                checked={settings.pinPanelWrap}
                                onCheckedChange={(checked) => setSetting("pinPanelWrap", checked)}
                            />
                            <SettingRow
                                title='Pinned text size'
                                description={`Current pinned block text scale is ${pinFontPercent}%.`}>
                                <Select
                                    value={String(pinFontStepIndex)}
                                    onValueChange={(value) =>
                                        onPinFontStepChange(Number.parseInt(value, 10))
                                    }>
                                    <SelectTrigger className='w-44'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PIN_FONT_STEPS.map((step, index) => (
                                            <SelectItem key={step} value={String(index)}>
                                                {Math.round(step * 100)}%
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingRow>
                        </SettingsSection>
                    )}

                    {activeSection === "code" && (
                        <SettingsSection title='Code blocks'>
                            <SettingRow
                                title='Syntax theme'
                                description='Choose the highlight color theme for rendered code blocks.'>
                                <Select
                                    value={settings.codeTheme}
                                    onValueChange={(value) =>
                                        setSetting("codeTheme", value as CodeThemeSetting)
                                    }>
                                    <SelectTrigger className='w-44'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {codeThemeOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingRow>
                            <SettingRow
                                title='Font family'
                                description='Choose the font stack for rendered code blocks.'>
                                <Select
                                    value={settings.codeFontFamily}
                                    onValueChange={(value) =>
                                        setSetting(
                                            "codeFontFamily",
                                            value as CodeFontFamilySetting,
                                        )
                                    }>
                                    <SelectTrigger className='w-44'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='mono'>Mono</SelectItem>
                                        <SelectItem value='system'>System</SelectItem>
                                        <SelectItem value='serif'>Serif</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingRow>
                            <SettingRow title='Font size' description='Set code block text size.'>
                                <Select
                                    value={settings.codeFontSize}
                                    onValueChange={(value) =>
                                        setSetting("codeFontSize", value as CodeFontSizeSetting)
                                    }>
                                    <SelectTrigger className='w-44'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {["12", "13", "14", "15", "16"].map((value) => (
                                            <SelectItem key={value} value={value}>
                                                {value}px
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingRow>
                            <SettingRow
                                title='Line height'
                                description='Change spacing between lines in code blocks.'>
                                <Select
                                    value={settings.codeLineHeight}
                                    onValueChange={(value) =>
                                        setSetting(
                                            "codeLineHeight",
                                            value as CodeLineHeightSetting,
                                        )
                                    }>
                                    <SelectTrigger className='w-44'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='tight'>Tight</SelectItem>
                                        <SelectItem value='normal'>Normal</SelectItem>
                                        <SelectItem value='relaxed'>Relaxed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingRow>
                            <SettingSwitch
                                title='Wrap code lines'
                                description='Wrap long code lines instead of horizontal scrolling.'
                                checked={settings.codeWrap}
                                onCheckedChange={(checked) => setSetting("codeWrap", checked)}
                            />
                            <SettingRow
                                title='Maximum block height'
                                description='Limit tall code blocks and keep them scrollable.'>
                                <Select
                                    value={settings.codeMaxHeight}
                                    onValueChange={(value) =>
                                        setSetting("codeMaxHeight", value as CodeMaxHeightSetting)
                                    }>
                                    <SelectTrigger className='w-44'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='360'>360px</SelectItem>
                                        <SelectItem value='480'>480px</SelectItem>
                                        <SelectItem value='640'>640px</SelectItem>
                                        <SelectItem value='none'>No limit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingRow>
                        </SettingsSection>
                    )}

                    {activeSection === "editor" && (
                        <SettingsSection title='Editor'>
                            <SettingRow
                                title='Markdown editor font size'
                                description='Set the source editor text size.'>
                                <Select
                                    value={settings.editorFontSize}
                                    onValueChange={(value) =>
                                        setSetting(
                                            "editorFontSize",
                                            value as EditorFontSizeSetting,
                                        )
                                    }>
                                    <SelectTrigger className='w-44'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {EDITOR_FONT_SIZE_OPTIONS.map((value) => (
                                            <SelectItem key={value} value={value}>
                                                {value}px
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingRow>
                            <SettingSwitch
                                title='Wrap editor lines'
                                description='Soft-wrap Markdown editor lines instead of horizontal scrolling.'
                                checked={settings.editorWrap}
                                onCheckedChange={(checked) => setSetting("editorWrap", checked)}
                            />
                        </SettingsSection>
                    )}

                    {activeSection === "diagrams" && (
                        <SettingsSection title='Diagrams'>
                            <SettingRow
                                title='Mermaid spacing'
                                description='Adjust padding around rendered Mermaid diagrams.'>
                                <Select
                                    value={settings.mermaidDensity}
                                    onValueChange={(value) =>
                                        setSetting(
                                            "mermaidDensity",
                                            value as MermaidDensitySetting,
                                        )
                                    }>
                                    <SelectTrigger className='w-44'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='compact'>Compact</SelectItem>
                                        <SelectItem value='comfortable'>Comfortable</SelectItem>
                                        <SelectItem value='spacious'>Spacious</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingRow>
                            <div className='rounded-md border bg-muted/25 px-3 py-3 text-sm text-muted-foreground'>
                                Mermaid zoom keeps its animation disabled. Diagram spacing only
                                changes the rendered page blocks.
                            </div>
                        </SettingsSection>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SettingsSection({
    children,
    title,
}: {
    children: React.ReactNode;
    title: string;
}) {
    return (
        <section className='space-y-1'>
            <h3 className='mb-4 border-b pb-3 text-xl font-semibold tracking-normal'>{title}</h3>
            <div className='divide-y'>{children}</div>
        </section>
    );
}

function SettingRow({
    children,
    description,
    title,
}: {
    children: React.ReactNode;
    description: string;
    title: string;
}) {
    return (
        <div className='grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-6 py-4'>
            <div className='min-w-0'>
                <div className='text-sm font-semibold'>{title}</div>
                <div className='mt-1 max-w-2xl text-sm leading-5 text-muted-foreground'>
                    {description}
                </div>
            </div>
            <div className='shrink-0'>{children}</div>
        </div>
    );
}

function SettingSwitch({
    checked,
    description,
    onCheckedChange,
    title,
}: {
    checked: boolean;
    description: string;
    onCheckedChange: (checked: boolean) => void;
    title: string;
}) {
    return (
        <SettingRow title={title} description={description}>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </SettingRow>
    );
}

function PageHeader({
    breadcrumbs,
    canEditMarkdown,
    editMode,
    onEditModeToggle,
    onNavigate,
    page,
    showBreadcrumbs,
}: {
    breadcrumbs: PageBreadcrumbItem[];
    canEditMarkdown: boolean;
    editMode: boolean;
    onEditModeToggle: () => void;
    onNavigate: (url: string) => void;
    page: DocPage;
    showBreadcrumbs: boolean;
}) {
    return (
        <div className='space-y-4'>
            <div className='space-y-3'>
                <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                    {showBreadcrumbs ? (
                        <Breadcrumb className='min-w-0'>
                            <BreadcrumbList className='min-w-0 flex-nowrap overflow-hidden'>
                                {breadcrumbs.map((item, index) => {
                                    const isLast = index === breadcrumbs.length - 1;

                                    return (
                                        <React.Fragment key={`${item.title}-${item.url ?? index}`}>
                                            <BreadcrumbItem className='min-w-0'>
                                                {isLast || !item.url ? (
                                                    <BreadcrumbPage className='truncate'>
                                                        {item.title}
                                                    </BreadcrumbPage>
                                                ) : (
                                                    <BreadcrumbLink asChild className='truncate'>
                                                        <button
                                                            type='button'
                                                            onClick={() => onNavigate(item.url!)}>
                                                            {item.title}
                                                        </button>
                                                    </BreadcrumbLink>
                                                )}
                                            </BreadcrumbItem>
                                            {!isLast && (
                                                <BreadcrumbSeparator className='shrink-0' />
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </BreadcrumbList>
                        </Breadcrumb>
                    ) : (
                        <div className='min-w-0' />
                    )}

                    <TooltipProvider delayDuration={300}>
                        <div className='flex shrink-0 items-center gap-1.5'>
                            {canEditMarkdown && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={editMode ? "default" : "outline"}
                                            size='icon'
                                            className='h-7 w-7'
                                            aria-label={editMode ? "View Markdown" : "Edit Markdown"}
                                            onClick={onEditModeToggle}>
                                            {editMode ? (
                                                <Eye className='h-3.5 w-3.5' />
                                            ) : (
                                                <PencilLine className='h-3.5 w-3.5' />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side='bottom'>
                                        {editMode ? "View" : "Edit"}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            <DropdownMenu>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant='outline'
                                                size='icon'
                                                className='h-7 w-7'
                                                aria-label='Copy page data'>
                                                <Copy className='h-3.5 w-3.5' />
                                            </Button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side='bottom'>Copy</TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent align='end' className='w-36'>
                                    <DropdownMenuItem
                                        onSelect={() => {
                                            void copyWithToast(
                                                page.markdown,
                                                "Copied page Markdown.",
                                            );
                                        }}>
                                        <FileText className='h-3.5 w-3.5 text-muted-foreground' />
                                        Markdown
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onSelect={() => {
                                            void copyWithToast(page.sourcePath, "Copied page path.");
                                        }}>
                                        <Folder className='h-3.5 w-3.5 text-muted-foreground' />
                                        Path
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </TooltipProvider>
                </div>
                <h1 className='break-words text-2xl font-semibold tracking-normal md:text-3xl'>
                    {page.title}
                </h1>
            </div>
            <Separator />
        </div>
    );
}

function MarkdownEditor({
    fontSize,
    onChange,
    onSaveNow,
    saveError,
    savedAt,
    saveStatus,
    sourcePath,
    value,
    wrapText,
}: {
    fontSize: EditorFontSizeSetting;
    onChange: (value: string) => void;
    onSaveNow: () => void;
    saveError: string;
    savedAt: number | null;
    saveStatus: EditorSaveStatus;
    sourcePath: string;
    value: string;
    wrapText: boolean;
}) {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const highlightRef = React.useRef<HTMLElement>(null);
    const lineCount = React.useMemo(() => value.split(/\r?\n/).length, [value]);
    const highlightedMarkdown = React.useMemo(() => highlightMarkdown(value), [value]);
    const syncHighlightScroll = React.useCallback(() => {
        const textarea = textareaRef.current;
        const highlight = highlightRef.current;
        if (!textarea || !highlight) return;

        highlight.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
    }, []);

    React.useEffect(() => {
        syncHighlightScroll();
    }, [syncHighlightScroll, value]);

    return (
        <section
            className='mt-6 overflow-hidden rounded-md border bg-card'
            style={
                {
                    "--docs-editor-font-size": `${fontSize}px`,
                } as React.CSSProperties
            }>
            <div className='flex min-w-0 items-center justify-between gap-3 border-b px-3 py-2'>
                <div className='flex min-w-0 items-center gap-2'>
                    <FileText className='h-4 w-4 shrink-0 text-muted-foreground' />
                    <span className='truncate text-xs text-muted-foreground'>{sourcePath}</span>
                </div>
                <div className='flex shrink-0 items-center gap-3 text-xs text-muted-foreground'>
                    <span>{lineCount} lines</span>
                    <span className={cn(saveStatus === "error" && "text-destructive")}>
                        {formatEditorSaveStatus(saveStatus, savedAt)}
                    </span>
                </div>
            </div>
            <div className={cn("docs-markdown-editor", wrapText && "docs-markdown-editor--wrap")}>
                <pre
                    aria-hidden='true'
                    className='docs-markdown-editor-highlight hljs language-markdown'>
                    <code
                        ref={highlightRef}
                        dangerouslySetInnerHTML={{ __html: highlightedMarkdown }}
                    />
                </pre>
                <textarea
                    ref={textareaRef}
                    className='docs-markdown-editor-input'
                    value={value}
                    wrap={wrapText ? "soft" : "off"}
                    onChange={(event) => onChange(event.target.value)}
                    onScroll={syncHighlightScroll}
                    onKeyDown={(event) => {
                        if (
                            (event.metaKey || event.ctrlKey) &&
                            !event.altKey &&
                            event.code === "KeyS"
                        ) {
                            event.preventDefault();
                            onSaveNow();
                        }
                    }}
                    spellCheck={false}
                />
            </div>
            {saveStatus === "error" && (
                <div className='border-t px-3 py-2 text-xs text-destructive'>{saveError}</div>
            )}
        </section>
    );
}

const Article = React.memo(function Article({
    onPinMenuRequest,
    page,
}: {
    onPinMenuRequest: (request: PinMenuRequest) => void;
    page: DocPage;
}) {
    const ref = React.useRef<HTMLElement>(null);
    const [mermaidZoom, setMermaidZoom] = React.useState<MermaidZoomState | null>(null);
    const blocks = React.useMemo(() => parseArticleBlocks(page.html), [page.html]);

    const openMermaidZoom = React.useCallback((mermaid: Element) => {
        const svg = mermaid.querySelector("svg");
        if (!svg) return;

        const clone = svg.cloneNode(true) as SVGElement;
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("role", "img");

        const size = getSvgSize(clone);
        setMermaidZoom({
            title: getMermaidZoomTitle(mermaid),
            svgHtml: clone.outerHTML,
            width: size.width,
            height: size.height,
        });
    }, []);

    React.useEffect(() => {
        const root = ref.current;
        if (!root) return;

        root.querySelectorAll(".beautiful-mermaid, .mermaid").forEach((mermaid, index) => {
            if (!mermaid.querySelector("svg")) return;

            mermaid.classList.add("docs-mermaid-zoomable");
            mermaid.setAttribute("role", "button");
            mermaid.setAttribute("tabindex", "0");
            mermaid.setAttribute("aria-label", `Expand Mermaid diagram ${index + 1}`);
            mermaid.setAttribute("title", "Expand Mermaid diagram");
        });

        const onClick = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            const button = target.closest(".docs-code-copy") as HTMLButtonElement | null;
            if (button && root.contains(button)) {
                const block = button.closest(".docs-code-block");
                const code = block?.querySelector("pre code")?.textContent;
                if (!code) return;

                void copyWithToast(code, "Copied code.").then((copied) => {
                    if (!copied) return;

                    button.dataset.copied = "true";
                    button.textContent = "Copied";

                    window.setTimeout(() => {
                        button.dataset.copied = "false";
                        button.textContent = "Copy";
                    }, 1200);
                });
                return;
            }

            const image = target.closest("img");
            if (image && root.contains(image)) {
                window.getSelection()?.removeAllRanges();
                return;
            }

            const mermaid = target.closest(".beautiful-mermaid, .mermaid");
            if (!mermaid || !root.contains(mermaid) || !mermaid.querySelector("svg")) return;

            event.preventDefault();
            openMermaidZoom(mermaid);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Enter" && event.key !== " ") return;

            const target = event.target;
            if (!(target instanceof Element)) return;

            const mermaid = target.closest(".beautiful-mermaid, .mermaid");
            if (!mermaid || !root.contains(mermaid) || !mermaid.querySelector("svg")) return;

            event.preventDefault();
            openMermaidZoom(mermaid);
        };

        const onContextMenu = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            const selectedMarkdown = getSelectedMarkdownFromArticle(root, page.markdown);
            const pinnable = findPinnableAncestor(target, root);
            if (!pinnable && !selectedMarkdown) return;

            event.preventDefault();
            onPinMenuRequest({
                x: event.clientX,
                y: event.clientY,
                selectedMarkdown: selectedMarkdown ?? undefined,
                block: pinnable
                    ? {
                          label: getPinnedBlockLabel(pinnable),
                          markdown:
                              getBlockMarkdownFromElement(pinnable, page.markdown) ?? undefined,
                          html: pinnable.outerHTML,
                          sourceElement: pinnable,
                      }
                    : undefined,
            });
        };

        root.addEventListener("click", onClick);
        root.addEventListener("keydown", onKeyDown);
        root.addEventListener("contextmenu", onContextMenu);

        return () => {
            root.removeEventListener("click", onClick);
            root.removeEventListener("keydown", onKeyDown);
            root.removeEventListener("contextmenu", onContextMenu);
        };
    }, [onPinMenuRequest, openMermaidZoom, page.url, page.html, page.markdown]);

    return (
        <>
            <article ref={ref} className='docs-prose'>
                {blocks.map((block, index) =>
                    block.type === "html" ? (
                        <div
                            key={`html-${index}`}
                            className='contents'
                            dangerouslySetInnerHTML={{ __html: block.html }}
                        />
                    ) : (
                        <DocsAccordion key={`accordion-${index}`} data={block.data} />
                    ),
                )}
            </article>

            <MermaidZoomDialog
                mermaidZoom={mermaidZoom}
                onOpenChange={(open) => !open && setMermaidZoom(null)}
            />
        </>
    );
});

function MermaidZoomDialog({
    mermaidZoom,
    onOpenChange,
}: {
    mermaidZoom: MermaidZoomState | null;
    onOpenChange: (open: boolean) => void;
}) {
    const viewportRef = React.useRef<HTMLDivElement>(null);
    const scaleRef = React.useRef(1);
    const pointersRef = React.useRef(new Map<number, { x: number; y: number }>());
    const pinchRef = React.useRef<{ distance: number; scale: number } | null>(null);
    const dragRef = React.useRef<{
        x: number;
        y: number;
        scrollLeft: number;
        scrollTop: number;
    } | null>(null);
    const [scale, setScale] = React.useState(1);
    const [viewportSize, setViewportSize] = React.useState<Size>({ width: 0, height: 0 });

    React.useEffect(() => {
        scaleRef.current = scale;
    }, [scale]);

    React.useLayoutEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const updateSize = () => {
            setViewportSize({
                width: viewport.clientWidth,
                height: viewport.clientHeight,
            });
        };

        updateSize();

        const observer = new ResizeObserver(updateSize);
        observer.observe(viewport);

        return () => observer.disconnect();
    }, [mermaidZoom]);

    const naturalSize = React.useMemo(
        () => ({
            width: mermaidZoom?.width ?? 1,
            height: mermaidZoom?.height ?? 1,
        }),
        [mermaidZoom?.height, mermaidZoom?.width],
    );

    const fitScale = React.useMemo(() => {
        if (!mermaidZoom || viewportSize.width <= 0 || viewportSize.height <= 0) return 1;

        const availableHeight = Math.max(1, viewportSize.height - MERMAID_ZOOM_VIEWPORT_PADDING);
        return clamp(
            availableHeight / naturalSize.height,
            MIN_MERMAID_ZOOM_SCALE,
            MAX_MERMAID_ZOOM_SCALE,
        );
    }, [mermaidZoom, naturalSize.height, viewportSize.height, viewportSize.width]);

    const centerViewport = React.useCallback(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
        viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
    }, []);

    React.useLayoutEffect(() => {
        if (!mermaidZoom || viewportSize.width <= 0 || viewportSize.height <= 0) return;

        setScale(fitScale);
        scaleRef.current = fitScale;
    }, [fitScale, mermaidZoom, viewportSize.height, viewportSize.width]);

    React.useLayoutEffect(() => {
        if (!mermaidZoom) return;

        let frameId = 0;
        let attempts = 0;
        const centerUntilLayoutSettles = () => {
            centerViewport();
            attempts += 1;
            if (attempts < 8) frameId = window.requestAnimationFrame(centerUntilLayoutSettles);
        };

        frameId = window.requestAnimationFrame(centerUntilLayoutSettles);

        return () => window.cancelAnimationFrame(frameId);
    }, [centerViewport, mermaidZoom]);

    React.useEffect(() => {
        if (!mermaidZoom) return;

        const preventBrowserWheelZoom = (event: WheelEvent) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
        };

        const preventBrowserTouchZoom = (event: TouchEvent) => {
            if (event.touches.length < 2) return;
            event.preventDefault();
        };

        const preventBrowserGestureZoom = (event: Event) => {
            event.preventDefault();
        };

        window.addEventListener("wheel", preventBrowserWheelZoom, {
            capture: true,
            passive: false,
        });
        window.addEventListener("touchmove", preventBrowserTouchZoom, {
            capture: true,
            passive: false,
        });
        window.addEventListener("gesturestart", preventBrowserGestureZoom, {
            passive: false,
        });
        window.addEventListener("gesturechange", preventBrowserGestureZoom, {
            passive: false,
        });

        return () => {
            window.removeEventListener("wheel", preventBrowserWheelZoom, { capture: true });
            window.removeEventListener("touchmove", preventBrowserTouchZoom, { capture: true });
            window.removeEventListener("gesturestart", preventBrowserGestureZoom);
            window.removeEventListener("gesturechange", preventBrowserGestureZoom);
        };
    }, [mermaidZoom]);

    const setScaleWithScrollAnchor = React.useCallback((nextScale: number) => {
        const viewport = viewportRef.current;
        const clampedScale = clamp(nextScale, MIN_MERMAID_ZOOM_SCALE, MAX_MERMAID_ZOOM_SCALE);

        if (!viewport) {
            setScale(clampedScale);
            scaleRef.current = clampedScale;
            return;
        }

        const centerXRatio =
            viewport.scrollWidth > 0
                ? (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth
                : 0.5;
        const centerYRatio =
            viewport.scrollHeight > 0
                ? (viewport.scrollTop + viewport.clientHeight / 2) / viewport.scrollHeight
                : 0.5;

        setScale(clampedScale);
        scaleRef.current = clampedScale;

        window.requestAnimationFrame(() => {
            viewport.scrollLeft = centerXRatio * viewport.scrollWidth - viewport.clientWidth / 2;
            viewport.scrollTop = centerYRatio * viewport.scrollHeight - viewport.clientHeight / 2;
        });
    }, []);

    const handleWheel = React.useCallback(
        (event: React.WheelEvent<HTMLDivElement>) => {
            if (!event.ctrlKey && !event.metaKey) return;

            event.preventDefault();
            const zoomFactor = Math.exp(-event.deltaY * 0.004);
            setScaleWithScrollAnchor(scaleRef.current * zoomFactor);
        },
        [setScaleWithScrollAnchor],
    );

    const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== "touch") return;

        const viewport = viewportRef.current;
        if (!viewport) return;

        viewport.setPointerCapture(event.pointerId);
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointersRef.current.size === 1) {
            dragRef.current = {
                x: event.clientX,
                y: event.clientY,
                scrollLeft: viewport.scrollLeft,
                scrollTop: viewport.scrollTop,
            };
            pinchRef.current = null;
            return;
        }

        if (pointersRef.current.size === 2) {
            const [first, second] = Array.from(pointersRef.current.values());
            pinchRef.current = {
                distance: getPointDistance(first, second),
                scale: scaleRef.current,
            };
            dragRef.current = null;
        }
    }, []);

    const handlePointerMove = React.useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (event.pointerType !== "touch") return;
            if (!pointersRef.current.has(event.pointerId)) return;

            const viewport = viewportRef.current;
            if (!viewport) return;

            pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

            if (pointersRef.current.size >= 2) {
                event.preventDefault();
                const [first, second] = Array.from(pointersRef.current.values());
                const distance = getPointDistance(first, second);

                if (!pinchRef.current || pinchRef.current.distance <= 0) {
                    pinchRef.current = { distance, scale: scaleRef.current };
                    return;
                }

                setScaleWithScrollAnchor(
                    pinchRef.current.scale * (distance / pinchRef.current.distance),
                );
                return;
            }

            if (!dragRef.current) return;

            event.preventDefault();
            viewport.scrollLeft = dragRef.current.scrollLeft - (event.clientX - dragRef.current.x);
            viewport.scrollTop = dragRef.current.scrollTop - (event.clientY - dragRef.current.y);
        },
        [setScaleWithScrollAnchor],
    );

    const handlePointerEnd = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== "touch") return;

        const viewport = viewportRef.current;
        pointersRef.current.delete(event.pointerId);

        if (viewport?.hasPointerCapture(event.pointerId)) {
            viewport.releasePointerCapture(event.pointerId);
        }

        if (pointersRef.current.size === 1 && viewport) {
            const [point] = Array.from(pointersRef.current.values());
            dragRef.current = {
                x: point.x,
                y: point.y,
                scrollLeft: viewport.scrollLeft,
                scrollTop: viewport.scrollTop,
            };
            pinchRef.current = null;
            return;
        }

        dragRef.current = null;
        pinchRef.current = null;
    }, []);

    const scaledWidth = naturalSize.width * scale;
    const scaledHeight = naturalSize.height * scale;
    const canvasWidth = Math.max(viewportSize.width, scaledWidth);
    const canvasHeight = Math.max(viewportSize.height, scaledHeight);

    return (
        <Dialog open={Boolean(mermaidZoom)} onOpenChange={onOpenChange}>
            <DialogContent className='docs-command-dialog mermaid-zoom-dialog grid h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none grid-rows-[1fr] gap-0 overflow-hidden p-0 sm:rounded-lg'>
                <DialogTitle className='sr-only'>
                    {mermaidZoom?.title ?? "Mermaid diagram"}
                </DialogTitle>
                <DialogDescription className='sr-only'>Expanded Mermaid diagram</DialogDescription>
                <div
                    ref={viewportRef}
                    className='mermaid-zoom-viewport h-full overflow-auto bg-background'
                    onPointerCancel={handlePointerEnd}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerEnd}
                    onWheel={handleWheel}>
                    <div
                        className='mermaid-zoom-canvas'
                        style={{ width: canvasWidth, height: canvasHeight }}>
                        <div
                            className='mermaid-zoom-frame'
                            style={{
                                width: scaledWidth,
                                height: scaledHeight,
                            }}>
                            <div
                                className='mermaid-zoom-surface rounded-md border'
                                style={{
                                    width: scaledWidth,
                                    height: scaledHeight,
                                }}
                                dangerouslySetInnerHTML={{
                                    __html: mermaidZoom?.svgHtml ?? "",
                                }}
                            />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DocsAccordion({ data }: { data: DocsAccordionData }) {
    const defaultValues = data.items
        .map((item, index) => (item.open ? `item-${index + 1}` : null))
        .filter((value): value is string => Boolean(value));

    const items = data.items.map((item, index) => (
        <AccordionItem key={`${item.title}-${index}`} value={`item-${index + 1}`}>
            <AccordionTrigger>{item.title}</AccordionTrigger>
            <AccordionContent>
                <div
                    className='docs-accordion-content'
                    dangerouslySetInnerHTML={{ __html: item.html }}
                />
            </AccordionContent>
        </AccordionItem>
    ));

    if (data.multiple) {
        return (
            <Accordion
                type='multiple'
                defaultValue={defaultValues}
                className='not-prose w-full text-foreground'>
                {items}
            </Accordion>
        );
    }

    return (
        <Accordion
            type='single'
            collapsible
            defaultValue={defaultValues[0]}
            className='not-prose w-full text-foreground'>
            {items}
        </Accordion>
    );
}

function parseArticleBlocks(html: string): ArticleBlock[] {
    const markerPattern = /<div data-docs-accordion="([^"]+)"><\/div>/g;
    const blocks: ArticleBlock[] = [];
    let cursor = 0;

    for (const match of html.matchAll(markerPattern)) {
        if (match.index > cursor) {
            blocks.push({ type: "html", html: html.slice(cursor, match.index) });
        }

        const data = decodeAccordionData(match[1]);
        if (data) {
            blocks.push({ type: "accordion", data });
        }

        cursor = match.index + match[0].length;
    }

    if (cursor < html.length) {
        blocks.push({ type: "html", html: html.slice(cursor) });
    }

    return blocks.length > 0 ? blocks : [{ type: "html", html }];
}

function extractTableOfContents(html: string): TableOfContentsItem[] {
    if (typeof DOMParser === "undefined") return [];

    const document = new DOMParser().parseFromString(html, "text/html");
    const headings = Array.from(document.querySelectorAll("h2[id], h3[id], h4[id]"));

    return headings
        .map((heading) => {
            const title = heading.textContent?.trim().replace(/\s+/g, " ") ?? "";
            const id = heading.getAttribute("id") ?? "";
            const level = Number(heading.tagName.slice(1));

            return { id, title, level };
        })
        .filter((item) => item.id.length > 0 && item.title.length > 0);
}

function buildPageBreadcrumbs(site: SiteKey, nav: NavItem[], page: DocPage): PageBreadcrumbItem[] {
    const navPath = findNavPath(nav, page.url);
    const pagePath =
        navPath.length > 0
            ? navPath.map((item) => ({ title: item.title, url: item.url }))
            : [{ title: page.title, url: page.url }];

    return [{ title: site, url: "/" }, ...pagePath].map((item, index, items) =>
        index === items.length - 1 ? { title: item.title } : item,
    );
}

function findNavPath(items: NavItem[], url: string): NavItem[] {
    for (const item of items) {
        if (item.url === url) return [item];

        const childPath = findNavPath(item.children, url);
        if (childPath.length > 0) return [item, ...childPath];
    }

    return [];
}

function getSvgSize(svg: SVGElement): Size {
    const width = Number.parseFloat(svg.getAttribute("width") ?? "");
    const height = Number.parseFloat(svg.getAttribute("height") ?? "");

    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        return { width, height };
    }

    const viewBox = svg
        .getAttribute("viewBox")
        ?.split(/[\s,]+/)
        .map((value) => Number.parseFloat(value));

    if (
        viewBox?.length === 4 &&
        Number.isFinite(viewBox[2]) &&
        viewBox[2] > 0 &&
        Number.isFinite(viewBox[3]) &&
        viewBox[3] > 0
    ) {
        return { width: viewBox[2], height: viewBox[3] };
    }

    const rect = svg.getBoundingClientRect();
    return {
        width: rect.width > 0 ? rect.width : 800,
        height: rect.height > 0 ? rect.height : 600,
    };
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getPointDistance(first: { x: number; y: number }, second: { x: number; y: number }) {
    return Math.hypot(first.x - second.x, first.y - second.y);
}

function decodeAccordionData(value: string): DocsAccordionData | null {
    try {
        const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
        const json = new TextDecoder().decode(bytes);
        const data = JSON.parse(json) as DocsAccordionData;
        return Array.isArray(data.items) ? data : null;
    } catch {
        return null;
    }
}

function getMermaidZoomTitle(mermaid: Element) {
    const source = mermaid.getAttribute("data-mermaid-source")?.trim();
    const firstLine = source
        ?.split("\n")
        .find((line) => line.trim().length > 0)
        ?.trim();
    return firstLine ? `Mermaid: ${firstLine}` : "Mermaid diagram";
}

function findPinnableAncestor(target: Element, root: HTMLElement): HTMLElement | null {
    let current: Element | null = target;

    while (current && current !== root) {
        if (!root.contains(current)) return null;

        if (current instanceof HTMLElement) {
            if (
                current.classList.contains("docs-code-block") ||
                current.classList.contains("beautiful-mermaid") ||
                current.classList.contains("mermaid")
            ) {
                return current;
            }

            if (current.tagName === "TABLE") {
                const wrapper = current.closest("div.not-prose");
                if (wrapper instanceof HTMLElement && root.contains(wrapper)) return wrapper;
                return current;
            }

            if (PINNABLE_TAGS.has(current.tagName)) return current;
        }

        current = current.parentElement;
    }

    return null;
}

function getPinnedBlockLabel(element: HTMLElement) {
    const tag = element.tagName.toLowerCase();
    const text = normalizeText(element.textContent ?? "");

    if (/^h[1-6]$/.test(tag)) return truncateText(text, 56);

    if (element.classList.contains("docs-code-block")) {
        const label = normalizeText(
            element.querySelector(".docs-code-block-label")?.textContent ?? "",
        );
        return label ? `Code: ${label}` : "Code block";
    }

    if (element.classList.contains("beautiful-mermaid") || element.classList.contains("mermaid")) {
        const source = element.getAttribute("data-mermaid-source")?.trim() || text;
        const diagramType = source.split(/\s+/)[0];
        return diagramType ? `Mermaid: ${diagramType}` : "Mermaid diagram";
    }

    const table = tag === "table" ? element : element.querySelector("table");
    if (table) {
        const headers = Array.from(table.querySelectorAll("th"))
            .map((cell) => normalizeText(cell.textContent ?? ""))
            .filter(Boolean)
            .slice(0, 3)
            .join(", ");
        return headers ? `Table: ${headers}` : "Table";
    }

    if (tag === "ul" || tag === "ol") {
        const firstItem = normalizeText(element.querySelector("li")?.textContent ?? "");
        return `List: ${truncateText(firstItem || text, 48)}`;
    }

    if (tag === "blockquote") return `Quote: ${truncateText(text, 48)}`;

    return truncateText(text, 56) || "(empty)";
}

function preparePinnedBlockHtml(html: string) {
    if (typeof document === "undefined") return html;

    const template = document.createElement("template");
    template.innerHTML = html;

    template.content
        .querySelectorAll(".docs-code-copy, .md-clipboard, .md-code__copy, [data-clipboard-target]")
        .forEach((element) => element.remove());

    template.content
        .querySelectorAll(".docs-pin-source--hoverable, .docs-pin-source--pinned")
        .forEach((element) => {
            element.classList.remove("docs-pin-source--hoverable", "docs-pin-source--pinned");
        });

    template.content.querySelectorAll(".docs-mermaid-zoomable").forEach((element) => {
        element.classList.remove("docs-mermaid-zoomable");
        element.removeAttribute("role");
        element.removeAttribute("tabindex");
        element.removeAttribute("title");
        element.removeAttribute("aria-label");
    });

    return template.innerHTML;
}

function getPinPageKey(site: SiteKey, pagePath: string) {
    return `${site}:${normalizePath(pagePath)}`;
}

function readPinnedBlocks(pageKey: string): PinnedBlock[] {
    try {
        const allPins = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) ?? "{}") as Record<
            string,
            unknown
        >;
        const blocks = allPins[pageKey];
        if (!Array.isArray(blocks)) return [];

        return blocks.filter(isPinnedBlock).slice(0, MAX_PINNED_BLOCKS);
    } catch {
        return [];
    }
}

function writePinnedBlocks(pageKey: string, blocks: PinnedBlock[]) {
    try {
        const allPins = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) ?? "{}") as Record<
            string,
            PinnedBlock[]
        >;

        if (blocks.length > 0) {
            allPins[pageKey] = blocks.slice(0, MAX_PINNED_BLOCKS);
        } else {
            delete allPins[pageKey];
        }

        localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(allPins));
    } catch (error) {
        console.warn("[smooth-docs] Failed to save pinned blocks", error);
    }
}

function isPinnedBlock(value: unknown): value is PinnedBlock {
    if (!value || typeof value !== "object") return false;

    const block = value as Partial<PinnedBlock>;
    return (
        typeof block.id === "string" &&
        typeof block.label === "string" &&
        typeof block.html === "string"
    );
}

function readPinFontStepIndex() {
    const value = Number.parseInt(readStorageValue(PIN_FONT_STEP_KEY) ?? "", 10);
    return Number.isInteger(value) && value >= 0 && value < PIN_FONT_STEPS.length
        ? value
        : DEFAULT_PIN_FONT_STEP_INDEX;
}

function readUiSettings(): DocsUiSettings {
    try {
        const parsed = JSON.parse(readStorageValue(UI_SETTINGS_STORAGE_KEY) ?? "{}") as Partial<
            Record<keyof DocsUiSettings, unknown>
        >;

        return {
            mainWidth: pickSetting(parsed.mainWidth, ["narrow", "default", "wide", "full"], "default"),
            density: pickSetting(
                parsed.density,
                ["compact", "comfortable", "spacious"],
                "comfortable",
            ),
            autoHideHeader:
                typeof parsed.autoHideHeader === "boolean"
                    ? parsed.autoHideHeader
                    : DEFAULT_UI_SETTINGS.autoHideHeader,
            showBreadcrumbs:
                typeof parsed.showBreadcrumbs === "boolean"
                    ? parsed.showBreadcrumbs
                    : DEFAULT_UI_SETTINGS.showBreadcrumbs,
            reduceMotion:
                typeof parsed.reduceMotion === "boolean"
                    ? parsed.reduceMotion
                    : DEFAULT_UI_SETTINGS.reduceMotion,
            leftSidebarWrap:
                typeof parsed.leftSidebarWrap === "boolean"
                    ? parsed.leftSidebarWrap
                    : DEFAULT_UI_SETTINGS.leftSidebarWrap,
            rightSidebarWrap:
                typeof parsed.rightSidebarWrap === "boolean"
                    ? parsed.rightSidebarWrap
                    : DEFAULT_UI_SETTINGS.rightSidebarWrap,
            pinPanelWrap:
                typeof parsed.pinPanelWrap === "boolean"
                    ? parsed.pinPanelWrap
                    : DEFAULT_UI_SETTINGS.pinPanelWrap,
            showRightSidebar:
                typeof parsed.showRightSidebar === "boolean"
                    ? parsed.showRightSidebar
                    : DEFAULT_UI_SETTINGS.showRightSidebar,
            codeTheme: pickSetting(
                parsed.codeTheme,
                CODE_THEME_VALUES,
                "github-dark",
            ),
            codeFontFamily: pickSetting(
                parsed.codeFontFamily,
                ["mono", "system", "serif"],
                "mono",
            ),
            codeFontSize: pickSetting(
                parsed.codeFontSize,
                ["12", "13", "14", "15", "16"],
                "14",
            ),
            codeLineHeight: pickSetting(
                parsed.codeLineHeight,
                ["tight", "normal", "relaxed"],
                "normal",
            ),
            codeWrap:
                typeof parsed.codeWrap === "boolean"
                    ? parsed.codeWrap
                    : DEFAULT_UI_SETTINGS.codeWrap,
            codeMaxHeight: pickSetting(
                parsed.codeMaxHeight,
                ["360", "480", "640", "none"],
                "640",
            ),
            editorFontSize: pickSetting(
                parsed.editorFontSize,
                EDITOR_FONT_SIZE_OPTIONS,
                "14",
            ),
            editorWrap:
                typeof parsed.editorWrap === "boolean"
                    ? parsed.editorWrap
                    : DEFAULT_UI_SETTINGS.editorWrap,
            mermaidDensity: pickSetting(
                parsed.mermaidDensity,
                ["compact", "comfortable", "spacious"],
                "comfortable",
            ),
        };
    } catch {
        return DEFAULT_UI_SETTINGS;
    }
}

function pickSetting<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
    return typeof value === "string" && options.includes(value as T) ? (value as T) : fallback;
}

function getCodeThemeOptions(theme: Theme) {
    return CODE_THEME_OPTIONS.filter((option) => option.colorScheme === theme);
}

function isCodeThemeAvailableForTheme(value: CodeThemeSetting, theme: Theme) {
    return CODE_THEME_OPTIONS.some(
        (option) => option.value === value && option.colorScheme === theme,
    );
}

function getDefaultCodeThemeForTheme(theme: Theme): CodeThemeSetting {
    return theme === "light" ? "github-light" : "github-dark";
}

function getMainMaxWidth(value: MainWidthSetting) {
    if (value === "narrow") return "40rem";
    if (value === "wide") return "64rem";
    if (value === "full") return "100%";
    return "48rem";
}

function getCodeFontFamily(value: CodeFontFamilySetting) {
    if (value === "system") {
        return 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    }
    if (value === "serif") return 'Georgia, Cambria, "Times New Roman", Times, serif';
    return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
}

function getCodeLineHeight(value: CodeLineHeightSetting) {
    if (value === "tight") return "1.35";
    if (value === "relaxed") return "1.8";
    return "1.6";
}

function getCodeMaxHeight(value: CodeMaxHeightSetting) {
    return value === "none" ? "none" : `${value}px`;
}

function getMermaidPadding(value: MermaidDensitySetting) {
    if (value === "compact") return "0.75rem";
    if (value === "spacious") return "1.5rem";
    return "1rem";
}

function readLeftSidebarWidth() {
    const value = Number.parseInt(readStorageValue(LEFT_SIDEBAR_WIDTH_KEY) ?? "", 10);
    return Number.isFinite(value) ? clampLeftSidebarWidth(value) : DEFAULT_LEFT_SIDEBAR_WIDTH;
}

function clampLeftSidebarWidth(width: number) {
    const viewportMax =
        typeof window === "undefined"
            ? MAX_LEFT_SIDEBAR_WIDTH
            : Math.max(MIN_LEFT_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.35));

    return clamp(width, MIN_LEFT_SIDEBAR_WIDTH, Math.min(MAX_LEFT_SIDEBAR_WIDTH, viewportMax));
}

function readTocPanelWidth() {
    const value = Number.parseInt(readStorageValue(TOC_PANEL_WIDTH_KEY) ?? "", 10);
    return Number.isFinite(value) ? clampTocPanelWidth(value) : DEFAULT_TOC_PANEL_WIDTH;
}

function clampTocPanelWidth(width: number) {
    const viewportMax =
        typeof window === "undefined"
            ? MAX_TOC_PANEL_WIDTH
            : Math.max(MIN_TOC_PANEL_WIDTH, Math.floor(window.innerWidth * 0.35));

    return clamp(width, MIN_TOC_PANEL_WIDTH, Math.min(MAX_TOC_PANEL_WIDTH, viewportMax));
}

function readPinPanelWidth() {
    const value = Number.parseInt(readStorageValue(PIN_PANEL_WIDTH_KEY) ?? "", 10);
    return Number.isFinite(value) ? clampPinPanelWidth(value) : DEFAULT_PIN_PANEL_WIDTH;
}

function clampPinPanelWidth(width: number) {
  const viewportMax =
      typeof window === "undefined"
          ? MAX_PIN_PANEL_WIDTH
          : Math.max(MIN_PIN_PANEL_WIDTH, Math.floor(window.innerWidth * 0.55));

  return clamp(width, MIN_PIN_PANEL_WIDTH, Math.min(MAX_PIN_PANEL_WIDTH, viewportMax));
}

function readStorageValue(key: string) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorageValue(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Ignore private browsing or restricted storage.
    }
}

function getSelectedMarkdownFromArticle(root: HTMLElement, markdown: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

    const selectedText = normalizeSelectedText(selection.toString());
    if (!selectedText) return null;

    return resolveSelectedMarkdown(markdown, selectedText);
}

function getBlockMarkdownFromElement(element: HTMLElement, markdown: string) {
    const codeBlock = element.classList.contains("docs-code-block")
        ? element
        : element.closest(".docs-code-block");
    if (codeBlock instanceof HTMLElement) {
        const language = codeBlock.dataset.language || "text";
        const code = codeBlock.querySelector("pre code")?.textContent?.trimEnd();
        return code ? `\`\`\`${language}\n${code}\n\`\`\`` : null;
    }

    const mermaid = element.matches(".beautiful-mermaid, .mermaid")
        ? element
        : element.closest(".beautiful-mermaid, .mermaid");
    if (mermaid instanceof HTMLElement) {
        const source = mermaid.getAttribute("data-mermaid-source")?.trim();
        return source ? `\`\`\`mermaid\n${source}\n\`\`\`` : null;
    }

    const blockText = normalizeSelectedText(element.innerText || element.textContent || "");
    if (!blockText) return null;

    return resolveSelectedMarkdown(markdown, blockText);
}

function resolveSelectedMarkdown(markdown: string, selectedText: string) {
    const content = stripMarkdownFrontmatter(markdown).trim();
    const lineRange = findMarkdownLineRange(content, selectedText);
    if (lineRange) return lineRange;

    const exactIndex = content.indexOf(selectedText);
    if (exactIndex >= 0) return content.slice(exactIndex, exactIndex + selectedText.length);

    return selectedText;
}

function stripMarkdownFrontmatter(markdown: string) {
    if (!markdown.startsWith("---")) return markdown;

    const lines = markdown.split(/\r?\n/);
    const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    return endIndex > 0 ? lines.slice(endIndex + 1).join("\n") : markdown;
}

function findMarkdownLineRange(markdown: string, selectedText: string) {
    const selectedLines = selectedText.split(/\r?\n/).map(normalizeMatchText).filter(Boolean);

    if (selectedLines.length === 0) return null;

    const markdownLines = markdown.split(/\r?\n/);
    const normalizedMarkdownLines = markdownLines.map(normalizeMarkdownLineForMatch);

    if (selectedLines.length === 1) {
        const index = normalizedMarkdownLines.findIndex((line) => line === selectedLines[0]);
        return index >= 0 ? markdownLines[index].trim() : null;
    }

    let startIndex = -1;
    let cursor = 0;

    for (const selectedLine of selectedLines) {
        const nextIndex = normalizedMarkdownLines.findIndex(
            (line, index) => index >= cursor && isMarkdownLineMatch(line, selectedLine),
        );

        if (nextIndex < 0) return null;
        if (startIndex < 0) startIndex = nextIndex;
        cursor = nextIndex + 1;
    }

    return markdownLines.slice(startIndex, cursor).join("\n").trim();
}

function normalizeSelectedText(value: string) {
    return value
        .replace(/\u00a0/g, " ")
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .join("\n")
        .trim();
}

function normalizeMarkdownLineForMatch(value: string) {
    const accordionItem = value.trim().match(/^::item\[(.+?)\]/);
    if (accordionItem) return normalizeMatchText(accordionItem[1]);

    let line = value
        .trim()
        .replace(/^#{1,6}\s+/, "")
        .replace(/^(>\s*)+/, "")
        .replace(/^[-*+]\s+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .replace(/^\[[ xX]\]\s+/, "");

    if (line.includes("|")) {
        line = line
            .split("|")
            .map((cell) => cell.trim())
            .filter(Boolean)
            .join(" ");
    }

    return normalizeMatchText(line);
}

function normalizeMatchText(value: string) {
    return value
        .replace(/\u00a0/g, " ")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/[*_~]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function isMarkdownLineMatch(markdownLine: string, selectedLine: string) {
    return (
        markdownLine === selectedLine ||
        (selectedLine.length > 8 && markdownLine.includes(selectedLine)) ||
        (markdownLine.length > 8 && selectedLine.includes(markdownLine))
    );
}

function normalizeText(value: string) {
    return value.trim().replace(/\s+/g, " ");
}

function truncateText(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function SiteToggle({
    site,
    onSiteChange,
}: {
    site: SiteKey;
    onSiteChange: (site: SiteKey) => void;
}) {
    const nextSite = availableSites.find((candidate) => candidate !== site) ?? site;

    return (
        <div className='hidden sm:flex' aria-label='Select docs'>
            <Toggle
                size='sm'
                pressed={false}
                onPressedChange={() => onSiteChange(nextSite)}
                aria-label={`Switch docs site to ${getSiteLabel(nextSite)}`}
                className='h-7 min-w-[84px] justify-center bg-accent px-3 text-xs text-accent-foreground hover:bg-accent hover:text-accent-foreground'>
                {getSiteLabel(site)}
            </Toggle>
        </div>
    );
}

function DocsSidebar({
    currentPath,
    items,
    onNavigate,
    onSettingsOpen,
    onWidthChange,
    pageUrls,
    siteTitle,
    width,
    wrapText,
}: {
    currentPath: string;
    items: NavItem[];
    onNavigate: (url: string) => void;
    onSettingsOpen: () => void;
    onWidthChange: (width: number) => void;
    pageUrls: ReadonlySet<string>;
    siteTitle: string;
    width: number;
    wrapText: boolean;
}) {
    return (
        <SidebarRoot collapsible='offcanvas' className='docs-left-sidebar'>
            <SidebarWidthResizer
                ariaLabel='Resize navigation sidebar'
                side='left'
                width={width}
                onWidthChange={onWidthChange}
            />
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Docs</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <DocsSidebarNav
                            currentPath={currentPath}
                            items={items}
                            onNavigate={onNavigate}
                            pageUrls={pageUrls}
                            wrapText={wrapText}
                        />
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem className='flex min-w-0 items-center gap-1'>
                        <SidebarMenuButton
                            className='h-auto min-w-0 flex-1 py-2'
                            tooltip={siteTitle}
                            onClick={() => onNavigate("/")}>
                            <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground'>
                                S
                            </span>
                            <span className='flex min-w-0 flex-col'>
                                <span className='truncate font-semibold leading-none'>
                                    {siteTitle}
                                </span>
                                <span className='mt-1 truncate text-xs font-normal text-sidebar-foreground/60'>
                                    Markdown static docs
                                </span>
                            </span>
                        </SidebarMenuButton>
                        <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='h-9 w-9 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground'
                            aria-label='Open settings'
                            onClick={onSettingsOpen}>
                            <SettingsIcon className='h-4 w-4' />
                        </Button>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </SidebarRoot>
    );
}

function DocsSidebarNav({
    items,
    currentPath,
    onNavigate,
    pageUrls,
    wrapText,
}: {
    items: NavItem[];
    currentPath: string;
    onNavigate: (url: string) => void;
    pageUrls: ReadonlySet<string>;
    wrapText: boolean;
}) {
    const { isMobile, setOpenMobile } = useSidebar();

    const navigate = React.useCallback(
        (url: string) => {
            onNavigate(url);
            if (isMobile) setOpenMobile(false);
        },
        [isMobile, onNavigate, setOpenMobile],
    );

    return (
        <SidebarMenu>
            {items.map((item) => (
                <DocsSidebarNavItem
                    key={item.url}
                    currentPath={currentPath}
                    item={item}
                    onNavigate={navigate}
                    pageUrls={pageUrls}
                    wrapText={wrapText}
                />
            ))}
        </SidebarMenu>
    );
}

function DocsSidebarNavItem({
    currentPath,
    item,
    onNavigate,
    pageUrls,
    wrapText,
}: {
    currentPath: string;
    item: NavItem;
    onNavigate: (url: string) => void;
    pageUrls: ReadonlySet<string>;
    wrapText: boolean;
}) {
    const isActive = item.url === currentPath;
    const hasChildren = item.children.length > 0;
    const hasPage = pageUrls.has(item.url);
    const isCurrentBranch = navItemContainsPath(item, currentPath);
    const [open, setOpen] = React.useState(isCurrentBranch);

    React.useEffect(() => {
        if (isCurrentBranch) setOpen(true);
    }, [isCurrentBranch]);

    const handleFolderClick = React.useCallback(() => {
        if (!hasPage) return;

        onNavigate(item.url);

        if (open && item.url !== currentPath) return;

        setOpen((value) => !value);
    }, [currentPath, hasPage, item.url, onNavigate, open]);

    if (!hasChildren) {
        return (
            <SidebarMenuItem>
                <SidebarMenuButton
                    className={cn(wrapText && "h-auto min-h-9 items-start py-2")}
                    isActive={isActive}
                    tooltip={item.title}
                    onClick={() => onNavigate(item.url)}>
                    <FileText className='h-4 w-4 shrink-0 text-sidebar-foreground/70' />
                    <span
                        className={cn(
                            "min-w-0",
                            wrapText ? "break-words whitespace-normal leading-5" : "truncate",
                        )}>
                        {item.title}
                    </span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    }

    const folderButton = (
        <SidebarMenuButton
            className={cn("justify-between", wrapText && "h-auto min-h-9 items-start py-2")}
            isActive={isActive}
            tooltip={item.title}
            onClick={hasPage ? handleFolderClick : undefined}>
            <span className='flex min-w-0 items-start gap-2'>
                <Folder className='h-4 w-4 shrink-0 text-sidebar-foreground/70' />
                <span
                    className={cn(
                        "min-w-0",
                        wrapText ? "break-words whitespace-normal leading-5" : "truncate",
                    )}>
                    {item.title}
                </span>
            </span>
            <ChevronRight
                className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200 ease-smooth",
                    open && "rotate-90",
                )}
            />
        </SidebarMenuButton>
    );

    return (
        <SidebarMenuItem>
            <Collapsible open={open} onOpenChange={setOpen}>
                {hasPage ? (
                    folderButton
                ) : (
                    <CollapsibleTrigger asChild>{folderButton}</CollapsibleTrigger>
                )}

                <CollapsibleContent className='docs-collapsible-content'>
                    <SidebarMenuSub>
                        {item.children.map((child) => (
                            <DocsSidebarSubItem
                                key={child.url}
                                currentPath={currentPath}
                                item={child}
                                onNavigate={onNavigate}
                                pageUrls={pageUrls}
                                wrapText={wrapText}
                            />
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
        </SidebarMenuItem>
    );
}

function DocsSidebarSubItem({
    currentPath,
    item,
    onNavigate,
    pageUrls,
    wrapText,
}: {
    currentPath: string;
    item: NavItem;
    onNavigate: (url: string) => void;
    pageUrls: ReadonlySet<string>;
    wrapText: boolean;
}) {
    const isActive = item.url === currentPath;
    const hasChildren = item.children.length > 0;
    const hasPage = pageUrls.has(item.url);
    const isCurrentBranch = navItemContainsPath(item, currentPath);
    const [open, setOpen] = React.useState(isCurrentBranch);

    React.useEffect(() => {
        if (isCurrentBranch) setOpen(true);
    }, [isCurrentBranch]);

    const handleFolderClick = React.useCallback(() => {
        if (!hasPage) return;

        onNavigate(item.url);

        if (open && item.url !== currentPath) return;

        setOpen((value) => !value);
    }, [currentPath, hasPage, item.url, onNavigate, open]);

    if (!hasChildren) {
        return (
            <SidebarMenuSubItem>
                <SidebarMenuSubButton
                    className={cn(wrapText && "h-auto min-h-7 items-start py-1.5")}
                    isActive={isActive}
                    onClick={() => onNavigate(item.url)}>
                    <FileText className='h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60' />
                    <span
                        className={cn(
                            "min-w-0",
                            wrapText ? "break-words whitespace-normal leading-5" : "truncate",
                        )}>
                        {item.title}
                    </span>
                </SidebarMenuSubButton>
            </SidebarMenuSubItem>
        );
    }

    const folderButton = (
        <SidebarMenuSubButton
            className={cn("h-8 justify-between", wrapText && "h-auto min-h-8 items-start py-1.5")}
            isActive={isActive}
            onClick={hasPage ? handleFolderClick : undefined}>
            <span className='flex min-w-0 items-start gap-2'>
                <Folder className='h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60' />
                <span
                    className={cn(
                        "min-w-0",
                        wrapText ? "break-words whitespace-normal leading-5" : "truncate",
                    )}>
                    {item.title}
                </span>
            </span>
            <ChevronRight
                className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-smooth",
                    open && "rotate-90",
                )}
            />
        </SidebarMenuSubButton>
    );

    return (
        <SidebarMenuSubItem>
            <Collapsible open={open} onOpenChange={setOpen}>
                {hasPage ? (
                    folderButton
                ) : (
                    <CollapsibleTrigger asChild>{folderButton}</CollapsibleTrigger>
                )}

                <CollapsibleContent className='docs-collapsible-content'>
                    <SidebarMenuSub className='mx-2'>
                        {item.children.map((child) => (
                            <DocsSidebarSubItem
                                key={child.url}
                                currentPath={currentPath}
                                item={child}
                                onNavigate={onNavigate}
                                pageUrls={pageUrls}
                                wrapText={wrapText}
                            />
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
        </SidebarMenuSubItem>
    );
}

function navItemContainsPath(item: NavItem, currentPath: string): boolean {
    return (
        item.url === currentPath ||
        item.children.some((child) => navItemContainsPath(child, currentPath))
    );
}

function readRoute(): RouteState {
    const pathname = normalizePath(decodePathname(location.pathname));
    const [maybeSite, ...rest] = pathname.replace(/^\//, "").split("/");

    if (availableSites.includes(maybeSite)) {
        return { site: maybeSite, pagePath: normalizePath(`/${rest.join("/")}`) };
    }

    return { site: availableSites[0] ?? "docs", pagePath: pathname };
}

function toSiteUrl(site: SiteKey, pagePath: string) {
    return `/${site}${normalizePath(pagePath)}`;
}

function decodePathname(pathname: string) {
    return pathname
        .split("/")
        .map((segment) => {
            try {
                return decodeURIComponent(segment);
            } catch {
                return segment;
            }
        })
        .join("/");
}

function refreshThemeStylesheet(version: number) {
    const link = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"]');
    if (!link) return;

    const href = link.getAttribute("href") ?? "";
    const url = new URL(href, location.origin);
    if (url.pathname !== "/theme/theme.css") return;

    url.searchParams.set("v", String(version));
    link.href = `${url.pathname}${url.search}${url.hash}`;
}

function getSiteLabel(site: SiteKey) {
    return siteLabels[site] ?? titleCase(site);
}

function titleCase(value: string) {
    return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatEditorSaveStatus(status: EditorSaveStatus, savedAt: number | null) {
    if (status === "dirty") return "Unsaved";
    if (status === "saving") return "Saving...";
    if (status === "error") return "Save failed";
    if (!savedAt) return "Saved";

    return `Saved ${new Date(savedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })}`;
}

function highlightMarkdown(value: string) {
    const source = value.length > 0 ? value : " ";

    try {
        return hljs.highlight(source, {
            language: "markdown",
            ignoreIllegals: true,
        }).value;
    } catch {
        return escapeHtml(source);
    }
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizePath(pathname: string) {
    if (!pathname || pathname === "/index.html") return "/";
    const clean = pathname.replace(/\/index\.html$/, "/");
    const withLeadingSlash = clean.startsWith("/") ? clean : `/${clean}`;
    return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function getDraftSourceRelativePath(sourcePath: string) {
    return sourcePath.startsWith("draft/docs/") ? sourcePath.slice("draft/docs/".length) : null;
}

function getSiteSourceRelativePath(sourcePath: string, site: SiteKey) {
    const prefix = `${site}/docs/`;

    return sourcePath.startsWith(prefix) ? sourcePath.slice(prefix.length) : null;
}

function isDocsMarkdownSourcePath(sourcePath: string) {
    return getSiteFromSourcePath(sourcePath) !== null && sourcePath.endsWith(".md");
}

function getSiteFromSourcePath(sourcePath: string) {
    const normalized = sourcePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const site = availableSites.find((candidate) => normalized.startsWith(`${candidate}/docs/`));
    return site ?? null;
}

function normalizeClientDestinationPath(destinationPath: string, sourceFileName: string) {
    const normalized = stripDocsPathPrefix(destinationPath).trim();

    if (!normalized) return sourceFileName;
    if (normalized.endsWith("/")) return `${normalized}${sourceFileName}`;
    if (normalized.endsWith(".md")) return normalized;

    return `${normalized}.md`;
}

function normalizeClientNewMarkdownPath(filePath: string) {
    const normalized = stripDocsPathPrefix(filePath).trim();

    if (!normalized) return "new.md";
    if (normalized.endsWith("/")) return `${normalized}index.md`;
    if (normalized.endsWith(".md")) return normalized;

    return `${normalized}.md`;
}

function getDestinationFolderQuery(destinationPath: string) {
    const normalized = stripDocsPathPrefix(destinationPath).trim();

    if (!normalized) return "";
    if (normalized.endsWith("/")) return normalized.replace(/\/+$/, "");
    if (normalized.endsWith(".md")) return getPathDirName(normalized);

    return normalized;
}

function stripDocsPathPrefix(value: string) {
    let normalized = value
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");

    for (const site of availableSites) {
        const prefix = `${site}/docs/`;
        if (normalized === `${site}/docs`) {
            return "";
        }
        if (normalized.startsWith(prefix)) {
            normalized = normalized.slice(prefix.length);
            break;
        }
    }

    return normalized;
}

function getPathFileName(value: string) {
    return value.split("/").filter(Boolean).at(-1) ?? "";
}

function getPathDirName(value: string) {
    const parts = value.split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
}

function joinDocsPath(folderPath: string, fileName: string) {
    const folder = stripDocsPathPrefix(folderPath).replace(/\/+$/, "");
    return folder ? `${folder}/${fileName}` : fileName;
}

function isPrimaryShortcut(event: KeyboardEvent) {
    return event.metaKey || event.ctrlKey;
}

function isEditableShortcutTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;

    const editable = target.closest("input, textarea, select, [contenteditable='true']");
    return Boolean(editable);
}

function getInitialTheme(): Theme {
    try {
        return localStorage.getItem("smooth-docs-theme") === "light" ? "light" : "dark";
    } catch {
        return "dark";
    }
}

async function copy(value: string) {
    try {
        await navigator.clipboard.writeText(value);
        return;
    } catch (error) {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.select();

        const copied = document.execCommand("copy");
        textarea.remove();

        if (!copied) {
            throw error;
        }
    }
}

async function copyWithToast(value: string, message: string) {
    try {
        await copy(value);
        toast.success(message);
        return true;
    } catch {
        toast.error("Copy failed.", {
            description: "Clipboard permission was denied.",
        });
        return false;
    }
}
