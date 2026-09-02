import { Option } from "effect";
import { describe, expect, it } from "vitest";

import { Workflow, flowLocationId } from "@foldworks/workflow";

import { allNodes, findFlow } from "./graph";
import { Message } from "./message";
import { initialModel } from "./model";
import { update } from "./update";

describe("workflow update", () => {
  it("folds a completed Foldkit drag into a nested flow insertion", () => {
    const itemId = "palette:approval";
    const targetId = flowLocationId({ flowId: "flow:condition:then", index: 0 });
    const pressed = update(
      initialModel,
      Message.GotWorkflowMessage({
        message: Workflow.Message.PressedDraggable({
          itemId,
          containerId: "node-palette",
          index: 1,
          screenX: 10,
          screenY: 10,
        }),
      }),
    ).model;
    const moved = update(
      pressed,
      Message.GotWorkflowMessage({
        message: Workflow.Message.MovedPointer({
          screenX: 30,
          screenY: 30,
          clientX: 300,
          clientY: 240,
          maybeDropTarget: Option.some({ containerId: targetId, index: 0 }),
        }),
      }),
    ).model;
    const dropped = update(
      moved,
      Message.GotWorkflowMessage({
        message: Workflow.Message.ReleasedPointer(),
      }),
    ).model;

    expect(allNodes(dropped.document)).toHaveLength(6);
    expect(findFlow(dropped.document, "flow:condition:then")?.elements)
      .toContainEqual(expect.objectContaining({ id: "node-1", type: "approval" }));
    expect(dropped.revision).toBe(1);
    expect(dropped.announcement).toContain("added");
  });

  it("opens the Foldkit dialog when a nested node is selected", () => {
    const selected = update(
      initialModel,
      Message.ClickedNode({ nodeId: "node-action" }),
    ).model;

    expect(Option.getOrUndefined(selected.selectedNodeId)).toBe("node-action");
    expect(selected.inspector.isOpen).toBe(true);
  });
});
