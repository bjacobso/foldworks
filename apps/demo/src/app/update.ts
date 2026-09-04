import { Effect, Option, Schema as S } from "effect";
import { Command, Update } from "foldkit";
import { UrlRequest, load, pushUrl } from "foldkit/navigation";
import { evo } from "foldkit/struct";
import { toString as urlToString } from "foldkit/url";

import { update as updateDataGrid } from "../data-grid/update";
import { serializeWorkspace, writePersistedWorkspace } from "../document-storage";
import { OutMessage as FormOutMessage } from "../form-builder/message";
import { loadExample, setMode, update as updateForm } from "../form-builder/update";
import { update as updateQueryBuilder } from "../query-builder/update";
import { applyTheme } from "../theme";
import { update as updateUiKit } from "../ui-kit/update";
import { OutMessage as WorkflowOutMessage } from "../workflow/message";
import { setOrientation, update as updateWorkflow } from "../workflow/update";
import {
  formBuilderPath,
  formStateFromRoute,
  urlToAppRoute,
  workflowOrientationFromRoute,
  workflowPath,
} from "./route";
import { Message } from "./message";
import type { Model } from "./model";

type UpdateReturn = Update.Return<Model, Message>;

const NavigateInternal = Command.define("NavigateInternal", {
  args: { url: S.String },
  messages: [Message.CompletedNavigateInternal],
  execute: ({ url }) => pushUrl(url).pipe(Effect.as(Message.CompletedNavigateInternal())),
});

const LoadExternal = Command.define("LoadExternal", {
  args: { href: S.String },
  messages: [Message.CompletedLoadExternal],
  execute: ({ href }) => load(href).pipe(Effect.as(Message.CompletedLoadExternal())),
});

const ApplyTheme = Command.define("ApplyTheme", {
  args: {
    name: S.Literals(["Neutral", "Zinc", "Blue"]),
    preference: S.Literals(["System", "Light", "Dark"]),
    systemIsDark: S.Boolean,
  },
  messages: [Message.CompletedApplyTheme],
  execute: ({ name, preference, systemIsDark }) => Effect.sync(() => {
    applyTheme(name, preference, systemIsDark);
    return Message.CompletedApplyTheme();
  }),
});

const PersistWorkspace = Command.define("PersistWorkspace", {
  args: { json: S.String },
  messages: [Message.CompletedPersistWorkspace],
  execute: ({ json }) => Effect.sync(() =>
    Message.CompletedPersistWorkspace({ succeeded: writePersistedWorkspace(json) })
  ),
});

const persist = (model: Model, announcement: string): UpdateReturn => {
  const next = evo(model, {
    persistenceStatus: () => "Saving" as const,
    revision: (value) => value + 1,
    announcement: () => announcement,
  });
  return {
    model: next,
    commands: [PersistWorkspace({
      json: serializeWorkspace({
        version: 1,
        workflow: next.workflowEditor.document,
        forms: next.formEditor.documents,
      }),
    })],
  };
};

const foldWorkflow = Update.foldChild({
  update: updateWorkflow,
  read: (model: Model) => Option.some(model.workflowEditor),
  write: (model, workflowEditor) => evo(model, { workflowEditor: () => workflowEditor }),
  toParentMessage: (message) => Message.GotWorkflowEditorMessage({ message }),
  foldOutMessage: (outMessage: WorkflowOutMessage) => (model: Model): UpdateReturn =>
    WorkflowOutMessage.match(outMessage, {
      Changed: () => persist(model, model.workflowEditor.announcement),
      RequestedOrientation: ({ orientation }) => ({
        model,
        commands: [NavigateInternal({ url: workflowPath(orientation) })],
      }),
    }),
});

const foldForm = Update.foldChild({
  update: updateForm,
  read: (model: Model) => Option.some(model.formEditor),
  write: (model, formEditor) => evo(model, { formEditor: () => formEditor }),
  toParentMessage: (message) => Message.GotFormEditorMessage({ message }),
  foldOutMessage: (outMessage: FormOutMessage) => (model: Model): UpdateReturn =>
    FormOutMessage.match(outMessage, {
      Changed: () => persist(model, model.formEditor.announcement),
      RequestedRoute: ({ exampleId, mode }) => ({
        model,
        commands: [NavigateInternal({ url: formBuilderPath(exampleId, mode) })],
      }),
    }),
});

