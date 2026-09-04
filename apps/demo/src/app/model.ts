import { Schema as S } from "effect";

import type { PersistedWorkspace } from "../document-storage";
import { Model as DataGridModel, initialModel as initialDataGrid } from "../data-grid/model";
import { Model as FormEditorModel, init as initFormEditor } from "../form-builder/editor-model";
import { exampleForms } from "../form-builder/model";
import { Model as QueryBuilderDemoModel, initialModel as initialQueryBuilder } from "../query-builder/model";
import { ThemeName, ThemePreference, type ThemeState } from "../theme";
import { Model as UiKitModel, initialModel as initialUiKit } from "../ui-kit/model";
import { Model as WorkflowEditorModel, init as initWorkflowEditor } from "../workflow/model";
import {
  AppRoute,
  formStateFromRoute,
  workflowOrientationFromRoute,
} from "./route";

export const Model = S.Struct({
  route: AppRoute,
  workflowEditor: WorkflowEditorModel,
  formEditor: FormEditorModel,
  dataGridDemo: DataGridModel,
  queryBuilderDemo: QueryBuilderDemoModel,
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
): Model => {
  const { exampleId, mode } = formStateFromRoute(route);
  return {
    route,
    workflowEditor: initWorkflowEditor(
      persisted?.workflow,
      workflowOrientationFromRoute(route),
    ),
    formEditor: initFormEditor(persisted?.forms ?? exampleForms, exampleId, mode),
    dataGridDemo: initialDataGrid,
    queryBuilderDemo: initialQueryBuilder,
    uiKit: initialUiKit,
    themeName: theme.name,
    themePreference: theme.preference,
    systemIsDark: theme.systemIsDark,
    persistenceStatus: "Saved",
    revision: 0,
    announcement: "Foldworks ready.",
  };
};
