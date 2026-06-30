export type SmoothDocsTheme = {
  name: string;
  root: string;
  title: string;
  sourceDir: string;
  cssFile: string | null;
  jsFile: string | null;
  publicDir: string | null;
  extends?: string;
};

export type SmoothDocsConfig = {
  kitRoot: string;
  projectDir: string;
  configPath: string | null;
  docsDir: string;
  siteKey: string;
  siteName: string;
  theme: SmoothDocsTheme;
};

export function loadSmoothDocsConfig(options?: {
  kitRoot?: string;
  projectDir?: string;
}): SmoothDocsConfig;

export function findConfigPath(projectDir: string): string | null;

export function listThemes(kitRoot: string): Array<{
  name: string;
  root: string;
  title: string;
  extends?: string;
}>;
