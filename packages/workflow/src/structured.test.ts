import { describe, expect, it } from "vitest";

import { createStructuredLayout, flowLocationFromId, flowLocationId } from "./layout";
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
  type: "action",
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
  isMovable: (node) => node.anchored !== true,
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
});
