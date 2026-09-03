import { Subscription } from "foldkit";

import { Workflow } from "@foldworks/workflow";

import { Message } from "./message";
import type { Model } from "./model";

const interaction = Subscription.lift({
  dragPointer: Workflow.subscriptions.documentPointer,
  dragEscape: Workflow.subscriptions.documentEscape,
  dragKeyboard: Workflow.subscriptions.documentKeyboard,
  autoScroll: Workflow.subscriptions.autoScroll,
})<Model, Message>({
  toChildModel: (model) => model.workflow,
  toParentMessage: (message) => Message.GotWorkflowMessage({ message }),
});

export const subscriptions = interaction;
