import { toPng } from "html-to-image";
import type { CompiledFlowLayout, FlowDocument, FlowLayoutBox } from "#smooth-docs/types";

export type FlowExportBounds = FlowLayoutBox;

export type ExportFlowPngOptions = {
    document: FlowDocument;
    element: HTMLElement;
    layout: CompiledFlowLayout;
    padding?: number;
};

export function computeFlowExportBounds(layout: CompiledFlowLayout): FlowExportBounds {
    const boxes = [...Object.values(layout.lanes), ...Object.values(layout.nodes)];
    if (boxes.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
}

export function createFlowPngFilename(document: FlowDocument) {
    const titleSlug = slug(document.title);
    return `${titleSlug || slug(document.id) || "workflow"}.png`;
}

export async function exportFlowPng({
    document,
    element,
    layout,
    padding = 32,
}: ExportFlowPngOptions) {
    const bounds = computeFlowExportBounds(layout);
    const safePadding = Number.isFinite(padding) ? Math.max(0, padding) : 32;
    const width = Math.max(1, Math.ceil(bounds.width + safePadding * 2));
    const height = Math.max(1, Math.ceil(bounds.height + safePadding * 2));
    const selection = Array.from(
        element.querySelectorAll<HTMLElement>(".selected, [aria-selected='true'], [data-selected='true']"),
    );
    const snapshots = selection.map((node) => ({
        node,
        className: node.getAttribute("class"),
        ariaSelected: node.getAttribute("aria-selected"),
        dataSelected: node.getAttribute("data-selected"),
    }));

    for (const { node } of snapshots) {
        node.classList.remove("selected");
        node.removeAttribute("aria-selected");
        node.removeAttribute("data-selected");
    }

    try {
        const backgroundColor = getComputedStyle(element).backgroundColor ||
            getComputedStyle(documentElement()).backgroundColor;
        const dataUrl = await toPng(element, {
            width,
            height,
            backgroundColor,
            pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
            cacheBust: true,
            filter: includeInExport,
            style: {
                width: `${width}px`,
                height: `${height}px`,
                transform: `translate(${safePadding - bounds.x}px, ${safePadding - bounds.y}px) scale(1)`,
                transformOrigin: "top left",
            },
        });
        const link = window.document.createElement("a");
        link.download = createFlowPngFilename(document);
        link.href = dataUrl;
        link.click();
        return dataUrl;
    } finally {
        for (const snapshot of snapshots) {
            restoreAttribute(snapshot.node, "class", snapshot.className);
            restoreAttribute(snapshot.node, "aria-selected", snapshot.ariaSelected);
            restoreAttribute(snapshot.node, "data-selected", snapshot.dataSelected);
        }
    }
}

function includeInExport(node: HTMLElement) {
    return !node.matches([
        ".react-flow__controls",
        ".react-flow__minimap",
        ".react-flow__handle",
        ".react-flow__selection",
        "[aria-label='Workflow reader controls']",
        "[data-flow-reader-control='true']",
        "[data-flow-editor='true']",
        "[data-flow-export-exclude='true']",
    ].join(","));
}

function restoreAttribute(node: HTMLElement, name: string, value: string | null) {
    if (value === null) node.removeAttribute(name);
    else node.setAttribute(name, value);
}

function slug(value: string) {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 96)
        .replace(/-+$/g, "");
}

function documentElement() {
    return window.document.documentElement;
}
