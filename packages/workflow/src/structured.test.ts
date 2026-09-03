import { describe, expect, it } from "vitest";

import {
  createStructuredLayout,
  flowLocationFromId,
  flowLocationId,
  pathForPoints,
} from "./layout";
import { OutMessage } from "./interaction";
import { defineNodeTypes, paletteItemId, paletteTypeFromId } from "./registry";
import { applyReorder } from "./reorder";
import {
  createStructuredWorkflowOperations,
  type Flow,
  type WorkflowDocument,
} from "./structured";

interface Node {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly anchored?: boolean;
  readonly branches: ReadonlyArray<Flow<Node>>;
}

const leaf = (id: string, anchored = false): Node => ({
  id,
  type: anchored ? "anchored" : "action",
  title: id,
  anchored,
  branches: [],
});

const branch = (id: string, label: string, elements: ReadonlyArray<Node>): Flow<Node> => ({
  id,
  label,
  elements,
});

const condition: Node = {
  id: "condition",
  type: "condition",
  title: "Condition",
  branches: [
    branch("condition:then", "Then", []),
    branch("condition:else", "Else", [leaf("nested")]),
  ],
};

const document: WorkflowDocument<Node> = {
  root: branch("root", "", [leaf("start", true), condition, leaf("end", true)]),
};

const operations = createStructuredWorkflowOperations<Node>({
  action: { movable: true, deletable: true },
  anchored: { movable: false, deletable: false },
  condition: { movable: true, deletable: true },
});

describe("structured workflow primitives", () => {
  it("inserts and deletes elements at structural flow locations", () => {
    const inserted = operations.insertElement(
      document,
      { flowId: "condition:then", index: 0 },
      leaf("inserted"),
    );
    expect(inserted === undefined ? [] : operations.findFlow(inserted, "condition:then")?.elements)
      .toContainEqual(expect.objectContaining({ id: "inserted" }));

    const deleted = inserted === undefined ? undefined : operations.deleteElement(inserted, "inserted");
    expect(deleted === undefined ? undefined : operations.findElement(deleted, "inserted"))
      .toBeUndefined();
  });

  it("moves elements between nested flows and rejects moves into descendants", () => {
    const moved = operations.moveElement(document, "nested", { flowId: "root", index: 2 });
    expect(moved?.root.elements.map((node) => node.id)).toEqual([
      "start",
      "condition",
      "nested",
      "end",
    ]);

    expect(
      operations.moveElement(document, "condition", {
        flowId: "condition:else",
        index: 0,
      }),
    ).toBeUndefined();
  });

  it("keeps anchored elements in place", () => {
    expect(operations.moveElement(document, "start", { flowId: "root", index: 2 }))
      .toBeUndefined();
    expect(operations.deleteElement(document, "end")).toBeUndefined();
  });

  it("round-trips location ids", () => {
    const location = { flowId: "condition:then", index: 2 };
    expect(flowLocationFromId(flowLocationId(location))).toEqual(location);
  });

  it("rejects malformed flow location ids", () => {
    expect(flowLocationFromId("flow-target:missing-index")).toBeUndefined();
    expect(flowLocationFromId("flow-target:%E0%A4%A:1")).toBeUndefined();
    expect(flowLocationFromId("flow-target:root:-1")).toBeUndefined();
  });

  it("returns undefined when updating an unknown element", () => {
    expect(operations.updateElement(document, "missing", (node) => ({
      ...node,
      title: "Updated",
    }))).toBeUndefined();
  });

  it("draws two-point paths and compacts collinear intermediate points", () => {
    expect(pathForPoints([{ x: 0, y: 0 }, { x: 0, y: 20 }]))
      .toBe("M 0 0 L 0 20");
    expect(pathForPoints([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 0, y: 20 },
      { x: 20, y: 20 },
    ], 0)).toBe("M 0 0 L 0 20 Q 0 20 0 20 L 20 20");
  });

  it("round-trips palette ids and applies a palette reorder", () => {
    expect(paletteTypeFromId(paletteItemId("custom:type"))).toBe("custom:type");
    const inserted = applyReorder({
      document,
      reordered: OutMessage.Reordered({
        itemId: paletteItemId("action"),
        fromContainerId: "palette",
        fromIndex: 0,
        toContainerId: flowLocationId({ flowId: "condition:then", index: 0 }),
        toIndex: 0,
      }),
      operations,
      createFromPalette: (type) => type === "action" ? leaf("created") : undefined,
    });

    expect(inserted?._tag).toBe("Inserted");
    expect(inserted === undefined
      ? undefined
      : operations.findFlow(inserted.document, "condition:then")?.elements[0]?.id)
      .toBe("created");
  });

  it("defaults registry movement policies to true", () => {
    const registry = defineNodeTypes({
      action: {
        create: (id: string) => leaf(id),
        size: () => ({ width: 100, height: 40 }),
        render: undefined,
      },
    });

    expect(registry.action).toMatchObject({ movable: true, deletable: true });
  });

  it("lays out branches with orthogonal connectors and insertion targets", () => {
    const layout = createStructuredLayout<Node>({
      nodeSize: () => ({ width: 250, height: 64 }),
    })(document);
    const conditionNode = layout.nodes.get("condition");
    const nestedNode = layout.nodes.get("nested");

    expect(conditionNode).toBeDefined();
    expect(nestedNode?.x).not.toBe(conditionNode?.x);
    expect(layout.branchLabels.map((label) => label.text)).toEqual(["Then", "Else"]);
    expect(layout.insertions.map((target) => target.location.flowId))
      .toContain("condition:then");
    expect(layout.connectors.some((connector) => connector.points.length > 2)).toBe(true);
  });

  it("transposes the structured layout for horizontal workflows", () => {
    const vertical = createStructuredLayout<Node>({
      nodeSize: () => ({ width: 250, height: 64 }),
      minimumWidth: 720,
      minimumHeight: 620,
    })(document);
    const horizontal = createStructuredLayout<Node>({
      nodeSize: () => ({ width: 250, height: 64 }),
      orientation: "Horizontal",
      minimumWidth: 720,
      minimumHeight: 620,
    })(document);
    const verticalStart = vertical.nodes.get("start");
    const verticalCondition = vertical.nodes.get("condition");
    const horizontalStart = horizontal.nodes.get("start");
    const horizontalCondition = horizontal.nodes.get("condition");

    expect(verticalStart?.y).toBeLessThan(verticalCondition?.y ?? 0);
    expect(horizontalStart?.x).toBeLessThan(horizontalCondition?.x ?? 0);
    expect(horizontalStart).toMatchObject({ width: 250, height: 64 });
    expect(horizontal.width).toBeGreaterThan(horizontal.height);
    expect(horizontal.insertions).toHaveLength(vertical.insertions.length);
    expect(horizontal.branchLabels.map((label) => label.text))
      .toEqual(vertical.branchLabels.map((label) => label.text));
  });
});
