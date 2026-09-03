import { defineMessageUnion } from "foldkit/message";

import { DataGrid } from "@foldworks/data-grid";

export const Message = defineMessageUnion({
  GotGridMessage: { message: DataGrid.Message },
});
export type Message = typeof Message.Type;
