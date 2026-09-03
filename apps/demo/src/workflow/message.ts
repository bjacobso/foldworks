import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest } from "foldkit/navigation";
import { Url } from "foldkit/url";

import { Dialog } from "@foldkit/ui";
import { DataGrid } from "@foldworks/data-grid";
import { FormBuilder } from "@foldworks/form-builder";
import { Workflow } from "@foldworks/workflow";
import { ThemePreference } from "../theme";
import { WorkflowOrientation } from "./route";

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  CompletedApplyThemePreference: {},
  CompletedPersistWorkspace: { succeeded: S.Boolean },
  CompletedExportDocument: { editor: S.Literals(["Workflow", "Form"]) },
  CompletedImportDocument: {
    editor: S.Literals(["Workflow", "Form"]),
    json: S.String,
  },
  CancelledImportDocument: { editor: S.Literals(["Workflow", "Form"]) },
  FailedImportDocument: {
    editor: S.Literals(["Workflow", "Form"]),
    reason: S.String,
  },
  ClickedUndo: { editor: S.Literals(["Workflow", "Form"]) },
  ClickedRedo: { editor: S.Literals(["Workflow", "Form"]) },
  ClickedExportDocument: { editor: S.Literals(["Workflow", "Form"]) },
  ClickedImportDocument: { editor: S.Literals(["Workflow", "Form"]) },
  ChangedSystemTheme: { isDark: S.Boolean },
  SelectedThemePreference: { preference: ThemePreference },
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
  ClickedResetForm: {},
  ChangedFormAnswer: { fieldId: S.String, value: S.String },
  ToggledFormAnswer: { fieldId: S.String },
  ClickedPreviewPrevious: {},
  ClickedPreviewNext: {},
  GotWorkflowMessage: { message: Workflow.Message },
  SelectedWorkflowOrientation: { orientation: WorkflowOrientation },
  GotInspectorMessage: { message: Dialog.Message },
  ClickedNode: { nodeId: S.String },
  ClickedQuickAdd: { locationId: S.String },
  ChangedSelectedNodeTitle: { value: S.String },
  ChangedSelectedNodeDescription: { value: S.String },
  ChangedSelectedNodeType: { value: S.String },
  ChangedSelectedNodeSize: { value: S.String },
  ClickedDeleteSelectedNode: {},
  ClickedResetWorkflow: {},
  ChangedUiKitName: { value: S.String },
  ChangedUiKitNotes: { value: S.String },
  SelectedUiKitDepartment: {
    value: S.Literals(["Engineering", "Operations", "People"]),
  },
  SelectedUiKitView: {
    value: S.Literals(["Overview", "Details", "Activity"]),
  },
  ClickedUiKitAction: { action: S.String },
});
export type Message = typeof Message.Type;
