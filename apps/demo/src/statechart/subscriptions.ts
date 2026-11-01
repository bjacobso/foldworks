import { Option } from "effect";
import { Subscription } from "foldkit";

import { Diagram } from "foldworks/diagram";

import { Message } from "./message";
import type { Model } from "./model";

export const subscriptions = Subscription.lift(Diagram.subscriptions)<Model, Message>({
  read: (model) => Option.some(model.canvas),
  toParentMessage: (message) => Message.GotCanvasMessage({ message }),
});
