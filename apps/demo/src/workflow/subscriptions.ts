import { Subscription } from "foldkit";

import { DataGrid } from "@foldworks/data-grid";
import { FormBuilder } from "@foldworks/form-builder";
import { Workflow } from "@foldworks/workflow";

import { Message } from "./message";
import type { Model } from "./model";

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
);
