export type FlowDevApiRequest = {
  method?: string;
  url?: string;
  protocol?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: string | Buffer;
};

export type FlowDevApiResponse = {
  status: number;
  body: unknown;
};

export type FlowDevApiGeneratedContent = {
  docsDataBySite: Record<string, unknown>;
  generatedAt: number;
};

export function createFlowDevApiHandler(options: {
  docsRoot: string;
  siteKey?: string;
  protocol?: string;
  maxRequestBytes?: number;
  maxSourceBytes?: number;
  atomicWrite?: (
    targetPath: string,
    content: string | Uint8Array,
    options?: Record<string, unknown>,
  ) => Promise<void>;
  regenerate?: () => Promise<FlowDevApiGeneratedContent>;
  broadcast?: (content: FlowDevApiGeneratedContent) => void | Promise<void>;
  markSilentDocsFile?: (file: string) => void;
}): (request: FlowDevApiRequest) => Promise<FlowDevApiResponse>;

export const FLOW_DEV_API_REQUEST_LIMIT: number;
export const FLOW_DEV_API_SOURCE_LIMIT: number;
