import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { CodeEditor } from "@foldworks/code-editor";
import { Tree, Workspace } from "@foldworks/ui";

export const Message = defineMessageUnion({
  Navigator: { message: Workspace.Message },
  FileTree: { message: Tree.Message },
  Workspace: { message: Workspace.Message },
  ArrangeDocuments: {},
  Editor: { message: CodeEditor.Message },
  Reference: { message: CodeEditor.Message },
  LoadSample: { languageId: S.String },
  ToggleWrapping: {},
  ToggleReadOnly: {},
  Save: {},
});
export type Message = typeof Message.Type;
