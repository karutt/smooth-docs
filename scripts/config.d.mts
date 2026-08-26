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

export type SmoothDocsThemeConfig = {
  name?: string;
  path?: string;
  extends?: string;
};

export type SmoothDocsPublishConfig = {
  enabled: boolean;
  outDir: string;
  outDirPath: string;
  root: string | null;
  rootDir: string | null;
  themeConfig: SmoothDocsThemeConfig | null;
};

export type SmoothDocsConfig = {
  kitRoot: string;
  projectDir: string;
  configPath: string | null;
  configuredDocsDir: string;
  docsDir: string;
  siteKey: string;
  siteName: string;
  devPort: number;
  navIgnore: string[];
  publish: SmoothDocsPublishConfig;
  generatedSiteDir: string;
  generatedAllDir: string;
  theme: SmoothDocsTheme;
};

export const DEFAULT_NAV_IGNORE_PATTERNS: string[];

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
  sourceDir: string;
  cssFile: string | null;
  jsFile: string | null;
  publicDir: string | null;
}>;

export function updateSmoothDocsTheme(projectDir: string, themeName: string): string;
