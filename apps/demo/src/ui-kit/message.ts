import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";

import { Department, View } from "./model";

export const Message = defineMessageUnion({
  ChangedName: { value: S.String },
  ChangedNotes: { value: S.String },
  SelectedDepartment: { value: Department },
  SelectedView: { value: View },
  ClickedAction: { action: S.String },
});
export type Message = typeof Message.Type;
