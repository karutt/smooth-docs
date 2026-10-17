import * as React from "react";
import type {
    FlowDiagnostic,
    FlowDocument,
    FlowEdge,
    FlowLane,
    FlowLink,
    FlowNode,
    FlowPosition,
    FlowStoryStep,
} from "#smooth-docs/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlowEditorAction } from "./flow-editor-reducer";

export type DocsFlowInspectorTarget =
    | { kind: "node"; mode: "add" | "edit"; id?: string }
    | { kind: "edge"; mode: "add" | "edit"; id?: string }
    | { kind: "lane"; mode: "add" | "edit"; id?: string };

export type DocsFlowInspectorEditorProps = {
    mode?: "edit";
    document: FlowDocument;
    target: DocsFlowInspectorTarget;
    diagnostics?: FlowDiagnostic[];
    onCommand: (command: FlowEditorAction) => void;
    onCancel: () => void;
    onAnnounce?: (message: string) => void;
    className?: string;
};

export type DocsFlowInspectorReaderProps = {
    mode: "read";
    document: FlowDocument;
    nodeId: string;
    onSelectNode?: (nodeId: string) => void;
    onFocusUpstream?: (nodeId: string) => void;
    onFocusDownstream?: (nodeId: string) => void;
    onRestoreAll?: () => void;
    className?: string;
};

export type DocsFlowInspectorProps =
    | DocsFlowInspectorEditorProps
    | DocsFlowInspectorReaderProps;

export type DocsFlowStoriesEditorProps = {
    document: FlowDocument;
    onCommand: (command: FlowEditorAction) => void;
    onAnnounce?: (message: string) => void;
};

type EntityKind = DocsFlowInspectorTarget["kind"];

const fieldClassName =
    "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const labelClassName = "block text-sm font-medium text-foreground";

function compactString(value: FormDataEntryValue | null) {
    const text = String(value ?? "").trim();
    return text || undefined;
}

function diagnosticMatchesField(
    diagnostic: FlowDiagnostic,
    kind: EntityKind,
    entityId: string | undefined,
    fieldPath: string,
) {
    if (entityId && diagnostic.subjectId && diagnostic.subjectId !== entityId) return false;
    const path = diagnostic.path ?? "";
    const collection = kind === "node" ? "nodes" : kind === "edge" ? "edges" : "lanes";
    return (
        path === fieldPath ||
        path.endsWith(`.${fieldPath}`) ||
        path.includes(`${collection}[`) && path.includes(`].${fieldPath}`)
    );
}

