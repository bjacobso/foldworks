import { Option } from "effect";
import { describe, expect, it } from "vitest";

import {
  Workflow,
  flowContainerId,
  flowIdFromContainerId,
  flowLocationId,
} from "@foldworks/workflow";
import { allNodes, findFlow, findNode } from "./graph";
import { Message } from "./message";
import { init, initialModel, type WorkflowDocument, type WorkflowNode } from "./model";
import { update } from "./update";

describe("workflow update", () => {
  it("moves a node with keyboard pickup, ArrowDown, and drop", () => {
    const action = (id: string): WorkflowNode => ({
      id,
      type: "action",
      data: { title: id, description: "", size: "default" },
      branches: [],
    });
    const document: WorkflowDocument = {
      root: {
        id: "flow:root",
        label: "",
        elements: [action("first"), action("second"), action("third")],
      },
    };
    const sourceContainer = flowContainerId(document.root.id);
    const pickedUp = update(
      init(document),
      Message.GotWorkflowMessage({
        message: Workflow.Message.ActivatedKeyboardDrag({
          itemId: "first",
          containerId: sourceContainer,
          index: 0,
        }),
      }),
    ).model;
    const arrowed = update(
      pickedUp,
      Message.GotWorkflowMessage({
        message: Workflow.Message.PressedArrowKey({ direction: "Down" }),
      }),
    );
    expect(arrowed.commands).toHaveLength(1);

    const resolved = update(
      arrowed.model,
      Message.GotWorkflowMessage({
        message: Workflow.Message.CompletedResolveKeyboardMove({
          targetContainerId: sourceContainer,
          targetIndex: 1,
        }),
      }),
    ).model;
    const childDrop = Workflow.update(
      resolved.workflow,
      Workflow.Message.ConfirmedKeyboardDrop(),
    ).outMessage;
    expect(childDrop?._tag).toBe("Reordered");
    if (childDrop?._tag !== "Reordered") throw new Error("Expected a reorder");
    expect(flowIdFromContainerId(childDrop.toContainerId)).toBe("flow:root");

    const dropped = update(
      resolved,
      Message.GotWorkflowMessage({
        message: Workflow.Message.ConfirmedKeyboardDrop(),
      }),
    ).model;
    expect(dropped.document.root.elements.map((node) => node.id)).toEqual([
      "second",
      "first",
      "third",
    ]);
  });

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

  it("undoes and redoes workflow document edits", () => {
    const locationId = flowLocationId({ flowId: "flow:root", index: 1 });
    const added = update(initialModel, Message.ClickedQuickAdd({ locationId })).model;
    expect(allNodes(added.document)).toHaveLength(6);
    expect(added.workflowHistory.past).toHaveLength(1);

    const undone = update(added, Message.ClickedUndo()).model;
    expect(allNodes(undone.document)).toHaveLength(5);
    expect(undone.workflowHistory.future).toHaveLength(1);

    const redone = update(undone, Message.ClickedRedo()).model;
    expect(allNodes(redone.document)).toHaveLength(6);
  });

  it("coalesces consecutive workflow text edits", () => {
    const selected = update(initialModel, Message.ClickedNode({ nodeId: "node-action" })).model;
    const first = update(selected, Message.ChangedSelectedNodeTitle({ value: "Run" })).model;
    const second = update(first, Message.ChangedSelectedNodeTitle({ value: "Run checks" })).model;
    expect(second.workflowHistory.past).toHaveLength(1);

    const undone = update(second, Message.ClickedUndo()).model;
    expect(findNode(undone.document, "node-action")?.data.title).toBe("Action");
  });

});
