import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import type { FlowDocument } from "#smooth-docs/types";
// @ts-expect-error -- the runtime layout module is exercised directly to avoid loading Node-only parser I/O in jsdom.
import { compileFlowLayout } from "../../scripts/docs-flow/layout.mjs";
import { projectFlowToReactFlow } from "@/components/docs-flow/DocsFlowCanvas";

const MAX_GENERATION_AND_LAYOUT_MS = 2_000;
const MAX_INTERACTION_PROJECTION_MS = 200;

function maximumDocument(): FlowDocument {
  const lanes = Array.from({ length: 32 }, (_, index) => ({
    id: `lane-${index + 1}`,
    label: `Lane ${index + 1}`,
  }));
  const nodes: FlowDocument["nodes"] = Array.from({ length: 100 }, (_, index) => ({
    id: `node-${index + 1}`,
    type: (["action", "decision", "service", "external", "note"] as const)[index % 5],
    label: `Maximum node ${index + 1}`,
    description: `Performance fixture node ${index + 1}`,
    lane: lanes[index % lanes.length].id,
  }));
  const chain: FlowDocument["edges"] = Array.from({ length: 99 }, (_, index) => ({
    id: `chain-${index + 1}`,
    from: nodes[index].id,
    to: nodes[index + 1].id,
  }));
  const cross: FlowDocument["edges"] = Array.from({ length: 51 }, (_, index) => ({
    id: `cross-${index + 1}`,
    from: nodes[index].id,
    to: nodes[(index + 17) % nodes.length].id,
    label: `Cross ${index + 1}`,
  }));
  const edges = [...chain, ...cross];
  const stories: NonNullable<FlowDocument["stories"]> = Array.from(
    { length: 32 },
    (_, index) => ({
      id: `story-${index + 1}`,
      label: `Story ${index + 1}`,
      steps: [
        { node: edges[index].from },
        { edge: edges[index].id },
        { node: edges[index].to },
      ],
    }),
  );
  return {
    version: 1,
    id: "maximum-performance-fixture",
    kind: "workflow",
    title: "Maximum performance fixture",
    direction: "right",
    lanes,
    nodes,
    edges,
    stories,
  };
}

describe("DocsFlow maximum-scale performance", () => {
  it("parses, validates, and lays out every collection maximum within two seconds", async () => {
    const document = maximumDocument();
    const source = stringify(document);
    const generationStart = performance.now();
    const parsed = parse(source) as FlowDocument;
    const generationMs = performance.now() - generationStart;
    expect(parsed.nodes).toHaveLength(100);
    expect(parsed.edges).toHaveLength(150);

    const layoutStart = performance.now();
    const firstLayout = await compileFlowLayout(document);
    const layoutMs = performance.now() - layoutStart;
    const secondLayout = await compileFlowLayout(document);

    expect(generationMs).toBeLessThan(MAX_GENERATION_AND_LAYOUT_MS);
    expect(layoutMs).toBeLessThan(MAX_GENERATION_AND_LAYOUT_MS);
    expect(secondLayout).toEqual(firstLayout);
  });

  it("projects search, selection, focus, and story feedback within 200 milliseconds", async () => {
    const document = maximumDocument();
    const layout = await compileFlowLayout(document);
    const projectionStart = performance.now();
    const projection = projectFlowToReactFlow(document, layout, {
      selectedNodeId: "node-100",
      searchMatchNodeIds: ["node-96"],
      focusedNodeIds: document.nodes.slice(40, 100).map((node) => node.id),
      focusedEdgeIds: document.edges.slice(40, 150).map((edge) => edge.id),
      storyActiveNodeIds: ["node-1", "node-2"],
      storyActiveEdgeIds: ["chain-1"],
    });
    const projectionMs = performance.now() - projectionStart;

    expect(projection.nodes).toHaveLength(132);
    expect(projection.edges).toHaveLength(150);
    expect(projectionMs).toBeLessThan(MAX_INTERACTION_PROJECTION_MS);
  });
});
