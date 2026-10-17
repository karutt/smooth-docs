import ELK from "elkjs/lib/elk.bundled.js";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 104;
const PORT_SIZE = 1;
const LANE_PADDING = 32;
const LANE_GAP = 32;
const EMPTY_LANE_CROSS_SIZE = NODE_HEIGHT + LANE_PADDING * 2;
const LARGE_GRAPH_NODE_THRESHOLD = 80;
const LARGE_GRAPH_EDGE_THRESHOLD = 120;

const compareIds = (left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);

/**
 * Compile authored flow geometry without changing the input document.
 *
 * Authored node positions always take precedence. ELK computes stable display
 * positions only for nodes whose authored position is missing.
 */
export async function compileFlowLayout(document) {
  const direction = document.direction === "down" ? "down" : "right";
  const authoredNodes = Array.isArray(document.nodes) ? document.nodes : [];
  const authoredEdges = Array.isArray(document.edges) ? document.edges : [];
  const authoredLanes = Array.isArray(document.lanes) ? document.lanes : [];

  assertUniqueIds(authoredNodes, "node");
  assertUniqueIds(authoredEdges, "edge");
  assertUniqueIds(authoredLanes, "lane");

  const nodeIds = new Set(authoredNodes.map((node) => node.id));
  for (const edge of authoredEdges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`Flow edge ${edge.id} refers to an unknown node`);
    }
  }

  const nodes = {};
  if (
    authoredNodes.length >= LARGE_GRAPH_NODE_THRESHOLD ||
    authoredEdges.length >= LARGE_GRAPH_EDGE_THRESHOLD
  ) {
    Object.assign(nodes, createLargeGraphLayout(authoredNodes, authoredLanes, direction));
  } else {
    const elk = new ELK();
    const laidOutGraph = await elk.layout({
      id: "root",
      layoutOptions: createRootLayoutOptions(direction),
      children: [...authoredNodes].sort(compareIds).map((node) => createElkNode(node.id, direction)),
      edges: [...authoredEdges].sort(compareIds).map((edge) => createElkEdge(edge, direction)),
    });

    const elkNodes = new Map((laidOutGraph.children ?? []).map((node) => [node.id, node]));
    for (const node of authoredNodes) {
      const laidOut = elkNodes.get(node.id);
      if (!laidOut) {
        throw new Error(`ELK did not return geometry for node ${node.id}`);
      }
      nodes[node.id] = {
        x: normalizeNumber(laidOut.x),
        y: normalizeNumber(laidOut.y),
        width: normalizePositiveNumber(laidOut.width, NODE_WIDTH),
        height: normalizePositiveNumber(laidOut.height, NODE_HEIGHT),
      };
    }
  }

  const laneFrames = normalizeLaneOrder({
    direction,
    lanes: authoredLanes,
    nodes,
    authoredNodes,
  });

  for (const node of authoredNodes) {
    if (!hasSavedPosition(node)) continue;
    nodes[node.id].x = node.position.x;
    nodes[node.id].y = node.position.y;
  }

  const lanes = finalizeLaneBoxes({
    direction,
    laneFrames,
    lanes: authoredLanes,
    nodes,
    authoredNodes,
  });

  return {
    nodes,
    lanes,
    direction,
    computedNodeIds: authoredNodes
      .filter((node) => !hasSavedPosition(node))
      .map((node) => node.id),
  };
}

function createLargeGraphLayout(authoredNodes, authoredLanes, direction) {
  const nodes = {};
  const laneIds = new Set(authoredLanes.map((lane) => lane.id));
  const groups = new Map(authoredLanes.map((lane) => [lane.id, []]));
  groups.set("", []);
  for (const node of [...authoredNodes].sort(compareIds)) {
    const groupId = node.lane && laneIds.has(node.lane) ? node.lane : "";
    groups.get(groupId).push(node);
  }
  for (const members of groups.values()) {
    members.forEach((node, index) => {
      const primary = LANE_PADDING + index * (NODE_WIDTH + 96);
      nodes[node.id] = direction === "down"
        ? { x: LANE_PADDING, y: primary, width: NODE_WIDTH, height: NODE_HEIGHT }
        : { x: primary, y: LANE_PADDING, width: NODE_WIDTH, height: NODE_HEIGHT };
    });
  }
  return nodes;
}

function createRootLayoutOptions(direction) {
  return {
    "elk.algorithm": "layered",
    "elk.direction": direction === "down" ? "DOWN" : "RIGHT",
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    "elk.padding": "[top=32,left=32,bottom=32,right=32]",
    "elk.portConstraints": "FIXED_SIDE",
    "elk.randomSeed": "1",
    "elk.separateConnectedComponents": "true",
    "elk.spacing.componentComponent": "96",
    "elk.spacing.nodeNode": "64",
    "elk.layered.cycleBreaking.strategy": "GREEDY",
    "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.layered.spacing.edgeNodeBetweenLayers": "48",
    "elk.layered.spacing.nodeNodeBetweenLayers": "96",
  };
}

function createElkNode(id, direction) {
  const inputSide = direction === "down" ? "NORTH" : "WEST";
  const outputSide = direction === "down" ? "SOUTH" : "EAST";

  return {
    id,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    layoutOptions: {
      "elk.portConstraints": "FIXED_SIDE",
    },
    ports: [
      createElkPort(portId(id, "in"), inputSide),
      createElkPort(portId(id, "out"), outputSide),
    ],
  };
}

