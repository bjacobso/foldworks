import { Schema as S } from "effect";
import { DataGrid } from "@foldworks/data-grid";
import { defineMessageUnion } from "foldkit/message";

import { Snapshot } from "./domain";
import { Panel } from "./model";

export const Message = defineMessageUnion({
  CompletedFocus: {},
  GotGridMessage: { message: DataGrid.Message },
  SelectedWorker: { id: S.String, panel: Panel },
  OpenedPanel: { panel: Panel },
  ChangedState: { value: S.String },
  Previewed: {},
  Discarded: {},
  Applied: {},
  CompletedApply: { snapshot: S.Option(Snapshot), error: S.String },
});
export type Message = typeof Message.Type;