const foldDataGrid = Update.foldChild({
  update: updateDataGrid,
  read: (model: Model) => Option.some(model.dataGridDemo),
  write: (model, dataGridDemo) => evo(model, { dataGridDemo: () => dataGridDemo }),
  toParentMessage: (message) => Message.GotDataGridDemoMessage({ message }),
});

const foldUiKit = Update.foldChild({
  update: updateUiKit,
  read: (model: Model) => Option.some(model.uiKit),
  write: (model, uiKit) => evo(model, { uiKit: () => uiKit }),
  toParentMessage: (message) => Message.GotUiKitMessage({ message }),
});

const foldQueryBuilder = Update.foldChild({
  update: updateQueryBuilder,
  read: (model: Model) => Option.some(model.queryBuilderDemo),
  write: (model, queryBuilderDemo) => evo(model, { queryBuilderDemo: () => queryBuilderDemo }),
  toParentMessage: (message) => Message.GotQueryBuilderDemoMessage({ message }),
});

const applyRoute = (model: Model, route: Model["route"]): Model => {
  let next: Model = evo(model, { route: () => route });
  if (route._tag === "Workflow") {
    const workflowEditor = setOrientation(next.workflowEditor, workflowOrientationFromRoute(route));
    return workflowEditor === next.workflowEditor
      ? next
      : evo(next, {
          workflowEditor: () => workflowEditor,
          revision: (value) => value + 1,
        });
  }
  if (route._tag !== "FormBuilder") return next;

  const { exampleId, mode } = formStateFromRoute(route);
  const previousEditor = next.formEditor;
  if (previousEditor.exampleId !== exampleId) {
    next = evo(next, { formEditor: (editor) => loadExample(editor, exampleId) });
  }
  if (next.formEditor.mode !== mode) {
    next = evo(next, { formEditor: (editor) => setMode(editor, mode) });
  }
  return next.formEditor === previousEditor
    ? next
    : evo(next, { revision: (value) => value + 1 });
};

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    CompletedNavigateInternal: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),
    CompletedApplyTheme: () => ({ model }),
    CompletedPersistWorkspace: ({ succeeded }) => ({
      model: evo(model, {
        persistenceStatus: () => succeeded ? "Saved" : "Error",
        announcement: () => succeeded
          ? "Changes saved locally."
          : "Changes could not be saved in this browser.",
      }),
    }),
    ChangedSystemTheme: ({ isDark }) => {
      const next = evo(model, { systemIsDark: () => isDark });
      return model.themePreference === "System"
        ? {
            model: next,
            commands: [ApplyTheme({
              name: model.themeName,
              preference: "System",
              systemIsDark: isDark,
            })],
          }
        : { model: next };
    },
    SelectedThemeName: ({ name }) => ({
      model: evo(model, { themeName: () => name }),
      commands: [ApplyTheme({
        name,
        preference: model.themePreference,
        systemIsDark: model.systemIsDark,
      })],
    }),
    SelectedThemePreference: ({ preference }) => ({
      model: evo(model, { themePreference: () => preference }),
      commands: [ApplyTheme({
        name: model.themeName,
        preference,
        systemIsDark: model.systemIsDark,
      })],
    }),
    ClickedLink: ({ request }) => UrlRequest.match<UpdateReturn>(request, {
      Internal: ({ url }) => ({
        model,
        commands: [NavigateInternal({ url: urlToString(url) })],
      }),
      External: ({ href }) => ({ model, commands: [LoadExternal({ href })] }),
    }),
    ChangedUrl: ({ url }) => ({ model: applyRoute(model, urlToAppRoute(url)) }),
    GotWorkflowEditorMessage: ({ message: childMessage }) =>
      foldWorkflow(model, childMessage),
    GotFormEditorMessage: ({ message: childMessage }) => foldForm(model, childMessage),
    GotDataGridDemoMessage: ({ message: childMessage }) =>
      foldDataGrid(model, childMessage),
    GotQueryBuilderDemoMessage: ({ message: childMessage }) =>
      foldQueryBuilder(model, childMessage),
    GotUiKitMessage: ({ message: childMessage }) => foldUiKit(model, childMessage),
  });