function createElkPort(id, side) {
  return {
    id,
    width: PORT_SIZE,
    height: PORT_SIZE,
    layoutOptions: {
      "elk.port.side": side,
    },
  };
}

function createElkEdge(edge) {
  return {
    id: edge.id,
    sources: [portId(edge.from, "out")],
    targets: [portId(edge.to, "in")],
  };
}

function portId(nodeId, kind) {
  return `${nodeId}::${kind}`;
}

function normalizeLaneOrder({ direction, lanes, nodes, authoredNodes }) {
  if (lanes.length === 0) return {};

  const crossStart = minimumCoordinate(Object.values(nodes), crossAxis(direction));
  let cursor = crossStart;
  const frames = {};

  for (const lane of lanes) {
    const members = authoredNodes
      .filter((node) => node.lane === lane.id)
      .map((node) => nodes[node.id]);
    const originalBounds = boundsForBoxes(members);
    const crossSpan = originalBounds
      ? crossEnd(originalBounds, direction) - crossCoordinate(originalBounds, direction)
      : 0;
    const crossSize = Math.max(EMPTY_LANE_CROSS_SIZE, crossSpan + LANE_PADDING * 2);
    const originalCross = originalBounds ? crossCoordinate(originalBounds, direction) : cursor;
    const crossOffset = cursor + LANE_PADDING - originalCross;

    for (const node of authoredNodes) {
      if (node.lane !== lane.id || hasSavedPosition(node)) continue;
      const box = nodes[node.id];
      setCrossCoordinate(box, direction, crossCoordinate(box, direction) + crossOffset);
    }

    frames[lane.id] = {
      cross: cursor,
      crossSize,
    };
    cursor += crossSize + LANE_GAP;
  }

  const unassigned = authoredNodes.filter(
    (node) => !node.lane || !lanes.some((lane) => lane.id === node.lane),
  );
  const unassignedBoxes = unassigned.map((node) => nodes[node.id]);
  const unassignedBounds = boundsForBoxes(unassignedBoxes);
  if (unassignedBounds) {
    const offset = cursor - crossCoordinate(unassignedBounds, direction);
    for (const node of unassigned) {
      if (hasSavedPosition(node)) continue;
      const box = nodes[node.id];
      setCrossCoordinate(box, direction, crossCoordinate(box, direction) + offset);
    }
  }

  return frames;
}

function finalizeLaneBoxes({ direction, laneFrames, lanes, nodes, authoredNodes }) {
  if (lanes.length === 0) return {};

  const allBounds = boundsForBoxes(Object.values(nodes));
  const primary = allBounds ? primaryCoordinate(allBounds, direction) - LANE_PADDING : 0;
  const primaryEndValue = allBounds ? primaryEnd(allBounds, direction) + LANE_PADDING : NODE_WIDTH;
  const primarySize = Math.max(NODE_WIDTH, primaryEndValue - primary);
  const result = {};

  for (const lane of lanes) {
    const frame = laneFrames[lane.id];
    const members = authoredNodes
      .filter((node) => node.lane === lane.id)
      .map((node) => nodes[node.id]);
    const memberBounds = boundsForBoxes(members);
    let cross = frame.cross;
    let crossEndValue = frame.cross + frame.crossSize;

    if (memberBounds) {
      cross = Math.min(cross, crossCoordinate(memberBounds, direction) - LANE_PADDING);
      crossEndValue = Math.max(crossEndValue, crossEnd(memberBounds, direction) + LANE_PADDING);
    }

    const laneBox =
      direction === "down"
        ? {
            x: normalizeNumber(cross),
            y: normalizeNumber(primary),
            width: normalizePositiveNumber(crossEndValue - cross, EMPTY_LANE_CROSS_SIZE),
            height: normalizePositiveNumber(primarySize, NODE_HEIGHT),
          }
        : {
            x: normalizeNumber(primary),
            y: normalizeNumber(cross),
            width: normalizePositiveNumber(primarySize, NODE_WIDTH),
            height: normalizePositiveNumber(crossEndValue - cross, EMPTY_LANE_CROSS_SIZE),
          };

    result[lane.id] = laneBox;
  }

  return result;
}

function boundsForBoxes(boxes) {
  if (boxes.length === 0) return null;

  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function minimumCoordinate(boxes, axis) {
  return boxes.length > 0 ? Math.min(...boxes.map((box) => box[axis])) : 0;
}

function primaryCoordinate(box, direction) {
  return direction === "down" ? box.y : box.x;
}

function primaryEnd(box, direction) {
  return direction === "down" ? box.y + box.height : box.x + box.width;
}

function crossCoordinate(box, direction) {
  return direction === "down" ? box.x : box.y;
}

function crossEnd(box, direction) {
  return direction === "down" ? box.x + box.width : box.y + box.height;
}

function crossAxis(direction) {
  return direction === "down" ? "x" : "y";
}

function setCrossCoordinate(box, direction, value) {
  if (direction === "down") {
    box.x = normalizeNumber(value);
  } else {
    box.y = normalizeNumber(value);
  }
}

function hasSavedPosition(node) {
  return (
    node.position !== null &&
    typeof node.position === "object" &&
    Number.isFinite(node.position.x) &&
    Number.isFinite(node.position.y)
  );
}

function normalizeNumber(value) {
  if (!Number.isFinite(value)) return 0;
  const normalized = Math.round(value * 1000) / 1000;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function normalizePositiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? normalizeNumber(value) : fallback;
}

function assertUniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new Error(`Duplicate ${label} ID: ${item.id}`);
    }
    seen.add(item.id);
  }
}
