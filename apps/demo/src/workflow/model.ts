import { Option, Schema as S } from "effect";

import { Dialog } from "@foldkit/ui";
import { History } from "@foldworks/history";
import { Workflow } from "@foldworks/workflow";
import { nextWorkflowId } from "../document-ids";
import type { WorkflowOrientation } from "../app/route";

export const NodeKind = S.Literals([
  "start",
  "action",
  "approval",
  "condition",
  "delay",
  "switch",
  "end",
]);
export type NodeKind = typeof NodeKind.Type;

export const NodeSize = S.Literals(["compact", "default", "wide"]);
export type NodeSize = typeof NodeSize.Type;

export const NodeData = S.Struct({
  title: S.String,
  description: S.String,
  size: NodeSize,
});
export type NodeData = typeof NodeData.Type;

export interface WorkflowNode {
  readonly id: string;
  readonly type: NodeKind;
  readonly data: NodeData;
  readonly branches: ReadonlyArray<WorkflowFlow>;
}

export interface WorkflowFlow {
  readonly id: string;
  readonly label: string;
  readonly elements: ReadonlyArray<WorkflowNode>;
}

export const WorkflowNode = S.Struct({
  id: S.String,
  type: NodeKind,
  data: NodeData,
  branches: S.Array(
    S.Struct({
      id: S.String,
      label: S.String,
      elements: S.Array(
        S.suspend((): S.Codec<WorkflowNode> => WorkflowNode),
      ),
    }),
  ),
});

export const WorkflowDocument = S.Struct({
  root: S.Struct({
    id: S.String,
    label: S.String,
    elements: S.Array(WorkflowNode),
  }),
});
export type WorkflowDocument = typeof WorkflowDocument.Type;

export const WorkflowHistory = History.Schema(WorkflowDocument);

export const Model = S.Struct({
  document: WorkflowDocument,
  workflowHistory: WorkflowHistory,
  workflow: Workflow.Model,
  inspector: Dialog.Model,
  selectedNodeId: S.Option(S.String),
  nextId: S.Number,
  revision: S.Number,
  announcement: S.String,
});
export type Model = typeof Model.Type;

const node = (
  id: string,
  type: NodeKind,
  title: string,
  description: string,
  size: NodeSize,
  branches: ReadonlyArray<WorkflowFlow> = [],
): WorkflowNode => ({
  id,
  type,
  data: { title, description, size },
  branches,
});

export const initialDocument: WorkflowDocument = {
  root: {
    id: "flow:root",
    label: "",
    elements: [
      node("node-start", "start", "Start", "There is no text", "default"),
      node(
        "node-condition",
        "condition",
        "Condition",
        "There is no text",
        "default",
        [
          { id: "flow:condition:then", label: "Then", elements: [] },
          {
            id: "flow:condition:else",
            label: "Else",
            elements: [
              node(
                "node-switch",
                "switch",
                "Switch",
                "",
                "compact",
                [
                  {
                    id: "flow:switch:default",
                    label: "Default",
                    elements: [
                      node(
                        "node-action",
                        "action",
                        "Action",
                        "There is no text",
                        "default",
                      ),
                    ],
                  },
                ],
              ),
            ],
          },
        ],
      ),
      node("node-end", "end", "End", "There is no text", "default"),
    ],
  },
};

export const init = (
  document: WorkflowDocument = initialDocument,
  orientation: WorkflowOrientation = "Vertical",
): Model => ({
  document,
  workflowHistory: History.init<WorkflowDocument>(),
  workflow: Workflow.init({
    id: "workflow-drag-and-drop",
    orientation,
  }),
  inspector: Dialog.init({ id: "node-inspector", isAnimated: true }),
  selectedNodeId: Option.none(),
  nextId: nextWorkflowId(document),
  revision: 0,
  announcement: "Workflow builder ready.",
});

export const initialModel: Model = init();
