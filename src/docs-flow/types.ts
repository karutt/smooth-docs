export type FlowId = string;

export type FlowDirection = "right" | "down";
export type FlowNodeType = "action" | "decision" | "service" | "external" | "note";
export type FlowEdgeStyle = "normal" | "error" | "async";
export type FlowRisk = "low" | "medium" | "high" | "critical";
export type FlowLinkKind = "docs" | "source" | "external";

export type FlowPosition = {
  x: number;
  y: number;
};

export type FlowLink = {
  kind: FlowLinkKind;
  href: string;
  label?: string;
};

export type FlowLane = {
  id: FlowId;
  label: string;
  description?: string;
};

export type FlowNode = {
  id: FlowId;
  type: FlowNodeType;
  label: string;
  description?: string;
  lane?: FlowId;
  owner?: string;
  status?: string;
  risk?: FlowRisk;
  links?: FlowLink[];
  position?: FlowPosition;
};

export type FlowEdge = {
  id: FlowId;
  from: FlowId;
  to: FlowId;
  label?: string;
  style?: FlowEdgeStyle;
};

export type FlowStoryStep = { node: FlowId } | { edge: FlowId };

export type FlowStory = {
  id: FlowId;
  label: string;
  description?: string;
  steps: FlowStoryStep[];
};

export type FlowDocument = {
  version: 1;
  id: FlowId;
  kind: "workflow";
  title: string;
  description?: string;
  direction: FlowDirection;
  lanes?: FlowLane[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  stories?: FlowStory[];
};

export type ExternalFlowReference = {
  src: string;
  view?: FlowId;
  height?: number;
};

export type FlowDiagnosticSeverity = "error" | "warning";

export type FlowDiagnostic = {
  code: string;
  severity: FlowDiagnosticSeverity;
  message: string;
  path?: string;
  line?: number;
  column?: number;
  subjectId?: FlowId;
  supportedFixes?: string[];
};

export type FlowLayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CompiledFlowLayout = {
  direction: FlowDirection;
  nodes: Record<FlowId, FlowLayoutBox>;
  lanes: Record<FlowId, FlowLayoutBox>;
  computedNodeIds: FlowId[];
};

export type CompiledFlowView = {
  story?: FlowId;
  height: number;
};

export type FlowSourceReference = {
  kind: "inline" | "external";
  pageSourcePath: string;
  flowId: FlowId;
  reference?: string;
  revision: string;
  editable: boolean;
};

export type CompiledFlow = {
  embedId: string;
  document?: FlowDocument;
  view: CompiledFlowView;
  layout?: CompiledFlowLayout;
  diagnostics: FlowDiagnostic[];
  fallbackText?: string;
  searchText: string;
  source?: FlowSourceReference;
};

export type FlowConflictSnapshot = {
  currentRevision: string;
  currentDocument?: FlowDocument;
  diagnostics: FlowDiagnostic[];
};

export type FlowEditorStatus =
  | "closed"
  | "loading"
  | "clean"
  | "dirty"
  | "saving"
  | "conflict"
  | "error";

export type FlowEditorSession = {
  status: FlowEditorStatus;
  baseDocument: FlowDocument;
  draftDocument: FlowDocument;
  baseRevision: string;
  undo: FlowDocument[];
  redo: FlowDocument[];
  diagnostics: FlowDiagnostic[];
  conflict?: FlowConflictSnapshot;
};

export type FlowFocusMode = "all" | "upstream" | "downstream" | "story";

export type FlowViewState = {
  selectedNodeId?: FlowId;
  selectedEdgeId?: FlowId;
  searchQuery: string;
  searchMatchIndex: number;
  focusMode: FlowFocusMode;
  selectedStoryId?: FlowId;
  playbackIndex: number;
  linearView: boolean;
};
