import { Effect, Schema as S, Stream } from "effect";
import { Subscription } from "foldkit";

import { DataGrid } from "@foldworks/data-grid";
import { FormBuilder } from "@foldworks/form-builder";
import { Workflow } from "@foldworks/workflow";

import { Message } from "./message";
import type { Model } from "./model";
import { SYSTEM_DARK_QUERY } from "../theme";
import { demoFromRoute } from "./route";

const historySubscriptions = Subscription.make<Model, Message>()((entry) => ({
  historyKeyboard: entry(
    { editor: S.Literals(["None", "Workflow", "Form"]) },
    {
      modelToDependencies: (model) => {
        const demo = demoFromRoute(model.route);
        return {
          editor: demo === "Workflow"
            ? "Workflow" as const
            : demo === "FormBuilder" && model.formMode === "Editor"
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
          const activeEditor = editor === "Workflow" ? "Workflow" : "Form";
          return event.shiftKey
            ? Message.ClickedRedo({ editor: activeEditor })
            : Message.ClickedUndo({ editor: activeEditor });
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

const workflowSubscriptions = Subscription.lift({
  dragPointer: Workflow.subscriptions.documentPointer,
  dragEscape: Workflow.subscriptions.documentEscape,
  dragKeyboard: Workflow.subscriptions.documentKeyboard,
  autoScroll: Workflow.subscriptions.autoScroll,
})<Model, Message>({
  toChildModel: (model) => model.workflow,
  toParentMessage: (message) => Message.GotWorkflowMessage({ message }),
});

const dataGridSubscriptions = Subscription.lift(DataGrid.subscriptions)<
  Model,
  Message
>({
  toChildModel: (model) => model.dataGrid,
  toParentMessage: (message) => Message.GotDataGridMessage({ message }),
});

const liftedFormBuilderSubscriptions = Subscription.lift(FormBuilder.subscriptions)<
  Model,
  Message
>({
  toChildModel: (model) => model.formBuilder,
  toParentMessage: (message) => Message.GotFormBuilderMessage({ message }),
});

const formBuilderSubscriptions = {
  formDragPointer: liftedFormBuilderSubscriptions.documentPointer,
  formDragEscape: liftedFormBuilderSubscriptions.documentEscape,
  formDragKeyboard: liftedFormBuilderSubscriptions.documentKeyboard,
  formAutoScroll: liftedFormBuilderSubscriptions.autoScroll,
};

export const subscriptions = Subscription.aggregate<Model, Message>()(
  workflowSubscriptions,
  dataGridSubscriptions,
  formBuilderSubscriptions,
  themeSubscriptions,
  historySubscriptions,
);
