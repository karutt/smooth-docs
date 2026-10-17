export type DocsNavigation = {
    site: string;
    pagePath: string;
    search: string;
    hash: string;
};

export function resolveDocsNavigation(
    href: string,
    currentUrl: string,
    currentSite: string,
    pagesBySite: Readonly<Record<string, ReadonlySet<string>>>,
): DocsNavigation | null {
    let url: URL;
    let current: URL;
    try {
        current = new URL(currentUrl);
        url = new URL(href, current);
    } catch {
        return null;
    }

    if (url.origin !== current.origin || !/^https?:$/.test(url.protocol)) return null;
    // Let the browser handle jumps within the current document.
    if (url.hash && url.pathname === current.pathname && url.search === current.search) return null;

    const pathname = normalizeDocsPath(url.pathname.split("/").map((segment) => {
        try {
            return decodeURIComponent(segment);
        } catch {
            return segment;
        }
    }).join("/"));
    const [prefix, ...rest] = pathname.slice(1).split("/");
    const prefixed = Object.hasOwn(pagesBySite, prefix);
    const site = prefixed ? prefix : currentSite;
    const pagePath = prefixed ? normalizeDocsPath(`/${rest.join("/")}`) : pathname;
    if (!pagesBySite[site]?.has(pagePath)) return null;

    return { site, pagePath, search: url.search, hash: url.hash };
}

function normalizeDocsPath(pathname: string) {
    const clean = pathname.replace(/\/index\.html$/, "/");
    return clean.endsWith("/") ? clean : `${clean}/`;
}
