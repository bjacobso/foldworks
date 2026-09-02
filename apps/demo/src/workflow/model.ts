import { Option, Schema as S } from "effect";

import { Dialog } from "@foldkit/ui";
import { DataGrid } from "@foldworks/data-grid";
import { FormBuilder } from "@foldworks/form-builder";
import { Workflow } from "@foldworks/workflow";
import {
  ContentView,
  FormAnswer,
  FormDocument,
  FormExampleId,
  FormMode,
  FormSelection,
  exampleForms,
} from "../form-builder/model";
import { AppRoute, formStateFromRoute } from "./route";

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

export const Model = S.Struct({
  route: AppRoute,
  document: WorkflowDocument,
  dataGrid: DataGrid.Model,
  formDocument: FormDocument,
  formBuilder: FormBuilder.Model,
  formExampleId: FormExampleId,
  formMode: FormMode,
  selectedFormItem: S.Option(FormSelection),
  activeFormPageId: S.String,
  previewActorId: S.String,
  formAnswers: S.Array(FormAnswer),
  contentViews: S.Array(ContentView),
  nextFormId: S.Number,
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

export const initialModel: Model = {
  route: AppRoute.Workflow(),
  document: initialDocument,
  dataGrid: DataGrid.init({
    id: "people-directory",
    columns: [
      { id: "employee", width: 280 },
      { id: "status", width: 130 },
      { id: "department", width: 170 },
      { id: "role", width: 220 },
      { id: "location", width: 170 },
      { id: "startDate", width: 140 },
      { id: "salary", width: 130 },
    ],
  }),
  formDocument: exampleForms.Handoff,
  formBuilder: FormBuilder.init({
    id: "form-builder-drag-and-drop",
    activationThreshold: 5,
  }),
  formExampleId: "Handoff",
  formMode: "Editor",
  selectedFormItem: Option.none(),
  activeFormPageId: "handoff-about-you",
  previewActorId: "employee",
  formAnswers: [],
  contentViews: [],
  nextFormId: 1,
  workflow: Workflow.init({
    id: "workflow-drag-and-drop",
    activationThreshold: 5,
  }),
  inspector: Dialog.init({ id: "node-inspector", isAnimated: true }),
  selectedNodeId: Option.none(),
  nextId: 1,
  revision: 0,
  announcement: "Workflow builder ready.",
};

export const initialModelForRoute = (route: AppRoute): Model => {
  const { exampleId, mode } = formStateFromRoute(route);
  const formDocument = exampleForms[exampleId];
  return {
    ...initialModel,
    route,
    formDocument,
    formExampleId: exampleId,
    formMode: mode,
    activeFormPageId: formDocument.sections[0]?.pages[0]?.id ?? "",
    previewActorId: formDocument.actors[0]?.id ?? "__journey__",
  };
};
