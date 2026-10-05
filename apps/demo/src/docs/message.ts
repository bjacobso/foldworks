import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
export const Message = defineMessageUnion({
  Searched: { query: S.String },
  SelectedExplorer: { id: S.String },
  SentEvent: { event: S.String },
  Reset: {},
});
export type Message = typeof Message.Type;
