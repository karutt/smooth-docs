import { defaultFilter } from "cmdk";

type SearchablePage = { title: string; sourcePath: string; text: string };

export function pageSearchValue(page: SearchablePage) {
    return `open ${page.title} ${page.sourcePath} ${page.text}`;
}

export function createPageSearchFilter(pages: ReadonlyArray<SearchablePage>) {
    const index = new Map(pages.map((page) => [pageSearchValue(page), createPageSearchIndex(page)]));
    return (value: string, search: string) => {
        const page = index.get(value);
        return page ? scorePageSearch(page, search) : defaultFilter(value, search) * 0.8;
    };
}

export function createPageSearchIndex(page: SearchablePage) {
    const title = normalizeSearchText(page.title);
    const path = normalizeSearchText(page.sourcePath.replace(/\\/g, "/"));
    const filename = path.split("/").at(-1)?.replace(/\.md$/i, "") ?? "";
    const text = normalizeSearchText(page.text);
    return { title, compactTitle: compactSearchText(title), filename, path, text };
}

export function scorePageSearch(page: ReturnType<typeof createPageSearchIndex>, search: string) {
    const query = normalizeSearchText(search);
    if (!query) return 1;
    const compactQuery = compactSearchText(query);
    const terms = query.split(" ");

    // Keep title matches independent of the size or contents of the document.
    if (page.title === query) return 1;
    if (compactQuery && page.compactTitle === compactQuery) return 0.99;
    if (page.title.startsWith(query)) return 0.95;
    if (page.title.includes(query)) return 0.9;
    if (terms.every((term) => page.title.includes(term))) return 0.85;

    if (page.filename === query) return 0.8;
    if (page.filename.includes(query)) return 0.75;
    if (terms.every((term) => page.path.includes(term))) return 0.7;

    // Fuzzy matching stays limited to titles; long bodies otherwise produce
    // many accidental subsequence matches and slow down each keystroke.
    const titleMatch = defaultFilter(page.title, query);
    if (titleMatch >= 0.1) return 0.5 + titleMatch * 0.1;
    if (terms.every((term) => page.title.includes(term) || page.path.includes(term) || page.text.includes(term))) {
        return 0.3;
    }
    return 0;
}

function normalizeSearchText(value: string) {
    return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function compactSearchText(value: string) {
    return value.replace(/[\s_.\-/]+/g, "");
}
