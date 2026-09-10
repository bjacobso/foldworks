import { Schema as S } from "effect";
import { Agent } from "@foldworks/agent";
import { PdfAnnotator } from "@foldworks/pdf-annotator";
import { ArticleEditor, initialEditor } from "../editor/demo";
import { Sidebar } from "@foldworks/sidebar";

import { Model as WorkbenchModel, init as initWorkbench } from "../workbench/model";
import { Model as CodeEditorModel, init as initCodeEditor } from "../code-editor/model";
import type { Snapshot } from "../workbench/domain";

import type { PersistedWorkspace } from "../document-storage";
import { Model as DataGridModel, initialModel as initialDataGrid } from "../data-grid/model";
import { Model as DataTableModel, init as initDataTable } from "../data-table/model";
import { Model as FormEditorModel, init as initFormEditor } from "../form-builder/editor-model";
import { exampleForms } from "../form-builder/model";
import { Model as QueryBuilderDemoModel, initialModel as initialQueryBuilder } from "../query-builder/model";
import { ThemeName, ThemePreference, type ThemeState } from "../theme";
import { Model as UiKitModel, initialModel as initialUiKit } from "../ui-kit/model";
import { Model as WorkflowEditorModel, init as initWorkflowEditor } from "../workflow/model";
import {
  AppRoute,
  dataTablePersonFromRoute,
  formStateFromRoute,
  workflowOrientationFromRoute,
} from "./route";

export const Model = S.Struct({
  route: AppRoute,
  agent: Agent.Model,
  codeEditor: CodeEditorModel,
  workbench: WorkbenchModel,
  workflowEditor: WorkflowEditorModel,
  formEditor: FormEditorModel,
  dataGridDemo: DataGridModel,
  dataTableDemo: DataTableModel,
  queryBuilderDemo: QueryBuilderDemoModel,
  pdfAnnotator: PdfAnnotator.Model,
  editor: ArticleEditor.Model,
  sidebar: Sidebar.Model,
  uiKit: UiKitModel,
  themeName: ThemeName,
  themePreference: ThemePreference,
  systemIsDark: S.Boolean,
  persistenceStatus: S.Literals(["Saved", "Saving", "Error"]),
  revision: S.Number,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export const init = (
  route: AppRoute,
  theme: ThemeState = { name: "Neutral", preference: "System", systemIsDark: false },
  persisted?: PersistedWorkspace,
  workers?: Readonly<{ snapshot: Snapshot; error: string }>,
): Model => {
  const { exampleId, mode } = formStateFromRoute(route);
  return {
    route,
    agent: Agent.init({ id: "foldworks-agent", selectedModel: "atlas-balanced" }),
    codeEditor: initCodeEditor(),
    workbench: initWorkbench(workers?.snapshot, workers?.error),
    workflowEditor: initWorkflowEditor(
      persisted?.workflow,
      workflowOrientationFromRoute(route),
    ),
    formEditor: initFormEditor(persisted?.forms ?? exampleForms, exampleId, mode),
    dataGridDemo: initialDataGrid,
    dataTableDemo: initDataTable(dataTablePersonFromRoute(route)),
    queryBuilderDemo: initialQueryBuilder,
    pdfAnnotator: PdfAnnotator.init({
      id: "foldworks-pdf-annotator",
      sampleUrl: "/foldworks-sample.pdf",
    }),
    editor: initialEditor(),
    sidebar: Sidebar.init({ id: "foldworks-sidebar" }),
    uiKit: initialUiKit,
    themeName: theme.name,
    themePreference: theme.preference,
    systemIsDark: theme.systemIsDark,
    persistenceStatus: "Saved",
    revision: 0,
    announcement: "Foldworks ready.",
  };
};
