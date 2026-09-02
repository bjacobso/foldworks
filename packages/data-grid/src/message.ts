import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

export const Message = defineMessageUnion({
  SelectedCell: { rowId: S.String, columnId: S.String },
  ToggledSort: { columnId: S.String },
  StartedColumnResize: {
    columnId: S.String,
    screenX: S.Number,
    width: S.Number,
    minimumWidth: S.Number,
    maximumWidth: S.Number,
  },
  MovedColumnResize: { screenX: S.Number },
  FinishedColumnResize: {},
  ResetColumnSize: { columnId: S.String, width: S.Number },
});
export type Message = typeof Message.Type;
