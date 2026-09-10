import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { Sorting } from "./model";

export const Message = defineMessageUnion({
  ChangedQuery: { query: S.String },
  ChangedSelection: { rowIds: S.Array(S.String) },
  ChangedSorting: { sorting: S.Option(Sorting) },
  ChangedDensity: { density: S.Literals(["Compact", "Comfortable"]) },
  ClearedSelection: {},
  ClickedExport: {},
  ClickedCreate: {},
  ClickedRowActions: { rowId: S.String },
});
export type Message = typeof Message.Type;