function FieldDiagnostics({
    diagnostics,
    id,
}: {
    diagnostics: FlowDiagnostic[];
    id: string;
}) {
    if (diagnostics.length === 0) return null;
    return (
        <ul className="mt-1 space-y-1 text-xs text-destructive" id={id}>
            {diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code}-${index}`}>{diagnostic.message}</li>
            ))}
        </ul>
    );
}

function Field({
    children,
    diagnostics,
    fieldPath,
    id,
    kind,
    label,
    entityId,
}: {
    children: (accessibility: {
        id: string;
        describedBy: string | undefined;
        invalid: boolean;
    }) => React.ReactNode;
    diagnostics: FlowDiagnostic[];
    fieldPath: string;
    id: string;
    kind: EntityKind;
    label: string;
    entityId?: string;
}) {
    const matching = diagnostics.filter((diagnostic) =>
        diagnosticMatchesField(diagnostic, kind, entityId, fieldPath),
    );
    const messagesId = matching.length > 0 ? `${id}-diagnostics` : undefined;
    return (
        <div>
            <label className={labelClassName} htmlFor={id}>
                {label}
            </label>
            {children({ id, describedBy: messagesId, invalid: matching.length > 0 })}
            {messagesId ? <FieldDiagnostics diagnostics={matching} id={messagesId} /> : null}
        </div>
    );
}

function InputField({
    defaultValue,
    diagnostics,
    entityId,
    fieldPath,
    formPrefix,
    kind,
    label,
    max,
    maxLength,
    min,
    name,
    required,
    step,
    type = "text",
}: {
    defaultValue?: string | number;
    diagnostics: FlowDiagnostic[];
    entityId?: string;
    fieldPath: string;
    formPrefix: string;
    kind: EntityKind;
    label: string;
    max?: number;
    maxLength?: number;
    min?: number;
    name: string;
    required?: boolean;
    step?: number | "any";
    type?: React.HTMLInputTypeAttribute;
}) {
    const id = `${formPrefix}-${name}`;
    return (
        <Field
            diagnostics={diagnostics}
            entityId={entityId}
            fieldPath={fieldPath}
            id={id}
            kind={kind}
            label={label}
        >
            {({ describedBy, id: inputId, invalid }) => (
                <input
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    className={fieldClassName}
                    defaultValue={defaultValue}
                    id={inputId}
                    max={max}
                    maxLength={maxLength}
                    min={min}
                    name={name}
                    required={required}
                    step={step}
                    type={type}
                />
            )}
        </Field>
    );
}

function TextareaField({
    defaultValue,
    diagnostics,
    entityId,
    fieldPath,
    formPrefix,
    kind,
    label,
    maxLength,
    name,
}: {
    defaultValue?: string;
    diagnostics: FlowDiagnostic[];
    entityId?: string;
    fieldPath: string;
    formPrefix: string;
    kind: EntityKind;
    label: string;
    maxLength: number;
    name: string;
}) {
    const id = `${formPrefix}-${name}`;
    return (
        <Field
            diagnostics={diagnostics}
            entityId={entityId}
            fieldPath={fieldPath}
            id={id}
            kind={kind}
            label={label}
        >
            {({ describedBy, id: inputId, invalid }) => (
                <textarea
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    className={cn(fieldClassName, "min-h-24 resize-y")}
                    defaultValue={defaultValue}
                    id={inputId}
                    maxLength={maxLength}
                    name={name}
                />
            )}
        </Field>
    );
}

function SelectField({
    children,
    defaultValue,
    diagnostics,
    entityId,
    fieldPath,
    formPrefix,
    kind,
    label,
    name,
}: {
    children: React.ReactNode;
    defaultValue?: string;
    diagnostics: FlowDiagnostic[];
    entityId?: string;
    fieldPath: string;
    formPrefix: string;
    kind: EntityKind;
    label: string;
    name: string;
}) {
    const id = `${formPrefix}-${name}`;
    return (
        <Field
            diagnostics={diagnostics}
            entityId={entityId}
            fieldPath={fieldPath}
            id={id}
            kind={kind}
            label={label}
        >
            {({ describedBy, id: selectId, invalid }) => (
                <select
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    className={fieldClassName}
                    defaultValue={defaultValue}
                    id={selectId}
                    name={name}
                >
                    {children}
                </select>
            )}
        </Field>
    );
}

function FormActions({ cancelLabel, submitLabel, onCancel }: {
    cancelLabel: string;
    submitLabel: string;
    onCancel: () => void;
}) {
    return (
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button onClick={onCancel} type="button" variant="ghost">
                {cancelLabel}
            </Button>
            <Button type="submit">{submitLabel}</Button>
        </div>
    );
}

function LinkFields({
    diagnostics,
    formPrefix,
    links,
    nodeId,
}: {
    diagnostics: FlowDiagnostic[];
    formPrefix: string;
    links: FlowLink[];
    nodeId?: string;
}) {
    const keyPrefix = React.useId().replace(/:/g, "");
    const nextKey = React.useRef(links.length);
    const [items, setItems] = React.useState(() =>
        links.map((link, index) => ({ key: `${keyPrefix}-${index}`, link: { ...link } })),
    );

    return (
        <fieldset className="rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">Links</legend>
            <div className="space-y-4">
                {items.map((item, index) => (
                    <fieldset className="rounded-md border bg-muted/20 p-3" key={item.key}>
                        <legend className="px-1 text-xs font-medium">Link {index + 1}</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field
                                diagnostics={diagnostics}
                                entityId={nodeId}
                                fieldPath={`links[${index}].kind`}
                                id={`${formPrefix}-link-${index}-kind`}
                                kind="node"
                                label={`Link ${index + 1} kind`}
                            >
                                {({ describedBy, id, invalid }) => (
                                    <select
                                        aria-describedby={describedBy}
                                        aria-invalid={invalid || undefined}
                                        className={fieldClassName}
                                        defaultValue={item.link.kind}
                                        id={id}
                                        name={`link-${index}-kind`}
                                    >
                                        <option value="docs">Documentation</option>
                                        <option value="source">Source</option>
                                        <option value="external">External</option>
                                    </select>
                                )}
                            </Field>
                            <Field
                                diagnostics={diagnostics}
                                entityId={nodeId}
                                fieldPath={`links[${index}].label`}
                                id={`${formPrefix}-link-${index}-label`}
                                kind="node"
                                label={`Link ${index + 1} label`}
                            >
                                {({ describedBy, id, invalid }) => (
                                    <input
                                        aria-describedby={describedBy}
                                        aria-invalid={invalid || undefined}
                                        className={fieldClassName}
                                        defaultValue={item.link.label}
                                        id={id}
                                        maxLength={120}
                                        name={`link-${index}-label`}
                                    />
                                )}
                            </Field>
                            <div className="sm:col-span-2">
                                <Field
                                    diagnostics={diagnostics}
                                    entityId={nodeId}
                                    fieldPath={`links[${index}].href`}
                                    id={`${formPrefix}-link-${index}-href`}
                                    kind="node"
                                    label={`Link ${index + 1} URL or path`}
                                >
                                    {({ describedBy, id, invalid }) => (
                                        <input
                                            aria-describedby={describedBy}
                                            aria-invalid={invalid || undefined}
                                            className={fieldClassName}
                                            defaultValue={item.link.href}
                                            id={id}
                                            maxLength={2048}
                                            name={`link-${index}-href`}
                                            required
                                        />
                                    )}
                                </Field>
                            </div>
                        </div>
                        <Button
                            className="mt-3"
                            onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            Remove link {index + 1}
                        </Button>
                    </fieldset>
                ))}
            </div>
            <Button
                className="mt-3"
                disabled={items.length >= 16}
                onClick={() => {
                    const key = `${keyPrefix}-${nextKey.current}`;
                    nextKey.current += 1;
                    setItems((current) => [
                        ...current,
                        { key, link: { kind: "docs", href: "" } },
                    ]);
                }}
                size="sm"
                type="button"
                variant="outline"
            >
                Add link
            </Button>
            <input name="link-count" type="hidden" value={items.length} />
        </fieldset>
    );
}

function linksFromForm(formData: FormData): FlowLink[] | undefined {
    const count = Number(formData.get("link-count") ?? 0);
    const links = Array.from({ length: count }, (_, index) => {
        const kind = String(formData.get(`link-${index}-kind`) ?? "docs") as FlowLink["kind"];
        const href = String(formData.get(`link-${index}-href`) ?? "").trim();
        const label = compactString(formData.get(`link-${index}-label`));
        return { kind, href, ...(label ? { label } : {}) };
    }).filter((link) => link.href.length > 0);
    return links.length > 0 ? links : undefined;
}

function NodeForm({
    diagnostics,
    document,
    node,
    mode,
    onCancel,
    onCommand,
    onAnnounce,
}: {
    diagnostics: FlowDiagnostic[];
    document: FlowDocument;
    node?: FlowNode;
    mode: "add" | "edit";
    onCancel: () => void;
    onCommand: (command: FlowEditorAction) => void;
    onAnnounce?: (message: string) => void;
}) {
    const reactId = React.useId().replace(/:/g, "");
    const formPrefix = `docs-flow-node-${reactId}`;
    const formLabel = mode === "add" ? "Add node" : `Edit node ${node?.label ?? ""}`;
    const [hasPosition, setHasPosition] = React.useState(Boolean(node?.position));

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const links = linksFromForm(data);
        const changes: Omit<FlowNode, "id" | "position"> = {
            type: String(data.get("node-type")) as FlowNode["type"],
            label: String(data.get("node-label") ?? "").trim(),
            description: compactString(data.get("node-description")),
            lane: compactString(data.get("node-lane")),
            owner: compactString(data.get("node-owner")),
            status: compactString(data.get("node-status")),
            risk: compactString(data.get("node-risk")) as FlowNode["risk"],
            links,
        };

        if (mode === "add") {
            const position = hasPosition
                ? {
                      x: Number(data.get("position-x")),
                      y: Number(data.get("position-y")),
                  }
                : undefined;
            onCommand({ type: "node/add", node: { ...changes, position } });
            onAnnounce?.(`Node ${changes.label} created.`);
        } else if (node) {
            onCommand({ type: "node/update", id: node.id, changes });
            if (hasPosition) {
                const position: FlowPosition = {
                    x: Number(data.get("position-x")),
                    y: Number(data.get("position-y")),
                };
                if (position.x !== node.position?.x || position.y !== node.position?.y) {
                    onCommand({ type: "node/move", id: node.id, position });
                }
            }
            onAnnounce?.("Node updated.");
        }
        onCancel();
    };

    return (
        <form
            aria-label={formLabel}
            className="space-y-4 rounded-xl border bg-card p-4 text-card-foreground"
            onSubmit={submit}
        >
            <h3 className="text-lg font-semibold">{formLabel}</h3>
            {mode === "edit" && node ? (
                <p className="text-xs text-muted-foreground">Stable ID: {node.id}</p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                    defaultValue={node?.type ?? "action"}
                    diagnostics={diagnostics}
                    entityId={node?.id}
                    fieldPath="type"
                    formPrefix={formPrefix}
                    kind="node"
                    label="Node type"
                    name="node-type"
                >
                    <option value="action">Action</option>
                    <option value="decision">Decision</option>
                    <option value="service">Service</option>
                    <option value="external">External system</option>
                    <option value="note">Note</option>
                </SelectField>
                <SelectField
                    defaultValue={node?.lane ?? ""}
                    diagnostics={diagnostics}
                    entityId={node?.id}
                    fieldPath="lane"
                    formPrefix={formPrefix}
                    kind="node"
                    label="Lane"
                    name="node-lane"
                >
                    <option value="">Unassigned</option>
                    {(document.lanes ?? []).map((lane) => (
                        <option key={lane.id} value={lane.id}>{lane.label}</option>
                    ))}
                </SelectField>
            </div>
            <InputField
                defaultValue={node?.label}
                diagnostics={diagnostics}
                entityId={node?.id}
                fieldPath="label"
                formPrefix={formPrefix}
                kind="node"
                label="Node label"
                maxLength={120}
                name="node-label"
                required
            />
            <TextareaField
                defaultValue={node?.description}
                diagnostics={diagnostics}
                entityId={node?.id}
                fieldPath="description"
                formPrefix={formPrefix}
                kind="node"
                label="Node description"
                maxLength={2000}
                name="node-description"
            />
            <div className="grid gap-4 sm:grid-cols-3">
                <InputField
                    defaultValue={node?.owner}
                    diagnostics={diagnostics}
                    entityId={node?.id}
                    fieldPath="owner"
                    formPrefix={formPrefix}
                    kind="node"
                    label="Owner"
                    maxLength={120}
                    name="node-owner"
                />
                <InputField
                    defaultValue={node?.status}
                    diagnostics={diagnostics}
                    entityId={node?.id}
                    fieldPath="status"
                    formPrefix={formPrefix}
                    kind="node"
                    label="Status"
                    maxLength={64}
                    name="node-status"
                />
                <SelectField
                    defaultValue={node?.risk ?? ""}
                    diagnostics={diagnostics}
                    entityId={node?.id}
                    fieldPath="risk"
                    formPrefix={formPrefix}
                    kind="node"
                    label="Risk"
                    name="node-risk"
                >
                    <option value="">Not set</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                </SelectField>
            </div>
            <fieldset className="rounded-lg border p-3">
                <legend className="px-1 text-sm font-semibold">Authored position</legend>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        checked={hasPosition}
                        className="size-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onChange={(event) => setHasPosition(event.currentTarget.checked)}
                        type="checkbox"
                    />
                    Save an explicit node position
                </label>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <InputField
                        defaultValue={node?.position?.x ?? 0}
                        diagnostics={diagnostics}
                        entityId={node?.id}
                        fieldPath="position.x"
                        formPrefix={formPrefix}
                        kind="node"
                        label="Position X"
                        max={1_000_000}
                        min={-1_000_000}
                        name="position-x"
                        step="any"
                        type="number"
                    />
                    <InputField
                        defaultValue={node?.position?.y ?? 0}
                        diagnostics={diagnostics}
                        entityId={node?.id}
                        fieldPath="position.y"
                        formPrefix={formPrefix}
                        kind="node"
                        label="Position Y"
                        max={1_000_000}
                        min={-1_000_000}
                        name="position-y"
                        step="any"
                        type="number"
                    />
                </div>
            </fieldset>
            <LinkFields
                diagnostics={diagnostics}
                formPrefix={formPrefix}
                links={node?.links ?? []}
                nodeId={node?.id}
            />
            <FormActions
                cancelLabel="Cancel node editing"
                onCancel={onCancel}
                submitLabel={mode === "add" ? "Create node" : "Apply node changes"}
            />
        </form>
    );
}

function EdgeForm({
    diagnostics,
    document,
    edge,
    mode,
    onCancel,
    onCommand,
    onAnnounce,
}: {
    diagnostics: FlowDiagnostic[];
    document: FlowDocument;
    edge?: FlowEdge;
    mode: "add" | "edit";
    onCancel: () => void;
    onCommand: (command: FlowEditorAction) => void;
    onAnnounce?: (message: string) => void;
}) {
    const reactId = React.useId().replace(/:/g, "");
    const formPrefix = `docs-flow-edge-${reactId}`;
    const edgeName = edge?.label || (edge ? `${edge.from} to ${edge.to}` : "");
    const formLabel = mode === "add" ? "Add connection" : `Edit connection ${edgeName}`;

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const changes: Omit<FlowEdge, "id"> = {
            from: String(data.get("edge-from")),
            to: String(data.get("edge-to")),
            label: compactString(data.get("edge-label")),
            style: String(data.get("edge-style")) as FlowEdge["style"],
        };
        if (mode === "add") {
            onCommand({ type: "edge/add", edge: changes });
            onAnnounce?.("Connection created.");
        } else if (edge) {
            onCommand({ type: "edge/update", id: edge.id, changes });
            onAnnounce?.("Connection updated.");
        }
        onCancel();
    };

    return (
        <form
            aria-label={formLabel}
            className="space-y-4 rounded-xl border bg-card p-4 text-card-foreground"
            onSubmit={submit}
        >
            <h3 className="text-lg font-semibold">{formLabel}</h3>
            {mode === "edit" && edge ? (
                <p className="text-xs text-muted-foreground">Stable ID: {edge.id}</p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                    defaultValue={edge?.from ?? document.nodes[0]?.id}
                    diagnostics={diagnostics}
                    entityId={edge?.id}
                    fieldPath="from"
                    formPrefix={formPrefix}
                    kind="edge"
                    label="Source node"
                    name="edge-from"
                >
                    {document.nodes.map((node) => (
                        <option key={node.id} value={node.id}>{node.label} (source)</option>
                    ))}
                </SelectField>
                <SelectField
                    defaultValue={edge?.to ?? document.nodes[0]?.id}
                    diagnostics={diagnostics}
                    entityId={edge?.id}
                    fieldPath="to"
                    formPrefix={formPrefix}
                    kind="edge"
                    label="Target node"
                    name="edge-to"
                >
                    {document.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
                </SelectField>
            </div>
            <InputField
                defaultValue={edge?.label}
                diagnostics={diagnostics}
                entityId={edge?.id}
                fieldPath="label"
                formPrefix={formPrefix}
                kind="edge"
                label="Connection label"
                maxLength={160}
                name="edge-label"
            />
            <SelectField
                defaultValue={edge?.style ?? "normal"}
                diagnostics={diagnostics}
                entityId={edge?.id}
                fieldPath="style"
                formPrefix={formPrefix}
                kind="edge"
                label="Connection meaning"
                name="edge-style"
            >
                <option value="normal">Normal</option>
                <option value="error">Error path</option>
                <option value="async">Asynchronous</option>
            </SelectField>
            <FormActions
                cancelLabel="Cancel connection editing"
                onCancel={onCancel}
                submitLabel={mode === "add" ? "Create connection" : "Apply connection changes"}
            />
        </form>
    );
}

function LaneForm({
    diagnostics,
    lane,
    mode,
    onCancel,
    onCommand,
    onAnnounce,
}: {
    diagnostics: FlowDiagnostic[];
    lane?: FlowLane;
    mode: "add" | "edit";
    onCancel: () => void;
    onCommand: (command: FlowEditorAction) => void;
    onAnnounce?: (message: string) => void;
}) {
    const reactId = React.useId().replace(/:/g, "");
    const formPrefix = `docs-flow-lane-${reactId}`;
    const formLabel = mode === "add" ? "Add lane" : `Edit lane ${lane?.label ?? ""}`;

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const changes: Omit<FlowLane, "id"> = {
            label: String(data.get("lane-label") ?? "").trim(),
            description: compactString(data.get("lane-description")),
        };
        if (mode === "add") {
            onCommand({ type: "lane/add", lane: changes });
            onAnnounce?.(`Lane ${changes.label} created.`);
        } else if (lane) {
            onCommand({ type: "lane/update", id: lane.id, changes });
            onAnnounce?.("Lane updated.");
        }
        onCancel();
    };

    return (
        <form
            aria-label={formLabel}
            className="space-y-4 rounded-xl border bg-card p-4 text-card-foreground"
            onSubmit={submit}
        >
            <h3 className="text-lg font-semibold">{formLabel}</h3>
            {mode === "edit" && lane ? (
                <p className="text-xs text-muted-foreground">Stable ID: {lane.id}</p>
            ) : null}
            <InputField
                defaultValue={lane?.label}
                diagnostics={diagnostics}
                entityId={lane?.id}
                fieldPath="label"
                formPrefix={formPrefix}
                kind="lane"
                label="Lane label"
                maxLength={120}
                name="lane-label"
                required
            />
            <TextareaField
                defaultValue={lane?.description}
                diagnostics={diagnostics}
                entityId={lane?.id}
                fieldPath="description"
                formPrefix={formPrefix}
                kind="lane"
                label="Lane description"
                maxLength={1000}
                name="lane-description"
            />
            <FormActions
                cancelLabel="Cancel lane editing"
                onCancel={onCancel}
                submitLabel={mode === "add" ? "Create lane" : "Apply lane changes"}
            />
        </form>
    );
}

const READ_EDGE_STYLE_LABELS: Record<NonNullable<FlowEdge["style"]>, string> = {
    normal: "Normal",
    error: "Error path",
    async: "Asynchronous",
};

function safeReaderHref(link: FlowLink) {
    const href = link.href;
    if (
        typeof href !== "string" ||
        href.length === 0 ||
        href.trim() !== href ||
        /[\u0000-\u001f\u007f]/.test(href) ||
        href.startsWith("//") ||
        href.startsWith("\\") ||
        /^[A-Za-z]:/.test(href) ||
        /^\/(?:Users|home|private|var\/folders)\//.test(href)
    ) {
        return null;
    }
    const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(href)?.[1]?.toLowerCase();
    if (scheme && scheme !== "http" && scheme !== "https") return null;
    if (link.kind === "external" && !scheme) return null;
    if (link.kind === "source" && href.startsWith("/") && !scheme) return null;
    return href;
}

function ReaderLinks({ links }: { links?: FlowLink[] }) {
    const safeLinks = (links ?? []).flatMap((link) => {
        const href = safeReaderHref(link);
        return href ? [{ link, href }] : [];
    });
    if (safeLinks.length === 0) return null;

    return (
        <section className="mt-4" aria-label="Related links">
            <h4 className="text-sm font-semibold">Related links</h4>
            <ul className="mt-2 space-y-1">
                {safeLinks.map(({ link, href }, index) => (
                    <li key={`${link.kind}-${href}-${index}`}>
                        <a
                            className="break-all text-sm text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            href={href}
                            rel={link.kind === "external" ? "noreferrer" : undefined}
                            target={link.kind === "external" ? "_blank" : undefined}
                        >
                            {link.label || href}
                        </a>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function RelationshipList({
    direction,
    document,
    edges,
    onSelectNode,
}: {
    direction: "incoming" | "outgoing";
    document: FlowDocument;
    edges: FlowEdge[];
    onSelectNode?: (nodeId: string) => void;
}) {
    const nodes = new Map(document.nodes.map((node) => [node.id, node]));
    const label = direction === "incoming" ? "Incoming connections" : "Outgoing connections";

    return (
        <section>
            <h4 className="text-sm font-semibold">{label}</h4>
            {edges.length > 0 ? (
                <ul aria-label={label} className="mt-2 space-y-2">
                    {edges.map((edge) => {
                        const relatedId = direction === "incoming" ? edge.from : edge.to;
                        const relatedLabel = nodes.get(relatedId)?.label ?? relatedId;
                        return (
                            <li className="rounded-md border bg-muted/20 p-3 text-sm" key={edge.id}>
                                {onSelectNode ? (
                                    <button
                                        className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        onClick={() => onSelectNode(relatedId)}
                                        type="button"
                                    >
                                        {relatedLabel}
                                    </button>
                                ) : (
                                    <span className="font-medium">{relatedLabel}</span>
                                )}
                                {edge.label ? <span> — {edge.label}</span> : null}
                                <span className="ml-2 text-muted-foreground">
                                    ({READ_EDGE_STYLE_LABELS[edge.style ?? "normal"]})
                                </span>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="mt-2 text-sm text-muted-foreground">None.</p>
            )}
        </section>
    );
}

function ReaderInspector({
    className,
    document,
    nodeId,
    onFocusDownstream,
    onFocusUpstream,
    onRestoreAll,
    onSelectNode,
}: DocsFlowInspectorReaderProps) {
    const node = document.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return null;

    const incoming = document.edges.filter((edge) => edge.to === node.id);
    const outgoing = document.edges.filter((edge) => edge.from === node.id);
    const laneLabel = (document.lanes ?? []).find((lane) => lane.id === node.lane)?.label;
    const metadata = [
        ["Type", node.type],
        laneLabel ? ["Lane", laneLabel] : null,
        node.owner ? ["Owner", node.owner] : null,
        node.status ? ["Status", node.status] : null,
        node.risk ? ["Risk", node.risk] : null,
        node.position ? ["Position", `${node.position.x}, ${node.position.y}`] : null,
    ].filter((entry): entry is [string, string] => entry !== null);

    return (
        <aside
            aria-label={`Node details: ${node.label}`}
            className={cn("mt-5 rounded-xl border bg-card p-4 text-card-foreground", className)}
            role="region"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="break-words text-lg font-semibold">{node.label}</h3>
                    {node.description ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                            {node.description}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                    {onFocusUpstream ? (
                        <Button onClick={() => onFocusUpstream(node.id)} size="sm" type="button" variant="outline">
                            Focus upstream
                        </Button>
                    ) : null}
                    {onFocusDownstream ? (
                        <Button onClick={() => onFocusDownstream(node.id)} size="sm" type="button" variant="outline">
                            Focus downstream
                        </Button>
                    ) : null}
                    {onRestoreAll ? (
                        <Button onClick={onRestoreAll} size="sm" type="button" variant="ghost">
                            Show whole graph
                        </Button>
                    ) : null}
                </div>
            </div>
            <dl className="mt-4 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                {metadata.map(([term, value]) => (
                    <React.Fragment key={term}>
                        <dt className="font-medium">{term}</dt>
                        <dd className="break-words text-muted-foreground">{value}</dd>
                    </React.Fragment>
                ))}
            </dl>
            <ReaderLinks links={node.links} />
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <RelationshipList
                    direction="incoming"
                    document={document}
                    edges={incoming}
                    onSelectNode={onSelectNode}
                />
                <RelationshipList
                    direction="outgoing"
                    document={document}
                    edges={outgoing}
                    onSelectNode={onSelectNode}
                />
            </div>
        </aside>
    );
}

function EditorInspector({
    className,
    diagnostics = [],
    document,
    onAnnounce,
    onCancel,
    onCommand,
    target,
}: DocsFlowInspectorEditorProps) {
    const missingMessage = `The selected ${target.kind} is no longer available.`;
    const common = { diagnostics, mode: target.mode, onAnnounce, onCancel, onCommand };

    let form: React.ReactNode;
    if (target.kind === "node") {
        const node = target.mode === "edit"
            ? document.nodes.find((candidate) => candidate.id === target.id)
            : undefined;
        form = target.mode === "edit" && !node
            ? <p role="alert">{missingMessage}</p>
            : <NodeForm {...common} document={document} node={node} />;
    } else if (target.kind === "edge") {
        const edge = target.mode === "edit"
            ? document.edges.find((candidate) => candidate.id === target.id)
            : undefined;
        form = target.mode === "edit" && !edge
            ? <p role="alert">{missingMessage}</p>
            : <EdgeForm {...common} document={document} edge={edge} />;
    } else {
        const lane = target.mode === "edit"
            ? (document.lanes ?? []).find((candidate) => candidate.id === target.id)
            : undefined;
        form = target.mode === "edit" && !lane
            ? <p role="alert">{missingMessage}</p>
            : <LaneForm {...common} lane={lane} />;
    }

    return (
        <aside aria-label="Flow properties" className={cn("mt-5", className)}>
            {form}
        </aside>
    );
}

export function DocsFlowInspector(props: DocsFlowInspectorProps) {
    if (props.mode === "read") return <ReaderInspector {...props} />;
    return <EditorInspector {...props} />;
}

export function DocsFlowStoriesEditor({
    document,
    onAnnounce,
    onCommand,
}: DocsFlowStoriesEditorProps) {
    const stories = document.stories ?? [];
    const firstStep: FlowStoryStep | undefined = document.nodes[0]
        ? { node: document.nodes[0].id }
        : document.edges[0]
          ? { edge: document.edges[0].id }
          : undefined;

    return (
        <section aria-label="Story editing" className="space-y-4 rounded-xl border bg-card p-4">
            <div>
                <h3 className="text-lg font-semibold">Named stories</h3>
                <p className="text-sm text-muted-foreground">
                    Maintain ordered node and connection steps for guided playback.
                </p>
            </div>
            <form
                aria-label="Add story"
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!firstStep) return;
                    const data = new FormData(event.currentTarget);
                    const label = String(data.get("story-label") ?? "").trim();
                    if (!label) return;
                    onCommand({ type: "story/add", story: { label, steps: [firstStep] } });
                    event.currentTarget.reset();
                    onAnnounce?.(`Story ${label} created.`);
                }}
            >
                <label className="min-w-52 flex-1 text-sm font-medium">
                    Story label
                    <input className={fieldClassName} maxLength={120} name="story-label" required />
                </label>
                <Button disabled={!firstStep || stories.length >= 32} size="sm" type="submit">
                    Add story
                </Button>
            </form>

            {stories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No named stories yet.</p>
            ) : (
                <ol className="space-y-4">
                    {stories.map((story, storyIndex) => (
                        <li className="rounded-lg border p-3" key={story.id}>
                            <form
                                aria-label={`Edit story ${story.label}`}
                                className="grid gap-3 sm:grid-cols-2"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    const data = new FormData(event.currentTarget);
                                    onCommand({
                                        type: "story/update",
                                        id: story.id,
                                        changes: {
                                            label: String(data.get("label") ?? "").trim(),
                                            description: compactString(data.get("description")),
                                        },
                                    });
                                    onAnnounce?.("Story updated.");
                                }}
                            >
                                <label className={labelClassName}>
                                    Label
                                    <input className={fieldClassName} defaultValue={story.label} maxLength={120} name="label" required />
                                </label>
                                <label className={labelClassName}>
                                    Description
                                    <input className={fieldClassName} defaultValue={story.description} maxLength={500} name="description" />
                                </label>
                                <div className="flex flex-wrap gap-2 sm:col-span-2">
                                    <Button size="sm" type="submit" variant="outline">Save story details</Button>
                                    <Button
                                        aria-label={`Move story ${story.label} earlier`}
                                        disabled={storyIndex === 0}
                                        onClick={() => onCommand({ type: "story/reorder", id: story.id, toIndex: storyIndex - 1 })}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                    >Move earlier</Button>
                                    <Button
                                        aria-label={`Move story ${story.label} later`}
                                        disabled={storyIndex === stories.length - 1}
                                        onClick={() => onCommand({ type: "story/reorder", id: story.id, toIndex: storyIndex + 1 })}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                    >Move later</Button>
                                    <Button
                                        aria-label={`Delete story ${story.label}`}
                                        onClick={() => {
                                            onCommand({ type: "story/delete", id: story.id });
                                            onAnnounce?.(`Story ${story.label} deleted.`);
                                        }}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                    >Delete story</Button>
                                </div>
                            </form>

                            <ol aria-label={`${story.label} steps`} className="mt-3 space-y-2">
                                {story.steps.map((step, stepIndex) => (
                                    <li className="flex flex-wrap items-center gap-2 text-sm" key={`${story.id}-${stepIndex}`}>
                                        <span className="min-w-8 font-medium">{stepIndex + 1}.</span>
                                        <span className="min-w-44 flex-1">{storyStepLabel(document, step)}</span>
                                        <Button
                                            aria-label={`Move step ${stepIndex + 1} earlier`}
                                            disabled={stepIndex === 0}
                                            onClick={() => onCommand({ type: "story/step/reorder", storyId: story.id, fromIndex: stepIndex, toIndex: stepIndex - 1 })}
                                            size="sm"
                                            type="button"
                                            variant="ghost"
                                        >Earlier</Button>
                                        <Button
                                            aria-label={`Move step ${stepIndex + 1} later`}
                                            disabled={stepIndex === story.steps.length - 1}
                                            onClick={() => onCommand({ type: "story/step/reorder", storyId: story.id, fromIndex: stepIndex, toIndex: stepIndex + 1 })}
                                            size="sm"
                                            type="button"
                                            variant="ghost"
                                        >Later</Button>
                                        <Button
                                            aria-label={`Delete step ${stepIndex + 1}`}
                                            disabled={story.steps.length <= 1}
                                            onClick={() => onCommand({ type: "story/step/delete", storyId: story.id, index: stepIndex })}
                                            size="sm"
                                            type="button"
                                            variant="ghost"
                                        >Delete</Button>
                                    </li>
                                ))}
                            </ol>
                            <form
                                aria-label={`Add step to ${story.label}`}
                                className="mt-3 flex flex-wrap items-end gap-2"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    const value = String(new FormData(event.currentTarget).get("step") ?? "");
                                    const step = parseStoryStep(value);
                                    if (!step) return;
                                    onCommand({ type: "story/step/add", storyId: story.id, step });
                                    onAnnounce?.(`Step added to ${story.label}.`);
                                }}
                            >
                                <label className="min-w-52 flex-1 text-sm font-medium">
                                    Node or connection
                                    <select className={fieldClassName} name="step">
                                        {document.nodes.map((node) => <option key={`node:${node.id}`} value={`node:${node.id}`}>Node: {node.label}</option>)}
                                        {document.edges.map((edge) => <option key={`edge:${edge.id}`} value={`edge:${edge.id}`}>Connection: {edge.label || `${edge.from} → ${edge.to}`}</option>)}
                                    </select>
                                </label>
                                <Button disabled={story.steps.length >= 300} size="sm" type="submit" variant="outline">Add step</Button>
                            </form>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

function parseStoryStep(value: string): FlowStoryStep | undefined {
    if (value.startsWith("node:")) return { node: value.slice(5) };
    if (value.startsWith("edge:")) return { edge: value.slice(5) };
    return undefined;
}

function storyStepLabel(document: FlowDocument, step: FlowStoryStep) {
    if ("node" in step) {
        return `Node: ${document.nodes.find((node) => node.id === step.node)?.label ?? step.node}`;
    }
    const edge = document.edges.find((candidate) => candidate.id === step.edge);
    return `Connection: ${edge?.label || edge?.id || step.edge}`;
}

export default DocsFlowInspector;
