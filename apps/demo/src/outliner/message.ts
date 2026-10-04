import { defineMessageUnion } from "foldkit/message";
import { Outliner } from "@foldworks/outliner";

export const Message = defineMessageUnion({
  GotOutlinerMessage: { message: Outliner.Message },
  ToggledCheckboxes: {},
});
export type Message = typeof Message.Type;
