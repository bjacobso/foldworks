import { Subscription } from "foldkit";
import { DataGrid } from "@foldworks/data-grid";
import { Message } from "./message";
import type { Model } from "./model";

const grid = Subscription.lift(DataGrid.subscriptions)<Model, Message>({
  toChildModel: (model) => model.grid,
  toParentMessage: (message) => Message.GotGridMessage({ message }),
});

// The workbench and standalone grid coexist in the same application.
export const subscriptions = { workerColumnResize: grid.columnResize };
