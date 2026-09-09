import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { CodeEditor } from "@foldworks/code-editor";

export const Message = defineMessageUnion({
  Editor: { message: CodeEditor.Message },
  Reference: { message: CodeEditor.Message },
  LoadSample: { languageId: S.String },
  ToggleWrapping: {},
  ToggleReadOnly: {},
  Save: {},
});
export type Message = typeof Message.Type;
