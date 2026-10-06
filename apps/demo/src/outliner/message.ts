import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { Outliner } from "@foldworks/outliner";

export const Message = defineMessageUnion({
  GotOutlinerMessage: { message: Outliner.Message },
  ToggledCheckboxes: {},
  ToggledDone: { id: S.String },
});
export type Message = typeof Message.Type;
