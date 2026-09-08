import { defineMessageUnion } from "foldkit/message";
import { Schema as S } from "effect";

import { DataGrid } from "@foldworks/data-grid";

export const Message = defineMessageUnion({
  GotGridMessage: { message: DataGrid.Message },
  ChangedEditingMode: { mode: S.Literals(["Immediate", "Batch"]) },
  CompletedSave: DataGrid.Submission.fields,
});
export type Message = typeof Message.Type;
