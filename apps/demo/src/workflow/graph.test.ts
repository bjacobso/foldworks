import { describe, expect, it } from "vitest";

import {
  allNodes,
  canMoveNode,
  deleteNode,
  findFlow,
  insertNewNode,
  moveNode,
  nodeSubtree,
  previewDocumentForDrop,
} from "./graph";
import { layoutWorkflow } from "./layout";
import { initialDocument } from "./model";
import { nodeTypes } from "./node-types";

describe("structured workflow example", () => {
  it("models condition and switch branches as nested flows", () => {
    expect(allNodes(initialDocument).map((node) => node.id)).toEqual([
      "node-start",
      "node-condition",
      "node-switch",
      "node-action",
      "node-end",
    ]);
    expect(findFlow(initialDocument, "flow:condition:then")?.label).toBe("Then");
    expect(findFlow(initialDocument, "flow:switch:default")?.elements[0]?.id)
      .toBe("node-action");
  });

  it("identifies every node and flow carried by a branch owner", () => {
    const subtree = nodeSubtree(initialDocument, "node-condition");
    expect([...(subtree?.nodeIds ?? [])]).toEqual([
      "node-condition",
      "node-switch",
      "node-action",
    ]);
    expect([...(subtree?.flowIds ?? [])]).toEqual([
      "flow:condition:then",
      "flow:condition:else",
      "flow:switch:default",
    ]);
  });

  it("inserts a registered node at a structural flow location", () => {
    const result = insertNewNode(
      initialDocument,
      { flowId: "flow:condition:then", index: 0 },
      "approval",
      9,
    );

    expect(result?.node).toMatchObject({ id: "node-9", type: "approval" });
    expect(
      result === undefined
        ? []
        : findFlow(result.document, "flow:condition:then")?.elements,
    ).toContainEqual(expect.objectContaining({ id: "node-9" }));
  });

  it("moves a node between nested branches", () => {
    const result = moveNode(initialDocument, "node-action", {
      flowId: "flow:condition:then",
      index: 0,
    });

    expect(result === undefined ? [] : findFlow(result, "flow:condition:then")?.elements)
      .toContainEqual(expect.objectContaining({ id: "node-action" }));
    expect(result === undefined ? [] : findFlow(result, "flow:switch:default")?.elements)
      .toHaveLength(0);
  });

  it("moves a branching node with its subtree but never into itself", () => {
    const moved = moveNode(initialDocument, "node-switch", {
      flowId: "flow:condition:then",
      index: 0,
    });
    expect(moved === undefined ? undefined : findFlow(moved, "flow:switch:default"))
      .toBeDefined();

    expect(
      moveNode(initialDocument, "node-switch", {
        flowId: "flow:switch:default",
        index: 1,
      }),
    ).toBeUndefined();
  });

  it("protects boundaries and deletes a registered subtree atomically", () => {
    expect(canMoveNode(initialDocument, "node-start")).toBe(false);
    expect(deleteNode(initialDocument, "node-end")).toBeUndefined();
    const deleted = deleteNode(initialDocument, "node-condition");
    expect(deleted === undefined ? [] : allNodes(deleted).map((node) => node.id))
      .toEqual(["node-start", "node-end"]);
  });

  it("builds a non-mutating drop preview", () => {
    const preview = previewDocumentForDrop(
      initialDocument,
      "palette:approval",
      "flow-target:flow%3Acondition%3Athen:0",
    );

    expect(preview === undefined ? [] : allNodes(preview)).toHaveLength(6);
    expect(allNodes(initialDocument)).toHaveLength(5);
  });

  it("lays out the reference workflow with branches, labels, and no overlaps", () => {
    const layout = layoutWorkflow(initialDocument);
    expect(layout.branchLabels.map((label) => label.text)).toEqual([
      "Then",
      "Else",
      "Default",
    ]);
    expect(layout.insertions).toHaveLength(7);
    expect(layout.connectors.some((connector) => connector.points.length > 2)).toBe(true);

    const nodes = [...layout.nodes.values()];
    for (const [index, first] of nodes.entries()) {
      for (const second of nodes.slice(index + 1)) {
        const overlapWidth = Math.max(
          0,
          Math.min(first.x + first.width, second.x + second.width) -
            Math.max(first.x, second.x),
        );
        const overlapHeight = Math.max(
          0,
          Math.min(first.y + first.height, second.y + second.height) -
            Math.max(first.y, second.y),
        );
        expect(overlapWidth * overlapHeight).toBe(0);
      }
    }
  });

  it("lays out the reference workflow from left to right", () => {
    const layout = layoutWorkflow(initialDocument, "Horizontal");
    const start = layout.nodes.get("node-start");
    const condition = layout.nodes.get("node-condition");
    const end = layout.nodes.get("node-end");

    expect(start?.x).toBeLessThan(condition?.x ?? 0);
    expect(condition?.x).toBeLessThan(end?.x ?? 0);
    expect(layout.branchLabels.map((label) => label.text)).toEqual([
      "Then",
      "Else",
      "Default",
    ]);

    const nodes = [...layout.nodes.values()];
    for (const [index, first] of nodes.entries()) {
      for (const second of nodes.slice(index + 1)) {
        const overlapWidth = Math.max(
          0,
          Math.min(first.x + first.width, second.x + second.width) -
            Math.max(first.x, second.x),
        );
        const overlapHeight = Math.max(
          0,
          Math.min(first.y + first.height, second.y + second.height) -
            Math.max(first.y, second.y),
        );
        expect(overlapWidth * overlapHeight).toBe(0);
      }
    }
  });

  it("lets the consumer registry define topology and dimensions", () => {
    const switchNode = nodeTypes.switch.create("custom-switch");
    expect(switchNode.branches.map((branch) => branch.label)).toEqual(["Default"]);
    expect(nodeTypes.switch.size(switchNode)).toEqual({ width: 252, height: 38 });
  });
});
