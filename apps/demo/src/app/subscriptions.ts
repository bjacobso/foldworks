import { Effect, Schema as S, Stream } from "effect";
import { Subscription } from "foldkit";

import { subscriptions as dataGridSubscriptions } from "../data-grid/subscriptions";
import { Message as DataGridMessage } from "../data-grid/message";
import { subscriptions as formSubscriptions } from "../form-builder/subscriptions";
import { Message as FormMessage } from "../form-builder/message";
import { subscriptions as queryBuilderSubscriptions } from "../query-builder/subscriptions";
import { SYSTEM_DARK_QUERY } from "../theme";
import { subscriptions as workflowSubscriptions } from "../workflow/subscriptions";
import { Message as WorkflowMessage } from "../workflow/message";
import { demoFromRoute } from "./route";
import { Message } from "./message";
import type { Model } from "./model";

const historySubscriptions = Subscription.make<Model, Message>()((entry) => ({
  historyKeyboard: entry(
    { editor: S.Literals(["None", "Workflow", "Form"]) },
    {
      modelToDependencies: (model) => {
        const demo = demoFromRoute(model.route);
        return {
          editor: demo === "Workflow"
            ? "Workflow" as const
            : demo === "FormBuilder" && model.formEditor.mode === "Editor"
              ? "Form" as const
              : "None" as const,
        };
      },
      dependenciesToStream: ({ editor }) => Stream.fromEventListener<KeyboardEvent>(
        document,
        "keydown",
      ).pipe(
        Stream.filter((event) => editor !== "None" &&
          event.key.toLowerCase() === "z" &&
          (event.metaKey || event.ctrlKey) &&
          !event.altKey),
        Stream.mapEffect((event) => Effect.sync(() => {
          event.preventDefault();
          if (editor === "Workflow") {
            const child = event.shiftKey
              ? WorkflowMessage.ClickedRedo()
              : WorkflowMessage.ClickedUndo();
            return Message.GotWorkflowEditorMessage({ message: child });
          }
          const child = event.shiftKey ? FormMessage.ClickedRedo() : FormMessage.ClickedUndo();
          return Message.GotFormEditorMessage({ message: child });
        })),
      ),
    },
  ),
}));

const themeSubscriptions = Subscription.make<Model, Message>()(() => ({
  systemTheme: Subscription.persistent(
    Stream.fromEventListener<MediaQueryListEvent>(
      window.matchMedia(SYSTEM_DARK_QUERY),
      "change",
    ).pipe(
      Stream.map((event) => Message.ChangedSystemTheme({ isDark: event.matches })),
    ),
  ),
}));

const workflow = Subscription.lift(workflowSubscriptions)<Model, Message>({
  toChildModel: (model) => model.workflowEditor,
  toParentMessage: (message) => Message.GotWorkflowEditorMessage({ message }),
});

const form = Subscription.lift(formSubscriptions)<Model, Message>({
  toChildModel: (model) => model.formEditor,
  toParentMessage: (message) => Message.GotFormEditorMessage({ message }),
});

const dataGrid = Subscription.lift(dataGridSubscriptions)<Model, Message>({
  toChildModel: (model) => model.dataGridDemo,
  toParentMessage: (message) => Message.GotDataGridDemoMessage({ message }),
});

const queryBuilder = Subscription.lift(queryBuilderSubscriptions)<Model, Message>({
  toChildModel: (model) => model.queryBuilderDemo,
  toParentMessage: (message) => Message.GotQueryBuilderDemoMessage({ message }),
});

export const subscriptions = Subscription.aggregate<Model, Message>()(
  workflow,
  form,
  dataGrid,
  queryBuilder,
  themeSubscriptions,
  historySubscriptions,
);
