import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
export const Message = defineMessageUnion({
  Searched: { query: S.String },
  FilteredModules: { query: S.String },
  SelectedExplorer: { id: S.String },
  SentEvent: { event: S.String },
  Reset: {},
  JumpedTo: { id: S.String },
  CompletedJump: {},
});
export type Message = typeof Message.Type;
