import assert from "node:assert/strict";
import test from "node:test";
import { compileFlowLayout } from "../../scripts/docs-flow/layout.mjs";

function workflow(overrides = {}) {
  return {
    version: 1,
    id: "layout-contract",
    kind: "workflow",
    title: "Layout contract",
    direction: "right",
    lanes: [],
    nodes: [
      { id: "start", type: "action", label: "Start" },
      { id: "review", type: "decision", label: "Review" },
      { id: "finish", type: "service", label: "Finish" },
    ],
    edges: [
      { id: "start-review", from: "start", to: "review" },
      { id: "review-finish", from: "review", to: "finish" },
    ],
    ...overrides,
  };
}

function assertFiniteBox(box, label) {
  assert.ok(box, `${label} must have a layout box`);
  for (const field of ["x", "y", "width", "height"]) {
    assert.equal(Number.isFinite(box[field]), true, `${label}.${field} must be finite`);
  }
  assert.ok(box.width > 0, `${label}.width must be positive`);
  assert.ok(box.height > 0, `${label}.height must be positive`);
}

function boxesOverlap(first, second) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

test("compileFlowLayout is deterministic and follows right/down direction", async () => {
  const rightDocument = workflow();
  const firstRight = await compileFlowLayout(rightDocument);
  const secondRight = await compileFlowLayout(structuredClone(rightDocument));

  assert.deepEqual(secondRight, firstRight);
  assert.equal(firstRight.direction, "right");
  assert.ok(firstRight.nodes.start.x < firstRight.nodes.review.x);
  assert.ok(firstRight.nodes.review.x < firstRight.nodes.finish.x);

  const downDocument = workflow({ direction: "down" });
  const firstDown = await compileFlowLayout(downDocument);
  const secondDown = await compileFlowLayout(structuredClone(downDocument));

  assert.deepEqual(secondDown, firstDown);
  assert.equal(firstDown.direction, "down");
  assert.ok(firstDown.nodes.start.y < firstDown.nodes.review.y);
  assert.ok(firstDown.nodes.review.y < firstDown.nodes.finish.y);
});

test("compileFlowLayout respects authored lane order on the cross axis", async () => {
  const lanes = [
    { id: "user", label: "User" },
    { id: "backend", label: "Backend" },
    { id: "external", label: "External" },
  ];
  const nodes = [
    { id: "scan", type: "action", label: "Scan", lane: "user" },
    { id: "validate", type: "service", label: "Validate", lane: "backend" },
    { id: "charge", type: "external", label: "Charge", lane: "external" },
  ];
  const edges = [
    { id: "scan-validate", from: "scan", to: "validate" },
    { id: "validate-charge", from: "validate", to: "charge" },
  ];

  const right = await compileFlowLayout(workflow({ lanes, nodes, edges }));
  assert.ok(right.lanes.user.y < right.lanes.backend.y);
  assert.ok(right.lanes.backend.y < right.lanes.external.y);

  const down = await compileFlowLayout(workflow({ direction: "down", lanes, nodes, edges }));
  assert.ok(down.lanes.user.x < down.lanes.backend.x);
  assert.ok(down.lanes.backend.x < down.lanes.external.x);
});

test("compileFlowLayout handles cycles, self-loops, disconnected nodes, and long labels", async () => {
  const document = workflow({
    nodes: [
      { id: "alpha", type: "action", label: "A".repeat(120) },
      { id: "beta", type: "decision", label: "Beta" },
      { id: "gamma", type: "service", label: "Gamma" },
      { id: "island", type: "note", label: "Disconnected" },
    ],
    edges: [
      { id: "alpha-beta", from: "alpha", to: "beta" },
      { id: "beta-gamma", from: "beta", to: "gamma" },
      { id: "gamma-alpha", from: "gamma", to: "alpha" },
      { id: "beta-self", from: "beta", to: "beta" },
    ],
  });

  const layout = await compileFlowLayout(document);
  assert.deepEqual(Object.keys(layout.nodes).sort(), document.nodes.map((node) => node.id).sort());
  assert.deepEqual(layout.computedNodeIds, document.nodes.map((node) => node.id));

  for (const node of document.nodes) {
    assertFiniteBox(layout.nodes[node.id], `nodes.${node.id}`);
  }

  for (let left = 0; left < document.nodes.length; left += 1) {
    for (let right = left + 1; right < document.nodes.length; right += 1) {
      const leftBox = layout.nodes[document.nodes[left].id];
      const rightBox = layout.nodes[document.nodes[right].id];
      assert.equal(
        boxesOverlap(leftBox, rightBox),
        false,
        `${document.nodes[left].id} and ${document.nodes[right].id} must not overlap`,
      );
    }
  }
});

test("saved positions win while only missing positions are marked computed", async () => {
  const document = workflow({
    nodes: [
      { id: "start", type: "action", label: "Start", position: { x: 910, y: -120 } },
      { id: "review", type: "decision", label: "Review" },
      { id: "finish", type: "service", label: "Finish", position: { x: 1200, y: 360 } },
    ],
  });
  const original = structuredClone(document);

  const layout = await compileFlowLayout(document);

  assert.equal(layout.nodes.start.x, 910);
  assert.equal(layout.nodes.start.y, -120);
  assert.equal(layout.nodes.finish.x, 1200);
  assert.equal(layout.nodes.finish.y, 360);
  assertFiniteBox(layout.nodes.review, "nodes.review");
  assert.deepEqual(layout.computedNodeIds, ["review"]);
  assert.deepEqual(document, original, "layout compilation must not mutate authored positions");
});

test("fully saved layouts preserve every authored position and compute none", async () => {
  const nodes = workflow().nodes.map((node, index) => ({
    ...node,
    position: { x: index * 240, y: index * 80 },
  }));
  const layout = await compileFlowLayout(workflow({ nodes }));

  assert.deepEqual(layout.computedNodeIds, []);
  for (const node of nodes) {
    assert.deepEqual(
      { x: layout.nodes[node.id].x, y: layout.nodes[node.id].y },
      node.position,
    );
  }
});
