import { Subscription } from "foldkit";

import { QueryBuilder } from "@foldworks/query-builder";

import { Message } from "./message";
import type { Model } from "./model";

const interaction = Subscription.lift(QueryBuilder.subscriptions)<Model, Message>({
  toChildModel: (model) => model.builder,
  toParentMessage: (message) => Message.GotQueryBuilderMessage({ message }),
});

export const subscriptions = {
  queryDragPointer: interaction.documentPointer,
  queryDragEscape: interaction.documentEscape,
  queryDragKeyboard: interaction.documentKeyboard,
  queryAutoScroll: interaction.autoScroll,
};
