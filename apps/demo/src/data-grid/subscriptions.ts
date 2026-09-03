import { Subscription } from "foldkit";

import { DataGrid } from "@foldworks/data-grid";

import { Message } from "./message";
import type { Model } from "./model";

export const subscriptions = Subscription.lift(DataGrid.subscriptions)<Model, Message>({
  toChildModel: (model) => model.grid,
  toParentMessage: (message) => Message.GotGridMessage({ message }),
});
