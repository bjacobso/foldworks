import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

export const Message = defineMessageUnion({
  SelectedFile: { path: S.String },
  ChangedMode: { mode: S.Literals(["Unified", "Split"]) },
  SelectedLine: { path: S.String, side: S.Literals(["old", "new"]), line: S.Number },
  ChangedDraft: { value: S.String },
  SubmittedComment: {},
  CancelledComment: {},
  ToggledViewed: { path: S.String, viewed: S.Boolean },
  ToggledResolved: { id: S.String },
});
export type Message = typeof Message.Type;
