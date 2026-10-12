import { Option } from "effect";
import { Subscription } from "foldkit";
import { DragAndDrop } from "@foldkit/ui";

import { Message } from "./message";
import type { Model } from "./model";

export const subscriptions = Subscription.lift(DragAndDrop.subscriptions)<Model, Message>({
  read: (model) => Option.some(model.interaction),
  toParentMessage: (message) => Message.GotInteractionMessage({ message }),
});
