import { Schema as S } from "effect";
import { Agent } from "@foldworks/agent";
import { PdfAnnotator } from "@foldworks/pdf-annotator";
import { ArticleEditor, initialEditor } from "../editor/demo";
import { Sidebar } from "@foldworks/sidebar";

import { Model as WorkbenchModel, init as initWorkbench } from "../workbench/model";
import { Model as CodeEditorModel, init as initCodeEditor } from "../code-editor/model";
import { Model as LispModel, init as initLisp } from "../lisp/model";
import type { Snapshot } from "../workbench/domain";

import type { PersistedWorkspace } from "../document-storage";
import {
  Model as DataGridModel,
  initialModel as initialDataGrid,
  setExample as setDataGridExample,
} from "../data-grid/model";
import { Model as DataTableModel, init as initDataTable } from "../data-table/model";
import { Model as DiffViewerModel, initialModel as initialDiffViewer } from "../diff-viewer/model";
import { Model as FormEditorModel, init as initFormEditor } from "../form-builder/editor-model";
import { exampleForms } from "../form-builder/model";
import {
  Model as QueryBuilderDemoModel,
  initialModel as initialQueryBuilder,
} from "../query-builder/model";
import { ThemeName, ThemePreference, type ThemeState } from "../theme";
import { Model as PdfViewerDemoModel, initialModel as initialPdfViewer } from "../pdf-viewer/model";
import { Model as UiKitModel, initialModel as initialUiKit } from "../ui-kit/model";
import { Model as StatechartModel, initialModel as initialStatechart } from "../statechart/model";
import { Model as WorkflowEditorModel, init as initWorkflowEditor } from "../workflow/model";
import {
  AppRoute,
  dataGridExampleFromRoute,
  dataTablePersonFromRoute,
  formStateFromRoute,
  workflowOrientationFromRoute,
} from "./route";

export const Model = S.Struct({
  route: AppRoute,
  agent: Agent.Model,
  codeEditor: CodeEditorModel,
  lisp: LispModel,
  workbench: WorkbenchModel,
  workflowEditor: WorkflowEditorModel,
  statechart: StatechartModel,
  formEditor: FormEditorModel,
  dataGridDemo: DataGridModel,
  dataTableDemo: DataTableModel,
  diffViewerDemo: DiffViewerModel,
  queryBuilderDemo: QueryBuilderDemoModel,
  pdfAnnotator: PdfAnnotator.Model,
  pdfViewerDemo: PdfViewerDemoModel,
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
  theme: ThemeState = { name: "Shadcn", preference: "System", systemIsDark: false },
  persisted?: PersistedWorkspace,
  workers?: Readonly<{ snapshot: Snapshot; error: string }>,
): Model => {
  const { exampleId, mode } = formStateFromRoute(route);
  return {
    route,
    agent: Agent.init({ id: "foldworks-agent", selectedModel: "atlas-balanced" }),
    codeEditor: initCodeEditor(),
    lisp: initLisp(),
    workbench: initWorkbench(workers?.snapshot, workers?.error),
    workflowEditor: initWorkflowEditor(persisted?.workflow, workflowOrientationFromRoute(route)),
    statechart: initialStatechart,
    formEditor: initFormEditor(persisted?.forms ?? exampleForms, exampleId, mode),
    dataGridDemo: setDataGridExample(initialDataGrid, dataGridExampleFromRoute(route)),
    dataTableDemo: initDataTable(dataTablePersonFromRoute(route)),
    diffViewerDemo: initialDiffViewer,
    queryBuilderDemo: initialQueryBuilder,
    pdfAnnotator: PdfAnnotator.init({
      id: "foldworks-pdf-annotator",
      sampleUrl: "/foldworks-sample.pdf",
    }),
    pdfViewerDemo: initialPdfViewer,
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
