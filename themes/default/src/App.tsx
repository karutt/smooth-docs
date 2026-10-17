import * as React from "react";
import { docsDataBySite as initialDocsDataBySite } from "#docs-data";
import {
    ArrowUp,
    Bot,
    BookOpen,
    CheckCircle2,
    ChevronRight,
    Circle,
    Code2,
    Copy,
    Eye,
    FileText,
    Folder,
    FolderPlus,
    Inbox,
    Layout,
    Loader2,
    MessageSquareText,
    Maximize2,
    Minimize2,
    Minus,
    Moon,
    Palette,
    PanelRight,
    PencilLine,
    Pin,
    Plus,
    RotateCcw,
    Settings as SettingsIcon,
    Square,
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { CodexChatMessages } from "@/components/CodexChatMessages";
import { upsertCodexChatMessage, type CodexChatMessage, type CodexChatMessageUpdate } from "../../../src/codex-chat";
import "katex/dist/katex.min.css";
import { toast } from "sonner";

type Theme = "dark" | "light";

const ActionCommandDialog = React.lazy(() => import("@/components/ActionCommandDialog"));
const DOCS_THEME_STORAGE_KEY = "smooth-docs-docs-theme";

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

type DocsEntryTarget = {
    title: string;
    kind: "page" | "folder" | "root" | "selection";
    url: string;
    sourcePath?: string;
    sourcePaths?: string[];
    folderPath?: string;
    system?: "inbox";
};

type InboxPageItem = NonNullable<DocPage["inbox"]>["items"][number];
type FolderPageItem = NonNullable<DocPage["folder"]>["items"][number];

type DocsEntryContextMenuRequest = {
    x: number;
    y: number;
    target: DocsEntryTarget;
};

type PinToastState = {
    id: number;
    message: string;
};

type CodexChatStatus = {
    available: boolean;
    running: boolean;
    threadId: string | null;
    lastError: string;
    selectedEffort: string | null;
    selectedModel: string | null;
};

type CodexContextBlock = {
    id: string;
    label: string;
    markdown: string;
    sourcePath: string;
};

type CodexModelOption = {
    id: string;
    model: string;
    displayName: string;
    description: string;
    defaultEffort: string | null;
    effortOptions: Array<{
        value: string;
        description: string;
    }>;
    isDefault: boolean;
};

type CodexSessionSummary = {
    id: string;
    name: string;
    preview: string;
    cwd: string;
    modelProvider: string;
    updatedAt: number;
    status: string;
};

type CodexSessionResumeResult = {
    error?: string;
    messages?: CodexChatMessage[];
    status?: CodexChatStatus;
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

type CreateDocsEntryResult = {
    kind: "file" | "folder";
    sourcePath: string;
    folderPath?: string;
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

type MoveMarkdownResult = {
    site: SiteKey;
    moved: Array<{
        sourcePath: string;
        destinationPath: string;
        url: string;
    }>;
    docsDataBySite?: AllDocsData;
    generatedAt?: number;
};

type RenameDocsEntryResult = {
    site: SiteKey;
    renamed: Array<{
        sourcePath: string;
        destinationPath: string;
        url: string;
    }>;
    docsDataBySite?: AllDocsData;
    generatedAt?: number;
};

type DeleteDocsEntryResult = {
    site: SiteKey;
    deleted: string[];
    docsDataBySite?: AllDocsData;
    generatedAt?: number;
};

type SaveMarkdownResult = {
    sourcePath: string;
    site: SiteKey;
};

type EditorSaveStatus = "saved" | "dirty" | "saving" | "error";

type MainWidthSetting = "narrow" | "default" | "wide" | "full";
type CodeFontFamilySetting = "mono" | "system" | "serif";
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
    | "dracula"
    | "quiet-light"
    | "solarized-light"
    | "xcode-light";
type MermaidDensitySetting = "compact" | "comfortable" | "spacious";
type SettingsSectionId = "general" | "layout" | "sidebar" | "code" | "editor" | "diagrams";

type DocsThemeOption = {
    name: string;
    title: string;
    extends?: string;
    requiresRestart: boolean;
    cssPath?: string | null;
};

type DocsThemeSettingsState = {
    currentTheme: string;
    themes: DocsThemeOption[];
    loading: boolean;
    applying: boolean;
    error: string;
};

type DocsThemeSettingsPayload = {
    currentTheme?: string;
    themes?: DocsThemeOption[];
    requiresRestart?: boolean;
    error?: string;
} & Partial<DocsContentUpdatePayload>;

type DocsUiSettings = {
    mainWidth: MainWidthSetting;
    articleFontScale: number;
    autoHideHeader: boolean;
    showBreadcrumbs: boolean;
    reduceMotion: boolean;
    leftSidebarWrap: boolean;
    rightSidebarWrap: boolean;
    pinPanelWrap: boolean;
    showRightSidebar: boolean;
    codeTheme: CodeThemeSetting;
    codeFontFamily: CodeFontFamilySetting;
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
const READ_PAGES_STORAGE_PREFIX = "smooth-docs-kit-read-pages";
const DOCS_DRAG_MIME = "application/x-smooth-docs-source-paths";
const MERMAID_COPY_BUTTON_CLASS = "docs-mermaid-copy-image";
const MERMAID_COPY_ICON =
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>';
const MERMAID_EXPORT_BASE_COLOR_VARS = [
    "--bg",
    "--fg",
    "--line",
    "--accent",
    "--muted",
    "--surface",
    "--border",
] as const;
const MERMAID_EXPORT_DERIVED_COLOR_VARS = [
    "--_text",
    "--_text-sec",
    "--_text-muted",
    "--_text-faint",
    "--_line",
    "--_arrow",
    "--_node-fill",
    "--_node-stroke",
    "--_group-fill",
    "--_group-hdr",
    "--_inner-stroke",
    "--_key-badge",
    "--beautiful-mermaid-autonumber-bg",
    "--beautiful-mermaid-autonumber-border",
    "--beautiful-mermaid-autonumber-text",
] as const;
const PIN_FONT_STEP_KEY = "smooth-docs-kit-pin-font-step";
const PIN_PANEL_WIDTH_KEY = "smooth-docs-kit-pin-panel-width";
const LEFT_SIDEBAR_WIDTH_KEY = "smooth-docs-kit-left-sidebar-width";
const TOC_PANEL_WIDTH_KEY = "smooth-docs-kit-toc-panel-width";
const CODEX_CHAT_WIDTH_KEY = "smooth-docs-kit-codex-chat-width";
const CODEX_CHAT_SESSION_KEY = "smooth-docs-kit-codex-chat-session";
const DEFAULT_CODEX_CHAT_WIDTH = 480;
const MIN_CODEX_CHAT_WIDTH = 320;
const MAX_CODEX_CHAT_WIDTH = 960;
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
const MIN_ARTICLE_FONT_SCALE = 85;
const MAX_ARTICLE_FONT_SCALE = 125;
const ARTICLE_FONT_SCALE_STEP = 5;
const DEFAULT_ARTICLE_FONT_SCALE = 100;
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
    articleFontScale: DEFAULT_ARTICLE_FONT_SCALE,
    autoHideHeader: true,
    showBreadcrumbs: true,
    reduceMotion: false,
    leftSidebarWrap: false,
    rightSidebarWrap: false,
    pinPanelWrap: false,
    showRightSidebar: true,
    codeTheme: "github-dark",
    codeFontFamily: "mono",
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
    { value: "dracula", label: "Dracula", colorScheme: "dark" },
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

const DEFAULT_CODEX_EFFORT_OPTIONS = [
    { value: "minimal", description: "Minimal" },
    { value: "low", description: "Low" },
    { value: "medium", description: "Medium" },
    { value: "high", description: "High" },
];

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
    const [createMarkdownFolderPath, setCreateMarkdownFolderPath] = React.useState<string | null>(
        null,
    );
    const [deleteMarkdownOpen, setDeleteMarkdownOpen] = React.useState(false);
    const [editMode, setEditMode] = React.useState(false);
    const [editorText, setEditorText] = React.useState("");
    const [editorSaveStatus, setEditorSaveStatus] = React.useState<EditorSaveStatus>("saved");
    const [editorSaveError, setEditorSaveError] = React.useState("");
    const [editorSavedAt, setEditorSavedAt] = React.useState<number | null>(null);
    const [theme, setTheme] = React.useState<Theme>(() => getInitialTheme());
    const [uiSettings, setUiSettings] = React.useState<DocsUiSettings>(() => readUiSettings());
    const [docsThemeState, setDocsThemeState] = React.useState<DocsThemeSettingsState>({
        currentTheme: "",
        themes: [],
        loading: false,
        applying: false,
        error: "",
    });
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
    const [pageTitleDraft, setPageTitleDraft] = React.useState(currentPage.title);
    const [readPageUrls, setReadPageUrls] = React.useState<ReadonlySet<string>>(() =>
        readReadPageUrls(route.site),
    );
    const [selectedSourcePaths, setSelectedSourcePaths] = React.useState<ReadonlySet<string>>(
        () => new Set<string>(),
    );
    const [lastSelectedSourcePath, setLastSelectedSourcePath] = React.useState<string | null>(null);
    const pinPageKey = React.useMemo(
        () => getPinPageKey(route.site, currentPage.url),
        [currentPage.url, route.site],
    );
    const [pinnedBlocks, setPinnedBlocks] = React.useState<PinnedBlock[]>(() =>
        readPinnedBlocks(pinPageKey),
    );
    const [codexChatOpen, setCodexChatOpen] = React.useState(false);
    const [codexContextBlocks, setCodexContextBlocks] = React.useState<CodexContextBlock[]>([]);
    const [pinMenu, setPinMenu] = React.useState<PinMenuRequest | null>(null);
    const [docsEntryMenu, setDocsEntryMenu] =
        React.useState<DocsEntryContextMenuRequest | null>(null);
    const [createFolderTarget, setCreateFolderTarget] = React.useState<DocsEntryTarget | null>(
        null,
    );
    const [renameTarget, setRenameTarget] = React.useState<DocsEntryTarget | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<DocsEntryTarget | null>(null);
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
    const pageTitleDraftRef = React.useRef("");
    const pageTitleSaveTimerRef = React.useRef<number | null>(null);
    const pageUrls = React.useMemo(
        () => new Set(docsData.pages.map((page) => page.url)),
        [docsData.pages],
    );
    const inboxUnreadCount = React.useMemo(
        () => countUnreadInboxItems(docsData.pages, readPageUrls),
        [docsData.pages, readPageUrls],
    );
    const selectableSourcePaths = React.useMemo(
        () => flattenNavPageSourcePaths(docsData.nav),
        [docsData.nav],
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
    const hasDocsSidePanel = hasPinnedBlocks || tableOfContents.length > 0;
    const canSwitchDocsTheme = true;
    const canEditMarkdown =
        import.meta.env.DEV &&
        currentPage.kind === "page" &&
        isDocsMarkdownSourcePath(currentPage.sourcePath);
    const canCopyCurrentPagePath =
        import.meta.env.DEV && currentPage.absolutePath.trim().length > 0;
    const canRenderDocsSidePanel = !zenMode && !editMode && hasDocsSidePanel;
    const rightSidebarOpen = canRenderDocsSidePanel && uiSettings.showRightSidebar;
    const rightPanelOpen = rightSidebarOpen;

    React.useEffect(() => {
        setPinnedBlocks(readPinnedBlocks(pinPageKey));
        setPinMenu(null);
    }, [pinPageKey]);

    React.useEffect(() => {
        setReadPageUrls(readReadPageUrls(route.site));
        setSelectedSourcePaths(new Set<string>());
        setLastSelectedSourcePath(null);
    }, [route.site]);

    React.useEffect(() => {
        if (isDocsMarkdownSourcePath(currentPage.sourcePath)) return;

        setSelectedSourcePaths(new Set<string>());
        setLastSelectedSourcePath(null);
    }, [currentPage.sourcePath]);

    React.useEffect(() => {
        if (currentPage.kind !== "page") return;
        markPageAsRead(route.site, currentPage.url, setReadPageUrls);
    }, [currentPage.kind, currentPage.url, route.site]);

    const markPagesRead = React.useCallback(
        (pagePaths: ReadonlyArray<string>) => {
            markPagesAsRead(route.site, pagePaths, setReadPageUrls);
        },
        [route.site],
    );

    const markPagesUnread = React.useCallback(
        (pagePaths: ReadonlyArray<string>) => {
            markPagesAsUnread(route.site, pagePaths, setReadPageUrls);
        },
        [route.site],
    );

    React.useEffect(() => {
        const available = new Set(selectableSourcePaths);

        setSelectedSourcePaths((current) => {
            const next = new Set([...current].filter((sourcePath) => available.has(sourcePath)));
            return next.size === current.size ? current : next;
        });

        setLastSelectedSourcePath((current) =>
            current && available.has(current) ? current : null,
        );
    }, [selectableSourcePaths]);

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

    const loadDocsThemes = React.useCallback(async () => {
        setDocsThemeState((current) => ({ ...current, loading: true, error: "" }));

        try {
            const response = import.meta.env.DEV
                ? await fetch("/__smooth-docs/themes", { method: "GET" })
                : await fetch("/theme/themes.json", { method: "GET" });
            const data = (await response.json().catch(() => ({}))) as DocsThemeSettingsPayload;

            if (response.status === 404) {
                setDocsThemeState((current) => ({
                    ...current,
                    loading: false,
                    error: import.meta.env.DEV
                        ? "Theme switching is unavailable in this server."
                        : "No static theme manifest was found.",
                }));
                return;
            }

            if (!response.ok) {
                throw new Error(data.error ?? "Failed to load themes");
            }

            const themes = data.themes ?? [];
            const currentTheme = import.meta.env.DEV
                ? data.currentTheme
                : getInitialStaticDocsThemeName(themes, data.currentTheme);

            if (import.meta.env.DEV) {
                resetDocsThemeStylesheetToProjectTheme();
            } else if (currentTheme) {
                applyStaticDocsTheme(currentTheme, themes, { persist: false });
            }

            setDocsThemeState((current) => ({
                ...current,
                currentTheme: currentTheme ?? current.currentTheme,
                themes,
                loading: false,
                error: "",
            }));
        } catch (error) {
            setDocsThemeState((current) => ({
                ...current,
                loading: false,
                error: error instanceof Error ? error.message : "Failed to load themes",
            }));
        }
    }, []);

    React.useEffect(() => {
        if (!settingsOpen) return;
        void loadDocsThemes();
    }, [loadDocsThemes, settingsOpen]);

    const changeDocsTheme = React.useCallback(
        async (themeName: string) => {
            if (!themeName || docsThemeState.applying) return;

            if (!import.meta.env.DEV) {
                const applied = applyStaticDocsTheme(themeName, docsThemeState.themes);
                if (!applied) {
                    const message = "This docs theme cannot be switched in the static site.";
                    setDocsThemeState((current) => ({ ...current, error: message }));
                    toast.error("Theme change failed.", { description: message });
                    return;
                }

                setDocsThemeState((current) => ({
                    ...current,
                    currentTheme: themeName,
                    error: "",
                }));
                toast.success("Docs theme changed.");
                return;
            }

            setDocsThemeState((current) => ({
                ...current,
                currentTheme: themeName,
                applying: true,
                error: "",
            }));

            try {
                const response = await fetch("/__smooth-docs/theme", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ theme: themeName }),
                });
                const data = (await response.json().catch(() => ({}))) as DocsThemeSettingsPayload;

                if (response.status === 404) {
                    throw new Error("Theme switching is unavailable in this server.");
                }

                if (!response.ok) {
                    throw new Error(data.error ?? "Failed to change theme");
                }

                if (data.docsDataBySite || data.refreshThemeStylesheet) {
                    applyDocsContentUpdate(data);
                }

                setDocsThemeState((current) => ({
                    ...current,
                    currentTheme: data.currentTheme ?? themeName,
                    themes: data.themes ?? current.themes,
                    applying: false,
                    error: "",
                }));

                if (data.requiresRestart) {
                    toast.message("Restart the dev server to finish switching this theme.");
                } else {
                    toast.success("Docs theme changed.");
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to change theme";
                setDocsThemeState((current) => ({
                    ...current,
                    applying: false,
                    error: message,
                }));
                toast.error("Theme change failed.", {
                    description: message,
                });
            }
        },
        [
            applyDocsContentUpdate,
            docsThemeState.applying,
            docsThemeState.themes,
        ],
    );

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
        if (pageTitleSaveTimerRef.current !== null) {
            window.clearTimeout(pageTitleSaveTimerRef.current);
            pageTitleSaveTimerRef.current = null;
        }
        setPageTitleDraft(currentPage.title);
        pageTitleDraftRef.current = currentPage.title;
    }, [currentPage.sourcePath, syncEditorFromPage]);

    React.useEffect(() => {
        if (editMode) return;

        syncEditorFromPage(currentPage.markdown);
    }, [currentPage.markdown, editMode, syncEditorFromPage]);

    React.useEffect(() => {
        editorTextRef.current = editorText;
    }, [editorText]);

    React.useEffect(() => {
        pageTitleDraftRef.current = pageTitleDraft;
    }, [pageTitleDraft]);

    React.useEffect(() => {
        if (pageTitleSaveTimerRef.current !== null) return;

        setPageTitleDraft(currentPage.title);
        pageTitleDraftRef.current = currentPage.title;
    }, [currentPage.title]);

    React.useEffect(
        () => () => {
            if (pageTitleSaveTimerRef.current !== null) {
                window.clearTimeout(pageTitleSaveTimerRef.current);
            }
        },
        [],
    );

    const navigateTo = React.useCallback(
        (url: string, nextSite = route.site) => {
            const nextPath = normalizePath(url);
            history.pushState(null, "", toSiteUrl(nextSite, nextPath));
            setRoute({ site: nextSite, pagePath: nextPath });
            window.scrollTo({ top: 0, behavior: "instant" });
        },
        [route.site],
    );

    const selectPageSourcePath = React.useCallback(
        (
            sourcePath: string,
            modifiers: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean },
        ) => {
            if (!import.meta.env.DEV) return;

            const commandKey = Boolean(modifiers.metaKey || modifiers.ctrlKey);
            const shiftKey = Boolean(modifiers.shiftKey);

            setSelectedSourcePaths((current) => {
                if (shiftKey && lastSelectedSourcePath) {
                    const range = sourcePathRange(
                        selectableSourcePaths,
                        lastSelectedSourcePath,
                        sourcePath,
                    );
                    if (range.length > 0) {
                        return commandKey ? new Set([...current, ...range]) : new Set(range);
                    }
                }

                if (commandKey) {
                    const next = new Set(current);
                    if (next.has(sourcePath)) {
                        next.delete(sourcePath);
                    } else {
                        next.add(sourcePath);
                    }
                    return next;
                }

                return new Set([sourcePath]);
            });

            setLastSelectedSourcePath(sourcePath);
        },
        [lastSelectedSourcePath, selectableSourcePaths],
    );

    const getDragSourcePaths = React.useCallback(
        (sourcePath: string) => {
            if (!import.meta.env.DEV) return [sourcePath];

            if (selectedSourcePaths.has(sourcePath)) return [...selectedSourcePaths];

            setSelectedSourcePaths(new Set([sourcePath]));
            setLastSelectedSourcePath(sourcePath);
            return [sourcePath];
        },
        [selectedSourcePaths],
    );

    const moveMarkdownFiles = React.useCallback(
        async (sourcePaths: string[], destinationFolder: string) => {
            if (!import.meta.env.DEV || sourcePaths.length === 0) return;

            try {
                const response = await fetch("/__smooth-docs/move-markdown", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sourcePaths,
                        destinationFolder,
                    }),
                });
                const data = (await response.json().catch(() => ({}))) as Partial<
                    MoveMarkdownResult
                > & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(data.error ?? "Failed to move Markdown files");
                }

                applyDocsContentUpdate(data);

                const moved = data.moved ?? [];
                const movedCurrentPage = moved.find(
                    (item) => item.sourcePath === currentPage.sourcePath,
                );
                const nextSelection = moved.map((item) => item.destinationPath);

                if (nextSelection.length > 0) {
                    setSelectedSourcePaths(new Set(nextSelection));
                    setLastSelectedSourcePath(nextSelection.at(-1) ?? null);
                }

                if (movedCurrentPage) {
                    navigateTo(movedCurrentPage.url, data.site ?? route.site);
                }

                if (moved.length === 0) {
                    toast.message("Selected files are already in that folder.");
                } else {
                    toast.success(
                        moved.length === 1
                            ? "Moved Markdown file."
                            : `Moved ${moved.length} Markdown files.`,
                    );
                }
            } catch (error) {
                toast.error("Move failed.", {
                    description: error instanceof Error ? error.message : "Unknown error",
                });
            }
        },
        [
            applyDocsContentUpdate,
            currentPage.sourcePath,
            navigateTo,
            route.site,
        ],
    );

    const createDocsEntry = React.useCallback(
        async (kind: "file" | "folder", folderPath = "", name = "") => {
            if (!import.meta.env.DEV) return false;

            try {
                const response = await fetch("/__smooth-docs/create-docs-entry", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        site: route.site,
                        kind,
                        folderPath,
                        name,
                    }),
                });
                const data = (await response.json().catch(() => ({}))) as Partial<
                    CreateDocsEntryResult
                > & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(data.error ?? `Failed to create ${kind}`);
                }

                if (!data.url || !data.sourcePath || !data.site) {
                    throw new Error("Invalid response from docs action");
                }

                applyDocsContentUpdate(data);
                if (kind === "file") {
                    setSelectedSourcePaths(new Set([data.sourcePath]));
                    setLastSelectedSourcePath(data.sourcePath);
                } else {
                    setSelectedSourcePaths(new Set());
                    setLastSelectedSourcePath(null);
                }
                navigateTo(data.url, data.site);

                toast.success(kind === "folder" ? "Created folder." : "Created file.", {
                    description: kind === "folder" ? data.folderPath : data.sourcePath,
                });
                return true;
            } catch (error) {
                toast.error("Create failed.", {
                    description: error instanceof Error ? error.message : "Unknown error",
                });
                return false;
            }
        },
        [applyDocsContentUpdate, navigateTo, route.site],
    );

    const openDocsEntryContextMenu = React.useCallback(
        (event: React.MouseEvent, target: DocsEntryTarget) => {
            if (!import.meta.env.DEV) return;

            event.preventDefault();
            event.stopPropagation();

            let nextTarget = target;

            if (
                target.sourcePath &&
                selectedSourcePaths.has(target.sourcePath) &&
                selectedSourcePaths.size > 1
            ) {
                nextTarget = {
                    title: `${selectedSourcePaths.size} selected files`,
                    kind: "selection",
                    url: "",
                    sourcePaths: [...selectedSourcePaths],
                };
            } else if (target.sourcePath) {
                selectPageSourcePath(target.sourcePath, {
                    metaKey: false,
                    ctrlKey: false,
                    shiftKey: false,
                });
            }

            setDocsEntryMenu({
                x: event.clientX,
                y: event.clientY,
                target: nextTarget,
            });
        },
        [selectPageSourcePath, selectedSourcePaths],
    );

    const createMarkdownFromTarget = React.useCallback(
        (target: DocsEntryTarget) => {
            void createDocsEntry("file", getCreateFolderPathForTarget(target, route.site));
        },
        [createDocsEntry, route.site],
    );

    const createFolderFromTarget = React.useCallback(
        (target: DocsEntryTarget) => {
            setCreateFolderTarget(target);
        },
        [],
    );

    const renameDocsEntry = React.useCallback(
        async (target: DocsEntryTarget, newName: string) => {
            if (!import.meta.env.DEV) return;

            try {
                const response = await fetch("/__smooth-docs/rename-docs-entry", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        site: route.site,
                        sourcePath: target.sourcePath,
                        folderPath: target.folderPath,
                        newName,
                    }),
                });
                const data = (await response.json().catch(() => ({}))) as Partial<
                    RenameDocsEntryResult
                > & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(data.error ?? "Failed to rename docs entry");
                }

                applyDocsContentUpdate(data);

                const renamed = data.renamed ?? [];
                const renamedCurrentPage = renamed.find(
                    (item) => item.sourcePath === currentPage.sourcePath,
                );
                if (renamedCurrentPage) {
                    navigateTo(renamedCurrentPage.url, data.site ?? route.site);
                }

                if (renamed.length > 0) {
                    setSelectedSourcePaths(
                        new Set(renamed.map((item) => item.destinationPath)),
                    );
                    setLastSelectedSourcePath(renamed.at(-1)?.destinationPath ?? null);
                }

                toast.success(target.kind === "folder" ? "Renamed folder." : "Renamed file.");
            } catch (error) {
                toast.error("Rename failed.", {
                    description: error instanceof Error ? error.message : "Unknown error",
                });
            }
        },
        [
            applyDocsContentUpdate,
            currentPage.sourcePath,
            navigateTo,
            route.site,
        ],
    );

    const deleteDocsEntry = React.useCallback(
        async (target: DocsEntryTarget) => {
            if (!import.meta.env.DEV) return;

            try {
                const response = await fetch("/__smooth-docs/delete-docs-entry", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        site: route.site,
                        sourcePath: target.sourcePath,
                        sourcePaths: target.sourcePaths,
                        folderPath: target.folderPath,
                    }),
                });
                const data = (await response.json().catch(() => ({}))) as Partial<
                    DeleteDocsEntryResult
                > & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(data.error ?? "Failed to delete docs entry");
                }

                const deleted = new Set(data.deleted ?? []);
                const deletedCurrentPage = deleted.has(currentPage.sourcePath);
                applyDocsContentUpdate(data);
                setSelectedSourcePaths((current) => {
                    const next = new Set(
                        [...current].filter((sourcePath) => !deleted.has(sourcePath)),
                    );
                    return next;
                });
                setLastSelectedSourcePath((current) =>
                    current && deleted.has(current) ? null : current,
                );

                if (deletedCurrentPage) {
                    navigateTo("/", data.site ?? route.site);
                }

                toast.success(
                    target.kind === "selection"
                        ? `Deleted ${deleted.size} files.`
                        : target.kind === "folder"
                          ? "Deleted folder."
                          : "Deleted file.",
                );
            } catch (error) {
                toast.error("Delete failed.", {
                    description: error instanceof Error ? error.message : "Unknown error",
                });
            }
        },
        [
            applyDocsContentUpdate,
            currentPage.sourcePath,
            navigateTo,
            route.site,
        ],
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

    const updateArticleFontScale = React.useCallback(
        (value: number) => {
            updateUiSetting("articleFontScale", clampArticleFontScale(value));
        },
        [updateUiSetting],
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
        if (!canCopyCurrentPagePath) return;

        void copyWithToast(currentPage.absolutePath, "Copied page path.");
    }, [canCopyCurrentPagePath, currentPage.absolutePath]);

    const copyCurrentUrl = React.useCallback(() => {
        void copyWithToast(location.href, "Copied current URL.");
    }, []);

    const saveEditorText = React.useCallback(
        async (markdown: string, options: { toastOnError?: boolean } = {}) => {
            if (!import.meta.env.DEV || !canEditMarkdown) return false;

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
        if (!import.meta.env.DEV) return;

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

    const savePageTitle = React.useCallback(
        async (title: string) => {
            if (!import.meta.env.DEV || !canEditMarkdown) return;

            const normalizedTitle = normalizeMarkdownTitle(title);
            if (!normalizedTitle) {
                setPageTitleDraft(currentPage.title);
                pageTitleDraftRef.current = currentPage.title;
                return;
            }

            const sourceMarkdown = editMode ? editorTextRef.current : currentPage.markdown;
            const nextMarkdown = replaceMarkdownTitle(sourceMarkdown, normalizedTitle);
            if (nextMarkdown === sourceMarkdown) return;

            editorTextRef.current = nextMarkdown;
            if (editMode) setEditorText(nextMarkdown);

            const saved = await saveEditorText(nextMarkdown, { toastOnError: true });
            if (!saved) return;

            try {
                await regenerateDocsContent();
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                toast.error("Failed to update preview.", {
                    description: message,
                });
            }
        },
        [
            canEditMarkdown,
            currentPage.markdown,
            currentPage.title,
            editMode,
            regenerateDocsContent,
            saveEditorText,
        ],
    );

    const flushPageTitleSave = React.useCallback(() => {
        if (pageTitleSaveTimerRef.current !== null) {
            window.clearTimeout(pageTitleSaveTimerRef.current);
            pageTitleSaveTimerRef.current = null;
        }

        void savePageTitle(pageTitleDraftRef.current);
    }, [savePageTitle]);

    const updatePageTitleDraft = React.useCallback(
        (title: string) => {
            setPageTitleDraft(title);
            pageTitleDraftRef.current = title;

            if (pageTitleSaveTimerRef.current !== null) {
                window.clearTimeout(pageTitleSaveTimerRef.current);
            }

            pageTitleSaveTimerRef.current = window.setTimeout(() => {
                pageTitleSaveTimerRef.current = null;
                void savePageTitle(pageTitleDraftRef.current);
            }, 500);
        },
        [savePageTitle],
    );

    const enterEditMode = React.useCallback(() => {
        if (!import.meta.env.DEV || !canEditMarkdown) {
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
        if (!import.meta.env.DEV || !editMode || !canEditMarkdown) return;

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
        if (!import.meta.env.DEV) return;

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
            setUiSettings((current) =>
                current.showRightSidebar ? current : { ...current, showRightSidebar: true },
            );
            setSidebarOpen(false);
            request.sourceElement.classList.add("docs-pin-source--pinned");
            window.setTimeout(() => {
                request.sourceElement.classList.remove("docs-pin-source--pinned");
            }, 800);
            showPinToast("Pinned block added.");
        },
        [pinnedBlocks, savePinnedBlocksForCurrentPage, showPinToast],
    );

    const addCodexContextFromPinMenu = React.useCallback(
        (request: Pick<PinMenuRequest, "block" | "selectedMarkdown">) => {
            if (!import.meta.env.DEV) return;

            const markdown = (request.selectedMarkdown ?? request.block?.markdown ?? "").trim();
            if (!markdown) {
                showPinToast("No Markdown found for Codex context.");
                return;
            }

            const label = request.selectedMarkdown
                ? "Selected text"
                : request.block?.label || "Docs block";
            const nextBlock: CodexContextBlock = {
                id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                label,
                markdown,
                sourcePath: currentPage.sourcePath,
            };

            setCodexContextBlocks((current) => {
                const withoutDuplicate = current.filter(
                    (block) =>
                        block.markdown !== nextBlock.markdown ||
                        block.sourcePath !== nextBlock.sourcePath,
                );
                return [...withoutDuplicate, nextBlock].slice(-8);
            });

            request.block?.sourceElement.classList.add("docs-pin-source--pinned");
            window.setTimeout(() => {
                request.block?.sourceElement.classList.remove("docs-pin-source--pinned");
            }, 800);
            showPinToast("Added Codex context.");
        },
        [currentPage.sourcePath, showPinToast],
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

            if (import.meta.env.DEV && primary && event.shiftKey && !event.altKey && code === "KeyL") {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                if (!event.repeat) setCodexChatOpen((current) => !current);
                return;
            }

            if (event.defaultPrevented) return;

            const plainPrimary = primary && !event.altKey && !event.shiftKey;
            const editableTarget = isEditableShortcutTarget(event.target);
            const markdownEditorTarget =
                import.meta.env.DEV && isMarkdownEditorShortcutTarget(event.target);

            if (plainPrimary && code === "KeyK") {
                if (markdownEditorTarget) {
                    return;
                }
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

            if (plainPrimary && code === "KeyP" && canCopyCurrentPagePath) {
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
        canCopyCurrentPagePath,
        switchToNextSite,
        toggleRightSidebar,
        toggleTheme,
        toggleZenMode,
    ]);

    React.useEffect(() => {
        document.title = `${pageTitleDraft || currentPage.title} | ${docsData.siteTitle}`;
    }, [currentPage.title, docsData.siteTitle, pageTitleDraft]);

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

    const pageActiveBar = !editMode ? (
        <ArticleActiveBar
            canSwitchDocsTheme={canSwitchDocsTheme}
            docsTheme={docsThemeState.currentTheme}
            docsThemeApplying={docsThemeState.applying}
            docsThemeError={docsThemeState.error}
            docsThemeLoading={docsThemeState.loading}
            docsThemeOptions={docsThemeState.themes}
            fontScale={uiSettings.articleFontScale}
            leftSidebarOpen={!zenMode && sidebarOpen}
            leftSidebarWidth={leftSidebarWidth}
            mainWidth={uiSettings.mainWidth}
            onDocsThemeChange={changeDocsTheme}
            onDocsThemesRefresh={loadDocsThemes}
            onFontScaleChange={updateArticleFontScale}
            onMainWidthChange={(value) => updateUiSetting("mainWidth", value)}
            onSettingsOpen={() => setSettingsOpen(true)}
            onThemeToggle={toggleTheme}
            onRightSidebarToggle={toggleRightSidebar}
            rightSidebarAvailable={canRenderDocsSidePanel}
            rightSidebarOpen={rightSidebarOpen}
            theme={theme}
        />
    ) : null;

    return (
        <SidebarProvider
            className={cn(uiSettings.reduceMotion && "docs-reduce-motion", codexChatOpen && "max-md:flex-wrap")}
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
            style={{ "--sidebar-width": `${leftSidebarWidth}px` } as React.CSSProperties}>
            {!zenMode && (
                <DocsSidebar
                    canManageDocs={import.meta.env.DEV}
                    currentPath={currentPage.url}
                    currentSourcePath={currentPage.sourcePath}
                    getDragSourcePaths={getDragSourcePaths}
                    inboxUnreadCount={inboxUnreadCount}
                    items={docsData.nav}
                    onCreateMarkdown={() => {
                        void createDocsEntry("file", "");
                    }}
                    onEntryContextMenu={openDocsEntryContextMenu}
                    onMoveMarkdown={moveMarkdownFiles}
                    onNavigate={(url) => navigateTo(url)}
                    onPageSelect={selectPageSourcePath}
                    onSettingsOpen={() => setSettingsOpen(true)}
                    onWidthChange={updateLeftSidebarWidth}
                    pageUrls={pageUrls}
                    selectedSourcePaths={selectedSourcePaths}
                    siteTitle={docsData.siteTitle}
                    width={leftSidebarWidth}
                    wrapText={uiSettings.leftSidebarWrap}
                />
            )}

            {commandOpen ? (
                <React.Suspense fallback={null}>
                    <ActionCommandDialog
                        availableSites={availableSites}
                        canCopyPath={canCopyCurrentPagePath}
                        canCreateMarkdown={import.meta.env.DEV}
                        canEditMarkdown={canEditMarkdown}
                        docsData={docsData}
                        editMode={editMode}
                        getSiteLabel={getSiteLabel}
                        onCopyMarkdown={copyCurrentPageMarkdown}
                        onCopyPath={copyCurrentPagePath}
                        onCopyUrl={copyCurrentUrl}
                        onCreateMarkdown={() => {
                            void createDocsEntry("file", "");
                        }}
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
                            import.meta.env.DEV &&
                            availableSites.includes("published") &&
                            route.site === "draft" &&
                            currentPage.sourcePath.startsWith("draft/docs/")
                        }
                        canDeleteMarkdown={
                            import.meta.env.DEV &&
                            isDocsMarkdownSourcePath(currentPage.sourcePath)
                        }
                        open={commandOpen}
                        site={route.site}
                        theme={theme}
                        zenMode={zenMode}
                    />
                </React.Suspense>
            ) : null}

            {import.meta.env.DEV ? (
                <>
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
                        initialFolderPath={createMarkdownFolderPath}
                        open={createMarkdownOpen}
                        onOpenChange={(open) => {
                            setCreateMarkdownOpen(open);
                            if (!open) setCreateMarkdownFolderPath(null);
                        }}
                        onCreated={(site, url, payload) => {
                            applyDocsContentUpdate(payload);
                            navigateTo(url, site);
                        }}
                        site={route.site}
                    />

                    <DeleteMarkdownDialog
                        currentPage={currentPage}
                        open={
                            deleteMarkdownOpen && isDocsMarkdownSourcePath(currentPage.sourcePath)
                        }
                        onOpenChange={setDeleteMarkdownOpen}
                        onDeleted={(site, payload) => {
                            applyDocsContentUpdate(payload);
                            navigateTo("/", site);
                        }}
                    />
                </>
            ) : null}

            <DocsSettingsDialog
                canSwitchDocsTheme={canSwitchDocsTheme}
                canUseLocalDocsActions={import.meta.env.DEV}
                leftSidebarWidth={leftSidebarWidth}
                onLayoutWidthsReset={resetLayoutWidths}
                onOpenChange={setSettingsOpen}
                onPinFontStepChange={updatePinFontStepIndex}
                onDocsThemeChange={changeDocsTheme}
                onDocsThemesRefresh={loadDocsThemes}
                onSettingsChange={updateUiSetting}
                onSettingsReset={resetUiSettings}
                onThemeChange={setTheme}
                open={settingsOpen}
                pinFontStepIndex={pinFontStepIndex}
                pinPanelWidth={pinPanelWidth}
                docsTheme={docsThemeState.currentTheme}
                docsThemeApplying={docsThemeState.applying}
                docsThemeError={docsThemeState.error}
                docsThemeLoading={docsThemeState.loading}
                docsThemeOptions={docsThemeState.themes}
                settings={uiSettings}
                theme={theme}
                tocPanelWidth={tocPanelWidth}
            />

            <SidebarInset className={codexChatOpen ? "max-md:w-full max-md:flex-none" : undefined}>
                {!zenMode && (
                    <header
                        className={cn(
                            "sticky top-0 z-40 border-b bg-background/95 transition-[transform,opacity] duration-300 ease-out",
                            headerVisible
                                ? "translate-y-0 opacity-100"
                                : "-translate-y-full opacity-0",
                        )}>
                        <div className='flex h-14 items-center gap-2 px-4 lg:gap-3 lg:px-6'>
                            <SidebarTrigger aria-label='Toggle navigation' />
                            <HeaderBreadcrumbs
                                breadcrumbs={pageBreadcrumbs}
                                onNavigate={navigateTo}
                                showBreadcrumbs={uiSettings.showBreadcrumbs}
                            />

                            <div className='ml-auto flex shrink-0 items-center gap-1.5'>
                                <PageHeaderActions
                                    canCopyPath={canCopyCurrentPagePath}
                                    canEditMarkdown={canEditMarkdown}
                                    editMode={editMode}
                                    onEditModeToggle={toggleEditMode}
                                    page={currentPage}
                                />
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
                            "flex w-full flex-col gap-0",
                            `docs-code-theme-${uiSettings.codeTheme}`,
                            uiSettings.codeWrap && "docs-code-wrap",
                            uiSettings.editorWrap && "docs-editor-wrap",
                            rightPanelOpen && "lg:flex-row lg:items-start",
                            rightPanelOpen && "gap-8",
                        )}>
                        <div className='min-w-0 flex-1 py-8'>
                            <div
                                className='mx-auto flex w-full flex-col gap-0'
                                style={{ maxWidth: "var(--docs-main-max-width)" }}>
                                <PageHeader
                                    canEditTitle={canEditMarkdown}
                                    onTitleChange={updatePageTitleDraft}
                                    onTitleSave={flushPageTitleSave}
                                    page={currentPage}
                                    title={pageTitleDraft || currentPage.title}
                                />
                                {import.meta.env.DEV && editMode ? (
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
                                ) : currentPage.kind === "inbox" && currentPage.inbox ? (
                                    <InboxPage
                                        canManageDocs={import.meta.env.DEV}
                                        key={`${route.site}-${currentPage.url}-inbox`}
                                        getDragSourcePaths={getDragSourcePaths}
                                        onEntryContextMenu={openDocsEntryContextMenu}
                                        onMarkRead={markPagesRead}
                                        onMarkUnread={markPagesUnread}
                                        onNavigate={navigateTo}
                                        page={currentPage}
                                        readPageUrls={readPageUrls}
                                    />
                                ) : currentPage.kind === "folder" && currentPage.folder ? (
                                    <FolderPage
                                        canManageDocs={import.meta.env.DEV}
                                        key={`${route.site}-${currentPage.url}-folder`}
                                        getDragSourcePaths={getDragSourcePaths}
                                        onCreateFile={(folderPath) => {
                                            void createDocsEntry("file", folderPath);
                                        }}
                                        onCreateFolder={(target) => setCreateFolderTarget(target)}
                                        onEntryContextMenu={openDocsEntryContextMenu}
                                        onMoveMarkdown={moveMarkdownFiles}
                                        onNavigate={navigateTo}
                                        page={currentPage}
                                    />
                                ) : (
                                    <Article
                                        key={`${route.site}-${currentPage.url}`}
                                        fontScale={uiSettings.articleFontScale}
                                        page={currentPage}
                                        onPinMenuRequest={setPinMenu}
                                    />
                                )}
                                {pageActiveBar}
                            </div>
                        </div>



                        {rightSidebarOpen && hasPinnedBlocks ? (
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
                        ) : rightSidebarOpen ? (
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

            {import.meta.env.DEV ? (
                <CodexChatWidget
                    contextBlocks={codexContextBlocks}
                    currentPage={currentPage}
                    leftSidebarWidth={!zenMode && sidebarOpen ? leftSidebarWidth : 0}
                    onContextBlockRemove={(id) =>
                        setCodexContextBlocks((current) =>
                            current.filter((block) => block.id !== id),
                        )
                    }
                    onContextBlocksClear={() => setCodexContextBlocks([])}
                    onOpenChange={setCodexChatOpen}
                    open={codexChatOpen}
                    site={route.site}
                />
            ) : null}

            <PinContextMenu
                canAddContext={import.meta.env.DEV}
                request={pinMenu}
                onClose={closePinMenu}
                onAddContext={(request) => {
                    addCodexContextFromPinMenu(request);
                    setPinMenu(null);
                }}
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
            {import.meta.env.DEV ? (
                <>
                    <DocsEntryContextMenu
                        request={docsEntryMenu}
                        onClose={() => setDocsEntryMenu(null)}
                        onCreateFile={(target) => {
                            setDocsEntryMenu(null);
                            createMarkdownFromTarget(target);
                        }}
                        onCreateFolder={(target) => {
                            setDocsEntryMenu(null);
                            createFolderFromTarget(target);
                        }}
                        onDelete={(target) => {
                            setDocsEntryMenu(null);
                            setDeleteTarget(target);
                        }}
                        onRename={(target) => {
                            setDocsEntryMenu(null);
                            setRenameTarget(target);
                        }}
                    />
                    <CreateFolderDialog
                        open={createFolderTarget !== null}
                        target={createFolderTarget}
                        onOpenChange={(open) => {
                            if (!open) setCreateFolderTarget(null);
                        }}
                        onCreate={async (target, name) => {
                            const created = await createDocsEntry(
                                "folder",
                                getCreateFolderPathForTarget(target, route.site),
                                name,
                            );
                            if (created) setCreateFolderTarget(null);
                        }}
                    />
                    <RenameDocsEntryDialog
                        open={renameTarget !== null}
                        target={renameTarget}
                        onOpenChange={(open) => {
                            if (!open) setRenameTarget(null);
                        }}
                        onRename={async (target, newName) => {
                            await renameDocsEntry(target, newName);
                            setRenameTarget(null);
                        }}
                    />
                    <DeleteDocsEntryDialog
                        open={deleteTarget !== null}
                        target={deleteTarget}
                        onOpenChange={(open) => {
                            if (!open) setDeleteTarget(null);
                        }}
                        onDelete={async (target) => {
                            await deleteDocsEntry(target);
                            setDeleteTarget(null);
                        }}
                    />
                </>
            ) : null}
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
                    "docs-toc-panel-desktop sticky hidden min-w-0 shrink-0 overflow-hidden transition-[width] duration-300 ease-smooth lg:block",
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
    className,
    onWidthChange,
    side,
    width,
}: {
    ariaLabel: string;
    className?: string;
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
            aria-valuenow={Math.round(width)}
            className={cn("docs-sidebar-resizer", className)}
            data-side={side}
            tabIndex={0}
            onKeyDown={resizeWithKeyboard}
            onPointerCancel={endResize}
            onLostPointerCapture={endResize}
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
                    "docs-pin-panel-desktop sticky hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-smooth lg:block",
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
    canAddContext,
    onAddContext,
    onClose,
    onCopyMarkdown,
    onPin,
    request,
}: {
    canAddContext: boolean;
    onAddContext: (request: Pick<PinMenuRequest, "block" | "selectedMarkdown">) => void;
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
            {import.meta.env.DEV && canAddContext && (block?.markdown || selectedMarkdown) && (
                <button
                    type='button'
                    className='docs-pin-context-menu-item'
                    role='menuitem'
                    onClick={() =>
                        onAddContext({
                            block,
                            selectedMarkdown,
                        })
                    }>
                    <Bot className='h-3.5 w-3.5' />
                    <span className='min-w-0 truncate'>Add to Codex context</span>
                </button>
            )}
        </div>
    );
}

function DocsEntryContextMenu({
    onClose,
    onCreateFile,
    onCreateFolder,
    onDelete,
    onRename,
    request,
}: {
    onClose: () => void;
    onCreateFile: (target: DocsEntryTarget) => void;
    onCreateFolder: (target: DocsEntryTarget) => void;
    onDelete: (target: DocsEntryTarget) => void;
    onRename: (target: DocsEntryTarget) => void;
    request: DocsEntryContextMenuRequest | null;
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

    const { target } = request;
    const isSystemFolder = target.system === "inbox";
    const isRoot = target.kind === "root";
    const isSelection = target.kind === "selection";

    return (
        <div
            ref={ref}
            className='docs-pin-context-menu'
            style={{ left: position.x, top: position.y }}
            role='menu'>
            {!isSelection && (
                <>
                    <button
                        type='button'
                        className='docs-pin-context-menu-item'
                        role='menuitem'
                        onClick={() => onCreateFile(target)}>
                        <Plus className='h-3.5 w-3.5' />
                        <span className='min-w-0 truncate'>Add file</span>
                    </button>
                    <button
                        type='button'
                        className='docs-pin-context-menu-item'
                        role='menuitem'
                        onClick={() => onCreateFolder(target)}>
                        <FolderPlus className='h-3.5 w-3.5' />
                        <span className='min-w-0 truncate'>Add folder</span>
                    </button>
                </>
            )}
            {!isRoot && !isSelection && (
                <button
                    type='button'
                    className='docs-pin-context-menu-item'
                    role='menuitem'
                    disabled={isSystemFolder}
                    onClick={() => onRename(target)}>
                    <PencilLine className='h-3.5 w-3.5' />
                    <span className='min-w-0 truncate'>Rename</span>
                </button>
            )}
            {!isRoot && (
                <button
                    type='button'
                    className='docs-pin-context-menu-item text-destructive'
                    role='menuitem'
                    disabled={isSystemFolder}
                    onClick={() => onDelete(target)}>
                    <Trash2 className='h-3.5 w-3.5' />
                    <span className='min-w-0 truncate'>
                        {isSelection
                            ? `Delete ${target.sourcePaths?.length ?? 0} selected`
                            : "Delete"}
                    </span>
                </button>
            )}
            {isSystemFolder && (
                <div className='px-2 py-1 text-xs text-muted-foreground'>System folder</div>
            )}
        </div>
    );
}

function CreateFolderDialog({
    onCreate,
    onOpenChange,
    open,
    target,
}: {
    onCreate: (target: DocsEntryTarget, name: string) => Promise<void>;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    target: DocsEntryTarget | null;
}) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [name, setName] = React.useState("untitled");
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;

        setName("untitled");
        setSubmitting(false);
        window.requestAnimationFrame(() => inputRef.current?.focus());
    }, [open]);

    const submit = React.useCallback(async () => {
        if (!target || submitting || !name.trim()) return;

        setSubmitting(true);
        await onCreate(target, name);
        setSubmitting(false);
    }, [name, onCreate, submitting, target]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-md'>
                <DialogTitle>Add folder</DialogTitle>
                <DialogDescription>Create a folder in the selected sidebar location.</DialogDescription>
                <div className='space-y-2'>
                    <label className='text-sm font-medium' htmlFor='create-docs-folder-name'>
                        Name
                    </label>
                    <Input
                        ref={inputRef}
                        id='create-docs-folder-name'
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        onFocus={(event) => event.currentTarget.select()}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                void submit();
                            }
                        }}
                    />
                </div>
                <div className='flex justify-end gap-2'>
                    <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type='button' disabled={submitting || !name.trim()} onClick={submit}>
                        Create
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function RenameDocsEntryDialog({
    onOpenChange,
    onRename,
    open,
    target,
}: {
    onOpenChange: (open: boolean) => void;
    onRename: (target: DocsEntryTarget, newName: string) => Promise<void>;
    open: boolean;
    target: DocsEntryTarget | null;
}) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [name, setName] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (!open || !target) return;

        setName(defaultRenameName(target));
        setSubmitting(false);
        window.requestAnimationFrame(() => inputRef.current?.focus());
    }, [open, target]);

    const submit = React.useCallback(async () => {
        if (!target || submitting) return;

        setSubmitting(true);
        await onRename(target, name);
        setSubmitting(false);
    }, [name, onRename, submitting, target]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-md'>
                <DialogTitle>Rename {target?.kind === "folder" ? "folder" : "file"}</DialogTitle>
                <DialogDescription>
                    Rename this {target?.kind === "folder" ? "folder" : "Markdown file"}.
                </DialogDescription>
                <div className='space-y-2'>
                    <label className='text-sm font-medium' htmlFor='rename-docs-entry-name'>
                        Name
                    </label>
                    <Input
                        ref={inputRef}
                        id='rename-docs-entry-name'
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                void submit();
                            }
                        }}
                    />
                </div>
                <div className='flex justify-end gap-2'>
                    <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type='button' disabled={submitting || !name.trim()} onClick={submit}>
                        Rename
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DeleteDocsEntryDialog({
    onDelete,
    onOpenChange,
    open,
    target,
}: {
    onDelete: (target: DocsEntryTarget) => Promise<void>;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    target: DocsEntryTarget | null;
}) {
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (open) setSubmitting(false);
    }, [open]);

    const submit = React.useCallback(async () => {
        if (!target || submitting) return;

        setSubmitting(true);
        await onDelete(target);
        setSubmitting(false);
    }, [onDelete, submitting, target]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-md'>
                <DialogTitle>
                    Delete{" "}
                    {target?.kind === "selection"
                        ? `${target.sourcePaths?.length ?? 0} files`
                        : target?.kind === "folder"
                          ? "folder"
                          : "file"}
                </DialogTitle>
                <DialogDescription>
                    {target?.kind === "selection"
                        ? "Delete the selected Markdown files."
                        : target?.kind === "folder"
                          ? "Delete this folder and everything inside it."
                          : "Delete this Markdown file."}
                </DialogDescription>
                <div className='rounded-md border bg-muted px-3 py-2 text-sm'>
                    {target?.title}
                </div>
                <div className='flex justify-end gap-2'>
                    <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        type='button'
                        variant='destructive'
                        disabled={submitting}
                        onClick={submit}>
                        Delete
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
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

function CodexChatWidget({
    contextBlocks,
    currentPage,
    leftSidebarWidth,
    onContextBlockRemove,
    onContextBlocksClear,
    onOpenChange,
    open,
    site,
}: {
    contextBlocks: CodexContextBlock[];
    currentPage: DocPage;
    leftSidebarWidth: number;
    onContextBlockRemove: (id: string) => void;
    onContextBlocksClear: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    site: SiteKey;
}) {
    const [draft, setDraft] = React.useState("");
    const [expanded, setExpanded] = React.useState(false);
    const [panelWidth, setPanelWidth] = React.useState(() => {
        const saved = Number.parseInt(readStorageValue(CODEX_CHAT_WIDTH_KEY) ?? "", 10);
        return Number.isFinite(saved)
            ? clamp(saved, MIN_CODEX_CHAT_WIDTH, MAX_CODEX_CHAT_WIDTH)
            : DEFAULT_CODEX_CHAT_WIDTH;
    });
    const [viewportWidth, setViewportWidth] = React.useState(() => window.innerWidth);
    const dockWidthLimit = viewportWidth < 768
        ? viewportWidth
        : Math.max(MIN_CODEX_CHAT_WIDTH, viewportWidth - (viewportWidth >= 1024 ? leftSidebarWidth : 0) - 320);
    const displayedPanelWidth = viewportWidth < 768 ? viewportWidth : Math.min(panelWidth, dockWidthLimit);
    const [messages, setMessages] = React.useState<CodexChatMessage[]>([]);
    const [models, setModels] = React.useState<CodexModelOption[]>([]);
    const [modelsLoading, setModelsLoading] = React.useState(false);
    const [sending, setSending] = React.useState(false);
    const [sessions, setSessions] = React.useState<CodexSessionSummary[]>([]);
    const [sessionsLoading, setSessionsLoading] = React.useState(false);
    const [sessionsOpen, setSessionsOpen] = React.useState(false);
    const [sessionLoading, setSessionLoading] = React.useState(false);
    const [sessionReady, setSessionReady] = React.useState(false);
    const [statusLoaded, setStatusLoaded] = React.useState(false);
    const [status, setStatus] = React.useState<CodexChatStatus>({
        available: true,
        running: false,
        threadId: null,
        lastError: "",
        selectedEffort: null,
        selectedModel: null,
    });
    const assistantMessageIdRef = React.useRef<string | null>(null);
    const previousSessionRef = React.useRef(readStorageValue(CODEX_CHAT_SESSION_KEY));
    const restoreStartedRef = React.useRef(false);
    const draftRef = React.useRef<HTMLTextAreaElement>(null);
    const launcherRef = React.useRef<HTMLButtonElement>(null);
    const endRef = React.useRef<HTMLDivElement>(null);

    const appendMessage = React.useCallback((message: CodexChatMessage) => {
        setMessages((current) => [...current, message]);
    }, []);

    const updateAssistantMessage = React.useCallback(({ message, append }: CodexChatMessageUpdate) => {
        const placeholderId = assistantMessageIdRef.current;
        setMessages((current) => {
            if (!message.content && !current.some((entry) => entry.id === message.id)) return current;
            return upsertCodexChatMessage(
                current.filter((entry) => entry.id !== placeholderId || entry.content),
                message,
                append,
            );
        });
    }, []);

    React.useEffect(() => {
        const source = new EventSource("/__smooth-docs/codex/events");

        const readData = <T,>(event: MessageEvent<string>) => {
            try {
                return JSON.parse(event.data) as T;
            } catch {
                return null;
            }
        };

        const onStatus = (event: MessageEvent<string>) => {
            const data = readData<CodexChatStatus>(event);
            if (data) {
                setStatus(data);
                setStatusLoaded(true);
            }
        };

        const onMessage = (event: MessageEvent<string>) => {
            const data = readData<CodexChatMessageUpdate>(event);
            if (data?.message) updateAssistantMessage(data);
        };

        const onDone = (event: MessageEvent<string>) => {
            const data = readData<{ status?: CodexChatStatus }>(event);
            if (data?.status) setStatus(data.status);
            setMessages((current) => current.filter((entry) => entry.content));
            assistantMessageIdRef.current = null;
        };

        const onCodexError = (event: MessageEvent<string>) => {
            const data = readData<{ message?: string; status?: CodexChatStatus }>(event);
            const message = data?.message || "Codex chat failed";
            if (data?.status) setStatus(data.status);
            appendMessage({
                id: createClientId(),
                role: "system",
                content: message,
            });
            assistantMessageIdRef.current = null;
        };

        source.addEventListener("status", onStatus);
        source.addEventListener("message", onMessage);
        source.addEventListener("done", onDone);
        source.addEventListener("error", onCodexError);
        source.onerror = () => {
            setStatus((current) => ({
                ...current,
                available: false,
                running: false,
                lastError: current.lastError || "Codex chat connection failed",
            }));
        };

        return () => {
            source.removeEventListener("status", onStatus);
            source.removeEventListener("message", onMessage);
            source.removeEventListener("done", onDone);
            source.removeEventListener("error", onCodexError);
            source.close();
        };
    }, [updateAssistantMessage, appendMessage]);

    React.useEffect(() => {
        if (!open) return;
        endRef.current?.scrollIntoView({ block: "end" });
    }, [expanded, messages, open, status.running]);

    React.useLayoutEffect(() => {
        const input = draftRef.current;
        if (!input) return;
        input.style.height = "0px";
        input.style.height = `${Math.min(Math.max(input.scrollHeight, 48), 192)}px`;
    }, [draft, expanded, open]);

    React.useLayoutEffect(() => {
        if (open) setExpanded(false);
    }, [open]);

    React.useEffect(() => {
        if (open && !expanded) draftRef.current?.focus({ preventScroll: window.innerWidth >= 768 });
    }, [expanded, open]);

    React.useEffect(() => {
        const updateViewportWidth = () => setViewportWidth(window.innerWidth);
        window.addEventListener("resize", updateViewportWidth);
        return () => window.removeEventListener("resize", updateViewportWidth);
    }, []);

    const updatePanelWidth = React.useCallback((width: number) => {
        const next = Math.round(clamp(
            width,
            MIN_CODEX_CHAT_WIDTH,
            Math.max(MIN_CODEX_CHAT_WIDTH, Math.min(MAX_CODEX_CHAT_WIDTH, dockWidthLimit)),
        ));
        setPanelWidth(next);
        writeStorageValue(CODEX_CHAT_WIDTH_KEY, String(next));
    }, [dockWidthLimit]);

    const loadModels = React.useCallback(async () => {
        setModelsLoading(true);

        try {
            const response = await fetch("/__smooth-docs/codex/models", { method: "GET", cache: "no-store" });
            const data = (await response.json().catch(() => ({}))) as {
                models?: CodexModelOption[];
                status?: CodexChatStatus;
                error?: string;
            };

            if (!response.ok) {
                throw new Error(data.error ?? "Failed to load models");
            }

            setModels(Array.isArray(data.models) ? data.models : []);
            if (data.status) setStatus(data.status);
        } catch (error) {
            appendMessage({
                id: createClientId(),
                role: "system",
                content: error instanceof Error ? error.message : "Failed to load models",
            });
        } finally {
            setModelsLoading(false);
        }
    }, [appendMessage]);

    const updateCodexSettings = React.useCallback(
        async (next: { effort?: string | null; model?: string | null }) => {
            const nextModel =
                "model" in next ? next.model ?? null : status.selectedModel;
            const nextEffort =
                "effort" in next ? next.effort ?? null : status.selectedEffort;

            setStatus((current) => ({
                ...current,
                selectedEffort: nextEffort,
                selectedModel: nextModel,
            }));

            try {
                const response = await fetch("/__smooth-docs/codex/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        effort: nextEffort,
                        model: nextModel,
                    }),
                });
                const data = (await response.json().catch(() => ({}))) as Partial<CodexChatStatus> & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(data.error ?? "Failed to update Codex settings");
                }

                setStatus((current) => ({ ...current, ...data }));
            } catch (error) {
                appendMessage({
                    id: createClientId(),
                    role: "system",
                    content:
                        error instanceof Error
                            ? error.message
                            : "Failed to update Codex settings",
                });
            }
        },
        [appendMessage, status.selectedEffort, status.selectedModel],
    );

    const loadSessions = React.useCallback(async () => {
        setSessionsLoading(true);

        try {
            const response = await fetch("/__smooth-docs/codex/sessions", { method: "GET" });
            const data = (await response.json().catch(() => ({}))) as {
                sessions?: CodexSessionSummary[];
                error?: string;
            };

            if (!response.ok) {
                throw new Error(data.error ?? "Failed to load sessions");
            }

            setSessions(Array.isArray(data.sessions) ? data.sessions : []);
        } catch (error) {
            appendMessage({
                id: createClientId(),
                role: "system",
                content: error instanceof Error ? error.message : "Failed to load sessions",
            });
        } finally {
            setSessionsLoading(false);
        }
    }, [appendMessage]);

    React.useEffect(() => {
        if (!open) return;
        void loadModels();
    }, [loadModels, open]);

    const toggleSessions = React.useCallback(() => {
        setSessionsOpen((current) => {
            const next = !current;
            if (next) void loadSessions();
            return next;
        });
    }, [loadSessions]);

    const resumeSession = React.useCallback(
        async (threadId: string) => {
            if (status.running) return;

            restoreStartedRef.current = true;
            setSessionLoading(true);
            setSessionReady(false);

            try {
                const response = await fetch("/__smooth-docs/codex/session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ threadId }),
                });
                const data = (await response.json().catch(() => ({}))) as CodexSessionResumeResult;

                if (!response.ok) {
                    throw new Error(data.error ?? "Failed to resume session");
                }

                setMessages(normalizeCodexChatMessages(data.messages));
                assistantMessageIdRef.current = null;
                if (data.status) {
                    setStatus((current) => ({ ...current, ...data.status }));
                }
                setSessionsOpen(false);
            } catch (error) {
                appendMessage({
                    id: createClientId(),
                    role: "system",
                    content: error instanceof Error ? error.message : "Failed to resume session",
                });
            } finally {
                setSessionLoading(false);
                setSessionReady(true);
            }
        },
        [appendMessage, status.running],
    );

    React.useEffect(() => {
        if (!open || !statusLoaded || status.running || restoreStartedRef.current) return;
        restoreStartedRef.current = true;
        const threadId = previousSessionRef.current || status.threadId;
        if (threadId) {
            void resumeSession(threadId);
        } else {
            setSessionReady(true);
        }
    }, [open, resumeSession, status.running, status.threadId, statusLoaded]);

    React.useEffect(() => {
        if (!sessionReady || sessionLoading || !status.threadId) return;
        previousSessionRef.current = status.threadId;
        writeStorageValue(CODEX_CHAT_SESSION_KEY, status.threadId);
    }, [sessionLoading, sessionReady, status.threadId]);

    const stopTurn = React.useCallback(async () => {
        if (!status.running) return;

        try {
            const response = await fetch("/__smooth-docs/codex/stop", { method: "POST" });
            const data = (await response.json().catch(() => ({}))) as Partial<CodexChatStatus> & {
                error?: string;
            };

            if (!response.ok) {
                throw new Error(data.error ?? "Failed to stop Codex");
            }

            assistantMessageIdRef.current = null;
            setStatus((current) => ({ ...current, ...data, running: false }));
        } catch (error) {
            appendMessage({
                id: createClientId(),
                role: "system",
                content: error instanceof Error ? error.message : "Failed to stop Codex",
            });
        }
    }, [appendMessage, status.running]);

    const submit = React.useCallback(async () => {
        const text = draft.trim();
        if (!text || sending || status.running || sessionLoading || !sessionReady) return;

        const assistantId = createClientId();
        assistantMessageIdRef.current = assistantId;
        setDraft("");
        setSending(true);
        setMessages((current) => [
            ...current,
            {
                id: createClientId(),
                role: "user",
                content: text,
            },
            {
                id: assistantId,
                role: "assistant",
                content: "",
            },
        ]);

        try {
            const response = await fetch("/__smooth-docs/codex/message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contextBlocks: contextBlocks.map((block) => ({
                        label: block.label,
                        markdown: block.markdown,
                        sourcePath: block.sourcePath,
                    })),
                    text,
                    page: {
                        title: currentPage.title,
                        url: currentPage.url,
                        sourcePath: currentPage.sourcePath,
                        site,
                    },
                    selection: getSelectedText(),
                }),
            });
            const data = (await response.json().catch(() => ({}))) as {
                error?: string;
                lastError?: string;
            };

            if (!response.ok) {
                throw new Error(data.error ?? data.lastError ?? "Failed to send Codex message");
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to send Codex message";
            assistantMessageIdRef.current = null;
            setMessages((current) =>
                current.map((entry) =>
                    entry.id === assistantId
                        ? {
                              ...entry,
                              role: "system",
                              content: message,
                          }
                        : entry,
                ),
            );
            setStatus((current) => ({
                ...current,
                running: false,
                lastError: message,
            }));
        } finally {
            setSending(false);
        }
    }, [
        contextBlocks,
        currentPage.sourcePath,
        currentPage.title,
        currentPage.url,
        draft,
        sending,
        sessionLoading,
        sessionReady,
        site,
        status.running,
    ]);

    const reset = React.useCallback(async () => {
        if (status.running || sessionLoading) return;

        restoreStartedRef.current = true;
        setSessionReady(false);
        setSessionLoading(true);
        setMessages([]);
        assistantMessageIdRef.current = null;

        try {
            const response = await fetch("/__smooth-docs/codex/reset", { method: "POST" });
            const data = (await response.json().catch(() => ({}))) as Partial<CodexChatStatus> & {
                error?: string;
            };
            if (!response.ok) {
                throw new Error(data.error ?? "Failed to reset Codex chat");
            }
            setStatus((current) => ({ ...current, ...data }));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to reset Codex chat";
            appendMessage({
                id: createClientId(),
                role: "system",
                content: message,
            });
        } finally {
            setSessionLoading(false);
            setSessionReady(true);
        }
    }, [appendMessage, sessionLoading, status.running]);

    const onDraftKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            void submit();
        },
        [submit],
    );

    const selectedModel =
        status.selectedModel || models.find((model) => model.isDefault)?.model || models[0]?.model || "";
    const currentModel = models.find((model) => model.model === selectedModel);
    const effortOptions =
        currentModel?.effortOptions.length
            ? currentModel.effortOptions
            : DEFAULT_CODEX_EFFORT_OPTIONS;
    const selectedEffort =
        status.selectedEffort ||
        currentModel?.defaultEffort ||
        effortOptions[0]?.value ||
        "";
    const canSend = draft.trim().length > 0 && !sending && !status.running && !sessionLoading && sessionReady;

    const dockOpen = open && !expanded;
    const renderChatContent = (fullScreen: boolean) => (
        <>
            {!fullScreen && (
                <SidebarWidthResizer
                    ariaLabel='Resize Codex chat panel'
                    className='docs-chat-resizer'
                    side='right'
                    width={displayedPanelWidth}
                    onWidthChange={updatePanelWidth}
                />
            )}
            <header className={cn(
                "flex h-16 shrink-0 items-center justify-between gap-3",
                fullScreen ? "px-4 pr-14 sm:px-8 sm:pr-16" : "px-3 pr-12",
            )}>
                <div className='flex min-w-0 items-center gap-2'>
                    {fullScreen ? (
                        <DialogTitle className='hidden text-base font-medium sm:block'>Codex</DialogTitle>
                    ) : <h2 className='sr-only'>Codex chat</h2>}
                    <select
                        className='h-9 min-w-0 max-w-[50vw] rounded-lg bg-transparent px-2 text-base font-medium outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring sm:max-w-64'
                        value={selectedModel}
                        disabled={modelsLoading || status.running}
                        onChange={(event) => {
                            const model = event.target.value || null;
                            const nextModel = models.find((item) => item.model === model);
                            void updateCodexSettings({
                                model,
                                effort: nextModel?.defaultEffort ?? selectedEffort,
                            });
                        }}
                        aria-label='Codex model'>
                        {selectedModel && !currentModel && <option value={selectedModel}>{selectedModel}</option>}
                        {models.length === 0 ? (
                            <option value=''>
                                {modelsLoading ? "Loading models..." : "Default model"}
                            </option>
                        ) : (
                            models.map((model) => (
                                <option key={model.id} value={model.model}>{model.displayName}</option>
                            ))
                        )}
                    </select>
                    <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8 shrink-0 text-muted-foreground'
                        disabled={modelsLoading || status.running}
                        onClick={() => void loadModels()}
                        aria-label='Refresh Codex models'
                        title='Refresh models'>
                        <RotateCcw className={cn("h-3.5 w-3.5", modelsLoading && "animate-spin")} />
                    </Button>
                </div>
                <div className='flex shrink-0 items-center gap-1'>
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='icon'
                                    className='h-9 w-9 rounded-full text-muted-foreground'
                                    onClick={toggleSessions}
                                    aria-label='Show Codex sessions'
                                    aria-expanded={sessionsOpen}>
                                    <PanelRight className='h-4 w-4' />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Sessions</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='icon'
                                    className='h-9 w-9 rounded-full text-muted-foreground'
                                disabled={sending || status.running || sessionLoading}
                                    onClick={() => void reset()}
                                    aria-label='New Codex thread'>
                                    <PencilLine className='h-4 w-4' />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>New thread</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='icon'
                                    className='h-9 w-9 rounded-full text-muted-foreground'
                                    onClick={() => setExpanded((current) => !current)}
                                    aria-label={fullScreen ? "Exit full screen" : "Expand Codex chat"}
                                    aria-pressed={fullScreen}>
                                    {fullScreen ? <Minimize2 className='h-4 w-4' /> : <Maximize2 className='h-4 w-4' />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{fullScreen ? "Side panel" : "Full screen"}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </header>

            {sessionsOpen && (
                <div className='absolute right-4 top-16 z-10 max-h-[50vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border bg-background p-3 shadow-lg'>
                    <div className='mb-2 flex items-center justify-between gap-2'>
                        <span className='text-sm font-medium'>Sessions</span>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='h-7 px-2 text-xs'
                            disabled={sessionsLoading}
                            onClick={() => void loadSessions()}>
                            Refresh
                        </Button>
                    </div>
                    {sessionsLoading ? (
                        <div className='py-3 text-center text-sm text-muted-foreground'>Loading...</div>
                    ) : sessions.length === 0 ? (
                        <div className='py-3 text-center text-sm text-muted-foreground'>No sessions</div>
                    ) : (
                        <div className='space-y-1'>
                            {sessions.map((session) => (
                                <button
                                    key={session.id}
                                    type='button'
                                    className={cn(
                                        "flex w-full min-w-0 flex-col rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                                        session.id === status.threadId && "bg-muted",
                                    )}
                                    disabled={status.running || sessionLoading}
                                    onClick={() => void resumeSession(session.id)}>
                                    <span className='truncate font-medium'>{session.name}</span>
                                    <span className='truncate text-xs text-muted-foreground'>
                                        {formatCodexSessionTimestamp(session.updatedAt)} · {session.status}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className='min-h-0 flex-1 overflow-y-auto'>
                <div className={cn(
                    "flex min-h-full w-full flex-col gap-8",
                    fullScreen ? "px-5 py-10 sm:gap-10 sm:px-10 sm:py-16 lg:px-[8vw]" : "px-5 py-6",
                )}>
                    {messages.length === 0 ? (
                        <div className='flex flex-1 items-center justify-center text-xl font-medium text-muted-foreground'>
                        {sessionLoading || !sessionReady ? "Loading conversation..." : "What can I help with?"}
                        </div>
                    ) : (
                        <CodexChatMessages
                            messages={messages}
                            working={sending || status.running}
                            renderContent={(content) => <ChatMarkdownMessage content={content} />}
                        />
                    )}
                    <div ref={endRef} />
                </div>
            </div>

            <div className={cn(
                "shrink-0 bg-background pt-4",
                fullScreen ? "px-5 pb-6 sm:px-10 sm:pb-10 lg:px-[8vw]" : "px-4 pb-4",
            )}>
                {status.lastError && (
                    <div className='mb-3 text-sm text-destructive'>{status.lastError}</div>
                )}
                {contextBlocks.length > 0 && (
                    <div className='mb-3 flex flex-wrap items-center gap-1.5'>
                        {contextBlocks.map((block) => (
                            <span
                                key={block.id}
                                className='inline-flex max-w-full items-center gap-1 rounded-xl bg-muted px-3 py-1.5 text-xs text-muted-foreground'>
                                <FileText className='h-3 w-3 shrink-0' />
                                <span className='max-w-40 truncate'>{block.label}</span>
                                <button
                                    type='button'
                                    className='rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                                    onClick={() => onContextBlockRemove(block.id)}
                                    aria-label={`Remove Codex context: ${block.label}`}>
                                    <X className='h-3 w-3' />
                                </button>
                            </span>
                        ))}
                        <Button type='button' variant='ghost' size='sm' className='h-7 px-2 text-xs' onClick={onContextBlocksClear}>
                            Clear
                        </Button>
                    </div>
                )}
                <div className='flex w-full items-end gap-2 rounded-[2rem] bg-muted/70 p-2 pl-5 ring-1 ring-border/40 focus-within:ring-border'>
                    <textarea
                        ref={draftRef}
                        rows={1}
                        className='max-h-48 min-h-12 min-w-0 flex-1 resize-none bg-transparent py-3 text-base leading-6 outline-none placeholder:text-muted-foreground'
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={onDraftKeyDown}
                        placeholder='Ask Codex...'
                        aria-label='Ask Codex'
                        spellCheck={true}
                    />
                    <select
                        className='h-12 max-w-24 shrink-0 rounded-full bg-transparent px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'
                        value={selectedEffort}
                        disabled={sending || status.running}
                        onChange={(event) => void updateCodexSettings({ effort: event.target.value || null })}
                        aria-label='Codex reasoning effort'
                        title='Reasoning effort'>
                        {effortOptions.map((option) => (
                            <option key={option.value} value={option.value}>{formatCodexEffortLabel(option.value)}</option>
                        ))}
                    </select>
                    {status.running ? (
                        <Button
                            type='button'
                            size='icon'
                            className='h-12 w-12 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90'
                            onClick={() => void stopTurn()}
                            aria-label='Stop Codex turn'>
                            <Square className='h-4 w-4 fill-current' />
                        </Button>
                    ) : (
                        <Button
                            type='button'
                            size='icon'
                            className='h-12 w-12 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90'
                            disabled={!canSend}
                            onClick={() => void submit()}
                            aria-label='Send Codex message'>
                            {sending ? <Loader2 className='h-5 w-5 animate-spin' /> : <ArrowUp className='h-5 w-5' />}
                        </Button>
                    )}
                </div>
            </div>
            <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute right-3 top-4 h-8 w-8 rounded-full text-muted-foreground'
                onClick={() => onOpenChange(false)}
                aria-label='Close Codex chat'>
                <X className='h-4 w-4' />
            </Button>
        </>
    );

    return (
        <>
            <aside
                aria-label='Codex chat'
                aria-hidden={!dockOpen}
                inert={!dockOpen}
                data-state={dockOpen ? "open" : "closed"}
                className='docs-chat-dock'
                style={{ width: dockOpen ? displayedPanelWidth : 0 }}
                onKeyDown={(event) => {
                    if (event.key === "Escape" && !event.defaultPrevented) {
                        event.preventDefault();
                        onOpenChange(false);
                    }
                }}>
                {!expanded && (
                    <div
                        className='docs-chat-dock-content relative flex h-full min-w-0 flex-col overflow-hidden border-l bg-background'
                        style={{ width: displayedPanelWidth }}>
                        {renderChatContent(false)}
                    </div>
                )}
            </aside>
            {expanded && (
                <Dialog open={open} onOpenChange={onOpenChange}>
                    <DialogContent
                        showCloseButton={false}
                        aria-describedby={undefined}
                        data-chat-mode='full'
                        className='docs-chat-dialog inset-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none sm:rounded-none'
                        onOpenAutoFocus={(event) => {
                            event.preventDefault();
                            draftRef.current?.focus();
                        }}
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            launcherRef.current?.focus();
                        }}>
                        {renderChatContent(true)}
                    </DialogContent>
                </Dialog>
            )}
            {!open && (
                <div className='fixed bottom-4 right-4 z-50'>
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    ref={launcherRef}
                                    type='button'
                                    size='icon'
                                    className='h-11 w-11 rounded-full shadow-lg'
                                    onClick={() => onOpenChange(true)}
                                    aria-keyshortcuts='Meta+Shift+L'
                                    aria-label='Open Codex chat'>
                                    {status.running ? <Loader2 className='h-5 w-5 animate-spin' /> : <MessageSquareText className='h-5 w-5' />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side='left'>Codex · ⌘⇧L</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}
        </>
    );
}

function ChatMarkdownMessage({ content }: { content: string }) {
    const [html, setHtml] = React.useState(() => renderChatMarkdownSync(content));

    React.useEffect(() => {
        let active = true;
        setHtml(renderChatMarkdownSync(content));

        void loadChatMarkdownRenderer()
            .then((renderer) => {
                if (active) setHtml(renderer.render(content));
            })
            .catch(() => {
                if (active) setHtml(renderPlainChatText(content));
            });

        return () => {
            active = false;
        };
    }, [content]);

    return <div className='docs-chat-markdown' dangerouslySetInnerHTML={{ __html: html }} />;
}

function CreateMarkdownDialog({
    currentPage,
    initialFolderPath,
    onCreated,
    onOpenChange,
    open,
    site,
}: {
    currentPage: DocPage;
    initialFolderPath: string | null;
    onCreated: (site: SiteKey, url: string, payload: DocsContentUpdatePayload) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    site: SiteKey;
}) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const defaultFilePath = React.useMemo(() => {
        if (initialFolderPath !== null) {
            return initialFolderPath ? `${initialFolderPath}/new.md` : "new.md";
        }

        const relativePath = getSiteSourceRelativePath(currentPage.sourcePath, site);
        const folderPath = relativePath ? getPathDirName(relativePath) : "";

        return folderPath ? `${folderPath}/new.md` : "new.md";
    }, [currentPage.sourcePath, initialFolderPath, site]);
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
    canSwitchDocsTheme,
    canUseLocalDocsActions,
    docsTheme,
    docsThemeApplying,
    docsThemeError,
    docsThemeLoading,
    docsThemeOptions,
    leftSidebarWidth,
    onLayoutWidthsReset,
    onDocsThemeChange,
    onDocsThemesRefresh,
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
    canSwitchDocsTheme: boolean;
    canUseLocalDocsActions: boolean;
    docsTheme: string;
    docsThemeApplying: boolean;
    docsThemeError: string;
    docsThemeLoading: boolean;
    docsThemeOptions: DocsThemeOption[];
    leftSidebarWidth: number;
    onLayoutWidthsReset: () => void;
    onDocsThemeChange: (theme: string) => void;
    onDocsThemesRefresh: () => void;
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
    const docsThemeDescription = docsThemeError
        ? docsThemeError
        : docsThemeApplying
          ? "Applying the selected docs theme."
            : docsThemeLoading
              ? "Loading installed docs themes."
              : import.meta.env.DEV && canUseLocalDocsActions
                ? "Choose the Smooth Docs theme written to the project config."
                : "Choose a Smooth Docs theme bundled into this static site.";
    const selectedDocsTheme = docsTheme || docsThemeOptions[0]?.name || "";

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
        ...(import.meta.env.DEV && canUseLocalDocsActions
            ? [{ id: "editor" as const, label: "Editor", icon: Type }]
            : []),
        { id: "diagrams", label: "Diagrams", icon: Maximize2 },
    ];

    React.useEffect(() => {
        if ((!import.meta.env.DEV || !canUseLocalDocsActions) && activeSection === "editor") {
            setActiveSection("general");
        }
    }, [activeSection, canUseLocalDocsActions]);

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
                            {import.meta.env.DEV && canUseLocalDocsActions
                                ? "Tune the docs UI for reading, navigation, editing, and code review."
                                : "Tune the docs UI for reading, navigation, and code review."}
                        </p>
                    </div>

                    {activeSection === "general" && (
                        <SettingsSection title='General'>
                            {canSwitchDocsTheme && (
                                <SettingRow title='Docs theme' description={docsThemeDescription}>
                                    {docsThemeOptions.length > 0 ? (
                                        <Select
                                            value={selectedDocsTheme}
                                            onValueChange={onDocsThemeChange}
                                            disabled={docsThemeLoading || docsThemeApplying}>
                                            <SelectTrigger className='w-44'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {docsThemeOptions.map((option) => (
                                                    <SelectItem
                                                        key={option.name}
                                                        disabled={
                                                            option.requiresRestart &&
                                                            !import.meta.env.DEV
                                                        }
                                                        value={option.name}>
                                                        {option.title}
                                                        {option.requiresRestart
                                                            ? import.meta.env.DEV
                                                                ? " (restart)"
                                                                : " (unavailable)"
                                                            : ""}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Button
                                            type='button'
                                            variant='outline'
                                            className='h-9'
                                            disabled={docsThemeLoading}
                                            onClick={onDocsThemesRefresh}>
                                            Load themes
                                        </Button>
                                    )}
                                </SettingRow>
                            )}
                            <SettingRow
                                title='Color mode'
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
                                title='Article font size'
                                description={`Article text is scaled to ${settings.articleFontScale}%.`}>
                                <ArticleFontScaleSlider
                                    className='w-56'
                                    value={settings.articleFontScale}
                                    onChange={(value) => setSetting("articleFontScale", value)}
                                />
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

                    {import.meta.env.DEV && canUseLocalDocsActions && activeSection === "editor" && (
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
    canEditTitle,
    onTitleChange,
    onTitleSave,
    page,
    title,
}: {
    canEditTitle: boolean;
    onTitleChange: (title: string) => void;
    onTitleSave: () => void;
    page: DocPage;
    title: string;
}) {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = "0px";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [title]);

    return (
        <div className='docs-page-header space-y-4'>
            {canEditTitle ? (
                <textarea
                    ref={textareaRef}
                    aria-label='Page title'
                    className='docs-page-title docs-page-title-input break-words text-2xl font-semibold tracking-normal md:text-3xl'
                    rows={1}
                    spellCheck={false}
                    value={title}
                    onBlur={onTitleSave}
                    onChange={(event) => onTitleChange(event.target.value)}
                />
            ) : (
                <h1 className='docs-page-title break-words text-2xl font-semibold tracking-normal md:text-3xl'>
                    {page.title}
                </h1>
            )}
            <Separator />
        </div>
    );
}

function HeaderBreadcrumbs({
    breadcrumbs,
    onNavigate,
    showBreadcrumbs,
}: {
    breadcrumbs: PageBreadcrumbItem[];
    onNavigate: (url: string) => void;
    showBreadcrumbs: boolean;
}) {
    if (!showBreadcrumbs) return <div className='min-w-0 flex-1' />;

    return (
        <Breadcrumb className='min-w-0 flex-1'>
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
                                        <button type='button' onClick={() => onNavigate(item.url!)}>
                                            {item.title}
                                        </button>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && <BreadcrumbSeparator className='shrink-0' />}
                        </React.Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

function PageHeaderActions({
    canCopyPath,
    canEditMarkdown,
    editMode,
    onEditModeToggle,
    page,
}: {
    canCopyPath: boolean;
    canEditMarkdown: boolean;
    editMode: boolean;
    onEditModeToggle: () => void;
    page: DocPage;
}) {
    return (
        <TooltipProvider delayDuration={300}>
            <div className='flex shrink-0 items-center gap-1.5'>
                {import.meta.env.DEV && canEditMarkdown && (
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
                        <TooltipContent side='bottom'>{editMode ? "View" : "Edit"}</TooltipContent>
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
                                void copyWithToast(page.markdown, "Copied page Markdown.");
                            }}>
                            <FileText className='h-3.5 w-3.5 text-muted-foreground' />
                            Markdown
                        </DropdownMenuItem>
                        {import.meta.env.DEV && canCopyPath && (
                            <DropdownMenuItem
                                onSelect={() => {
                                    void copyWithToast(page.absolutePath, "Copied page path.");
                                }}>
                                <Folder className='h-3.5 w-3.5 text-muted-foreground' />
                                Path
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </TooltipProvider>
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
    const lineCount = React.useMemo(() => value.split(/\r?\n/).length, [value]);

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
                <textarea
                    className='docs-markdown-editor-input'
                    value={value}
                    autoCapitalize='off'
                    autoComplete='off'
                    autoCorrect='off'
                    wrap={wrapText ? "soft" : "off"}
                    onChange={(event) => onChange(event.target.value)}
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

function InboxPage({
    canManageDocs,
    getDragSourcePaths,
    onEntryContextMenu,
    onMarkRead,
    onMarkUnread,
    onNavigate,
    page,
    readPageUrls,
}: {
    canManageDocs: boolean;
    getDragSourcePaths: (sourcePath: string) => string[];
    onEntryContextMenu: (event: React.MouseEvent, target: DocsEntryTarget) => void;
    onMarkRead: (pagePaths: ReadonlyArray<string>) => void;
    onMarkUnread: (pagePaths: ReadonlyArray<string>) => void;
    onNavigate: (url: string) => void;
    page: DocPage;
    readPageUrls: ReadonlySet<string>;
}) {
    const items = page.inbox?.items ?? [];
    const [unreadOnly, setUnreadOnly] = React.useState(false);
    const [selectedItemUrls, setSelectedItemUrls] = React.useState<ReadonlySet<string>>(
        () => new Set<string>(),
    );
    const sortedItems = React.useMemo(
        () =>
            [...items].sort((first, second) => {
                const firstUnread = !readPageUrls.has(first.url);
                const secondUnread = !readPageUrls.has(second.url);

                if (firstUnread !== secondUnread) {
                    return firstUnread ? -1 : 1;
                }

                const firstCreatedAt =
                    parseInboxTimestamp(first.createdAt) ??
                    parseInboxTimestamp(first.updatedAt) ??
                    0;
                const secondCreatedAt =
                    parseInboxTimestamp(second.createdAt) ??
                    parseInboxTimestamp(second.updatedAt) ??
                    0;

                return secondCreatedAt - firstCreatedAt;
            }),
        [items, readPageUrls],
    );
    const unreadCount = sortedItems.filter((item) => !readPageUrls.has(item.url)).length;
    const displayItems = React.useMemo(
        () =>
            unreadOnly
                ? sortedItems.filter((item) => !readPageUrls.has(item.url))
                : sortedItems,
        [readPageUrls, sortedItems, unreadOnly],
    );
    const selectedItems = React.useMemo(
        () => sortedItems.filter((item) => selectedItemUrls.has(item.url)),
        [selectedItemUrls, sortedItems],
    );
    const selectedUnreadUrls = React.useMemo(
        () => selectedItems.filter((item) => !readPageUrls.has(item.url)).map((item) => item.url),
        [readPageUrls, selectedItems],
    );
    const selectedReadUrls = React.useMemo(
        () => selectedItems.filter((item) => readPageUrls.has(item.url)).map((item) => item.url),
        [readPageUrls, selectedItems],
    );
    const unreadUrls = React.useMemo(
        () => sortedItems.filter((item) => !readPageUrls.has(item.url)).map((item) => item.url),
        [readPageUrls, sortedItems],
    );
    const selectedDisplayCount = displayItems.reduce(
        (count, item) => count + (selectedItemUrls.has(item.url) ? 1 : 0),
        0,
    );
    const allDisplaySelected =
        displayItems.length > 0 && selectedDisplayCount === displayItems.length;
    const relativeNow = useInboxRelativeTimeNow(displayItems);

    React.useEffect(() => {
        const availableUrls = new Set(items.map((item) => item.url));

        setSelectedItemUrls((current) => {
            const next = new Set([...current].filter((url) => availableUrls.has(url)));
            return next.size === current.size ? current : next;
        });
    }, [items]);

    const toggleItemSelection = React.useCallback((url: string, checked: boolean) => {
        setSelectedItemUrls((current) => {
            const next = new Set(current);
            if (checked) {
                next.add(url);
            } else {
                next.delete(url);
            }
            return next;
        });
    }, []);

    const toggleVisibleSelection = React.useCallback(
        (checked: boolean) => {
            const visibleUrls = displayItems.map((item) => item.url);

            setSelectedItemUrls((current) => {
                const next = new Set(current);
                for (const url of visibleUrls) {
                    if (checked) {
                        next.add(url);
                    } else {
                        next.delete(url);
                    }
                }
                return next;
            });
        },
        [displayItems],
    );

    const markSelectedRead = React.useCallback(() => {
        if (selectedUnreadUrls.length === 0) return;

        onMarkRead(selectedUnreadUrls);
        setSelectedItemUrls(new Set<string>());
        toast.success(`Marked ${formatInboxDocumentCount(selectedUnreadUrls.length)} as read.`);
    }, [onMarkRead, selectedUnreadUrls]);

    const markSelectedUnread = React.useCallback(() => {
        if (selectedReadUrls.length === 0) return;

        onMarkUnread(selectedReadUrls);
        setSelectedItemUrls(new Set<string>());
        toast.success(`Marked ${formatInboxDocumentCount(selectedReadUrls.length)} as unread.`);
    }, [onMarkUnread, selectedReadUrls]);

    const markAllRead = React.useCallback(() => {
        if (unreadUrls.length === 0) return;

        onMarkRead(unreadUrls);
        setSelectedItemUrls(new Set<string>());
        toast.success(`Marked ${formatInboxDocumentCount(unreadUrls.length)} as read.`);
    }, [onMarkRead, unreadUrls]);

    return (
        <section className='mt-6 space-y-4'>
            <div className='flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between'>
                <div className='flex min-w-[12rem] items-center gap-3'>
                    <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground'>
                        <Inbox className='h-5 w-5' />
                    </span>
                    <div className='min-w-0'>
                        <p className='text-sm font-medium'>{items.length} documents</p>
                        <p className='truncate text-sm text-muted-foreground'>
                            Unread inbox files appear first.
                        </p>
                    </div>
                </div>
                <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2 xl:justify-end'>
                    <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className='h-7 gap-1.5 px-2 text-xs'
                        aria-label='Mark selected inbox documents as read'
                        title='Mark selected inbox documents as read'
                        disabled={selectedUnreadUrls.length === 0}
                        onClick={markSelectedRead}>
                        <CheckCircle2 className='h-3.5 w-3.5' />
                        Read
                    </Button>
                    <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className='h-7 gap-1.5 px-2 text-xs'
                        aria-label='Mark selected inbox documents as unread'
                        title='Mark selected inbox documents as unread'
                        disabled={selectedReadUrls.length === 0}
                        onClick={markSelectedUnread}>
                        <Circle className='h-3.5 w-3.5' />
                        Unread
                    </Button>
                    <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className='h-7 gap-1.5 px-2 text-xs'
                        aria-label='Mark all inbox documents as read'
                        title='Mark all inbox documents as read'
                        disabled={unreadCount === 0}
                        onClick={markAllRead}>
                        <CheckCircle2 className='h-3.5 w-3.5' />
                        All read
                    </Button>
                    <Toggle
                        pressed={unreadOnly}
                        disabled={unreadCount === 0}
                        className='h-7 gap-1.5 px-2 text-xs'
                        title='Show unread inbox documents only'
                        aria-label='Show unread inbox documents only'
                        onPressedChange={setUnreadOnly}>
                        <Circle className='h-3.5 w-3.5 fill-primary text-primary' />
                        Unread
                    </Toggle>
                    {selectedItems.length > 0 && (
                        <Badge variant='secondary' className='w-fit'>
                            {selectedItems.length} selected
                        </Badge>
                    )}
                    <Badge variant={unreadCount > 0 ? "default" : "secondary"} className='w-fit'>
                        {unreadCount} unread
                    </Badge>
                </div>
            </div>

            <div className='overflow-hidden rounded-md border bg-card'>
                <Table className='table-fixed'>
                    <TableHeader>
                        <TableRow>
                            <TableHead className='w-10 pr-0'>
                                <input
                                    type='checkbox'
                                    className='docs-inbox-select-checkbox'
                                    aria-label='Select visible inbox documents'
                                    checked={allDisplaySelected}
                                    disabled={displayItems.length === 0}
                                    ref={(element) => {
                                        if (!element) return;
                                        element.indeterminate =
                                            selectedDisplayCount > 0 && !allDisplaySelected;
                                    }}
                                    onChange={(event) =>
                                        toggleVisibleSelection(event.target.checked)
                                    }
                                />
                            </TableHead>
                            <TableHead className='w-[92px]'>Status</TableHead>
                            <TableHead className='min-w-0'>Document</TableHead>
                            <TableHead className='hidden w-28 md:table-cell'>Added</TableHead>
                            <TableHead className='hidden w-28 lg:table-cell'>Updated</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayItems.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={5}
                                    className='h-24 text-center text-sm text-muted-foreground'>
                                    {unreadOnly ? "No unread inbox documents" : "Empty inbox"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayItems.map((item) => {
                                const isRead = readPageUrls.has(item.url);
                                const addedAt = formatInboxDate(item.createdAt, relativeNow);
                                const updatedAt = formatInboxDate(item.updatedAt, relativeNow);
                                const addedAtTitle = formatInboxAbsoluteDate(item.createdAt);
                                const updatedAtTitle = formatInboxAbsoluteDate(item.updatedAt);
                                const isSelected = selectedItemUrls.has(item.url);

                                return (
                                    <TableRow
                                        key={item.url}
                                        draggable={canManageDocs}
                                        role='link'
                                        tabIndex={0}
                                        className={cn(
                                            "cursor-pointer",
                                            isSelected && "bg-muted/40 hover:bg-muted/50",
                                        )}
                                        onClick={() => onNavigate(item.url)}
                                        onContextMenu={
                                            canManageDocs
                                                ? (event) =>
                                                      onEntryContextMenu(event, {
                                                          title: item.title,
                                                          kind: "page",
                                                          url: item.url,
                                                          sourcePath: item.sourcePath,
                                                      })
                                                : undefined
                                        }
                                        onDragStart={(event) => {
                                            if (!canManageDocs) return;

                                            const sourcePaths = getDragSourcePaths(item.sourcePath);
                                            writeDraggedSourcePaths(event, sourcePaths, {
                                                sourceLabel: "Inbox",
                                                title: item.title,
                                            });
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key !== "Enter" && event.key !== " ") return;

                                            event.preventDefault();
                                            onNavigate(item.url);
                                        }}>
                                        <TableCell className='pr-0'>
                                            <input
                                                type='checkbox'
                                                className='docs-inbox-select-checkbox'
                                                aria-label={`Select ${item.title}`}
                                                checked={isSelected}
                                                onClick={(event) => event.stopPropagation()}
                                                onContextMenu={(event) => event.stopPropagation()}
                                                onKeyDown={(event) => event.stopPropagation()}
                                                onChange={(event) =>
                                                    toggleItemSelection(
                                                        item.url,
                                                        event.target.checked,
                                                    )
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 text-xs font-medium",
                                                    isRead
                                                        ? "text-muted-foreground"
                                                        : "text-foreground",
                                                )}>
                                                {isRead ? (
                                                    <CheckCircle2 className='h-4 w-4' />
                                                ) : (
                                                    <Circle className='h-4 w-4 fill-primary text-primary' />
                                                )}
                                                {isRead ? "Read" : "Unread"}
                                            </span>
                                        </TableCell>
                                        <TableCell className='min-w-0 overflow-hidden'>
                                            <div className='group flex min-w-0 max-w-full flex-col text-left'>
                                                <span
                                                    className='truncate font-medium text-foreground group-hover:underline'
                                                    title={item.title}>
                                                    {item.title}
                                                </span>
                                                <span
                                                    className='mt-1 truncate text-xs leading-5 text-muted-foreground'
                                                    title={item.text || item.sourcePath}>
                                                    {item.text || item.sourcePath}
                                                </span>
                                                <span
                                                    className='mt-2 text-xs text-muted-foreground md:hidden'
                                                    title={addedAtTitle}>
                                                    Added {addedAt}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell
                                            className='hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell'
                                            title={addedAtTitle}>
                                            {addedAt}
                                        </TableCell>
                                        <TableCell
                                            className='hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell'
                                            title={updatedAtTitle}>
                                            {updatedAt}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}

function countUnreadInboxItems(
    pages: ReadonlyArray<DocPage>,
    readPageUrls: ReadonlySet<string>,
) {
    const inboxPage = pages.find((page) => page.kind === "inbox" && page.inbox);

    return (
        inboxPage?.inbox?.items.reduce(
            (count, item) => count + (readPageUrls.has(item.url) ? 0 : 1),
            0,
        ) ?? 0
    );
}

function formatInboxDocumentCount(count: number) {
    return `${count} inbox ${count === 1 ? "document" : "documents"}`;
}

function FolderPage({
    canManageDocs,
    getDragSourcePaths,
    onCreateFile,
    onCreateFolder,
    onEntryContextMenu,
    onMoveMarkdown,
    onNavigate,
    page,
}: {
    canManageDocs: boolean;
    getDragSourcePaths: (sourcePath: string) => string[];
    onCreateFile: (folderPath: string) => void;
    onCreateFolder: (target: DocsEntryTarget) => void;
    onEntryContextMenu: (event: React.MouseEvent, target: DocsEntryTarget) => void;
    onMoveMarkdown: (sourcePaths: string[], destinationFolder: string) => void;
    onNavigate: (url: string) => void;
    page: DocPage;
}) {
    const items = page.folder?.items ?? [];
    const folderPath = page.folder?.root ?? "";
    const folderTarget: DocsEntryTarget = React.useMemo(
        () => ({
            title: page.title,
            kind: "folder",
            url: page.url,
            folderPath,
        }),
        [folderPath, page.title, page.url],
    );
    const folderCount = items.filter((item) => item.kind === "folder").length;
    const fileCount = items.length - folderCount;
    const relativeNow = useFolderRelativeTimeNow(items);
    const [dropTarget, setDropTarget] = React.useState<string | null>(null);
    const isRootFolder = folderPath === "";
    const isCurrentFolderDropTarget = dropTarget === folderPath;
    const handleCurrentFolderDragOver = React.useCallback(
        (event: React.DragEvent) => {
            if (
                !canManageDocs ||
                !isRootFolder ||
                !event.dataTransfer.types.includes(DOCS_DRAG_MIME)
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "move";
            setDropTarget(folderPath);
        },
        [canManageDocs, folderPath, isRootFolder],
    );
    const handleCurrentFolderDragLeave = React.useCallback((event: React.DragEvent) => {
        const relatedTarget = event.relatedTarget;
        if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;

        setDropTarget(null);
    }, []);
    const handleCurrentFolderDrop = React.useCallback(
        (event: React.DragEvent) => {
            if (!canManageDocs || !isRootFolder) return;

            const sourcePaths = readDraggedSourcePaths(event);
            if (sourcePaths.length === 0) return;

            event.preventDefault();
            event.stopPropagation();
            setDropTarget(null);
            onMoveMarkdown(sourcePaths, folderPath);
        },
        [canManageDocs, folderPath, isRootFolder, onMoveMarkdown],
    );

    return (
        <section className='mt-6 space-y-4'>
            <div className='flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div className='flex min-w-0 items-center gap-3'>
                    <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground'>
                        <Folder className='h-5 w-5' />
                    </span>
                    <div className='min-w-0'>
                        <p className='text-sm font-medium'>
                            {folderCount} folders, {fileCount} files
                        </p>
                        <p className='truncate text-sm text-muted-foreground'>
                            Direct items in {folderPath || "docs"}.
                        </p>
                    </div>
                </div>
                <div className='flex shrink-0 items-center gap-1.5'>
                    {import.meta.env.DEV && canManageDocs && (
                        <TooltipProvider delayDuration={300}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='icon'
                                        className='h-8 w-8'
                                        aria-label='Add file to folder'
                                        onClick={() => onCreateFile(folderPath)}>
                                        <Plus className='h-4 w-4' />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Add file</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='icon'
                                        className='h-8 w-8'
                                        aria-label='Add folder to folder'
                                        onClick={() => onCreateFolder(folderTarget)}>
                                        <FolderPlus className='h-4 w-4' />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Add folder</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    <Badge variant='secondary' className='ml-1 w-fit'>
                        {items.length} items
                    </Badge>
                </div>
            </div>

            <div
                className={cn(
                    "overflow-hidden rounded-md border bg-card transition-[background,box-shadow]",
                    isCurrentFolderDropTarget && "bg-muted/40 ring-2 ring-ring",
                )}
                onDragLeave={handleCurrentFolderDragLeave}
                onDragOver={handleCurrentFolderDragOver}
                onDrop={handleCurrentFolderDrop}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className='w-[92px]'>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className='hidden w-28 md:table-cell'>Updated</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={3}
                                    className='h-24 text-center text-sm text-muted-foreground'>
                                    Empty folder
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => {
                                const isFolder = item.kind === "folder";
                                const updatedAt = formatInboxDate(item.updatedAt, relativeNow);
                                const updatedAtTitle = formatInboxAbsoluteDate(item.updatedAt);
                                const isDropTarget =
                                    isFolder && dropTarget === item.folderPath;

                                return (
                                    <TableRow
                                        key={`${item.kind}-${item.url}`}
                                        draggable={
                                            canManageDocs && !isFolder && Boolean(item.sourcePath)
                                        }
                                        role='link'
                                        tabIndex={0}
                                        className={cn(
                                            "cursor-pointer",
                                            isDropTarget && "bg-muted/80",
                                        )}
                                        onClick={() => onNavigate(item.url)}
                                        onContextMenu={
                                            canManageDocs
                                                ? (event) =>
                                                      onEntryContextMenu(
                                                          event,
                                                          isFolder
                                                              ? {
                                                                    title: item.title,
                                                                    kind: "folder",
                                                                    url: item.url,
                                                                    folderPath: item.folderPath,
                                                                }
                                                              : {
                                                                    title: item.title,
                                                                    kind: "page",
                                                                    url: item.url,
                                                                    sourcePath: item.sourcePath,
                                                                },
                                                      )
                                                : undefined
                                        }
                                        onDragStart={(event) => {
                                            if (!canManageDocs || !item.sourcePath) return;
                                            const sourcePaths = getDragSourcePaths(item.sourcePath);
                                            writeDraggedSourcePaths(event, sourcePaths, {
                                                sourceLabel: "Folder",
                                                title: item.title,
                                            });
                                        }}
                                        onDragOver={(event) => {
                                            if (!canManageDocs || !isFolder || !item.folderPath) {
                                                return;
                                            }
                                            if (!event.dataTransfer.types.includes(DOCS_DRAG_MIME)) {
                                                return;
                                            }

                                            event.preventDefault();
                                            event.stopPropagation();
                                            event.dataTransfer.dropEffect = "move";
                                            setDropTarget(item.folderPath);
                                        }}
                                        onDragLeave={(event) => {
                                            const relatedTarget = event.relatedTarget;
                                            if (
                                                relatedTarget instanceof Node &&
                                                event.currentTarget.contains(relatedTarget)
                                            ) {
                                                return;
                                            }
                                            setDropTarget(null);
                                        }}
                                        onDrop={(event) => {
                                            if (!canManageDocs || !isFolder || !item.folderPath) {
                                                return;
                                            }
                                            const sourcePaths = readDraggedSourcePaths(event);
                                            if (sourcePaths.length === 0) return;

                                            event.preventDefault();
                                            event.stopPropagation();
                                            setDropTarget(null);
                                            onMoveMarkdown(sourcePaths, item.folderPath);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key !== "Enter" && event.key !== " ") return;

                                            event.preventDefault();
                                            onNavigate(item.url);
                                        }}>
                                        <TableCell>
                                            <span className='inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground'>
                                                {isFolder ? (
                                                    <Folder className='h-4 w-4' />
                                                ) : (
                                                    <FileText className='h-4 w-4' />
                                                )}
                                                {isFolder ? "Folder" : "File"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className='group flex min-w-0 flex-col text-left'>
                                                <span className='line-clamp-1 font-medium text-foreground group-hover:underline'>
                                                    {item.title}
                                                </span>
                                                <span className='mt-1 line-clamp-1 max-w-2xl text-xs leading-5 text-muted-foreground'>
                                                    {item.text || item.sourcePath || item.folderPath}
                                                </span>
                                                {!isFolder && (
                                                    <span
                                                        className='mt-2 text-xs text-muted-foreground md:hidden'
                                                        title={updatedAtTitle}>
                                                        Updated {updatedAt}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell
                                            className='hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell'
                                            title={updatedAtTitle}>
                                            {isFolder ? "" : updatedAt}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}

function useFolderRelativeTimeNow(items: ReadonlyArray<FolderPageItem>) {
    const timestamps = React.useMemo(
        () =>
            items
                .filter((item) => item.kind === "page")
                .flatMap((item) => [
                    parseInboxTimestamp(item.createdAt),
                    parseInboxTimestamp(item.updatedAt),
                ])
                .filter((timestamp): timestamp is number => timestamp !== null),
        [items],
    );
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (timestamps.length === 0) return;

        const timer = window.setTimeout(
            () => setNow(Date.now()),
            getNextRelativeTimeUpdateDelay(timestamps, now),
        );

        return () => window.clearTimeout(timer);
    }, [now, timestamps]);

    return now;
}

function useInboxRelativeTimeNow(items: ReadonlyArray<InboxPageItem>) {
    const timestamps = React.useMemo(
        () =>
            items
                .flatMap((item) => [
                    parseInboxTimestamp(item.createdAt),
                    parseInboxTimestamp(item.updatedAt),
                ])
                .filter((timestamp): timestamp is number => timestamp !== null),
        [items],
    );
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (timestamps.length === 0) return;

        const timer = window.setTimeout(
            () => setNow(Date.now()),
            getNextRelativeTimeUpdateDelay(timestamps, now),
        );

        return () => window.clearTimeout(timer);
    }, [now, timestamps]);

    return now;
}

const Article = React.memo(function Article({
    fontScale,
    onPinMenuRequest,
    page,
}: {
    fontScale: number;
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

            if (mermaid instanceof HTMLElement && !mermaid.querySelector(`.${MERMAID_COPY_BUTTON_CLASS}`)) {
                mermaid.append(createMermaidCopyButton(index));
            }
        });

        const onClick = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            const mermaidCopyButton = target.closest(
                `.${MERMAID_COPY_BUTTON_CLASS}`,
            ) as HTMLButtonElement | null;
            if (mermaidCopyButton && root.contains(mermaidCopyButton)) {
                const mermaid = mermaidCopyButton.closest(".beautiful-mermaid, .mermaid");
                if (!mermaid) return;

                event.preventDefault();
                event.stopPropagation();

                void copyMermaidDiagramAsImage(mermaid).then((copied) => {
                    if (!copied) return;

                    mermaidCopyButton.dataset.copied = "true";

                    window.setTimeout(() => {
                        mermaidCopyButton.dataset.copied = "false";
                    }, 1200);
                });
                return;
            }

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
            if (target.closest(`.${MERMAID_COPY_BUTTON_CLASS}`)) return;

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
            <article
                ref={ref}
                className='docs-prose'
                style={
                    {
                        "--docs-article-font-scale": fontScale / 100,
                    } as React.CSSProperties
                }>
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

function ArticleActiveBar({
    canSwitchDocsTheme,
    docsTheme,
    docsThemeApplying,
    docsThemeError,
    docsThemeLoading,
    docsThemeOptions,
    fontScale,
    leftSidebarOpen,
    leftSidebarWidth,
    mainWidth,
    onDocsThemeChange,
    onDocsThemesRefresh,
    onFontScaleChange,
    onMainWidthChange,
    onSettingsOpen,
    onThemeToggle,
    onRightSidebarToggle,
    rightSidebarAvailable,
    rightSidebarOpen,
    theme,
}: {
    canSwitchDocsTheme: boolean;
    docsTheme: string;
    docsThemeApplying: boolean;
    docsThemeError: string;
    docsThemeLoading: boolean;
    docsThemeOptions: DocsThemeOption[];
    fontScale: number;
    leftSidebarOpen: boolean;
    leftSidebarWidth: number;
    mainWidth: MainWidthSetting;
    onDocsThemeChange: (theme: string) => void;
    onDocsThemesRefresh: () => void;
    onFontScaleChange: (value: number) => void;
    onMainWidthChange: (value: MainWidthSetting) => void;
    onSettingsOpen: () => void;
    onThemeToggle: () => void;
    onRightSidebarToggle: () => void;
    rightSidebarAvailable: boolean;
    rightSidebarOpen: boolean;
    theme: Theme;
}) {
    const [openMenu, setOpenMenu] = React.useState<"theme" | "width" | null>(null);

    React.useEffect(() => {
        if (!canSwitchDocsTheme) return;

        if (docsThemeOptions.length > 0 || docsThemeLoading || docsThemeApplying || docsThemeError) {
            return;
        }

        onDocsThemesRefresh();
    }, [
        canSwitchDocsTheme,
        docsThemeApplying,
        docsThemeError,
        docsThemeLoading,
        docsThemeOptions.length,
        onDocsThemesRefresh,
    ]);

    const selectedDocsTheme = docsTheme || docsThemeOptions[0]?.name || "";
    const activeBarStyle = {
        "--docs-active-bar-sidebar-offset": leftSidebarOpen ? `${leftSidebarWidth}px` : "0px",
    } as React.CSSProperties;
    const updateOpenMenu = React.useCallback((menu: "theme" | "width", open: boolean) => {
        setOpenMenu((current) => {
            if (open) return menu;
            return current === menu ? null : current;
        });
    }, []);

    return (
        <footer
            className='docs-article-active-footer'
            data-menu-open={openMenu ? "true" : undefined}
            style={activeBarStyle}
            aria-label='Article controls'>
            <div className='docs-article-active-bar'>
                {canSwitchDocsTheme ? (
                    docsThemeOptions.length > 0 ? (
                        <Select
                            value={selectedDocsTheme}
                            onOpenChange={(open) => updateOpenMenu("theme", open)}
                            onValueChange={onDocsThemeChange}
                            disabled={docsThemeApplying}>
                            <SelectTrigger
                                className='docs-active-bar-select w-40'
                                aria-label='Docs theme'>
                                <Palette className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {docsThemeOptions.map((option) => (
                                    <SelectItem
                                        key={option.name}
                                        disabled={
                                            option.requiresRestart && !import.meta.env.DEV
                                        }
                                        value={option.name}>
                                        {option.title}
                                        {option.requiresRestart
                                            ? import.meta.env.DEV
                                                ? " (restart)"
                                                : " (unavailable)"
                                            : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='docs-active-bar-icon-button'
                            aria-label='Load docs themes'
                            title={docsThemeError || "Load docs themes"}
                            disabled={docsThemeLoading}
                            onClick={onDocsThemesRefresh}>
                            <Palette className='h-3.5 w-3.5' />
                        </Button>
                    )
                ) : null}

                <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='docs-active-bar-icon-button'
                    aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                    title={theme === "dark" ? "Light mode" : "Dark mode"}
                    onClick={onThemeToggle}>
                    {theme === "dark" ? (
                        <Sun className='h-3.5 w-3.5' />
                    ) : (
                        <Moon className='h-3.5 w-3.5' />
                    )}
                </Button>

                <Separator orientation='vertical' className='docs-active-bar-separator' />

                <Select
                    value={mainWidth}
                    onOpenChange={(open) => updateOpenMenu("width", open)}
                    onValueChange={(value) => onMainWidthChange(value as MainWidthSetting)}>
                    <SelectTrigger
                        className='docs-active-bar-select w-32'
                        aria-label='Main content width'>
                        <Layout className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='narrow'>Narrow</SelectItem>
                        <SelectItem value='default'>Default</SelectItem>
                        <SelectItem value='wide'>Wide</SelectItem>
                        <SelectItem value='full'>Full</SelectItem>
                    </SelectContent>
                </Select>

                <Button
                    type='button'
                    variant={rightSidebarOpen ? "secondary" : "ghost"}
                    size='icon'
                    className='docs-active-bar-icon-button'
                    aria-label={rightSidebarOpen ? "Hide right sidebar" : "Show right sidebar"}
                    title={rightSidebarOpen ? "Hide right sidebar" : "Show right sidebar"}
                    disabled={!rightSidebarAvailable}
                    onClick={onRightSidebarToggle}>
                    <PanelRight className='h-3.5 w-3.5' />
                </Button>

                <Separator orientation='vertical' className='docs-active-bar-separator' />

                <ArticleFontScaleSlider
                    className='docs-active-bar-font-slider w-60'
                    value={fontScale}
                    onChange={onFontScaleChange}
                />
                <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='docs-active-bar-icon-button'
                    aria-label='Reset article font size'
                    title='Reset article font size'
                    disabled={fontScale === DEFAULT_ARTICLE_FONT_SCALE}
                    onClick={() => onFontScaleChange(DEFAULT_ARTICLE_FONT_SCALE)}>
                    <RotateCcw className='h-3.5 w-3.5' />
                </Button>

                <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='docs-active-bar-icon-button'
                    aria-label='Open settings'
                    title='Open settings'
                    onClick={onSettingsOpen}>
                    <SettingsIcon className='h-3.5 w-3.5' />
                </Button>
            </div>
        </footer>
    );
}

function ArticleFontScaleSlider({
    className,
    onChange,
    value,
}: {
    className?: string;
    onChange: (value: number) => void;
    value: number;
}) {
    const updateFromInput = React.useCallback(
        (event: React.SyntheticEvent<HTMLInputElement>) => {
            onChange(clampArticleFontScale(Number.parseInt(event.currentTarget.value, 10)));
        },
        [onChange],
    );

    return (
        <div className={cn("docs-font-scale-slider", className)}>
            <Type className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
            <input
                type='range'
                min={MIN_ARTICLE_FONT_SCALE}
                max={MAX_ARTICLE_FONT_SCALE}
                step={ARTICLE_FONT_SCALE_STEP}
                value={value}
                className='docs-font-scale-range'
                aria-label='Article font size'
                onChange={updateFromInput}
                onClick={updateFromInput}
                onInput={updateFromInput}
                onKeyUp={updateFromInput}
            />
            <span className='docs-font-scale-value'>{value}%</span>
        </div>
    );
}

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
            <AccordionTrigger className='docs-accordion-trigger'>{item.title}</AccordionTrigger>
            <AccordionContent className='docs-accordion-panel'>
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
                className='docs-article-accordion not-prose w-full text-foreground'>
                {items}
            </Accordion>
        );
    }

    return (
        <Accordion
            type='single'
            collapsible
            defaultValue={defaultValues[0]}
            className='docs-article-accordion not-prose w-full text-foreground'>
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
    if (page.kind === "folder" && page.folder?.root === "") {
        return [{ title: site }];
    }

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

function createMermaidCopyButton(index: number) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = MERMAID_COPY_BUTTON_CLASS;
    button.innerHTML = MERMAID_COPY_ICON;
    button.setAttribute("aria-label", `Copy Mermaid diagram ${index + 1} as image`);
    button.setAttribute("title", "Copy as image");
    return button;
}

async function copyMermaidDiagramAsImage(mermaid: Element) {
    try {
        const clipboard = getPngImageClipboard();
        await clipboard.write([
            new ClipboardItem({ "image/png": renderMermaidDiagramPng(mermaid) }),
        ]);
        toast.success("Copied Mermaid diagram as image.");
        return true;
    } catch (error) {
        toast.error("Copy failed.", {
            description: getMermaidCopyErrorDescription(error),
        });
        return false;
    }
}

function getPngImageClipboard() {
    const clipboard = navigator.clipboard;
    if (!clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Image clipboard copy is not supported in this browser.");
    }

    if (typeof ClipboardItem.supports === "function" && !ClipboardItem.supports("image/png")) {
        throw new Error("PNG clipboard copy is not supported in this browser.");
    }

    return clipboard;
}

async function renderMermaidDiagramPng(mermaid: Element) {
    const svg = mermaid.querySelector("svg");
    if (!(svg instanceof SVGElement)) {
        throw new Error("Mermaid SVG was not found.");
    }

    const measured = getSvgSize(svg);
    const size = {
        width: Math.max(1, measured.width),
        height: Math.max(1, measured.height),
    };
    const clone = cloneMermaidSvgForExport(svg, mermaid, size);
    const image = await loadSvgImage(new XMLSerializer().serializeToString(clone));
    const scale = clamp(window.devicePixelRatio || 1, 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(size.width * scale));
    canvas.height = Math.max(1, Math.ceil(size.height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Could not create a canvas for the Mermaid image.");
    }

    context.scale(scale, scale);
    context.fillStyle = getMermaidCanvasBackground(mermaid);
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);

    return canvasToPngBlob(canvas);
}

function cloneMermaidSvgForExport(svg: SVGElement, mermaid: Element, size: Size) {
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(size.width));
    clone.setAttribute("height", String(size.height));
    inlineResolvedMermaidSvgColors(svg, clone, mermaid);
    return clone;
}

function inlineResolvedMermaidSvgColors(sourceSvg: SVGElement, targetSvg: SVGElement, mermaid: Element) {
    const mermaidStyle = getComputedStyle(mermaid);
    const sourceStyle = getComputedStyle(sourceSvg);
    const foreground = mermaidStyle.color || "rgb(0, 0, 0)";
    const background = getMermaidCanvasBackground(mermaid);
    const border = mermaidStyle.borderTopColor || foreground;
    const baseFallbacks: Record<(typeof MERMAID_EXPORT_BASE_COLOR_VARS)[number], string> = {
        "--bg": background,
        "--fg": foreground,
        "--line": border,
        "--accent": foreground,
        "--muted": foreground,
        "--surface": background,
        "--border": border,
    };
    const resolvedBaseVars = new Map<string, string>();

    for (const name of MERMAID_EXPORT_BASE_COLOR_VARS) {
        const rawValue = sourceStyle.getPropertyValue(name) || sourceSvg.style.getPropertyValue(name);
        const color = resolveCssColorValue(mermaid, rawValue, baseFallbacks[name], resolvedBaseVars);
        resolvedBaseVars.set(name, color);
        targetSvg.style.setProperty(name, color);
    }

    for (const name of MERMAID_EXPORT_DERIVED_COLOR_VARS) {
        const rawValue = sourceStyle.getPropertyValue(name) || sourceSvg.style.getPropertyValue(name);
        const color = resolveCssColorValue(
            mermaid,
            rawValue,
            getMermaidDerivedColorFallback(name, resolvedBaseVars),
            resolvedBaseVars,
        );
        targetSvg.style.setProperty(name, color);
    }
}

function resolveCssColorValue(
    context: Element,
    value: string,
    fallback: string,
    variables: ReadonlyMap<string, string>,
) {
    const colorValue = value.trim();
    if (!colorValue) return fallback;

    const host = context instanceof HTMLElement ? context : document.body;
    const probe = document.createElement("span");
    probe.style.position = "fixed";
    probe.style.left = "-9999px";
    probe.style.top = "0";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    for (const [name, variableValue] of variables) {
        probe.style.setProperty(name, variableValue);
    }

    probe.style.color = colorValue;
    if (!probe.style.color) return fallback;

    host.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved || fallback;
}

function getMermaidDerivedColorFallback(
    name: (typeof MERMAID_EXPORT_DERIVED_COLOR_VARS)[number],
    variables: ReadonlyMap<string, string>,
) {
    const foreground = variables.get("--fg") ?? "rgb(0, 0, 0)";
    const background = variables.get("--bg") ?? "rgb(255, 255, 255)";
    const line = variables.get("--line") ?? foreground;
    const accent = variables.get("--accent") ?? foreground;
    const surface = variables.get("--surface") ?? background;
    const border = variables.get("--border") ?? line;

    if (name === "--_line" || name === "--_inner-stroke") return line;
    if (name === "--_arrow") return accent;
    if (name === "--_node-fill" || name === "--_group-fill" || name === "--_group-hdr") {
        return surface;
    }
    if (name === "--_node-stroke" || name === "--beautiful-mermaid-autonumber-border") {
        return border;
    }
    if (name === "--_key-badge" || name === "--beautiful-mermaid-autonumber-bg") {
        return background;
    }
    return foreground;
}

function getMermaidCanvasBackground(mermaid: Element) {
    const background = getComputedStyle(mermaid).backgroundColor;
    if (background && background !== "rgba(0, 0, 0, 0)" && background !== "transparent") {
        return background;
    }

    const bodyBackground = getComputedStyle(document.body).backgroundColor;
    return bodyBackground && bodyBackground !== "rgba(0, 0, 0, 0)" ? bodyBackground : "#ffffff";
}

function loadSvgImage(svg: string) {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.decoding = "async";

    return new Promise<HTMLImageElement>((resolve, reject) => {
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Could not render the Mermaid SVG as an image."));
        };
        image.src = url;
    });
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }

            reject(new Error("Could not create a PNG image."));
        }, "image/png");
    });
}

function getMermaidCopyErrorDescription(error: unknown) {
    return error instanceof Error && error.message
        ? error.message
        : "Clipboard permission was denied.";
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
        .querySelectorAll(
            `.${MERMAID_COPY_BUTTON_CLASS}, .docs-code-copy, .md-clipboard, .md-code__copy, [data-clipboard-target]`,
        )
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

function getReadPagesStorageKey(site: SiteKey) {
    return `${READ_PAGES_STORAGE_PREFIX}:${site}`;
}

function readReadPageUrls(site: SiteKey): ReadonlySet<string> {
    try {
        const value = JSON.parse(readStorageValue(getReadPagesStorageKey(site)) ?? "[]");
        if (!Array.isArray(value)) return new Set<string>();

        return new Set<string>(
            value.filter((item): item is string => typeof item === "string").map(normalizePath),
        );
    } catch {
        return new Set<string>();
    }
}

function markPageAsRead(
    site: SiteKey,
    pagePath: string,
    setReadPageUrls: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>,
) {
    markPagesAsRead(site, [pagePath], setReadPageUrls);
}

function markPagesAsRead(
    site: SiteKey,
    pagePaths: ReadonlyArray<string>,
    setReadPageUrls: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>,
) {
    const normalizedPaths = pagePaths.map(normalizePath);

    setReadPageUrls((current) => {
        let changed = false;

        const next = new Set(current);
        for (const pagePath of normalizedPaths) {
            if (next.has(pagePath)) continue;

            next.add(pagePath);
            changed = true;
        }

        if (!changed) return current;

        writeStorageValue(getReadPagesStorageKey(site), JSON.stringify([...next].sort()));
        return next;
    });
}

function markPagesAsUnread(
    site: SiteKey,
    pagePaths: ReadonlyArray<string>,
    setReadPageUrls: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>,
) {
    const normalizedPaths = pagePaths.map(normalizePath);

    setReadPageUrls((current) => {
        let changed = false;
        const next = new Set(current);

        for (const pagePath of normalizedPaths) {
            if (!next.delete(pagePath)) continue;
            changed = true;
        }

        if (!changed) return current;

        writeStorageValue(getReadPagesStorageKey(site), JSON.stringify([...next].sort()));
        return next;
    });
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
            articleFontScale: readArticleFontScaleSetting(parsed.articleFontScale),
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

function readArticleFontScaleSetting(value: unknown) {
    if (typeof value !== "number") return DEFAULT_ARTICLE_FONT_SCALE;
    if (!Number.isFinite(value)) return DEFAULT_ARTICLE_FONT_SCALE;
    return clampArticleFontScale(value);
}

function clampArticleFontScale(value: number) {
    const stepped = Math.round(value / ARTICLE_FONT_SCALE_STEP) * ARTICLE_FONT_SCALE_STEP;
    return clamp(stepped, MIN_ARTICLE_FONT_SCALE, MAX_ARTICLE_FONT_SCALE);
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

function normalizeMarkdownTitle(title: string) {
    return title.replace(/\s+/g, " ").trim();
}

function replaceMarkdownTitle(markdown: string, title: string) {
    const normalizedTitle = normalizeMarkdownTitle(title);
    if (!normalizedTitle) return markdown;

    const lines = markdown.split(/\r?\n/);
    const headingIndex = findMarkdownTitleHeadingIndex(lines);

    if (headingIndex >= 0) {
        const nextLines = [...lines];
        nextLines[headingIndex] = `# ${normalizedTitle}`;
        return nextLines.join("\n");
    }

    const frontmatter = getMarkdownFrontmatterRange(lines);
    if (frontmatter) {
        const titleIndex = lines.findIndex(
            (line, index) =>
                index > frontmatter.start &&
                index < frontmatter.end &&
                /^title\s*:/i.test(line.trim()),
        );
        const nextLines = [...lines];
        const titleLine = `title: ${JSON.stringify(normalizedTitle)}`;

        if (titleIndex >= 0) {
            nextLines[titleIndex] = titleLine;
        } else {
            nextLines.splice(frontmatter.start + 1, 0, titleLine);
        }

        return nextLines.join("\n");
    }

    return `# ${normalizedTitle}\n\n${markdown.replace(/^\s+/, "")}`;
}

function findMarkdownTitleHeadingIndex(lines: string[]) {
    let inFence = false;
    let fenceMarker = "";

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
        if (fenceMatch) {
            const marker = fenceMatch[1]?.[0] ?? "";
            if (!inFence) {
                inFence = true;
                fenceMarker = marker;
            } else if (marker === fenceMarker) {
                inFence = false;
                fenceMarker = "";
            }
            continue;
        }

        if (!inFence && /^ {0,3}#\s+.+?\s*$/.test(line)) return index;
    }

    return -1;
}

function getMarkdownFrontmatterRange(lines: string[]) {
    if (lines[0]?.trim() !== "---") return null;

    const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    return end > 0 ? { start: 0, end } : null;
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

function isNavFolder(item: NavItem) {
    return item.kind === "folder" || item.children.length > 0;
}

function isInboxNavItem(item: NavItem) {
    return item.system === "inbox" || item.url === "/inbox/";
}

function flattenNavPageSourcePaths(items: NavItem[]) {
    const sourcePaths: string[] = [];

    for (const item of items) {
        if (isInboxNavItem(item)) continue;

        if (!isNavFolder(item) && item.sourcePath) {
            sourcePaths.push(item.sourcePath);
        }

        sourcePaths.push(...flattenNavPageSourcePaths(item.children));
    }

    return sourcePaths;
}

function sourcePathRange(sourcePaths: string[], from: string, to: string) {
    const fromIndex = sourcePaths.indexOf(from);
    const toIndex = sourcePaths.indexOf(to);
    if (fromIndex < 0 || toIndex < 0) return [];

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    return sourcePaths.slice(start, end + 1);
}

function getNavFolderPath(item: NavItem) {
    if (item.relativePath) return item.relativePath.replace(/\/+$/, "");
    return item.url.replace(/^\/+|\/+$/g, "");
}

function getDocsEntryTargetFromNavItem(item: NavItem): DocsEntryTarget {
    if (isNavFolder(item)) {
        return {
            title: item.title,
            kind: "folder",
            url: item.url,
            folderPath: getNavFolderPath(item),
            system: item.system,
        };
    }

    return {
        title: item.title,
        kind: "page",
        url: item.url,
        sourcePath: item.sourcePath,
    };
}

function defaultRenameName(target: DocsEntryTarget) {
    if (target.kind === "folder") {
        return target.folderPath?.split("/").filter(Boolean).at(-1) ?? target.title;
    }

    const fileName = target.sourcePath?.split("/").pop() ?? target.title;
    return fileName.endsWith(".md") ? fileName.slice(0, -".md".length) : fileName;
}

function getCreateFolderPathForTarget(target: DocsEntryTarget, site: SiteKey) {
    if (target.kind === "folder") return target.folderPath ?? "";

    const relativePath = target.sourcePath
        ? getSiteSourceRelativePath(target.sourcePath, site)
        : null;
    return relativePath ? getPathDirName(relativePath) : "";
}

function writeDraggedSourcePaths(
    event: React.DragEvent,
    sourcePaths: string[],
    options: { title?: string; sourceLabel?: string } = {},
) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DOCS_DRAG_MIME, JSON.stringify(sourcePaths));
    event.dataTransfer.setData("text/plain", sourcePaths.join("\n"));

    const dragPreview = createDocsDragPreview({
        count: sourcePaths.length,
        sourceLabel: options.sourceLabel,
        title: options.title ?? sourcePaths[0] ?? "Markdown file",
    });

    document.body.appendChild(dragPreview);
    event.dataTransfer.setDragImage(dragPreview, 18, 18);
    window.setTimeout(() => dragPreview.remove(), 0);
}

function createDocsDragPreview({
    count,
    sourceLabel,
    title,
}: {
    count: number;
    sourceLabel?: string;
    title: string;
}) {
    const preview = document.createElement("div");
    preview.className = "docs-drag-preview";

    const icon = document.createElement("div");
    icon.className = "docs-drag-preview-icon";
    icon.textContent = count > 1 ? String(count) : "";

    const body = document.createElement("div");
    body.className = "docs-drag-preview-body";

    const titleElement = document.createElement("div");
    titleElement.className = "docs-drag-preview-title";
    titleElement.textContent = count > 1 ? `${count} Markdown files` : title;

    const metaElement = document.createElement("div");
    metaElement.className = "docs-drag-preview-meta";
    metaElement.textContent = sourceLabel ?? "Move to folder";

    body.append(titleElement, metaElement);
    preview.append(icon, body);

    return preview;
}

function readDraggedSourcePaths(event: React.DragEvent) {
    const raw = event.dataTransfer.getData(DOCS_DRAG_MIME);
    if (!raw) return [];

    try {
        const value = JSON.parse(raw);
        return Array.isArray(value)
            ? value.filter((item): item is string => typeof item === "string")
            : [];
    } catch {
        return [];
    }
}

function DocsSidebar({
    canManageDocs,
    currentPath,
    currentSourcePath,
    getDragSourcePaths,
    inboxUnreadCount,
    items,
    onCreateMarkdown,
    onEntryContextMenu,
    onMoveMarkdown,
    onNavigate,
    onPageSelect,
    onSettingsOpen,
    onWidthChange,
    pageUrls,
    selectedSourcePaths,
    siteTitle,
    width,
    wrapText,
}: {
    canManageDocs: boolean;
    currentPath: string;
    currentSourcePath: string;
    getDragSourcePaths: (sourcePath: string) => string[];
    inboxUnreadCount: number;
    items: NavItem[];
    onCreateMarkdown: () => void;
    onEntryContextMenu: (event: React.MouseEvent, target: DocsEntryTarget) => void;
    onMoveMarkdown: (sourcePaths: string[], destinationFolder: string) => void;
    onNavigate: (url: string) => void;
    onPageSelect: (
        sourcePath: string,
        modifiers: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean },
    ) => void;
    onSettingsOpen: () => void;
    onWidthChange: (width: number) => void;
    pageUrls: ReadonlySet<string>;
    selectedSourcePaths: ReadonlySet<string>;
    siteTitle: string;
    width: number;
    wrapText: boolean;
}) {
    const [isRootDropTarget, setIsRootDropTarget] = React.useState(false);
    const rootTarget = React.useMemo<DocsEntryTarget>(
        () => ({
            title: siteTitle,
            kind: "root",
            url: "/",
            folderPath: "",
        }),
        [siteTitle],
    );
    const openRootContextMenu = React.useCallback(
        (event: React.MouseEvent) => {
            if (!canManageDocs) return;
            onEntryContextMenu(event, rootTarget);
        },
        [canManageDocs, onEntryContextMenu, rootTarget],
    );
    const handleRootDragOver = React.useCallback((event: React.DragEvent) => {
        if (!canManageDocs || !event.dataTransfer.types.includes(DOCS_DRAG_MIME)) return;

        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setIsRootDropTarget(true);
    }, [canManageDocs]);
    const handleRootDragLeave = React.useCallback((event: React.DragEvent) => {
        const relatedTarget = event.relatedTarget;
        if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;

        setIsRootDropTarget(false);
    }, []);
    const handleRootDrop = React.useCallback(
        (event: React.DragEvent) => {
            if (!canManageDocs) return;

            const sourcePaths = readDraggedSourcePaths(event);
            if (sourcePaths.length === 0) return;

            event.preventDefault();
            event.stopPropagation();
            setIsRootDropTarget(false);
            onMoveMarkdown(sourcePaths, "");
        },
        [canManageDocs, onMoveMarkdown],
    );

    return (
        <SidebarRoot collapsible='offcanvas' className='docs-left-sidebar'>
            <SidebarWidthResizer
                ariaLabel='Resize navigation sidebar'
                side='left'
                width={width}
                onWidthChange={onWidthChange}
            />
            <SidebarContent onContextMenu={openRootContextMenu}>
                <SidebarGroup>
                    <SidebarGroupLabel className='justify-between gap-2 pr-1'>
                        <span>Docs</span>
                        {import.meta.env.DEV && canManageDocs && (
                            <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type='button'
                                            variant='ghost'
                                            size='icon'
                                            className='h-6 w-6 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground'
                                            aria-label='Add Markdown file'
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onCreateMarkdown();
                                            }}>
                                            <Plus className='h-3.5 w-3.5' />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side='right'>Add file</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <DocsSidebarNav
                            canManageDocs={canManageDocs}
                            currentPath={currentPath}
                            currentSourcePath={currentSourcePath}
                            getDragSourcePaths={getDragSourcePaths}
                            inboxUnreadCount={inboxUnreadCount}
                            items={items}
                            onEntryContextMenu={onEntryContextMenu}
                            onMoveMarkdown={onMoveMarkdown}
                            onNavigate={onNavigate}
                            onPageSelect={onPageSelect}
                            pageUrls={pageUrls}
                            selectedSourcePaths={selectedSourcePaths}
                            wrapText={wrapText}
                        />
                    </SidebarGroupContent>
                </SidebarGroup>
                <button
                    type='button'
                    aria-label='Open root folder'
                    className={cn(
                        "mt-1 block min-h-12 w-full flex-1 rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        isRootDropTarget &&
                            "bg-sidebar-accent text-sidebar-accent-foreground ring-2 ring-sidebar-ring",
                    )}
                    onClick={() => onNavigate("/")}
                    onContextMenu={openRootContextMenu}
                    onDragLeave={handleRootDragLeave}
                    onDragOver={handleRootDragOver}
                    onDrop={handleRootDrop}
                />
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem className='flex min-w-0 items-center gap-1'>
                        <SidebarMenuButton
                            className={cn(
                                "h-auto min-w-0 flex-1 py-2",
                                isRootDropTarget &&
                                    "bg-sidebar-accent text-sidebar-accent-foreground ring-2 ring-sidebar-ring",
                            )}
                            onClick={() => onNavigate("/")}
                            onDragLeave={handleRootDragLeave}
                            onDragOver={handleRootDragOver}
                            onDrop={handleRootDrop}>
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

function InboxUnreadBadge({ count }: { count: number }) {
    if (count <= 0) return null;

    const label = count > 99 ? "99+" : String(count);
    const title = `${count} unread inbox ${count === 1 ? "document" : "documents"}`;

    return (
        <span
            className='ml-2 inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-[0.625rem] font-semibold leading-none text-sidebar-primary-foreground'
            aria-label={title}
            title={title}>
            {label}
        </span>
    );
}

function DocsSidebarNav({
    canManageDocs,
    items,
    currentPath,
    currentSourcePath,
    getDragSourcePaths,
    inboxUnreadCount,
    onEntryContextMenu,
    onMoveMarkdown,
    onNavigate,
    onPageSelect,
    pageUrls,
    selectedSourcePaths,
    wrapText,
}: {
    canManageDocs: boolean;
    items: NavItem[];
    currentPath: string;
    currentSourcePath: string;
    getDragSourcePaths: (sourcePath: string) => string[];
    inboxUnreadCount: number;
    onEntryContextMenu: (event: React.MouseEvent, target: DocsEntryTarget) => void;
    onMoveMarkdown: (sourcePaths: string[], destinationFolder: string) => void;
    onNavigate: (url: string) => void;
    onPageSelect: (
        sourcePath: string,
        modifiers: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean },
    ) => void;
    pageUrls: ReadonlySet<string>;
    selectedSourcePaths: ReadonlySet<string>;
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
                    canManageDocs={canManageDocs}
                    key={item.url}
                    currentPath={currentPath}
                    currentSourcePath={currentSourcePath}
                    getDragSourcePaths={getDragSourcePaths}
                    inboxUnreadCount={inboxUnreadCount}
                    item={item}
                    onEntryContextMenu={onEntryContextMenu}
                    onMoveMarkdown={onMoveMarkdown}
                    onNavigate={navigate}
                    onPageSelect={onPageSelect}
                    pageUrls={pageUrls}
                    selectedSourcePaths={selectedSourcePaths}
                    wrapText={wrapText}
                />
            ))}
        </SidebarMenu>
    );
}

function DocsSidebarNavItem({
    canManageDocs,
    currentPath,
    currentSourcePath,
    getDragSourcePaths,
    inboxUnreadCount,
    item,
    onEntryContextMenu,
    onMoveMarkdown,
    onNavigate,
    onPageSelect,
    pageUrls,
    selectedSourcePaths,
    wrapText,
}: {
    canManageDocs: boolean;
    currentPath: string;
    currentSourcePath: string;
    getDragSourcePaths: (sourcePath: string) => string[];
    inboxUnreadCount: number;
    item: NavItem;
    onEntryContextMenu: (event: React.MouseEvent, target: DocsEntryTarget) => void;
    onMoveMarkdown: (sourcePaths: string[], destinationFolder: string) => void;
    onNavigate: (url: string) => void;
    onPageSelect: (
        sourcePath: string,
        modifiers: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean },
    ) => void;
    pageUrls: ReadonlySet<string>;
    selectedSourcePaths: ReadonlySet<string>;
    wrapText: boolean;
}) {
    const isActive = navItemIsActive(item, currentPath, currentSourcePath);
    const hasChildren = item.children.length > 0;
    const isFolder = isNavFolder(item);
    const isSystemInbox = isInboxNavItem(item);
    const hasPage = pageUrls.has(item.url);
    const isCurrentBranch = navItemContainsCurrent(item, currentPath, currentSourcePath);
    const [open, setOpen] = React.useState(isCurrentBranch);
    const [isDropTarget, setIsDropTarget] = React.useState(false);

    React.useEffect(() => {
        if (isCurrentBranch) setOpen(true);
    }, [isCurrentBranch]);

    const handleFolderClick = React.useCallback(() => {
        if (!hasPage) return;

        onNavigate(item.url);

        if (open && item.url !== currentPath) return;

        setOpen((value) => !value);
    }, [currentPath, hasPage, item.url, onNavigate, open]);

    const handlePageClick = React.useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            if (!item.sourcePath) {
                onNavigate(item.url);
                return;
            }

            if (canManageDocs) {
                onPageSelect(item.sourcePath, {
                    metaKey: event.metaKey,
                    ctrlKey: event.ctrlKey,
                    shiftKey: event.shiftKey,
                });
            }

            if (canManageDocs && (event.metaKey || event.ctrlKey || event.shiftKey)) return;

            onNavigate(item.url);
        },
        [canManageDocs, item.sourcePath, item.url, onNavigate, onPageSelect],
    );

    const handleDragStart = React.useCallback(
        (event: React.DragEvent<HTMLButtonElement>) => {
            if (!canManageDocs || !item.sourcePath) return;
            writeDraggedSourcePaths(event, getDragSourcePaths(item.sourcePath), {
                title: item.title,
            });
        },
        [canManageDocs, getDragSourcePaths, item.sourcePath, item.title],
    );

    const handleFolderDragOver = React.useCallback((event: React.DragEvent) => {
        if (!canManageDocs || !event.dataTransfer.types.includes(DOCS_DRAG_MIME)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setIsDropTarget(true);
    }, [canManageDocs]);

    const handleFolderDragLeave = React.useCallback((event: React.DragEvent) => {
        const relatedTarget = event.relatedTarget;
        if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
        setIsDropTarget(false);
    }, []);

    const handleFolderDrop = React.useCallback(
        (event: React.DragEvent) => {
            if (!canManageDocs) return;

            const sourcePaths = readDraggedSourcePaths(event);
            if (sourcePaths.length === 0) return;

            event.preventDefault();
            event.stopPropagation();
            setIsDropTarget(false);
            setOpen(true);
            onMoveMarkdown(sourcePaths, getNavFolderPath(item));
        },
        [canManageDocs, item, onMoveMarkdown],
    );

    const handleContextMenu = React.useCallback(
        (event: React.MouseEvent) => {
            if (!canManageDocs) return;
            onEntryContextMenu(event, getDocsEntryTargetFromNavItem(item));
        },
        [canManageDocs, item, onEntryContextMenu],
    );

    if (!isFolder) {
        const isSelected = Boolean(item.sourcePath && selectedSourcePaths.has(item.sourcePath));

        return (
            <SidebarMenuItem>
                <SidebarMenuButton
                    className={cn(
                        wrapText && "h-auto min-h-9 items-start py-2",
                        isSelected && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                    )}
                    data-selected={isSelected ? "true" : undefined}
                    draggable={canManageDocs && Boolean(item.sourcePath)}
                    isActive={isActive}
                    onClick={handlePageClick}
                    onContextMenu={canManageDocs ? handleContextMenu : undefined}
                    onDragStart={handleDragStart}>
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
            className={cn(
                "justify-between",
                wrapText && "h-auto min-h-9 items-start py-2",
                isDropTarget && "bg-sidebar-accent text-sidebar-accent-foreground ring-2 ring-sidebar-ring",
            )}
            isActive={isActive}
            onClick={
                isSystemInbox
                    ? () => onNavigate(item.url)
                    : hasPage
                      ? handleFolderClick
                      : undefined
            }
            onContextMenu={canManageDocs ? handleContextMenu : undefined}
            onDragLeave={handleFolderDragLeave}
            onDragOver={handleFolderDragOver}
            onDrop={handleFolderDrop}>
            <span
                className={cn(
                    "flex min-w-0 flex-1 gap-2",
                    wrapText ? "items-start" : "items-center",
                )}>
                {isSystemInbox ? (
                    <Inbox className='h-4 w-4 shrink-0 text-sidebar-foreground/70' />
                ) : (
                    <Folder className='h-4 w-4 shrink-0 text-sidebar-foreground/70' />
                )}
                <span
                    className={cn(
                        "min-w-0",
                        wrapText ? "break-words whitespace-normal leading-5" : "truncate",
                    )}>
                    {item.title}
                </span>
            </span>
            {isSystemInbox && <InboxUnreadBadge count={inboxUnreadCount} />}
            {!isSystemInbox && hasChildren && (
                <ChevronRight
                    className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200 ease-smooth",
                        open && "rotate-90",
                    )}
                />
            )}
        </SidebarMenuButton>
    );

    if (isSystemInbox) {
        return <SidebarMenuItem>{folderButton}</SidebarMenuItem>;
    }

    return (
        <SidebarMenuItem>
            <Collapsible open={open} onOpenChange={setOpen}>
                {hasPage ? (
                    folderButton
                ) : (
                    <CollapsibleTrigger asChild>{folderButton}</CollapsibleTrigger>
                )}

                {hasChildren && (
                    <CollapsibleContent className='docs-collapsible-content'>
                        <SidebarMenuSub>
                            {item.children.map((child) => (
                                <DocsSidebarSubItem
                                    canManageDocs={canManageDocs}
                                    key={child.url}
                                    currentPath={currentPath}
                                    currentSourcePath={currentSourcePath}
                                    getDragSourcePaths={getDragSourcePaths}
                                    inboxUnreadCount={inboxUnreadCount}
                                    item={child}
                                    onEntryContextMenu={onEntryContextMenu}
                                    onMoveMarkdown={onMoveMarkdown}
                                    onNavigate={onNavigate}
                                    onPageSelect={onPageSelect}
                                    pageUrls={pageUrls}
                                    selectedSourcePaths={selectedSourcePaths}
                                    wrapText={wrapText}
                                />
                            ))}
                        </SidebarMenuSub>
                    </CollapsibleContent>
                )}
            </Collapsible>
        </SidebarMenuItem>
    );
}

function DocsSidebarSubItem({
    canManageDocs,
    currentPath,
    currentSourcePath,
    getDragSourcePaths,
    inboxUnreadCount,
    item,
    onEntryContextMenu,
    onMoveMarkdown,
    onNavigate,
    onPageSelect,
    pageUrls,
    selectedSourcePaths,
    wrapText,
}: {
    canManageDocs: boolean;
    currentPath: string;
    currentSourcePath: string;
    getDragSourcePaths: (sourcePath: string) => string[];
    inboxUnreadCount: number;
    item: NavItem;
    onEntryContextMenu: (event: React.MouseEvent, target: DocsEntryTarget) => void;
    onMoveMarkdown: (sourcePaths: string[], destinationFolder: string) => void;
    onNavigate: (url: string) => void;
    onPageSelect: (
        sourcePath: string,
        modifiers: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean },
    ) => void;
    pageUrls: ReadonlySet<string>;
    selectedSourcePaths: ReadonlySet<string>;
    wrapText: boolean;
}) {
    const isActive = navItemIsActive(item, currentPath, currentSourcePath);
    const hasChildren = item.children.length > 0;
    const isFolder = isNavFolder(item);
    const isSystemInbox = isInboxNavItem(item);
    const hasPage = pageUrls.has(item.url);
    const isCurrentBranch = navItemContainsCurrent(item, currentPath, currentSourcePath);
    const [open, setOpen] = React.useState(isCurrentBranch);
    const [isDropTarget, setIsDropTarget] = React.useState(false);

    React.useEffect(() => {
        if (isCurrentBranch) setOpen(true);
    }, [isCurrentBranch]);

    const handleFolderClick = React.useCallback(() => {
        if (!hasPage) return;

        onNavigate(item.url);

        if (open && item.url !== currentPath) return;

        setOpen((value) => !value);
    }, [currentPath, hasPage, item.url, onNavigate, open]);

    const handlePageClick = React.useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            if (!item.sourcePath) {
                onNavigate(item.url);
                return;
            }

            if (canManageDocs) {
                onPageSelect(item.sourcePath, {
                    metaKey: event.metaKey,
                    ctrlKey: event.ctrlKey,
                    shiftKey: event.shiftKey,
                });
            }

            if (canManageDocs && (event.metaKey || event.ctrlKey || event.shiftKey)) return;

            onNavigate(item.url);
        },
        [canManageDocs, item.sourcePath, item.url, onNavigate, onPageSelect],
    );

    const handleDragStart = React.useCallback(
        (event: React.DragEvent<HTMLButtonElement>) => {
            if (!canManageDocs || !item.sourcePath) return;
            writeDraggedSourcePaths(event, getDragSourcePaths(item.sourcePath), {
                title: item.title,
            });
        },
        [canManageDocs, getDragSourcePaths, item.sourcePath, item.title],
    );

    const handleFolderDragOver = React.useCallback((event: React.DragEvent) => {
        if (!canManageDocs || !event.dataTransfer.types.includes(DOCS_DRAG_MIME)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setIsDropTarget(true);
    }, [canManageDocs]);

    const handleFolderDragLeave = React.useCallback((event: React.DragEvent) => {
        const relatedTarget = event.relatedTarget;
        if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
        setIsDropTarget(false);
    }, []);

    const handleFolderDrop = React.useCallback(
        (event: React.DragEvent) => {
            if (!canManageDocs) return;

            const sourcePaths = readDraggedSourcePaths(event);
            if (sourcePaths.length === 0) return;

            event.preventDefault();
            event.stopPropagation();
            setIsDropTarget(false);
            setOpen(true);
            onMoveMarkdown(sourcePaths, getNavFolderPath(item));
        },
        [canManageDocs, item, onMoveMarkdown],
    );

    const handleContextMenu = React.useCallback(
        (event: React.MouseEvent) => {
            if (!canManageDocs) return;
            onEntryContextMenu(event, getDocsEntryTargetFromNavItem(item));
        },
        [canManageDocs, item, onEntryContextMenu],
    );

    if (!isFolder) {
        const isSelected = Boolean(item.sourcePath && selectedSourcePaths.has(item.sourcePath));

        return (
            <SidebarMenuSubItem>
                <SidebarMenuSubButton
                    className={cn(
                        wrapText && "h-auto min-h-7 items-start py-1.5",
                        isSelected && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                    )}
                    data-selected={isSelected ? "true" : undefined}
                    draggable={canManageDocs && Boolean(item.sourcePath)}
                    isActive={isActive}
                    onClick={handlePageClick}
                    onContextMenu={canManageDocs ? handleContextMenu : undefined}
                    onDragStart={handleDragStart}>
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
            className={cn(
                "h-8 justify-between",
                wrapText && "h-auto min-h-8 items-start py-1.5",
                isDropTarget && "bg-sidebar-accent text-sidebar-accent-foreground ring-2 ring-sidebar-ring",
            )}
            isActive={isActive}
            onClick={
                isSystemInbox
                    ? () => onNavigate(item.url)
                    : hasPage
                      ? handleFolderClick
                      : undefined
            }
            onContextMenu={canManageDocs ? handleContextMenu : undefined}
            onDragLeave={handleFolderDragLeave}
            onDragOver={handleFolderDragOver}
            onDrop={handleFolderDrop}>
            <span
                className={cn(
                    "flex min-w-0 flex-1 gap-2",
                    wrapText ? "items-start" : "items-center",
                )}>
                {isSystemInbox ? (
                    <Inbox className='h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60' />
                ) : (
                    <Folder className='h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60' />
                )}
                <span
                    className={cn(
                        "min-w-0",
                        wrapText ? "break-words whitespace-normal leading-5" : "truncate",
                    )}>
                    {item.title}
                </span>
            </span>
            {isSystemInbox && <InboxUnreadBadge count={inboxUnreadCount} />}
            {!isSystemInbox && hasChildren && (
                <ChevronRight
                    className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-smooth",
                        open && "rotate-90",
                    )}
                />
            )}
        </SidebarMenuSubButton>
    );

    if (isSystemInbox) {
        return <SidebarMenuSubItem>{folderButton}</SidebarMenuSubItem>;
    }

    return (
        <SidebarMenuSubItem>
            <Collapsible open={open} onOpenChange={setOpen}>
                {hasPage ? (
                    folderButton
                ) : (
                    <CollapsibleTrigger asChild>{folderButton}</CollapsibleTrigger>
                )}

                {hasChildren && (
                    <CollapsibleContent className='docs-collapsible-content'>
                        <SidebarMenuSub className='mx-2'>
                            {item.children.map((child) => (
                                <DocsSidebarSubItem
                                    canManageDocs={canManageDocs}
                                    key={child.url}
                                    currentPath={currentPath}
                                    currentSourcePath={currentSourcePath}
                                    getDragSourcePaths={getDragSourcePaths}
                                    inboxUnreadCount={inboxUnreadCount}
                                    item={child}
                                    onEntryContextMenu={onEntryContextMenu}
                                    onMoveMarkdown={onMoveMarkdown}
                                    onNavigate={onNavigate}
                                    onPageSelect={onPageSelect}
                                    pageUrls={pageUrls}
                                    selectedSourcePaths={selectedSourcePaths}
                                    wrapText={wrapText}
                                />
                            ))}
                        </SidebarMenuSub>
                    </CollapsibleContent>
                )}
            </Collapsible>
        </SidebarMenuSubItem>
    );
}

function navItemIsActive(item: NavItem, currentPath: string, currentSourcePath: string): boolean {
    if (isNavFolder(item)) {
        return currentSourcePath.endsWith("/") && navFolderMatchesSourcePath(item, currentSourcePath);
    }

    return item.sourcePath ? item.sourcePath === currentSourcePath : item.url === currentPath;
}

function navItemContainsCurrent(
    item: NavItem,
    currentPath: string,
    currentSourcePath: string,
): boolean {
    return (
        navItemIsActive(item, currentPath, currentSourcePath) ||
        item.children.some((child) => navItemContainsCurrent(child, currentPath, currentSourcePath))
    );
}

function navFolderMatchesSourcePath(item: NavItem, currentSourcePath: string) {
    const folderPath = getNavFolderPath(item);
    const normalizedSourcePath = currentSourcePath.replace(/\\/g, "/").replace(/\/+$/, "/");
    const expectedSuffix = folderPath ? `/docs/${folderPath}/` : "/docs/";

    return normalizedSourcePath.endsWith(expectedSuffix);
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
    const link = getDocsThemeStylesheetLink();
    if (!link) return;

    const href = link.getAttribute("href") ?? "";
    const url = new URL(href, location.origin);
    if (!url.pathname.startsWith("/theme/") || !url.pathname.endsWith("/theme.css")) return;

    url.searchParams.set("v", String(version));
    link.href = `${url.pathname}${url.search}${url.hash}`;
}

function getInitialStaticDocsThemeName(
    themes: DocsThemeOption[],
    fallbackTheme?: string,
): string | undefined {
    const storedTheme = readStoredDocsThemeName();
    const storedOption = storedTheme
        ? themes.find(
              (option) =>
                  option.name === storedTheme && !option.requiresRestart && Boolean(option.cssPath),
          )
        : null;

    if (storedOption) return storedOption.name;
    if (storedTheme) removeStoredDocsThemeName();

    const fallbackOption = fallbackTheme
        ? themes.find(
              (option) =>
                  option.name === fallbackTheme &&
                  !option.requiresRestart &&
                  Boolean(option.cssPath),
          )
        : null;

    return fallbackOption?.name ?? themes.find((option) => !option.requiresRestart)?.name;
}

function applyStaticDocsTheme(
    themeName: string,
    themes: DocsThemeOption[],
    options: { persist?: boolean } = {},
) {
    const targetTheme = themes.find(
        (option) => option.name === themeName && !option.requiresRestart && Boolean(option.cssPath),
    );
    if (!targetTheme?.cssPath) return false;

    const link = getDocsThemeStylesheetLink();
    if (!link) return false;

    link.href = targetTheme.cssPath;

    if (options.persist !== false) {
        writeStoredDocsThemeName(targetTheme.name);
    }

    return true;
}

function resetDocsThemeStylesheetToProjectTheme() {
    const link = getDocsThemeStylesheetLink();
    if (link) link.href = "/theme/theme.css";
    removeStoredDocsThemeName();
}

function getDocsThemeStylesheetLink() {
    return (
        document.querySelector<HTMLLinkElement>("#smooth-docs-theme-stylesheet") ??
        document.querySelector<HTMLLinkElement>('link[href^="/theme/"][rel="stylesheet"]') ??
        document.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')
    );
}

function readStoredDocsThemeName() {
    try {
        return localStorage.getItem(DOCS_THEME_STORAGE_KEY) || "";
    } catch {
        return "";
    }
}

function writeStoredDocsThemeName(themeName: string) {
    try {
        localStorage.setItem(DOCS_THEME_STORAGE_KEY, themeName);
    } catch {
        // Ignore storage failures; the theme still applies for the current page.
    }
}

function removeStoredDocsThemeName() {
    try {
        localStorage.removeItem(DOCS_THEME_STORAGE_KEY);
    } catch {
        // Ignore storage failures.
    }
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

const INBOX_SECOND_MS = 1000;
const INBOX_MINUTE_MS = 60 * INBOX_SECOND_MS;
const INBOX_HOUR_MS = 60 * INBOX_MINUTE_MS;
const INBOX_DAY_MS = 24 * INBOX_HOUR_MS;
const INBOX_WEEK_MS = 7 * INBOX_DAY_MS;
const INBOX_MONTH_MS = (365 * INBOX_DAY_MS) / 12;
const INBOX_YEAR_MS = 365 * INBOX_DAY_MS;

function formatInboxDate(value?: string, now = Date.now()) {
    const timestamp = parseInboxTimestamp(value);
    if (timestamp === null) return "Unknown";

    const diff = timestamp - now;
    const suffix = diff > 0 ? "from now" : "ago";
    const { amount, unit } = getInboxRelativeTimeParts(Math.abs(diff));

    return `${amount}${unit} ${suffix}`;
}

function formatInboxAbsoluteDate(value?: string) {
    const timestamp = parseInboxTimestamp(value);
    if (timestamp === null) return undefined;

    return new Date(timestamp).toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function parseInboxTimestamp(value?: string) {
    if (!value) return null;

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
}

function getInboxRelativeTimeParts(diff: number) {
    if (diff < INBOX_MINUTE_MS) {
        return {
            amount: Math.max(1, Math.floor(diff / INBOX_SECOND_MS)),
            unit: "s",
        };
    }

    if (diff < INBOX_HOUR_MS) {
        return {
            amount: Math.max(1, Math.floor(diff / INBOX_MINUTE_MS)),
            unit: "m",
        };
    }

    if (diff < INBOX_DAY_MS) {
        return {
            amount: Math.max(1, Math.floor(diff / INBOX_HOUR_MS)),
            unit: "h",
        };
    }

    if (diff < INBOX_WEEK_MS) {
        return {
            amount: Math.max(1, Math.floor(diff / INBOX_DAY_MS)),
            unit: "d",
        };
    }

    if (diff < INBOX_MONTH_MS) {
        return {
            amount: Math.max(1, Math.floor(diff / INBOX_WEEK_MS)),
            unit: "w",
        };
    }

    if (diff < INBOX_YEAR_MS) {
        return {
            amount: Math.max(1, Math.floor(diff / INBOX_MONTH_MS)),
            unit: "mo",
        };
    }

    return {
        amount: Math.max(1, Math.floor(diff / INBOX_YEAR_MS)),
        unit: "y",
    };
}

function getNextRelativeTimeUpdateDelay(timestamps: ReadonlyArray<number>, now: number) {
    let nextDelay = INBOX_DAY_MS;

    for (const timestamp of timestamps) {
        const diff = Math.abs(timestamp - now);

        if (timestamp > now || diff < INBOX_MINUTE_MS) {
            nextDelay = Math.min(nextDelay, INBOX_SECOND_MS);
        } else if (diff < INBOX_HOUR_MS) {
            nextDelay = Math.min(nextDelay, INBOX_MINUTE_MS - (diff % INBOX_MINUTE_MS));
        } else if (diff < INBOX_DAY_MS) {
            nextDelay = Math.min(nextDelay, INBOX_HOUR_MS - (diff % INBOX_HOUR_MS));
        } else {
            nextDelay = Math.min(nextDelay, INBOX_DAY_MS - (diff % INBOX_DAY_MS));
        }
    }

    return Math.max(INBOX_SECOND_MS, Math.ceil(nextDelay));
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

function createClientId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function normalizeCodexChatMessages(messages: CodexChatMessage[] | undefined) {
    if (!Array.isArray(messages)) return [];

    return messages
        .map((message): CodexChatMessage | null => {
            const role =
                message.role === "assistant" || message.role === "system" || message.role === "user"
                    ? message.role
                    : null;
            const content = typeof message.content === "string" ? message.content : "";
            if (!role || !content.trim()) return null;

            return {
                id: typeof message.id === "string" && message.id ? message.id : createClientId(),
                role,
                content,
                kind: message.kind === "reasoning" || message.kind === "commentary" ? message.kind : "answer",
                turnId: typeof message.turnId === "string" ? message.turnId : undefined,
            };
        })
        .filter((message): message is CodexChatMessage => Boolean(message));
}

function formatCodexEffortLabel(value: string) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCodexSessionTimestamp(value: number) {
    if (!value) return "Unknown time";
    return new Date(value * 1000).toLocaleString([], {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
    });
}

type ChatMarkdownRenderer = {
    render: (markdown: string) => string;
};

let chatMarkdownRenderer: ChatMarkdownRenderer | null = null;
let chatMarkdownRendererPromise: Promise<ChatMarkdownRenderer> | null = null;

function renderChatMarkdownSync(markdown: string) {
    return chatMarkdownRenderer?.render(markdown) ?? renderPlainChatText(markdown);
}

function loadChatMarkdownRenderer() {
    if (chatMarkdownRenderer) return Promise.resolve(chatMarkdownRenderer);

    chatMarkdownRendererPromise ??= import("markdown-it").then(({ default: MarkdownIt }) => {
        const markdown = new MarkdownIt({
            breaks: true,
            html: false,
            linkify: true,
        });
        const defaultLinkOpen: NonNullable<typeof markdown.renderer.rules.link_open> =
            markdown.renderer.rules.link_open ??
            ((tokens, index, options, environment, self) =>
                self.renderToken(tokens, index, options));

        markdown.renderer.rules.link_open = (tokens, index, options, environment, self) => {
            const token = tokens[index];
            token.attrSet("target", "_blank");
            token.attrSet("rel", "noreferrer");
            return defaultLinkOpen(tokens, index, options, environment, self);
        };

        chatMarkdownRenderer = {
            render(value) {
                return markdown.render(value);
            },
        };
        return chatMarkdownRenderer;
    });

    return chatMarkdownRendererPromise;
}

function renderPlainChatText(value: string) {
    return escapeHtml(value).replace(/\n/g, "<br>");
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getSelectedText() {
    const selection = window.getSelection()?.toString().trim() ?? "";
    return selection.length > 6000 ? `${selection.slice(0, 6000)}\n[truncated]` : selection;
}

function isPrimaryShortcut(event: KeyboardEvent) {
    return event.metaKey || event.ctrlKey;
}

function isEditableShortcutTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;

    const editable = target.closest("input, textarea, select, [contenteditable='true']");
    return Boolean(editable);
}

function isMarkdownEditorShortcutTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(".docs-markdown-editor"));
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
