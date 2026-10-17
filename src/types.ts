import type { CompiledFlow } from "./docs-flow/types";
export type * from "./docs-flow/types";

export type SiteKey = string;

export type NavItem = {
  title: string;
  url: string;
  order: number;
  kind?: "folder" | "page";
  sourcePath?: string;
  relativePath?: string;
  system?: "inbox";
  children: NavItem[];
};

export type DocPage = {
  title: string;
  url: string;
  sourcePath: string;
  absolutePath: string;
  markdown: string;
  html: string;
  text: string;
  flows?: Record<string, CompiledFlow>;
  createdAt?: string;
  updatedAt?: string;
  kind?: "page" | "folder" | "inbox";
  folder?: {
    root: string;
    items: Array<{
      kind: "folder" | "page";
      title: string;
      url: string;
      sourcePath?: string;
      folderPath?: string;
      absolutePath: string;
      text: string;
      createdAt?: string;
      updatedAt?: string;
    }>;
  };
  inbox?: {
    root: string;
    items: Array<{
      title: string;
      url: string;
      sourcePath: string;
      absolutePath: string;
      text: string;
      createdAt?: string;
      updatedAt?: string;
    }>;
  };
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
