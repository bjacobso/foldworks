import { Subscription } from "foldkit";

import { DataGrid } from "@foldworks/data-grid";

import { Message } from "./message";
import type { Model } from "./model";

const worksheet = Subscription.lift(DataGrid.subscriptions)<Model, Message>({
  toChildModel: (model) => model.grid,
  toParentMessage: (message) => Message.GotGridMessage({ message }),
});

const coverage = Subscription.lift(DataGrid.subscriptions)<Model, Message>({
  toChildModel: (model) => model.coverage.grid,
  toParentMessage: (message) => Message.GotCoverageGridMessage({ message }),
});

// Both grids lift the same child record, so their keys are renamed to stay unique.
export const subscriptions = {
  worksheetColumnResize: worksheet.columnResize,
  coverageColumnResize: coverage.columnResize,
};
