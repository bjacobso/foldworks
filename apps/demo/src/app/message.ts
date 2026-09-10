import { Schema as S } from "effect";
import { PdfAnnotator } from "@foldworks/pdf-annotator";
import { Sidebar } from "@foldworks/sidebar";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest } from "foldkit/navigation";
import { Url } from "foldkit/url";

import { Message as AgentMessage } from "../agent/message";
import { Message as CodeEditorMessage } from "../code-editor/message";
import { Message as WorkbenchMessage } from "../workbench/message";
import { Message as DataGridMessage } from "../data-grid/message";
import { Message as FormEditorMessage } from "../form-builder/message";
import { Message as QueryBuilderDemoMessage } from "../query-builder/message";
import { ThemeName, ThemePreference } from "../theme";
import { Message as UiKitMessage } from "../ui-kit/message";
import { Message as WorkflowEditorMessage } from "../workflow/message";

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  CompletedApplyTheme: {},
  CompletedPersistWorkspace: { succeeded: S.Boolean },
  ChangedSystemTheme: { isDark: S.Boolean },
  SelectedThemeName: { name: ThemeName },
  SelectedThemePreference: { preference: ThemePreference },
  GotAgentMessage: { message: AgentMessage },
  GotWorkflowEditorMessage: { message: WorkflowEditorMessage },
  GotFormEditorMessage: { message: FormEditorMessage },
  GotCodeEditorMessage: { message: CodeEditorMessage },
  GotWorkbenchMessage: { message: WorkbenchMessage },
  GotDataGridDemoMessage: { message: DataGridMessage },
  GotQueryBuilderDemoMessage: { message: QueryBuilderDemoMessage },
  GotPdfAnnotatorMessage: { message: PdfAnnotator.Message },
  GotSidebarMessage: { message: Sidebar.Message },
  GotUiKitMessage: { message: UiKitMessage },
});
export type Message = typeof Message.Type;
