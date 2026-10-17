import type {
  CompiledFlowLayout,
  ExternalFlowReference,
  FlowDiagnostic,
  FlowDocument,
} from "../../src/docs-flow/types";

export class DocsFlowFileError extends Error {
  code: string;
}

export class DocsFlowSourceError extends Error {
  code: string;
}

export const MAX_FLOW_SOURCE_BYTES: number;

export function validateFlowDocument(
  value: unknown,
  options?: Record<string, unknown>,
): { ok: boolean; document?: FlowDocument; diagnostics: FlowDiagnostic[] };

export function parseFlowYaml(
  source: string,
  options?: Record<string, unknown>,
): {
  ok: boolean;
  kind?: "document" | "reference" | "invalid";
  document?: FlowDocument;
  reference?: ExternalFlowReference;
  diagnostics: FlowDiagnostic[];
  sourceText: string;
  editable: boolean;
};

export type ParsedMarkdownFlow = {
  kind: "document" | "reference" | "invalid";
  document?: FlowDocument;
  reference?: ExternalFlowReference;
  diagnostics: FlowDiagnostic[];
  sourceText: string;
  editable: boolean;
  startLine: number;
  endLine: number;
  bodyStart: number;
  bodyEnd: number;
  flowId?: string;
};

export function parseFlowMarkdown(
  markdown: string,
  options?: Record<string, unknown>,
): { embeds: ParsedMarkdownFlow[]; diagnostics: FlowDiagnostic[] };

export function compileFlowLayout(document: FlowDocument): Promise<CompiledFlowLayout>;

export function resolveExternalFlowPath(options: {
  docsRoot: string;
  pagePath: string;
  src: string;
  publishRoot?: string;
}): Promise<string>;

export function readFileBounded(
  filePath: string,
  options?: { maxBytes?: number; encoding?: BufferEncoding },
): Promise<string | Buffer>;

export function atomicWriteFile(
  targetPath: string,
  content: string | Uint8Array,
  options?: Record<string, unknown>,
): Promise<void>;

export function withTargetWriteQueue<T>(
  targetPath: string,
  operation: () => Promise<T>,
): Promise<T>;

export const withTargetQueue: typeof withTargetWriteQueue;

export type InlineFlowSource = {
  flowId: string;
  body: string;
  bodyStart: number;
  bodyEnd: number;
  fenceStart: number;
  fenceEnd: number;
  marker: "`" | "~";
  markerLength: number;
};

export function findInlineFlowSource(markdown: string, flowId: string): InlineFlowSource;
export function reconcileFlowYaml(currentBody: string, candidate: FlowDocument): string;
export function spliceInlineFlowSource(
  markdown: string,
  source: InlineFlowSource,
  nextBody: string,
): string;
export function createInlineFlowRevision(options: {
  pageSourcePath: string;
  flowId: string;
  body: string;
}): string;
export function prepareInlineFlowSave(options: {
  markdown: string;
  pageSourcePath: string;
  flowId: string;
  candidateDocument: FlowDocument;
}): {
  changed: boolean;
  markdown: string;
  body: string;
  revision: string;
  document: FlowDocument;
};
