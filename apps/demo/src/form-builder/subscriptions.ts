import { Subscription } from "foldkit";

import { FormBuilder } from "@foldworks/form-builder";

import { Message } from "./message";
import type { Model } from "./editor-model";

const interaction = Subscription.lift(FormBuilder.subscriptions)<Model, Message>({
  toChildModel: (model) => model.interaction,
  toParentMessage: (message) => Message.GotInteractionMessage({ message }),
});

export const subscriptions = {
  formDragPointer: interaction.documentPointer,
  formDragEscape: interaction.documentEscape,
  formDragKeyboard: interaction.documentKeyboard,
  formAutoScroll: interaction.autoScroll,
};
