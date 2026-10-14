import { Subscription } from "foldkit";
import { Option } from "effect";
import * as Graph from "@foldworks/diagram/graph";
import type { Model } from "./model";
import { Message } from "./message";
export const subscriptions = Subscription.lift(Graph.subscriptions)<Model, Message>({
  read: (model) => Option.some(model.graph),
  toParentMessage: (message) => Message.GotGraphMessage({ message }),
});
