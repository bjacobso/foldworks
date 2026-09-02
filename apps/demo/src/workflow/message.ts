import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest } from "foldkit/navigation";
import { Url } from "foldkit/url";

import { Dialog } from "@foldkit/ui";
import { DataGrid } from "@foldworks/data-grid";
import { FormBuilder } from "@foldworks/form-builder";
import { Workflow } from "@foldworks/workflow";

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  GotDataGridMessage: { message: DataGrid.Message },
  GotFormBuilderMessage: { message: FormBuilder.Message },
  SelectedFormExample: { exampleId: S.Literals(["Simple", "Handoff", "Complex"]) },
  SelectedFormMode: { mode: S.Literals(["Editor", "Preview"]) },
  SelectedFormItem: {
    kind: S.Literals(["Section", "Page", "Field"]),
    id: S.String,
  },
  SelectedFormPage: { pageId: S.String },
  SelectedPreviewActor: { actorId: S.String },
  ClickedAddSection: {},
  ClickedAddPage: { sectionId: S.String },
  ClickedAddField: { pageId: S.String, fieldType: S.String },
  ChangedFormItemTitle: { value: S.String },
  ChangedFormItemDescription: { value: S.String },
  ChangedSectionActor: { actorId: S.String },
  ChangedFieldRequired: { required: S.Boolean },
  ChangedFieldContent: { value: S.String },
  ChangedFieldOptions: { value: S.String },
  ClickedDeleteFormItem: {},
  ChangedFormAnswer: { fieldId: S.String, value: S.String },
  ToggledFormAnswer: { fieldId: S.String },
  ClickedPreviewPrevious: {},
  ClickedPreviewNext: {},
  GotWorkflowMessage: { message: Workflow.Message },
  GotInspectorMessage: { message: Dialog.Message },
  ClickedNode: { nodeId: S.String },
  ClickedQuickAdd: { locationId: S.String },
  ChangedSelectedNodeTitle: { value: S.String },
  ChangedSelectedNodeDescription: { value: S.String },
  ChangedSelectedNodeType: { value: S.String },
  ChangedSelectedNodeSize: { value: S.String },
  ClickedDeleteSelectedNode: {},
  ClickedResetWorkflow: {},
});
export type Message = typeof Message.Type;
