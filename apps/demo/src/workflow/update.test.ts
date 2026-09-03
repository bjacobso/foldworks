import { Option } from "effect";
import { describe, expect, it } from "vitest";

import { Workflow, flowLocationId } from "@foldworks/workflow";
import { findField } from "@foldworks/form-builder";

import { allNodes, findFlow, findNode } from "./graph";
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

  it("undoes and redoes workflow document edits", () => {
    const locationId = flowLocationId({ flowId: "flow:root", index: 1 });
    const added = update(initialModel, Message.ClickedQuickAdd({ locationId })).model;
    expect(allNodes(added.document)).toHaveLength(6);
    expect(added.workflowHistory.past).toHaveLength(1);

    const undone = update(added, Message.ClickedUndo({ editor: "Workflow" })).model;
    expect(allNodes(undone.document)).toHaveLength(5);
    expect(undone.workflowHistory.future).toHaveLength(1);

    const redone = update(undone, Message.ClickedRedo({ editor: "Workflow" })).model;
    expect(allNodes(redone.document)).toHaveLength(6);
  });

  it("coalesces consecutive workflow text edits", () => {
    const selected = update(initialModel, Message.ClickedNode({ nodeId: "node-action" })).model;
    const first = update(selected, Message.ChangedSelectedNodeTitle({ value: "Run" })).model;
    const second = update(first, Message.ChangedSelectedNodeTitle({ value: "Run checks" })).model;
    expect(second.workflowHistory.past).toHaveLength(1);

    const undone = update(second, Message.ClickedUndo({ editor: "Workflow" })).model;
    expect(findNode(undone.document, "node-action")?.data.title).toBe("Action");
  });

  it("coalesces form text edits and keeps each example draft independent", () => {
    const selected = update(
      initialModel,
      Message.SelectedFormItem({ kind: "Field", id: "handoff-name" }),
    ).model;
    const first = update(selected, Message.ChangedFormItemTitle({ value: "Legal name" })).model;
    const second = update(first, Message.ChangedFormItemTitle({ value: "Full legal name" })).model;
    expect(second.formHistory.past).toHaveLength(1);
    expect(second.formDocuments.Handoff).toBe(second.formDocument);
    expect(second.formDocuments.Simple).toBe(initialModel.formDocuments.Simple);

    const undone = update(second, Message.ClickedUndo({ editor: "Form" })).model;
    expect(findField(undone.formDocument, "handoff-name")?.label).toBe("Preferred name");
  });
});
