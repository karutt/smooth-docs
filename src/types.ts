export type SiteKey = string;

export type NavItem = {
  title: string;
  url: string;
  order: number;
  children: NavItem[];
};

export type DocPage = {
  title: string;
  url: string;
  sourcePath: string;
  markdown: string;
  html: string;
  text: string;
};

export type DocsData = {
  site: SiteKey;
  siteTitle: string;
  oppositeSite: SiteKey;
  devPorts: Record<SiteKey, number>;
  pages: DocPage[];
  nav: NavItem[];
};

export type AllDocsData = Record<SiteKey, DocsData>;
