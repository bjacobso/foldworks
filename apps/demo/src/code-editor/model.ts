import { Schema as S } from "effect";
import { CodeEditor } from "@foldworks/code-editor";
import { Tree, Workspace } from "@foldworks/ui";
import { ConfigurationEditor } from "./configuration";

import { jsonSample, typescriptSample } from "./samples";
export { jsonSample, typescriptSample } from "./samples";

export const Model = S.Struct({
  navigator: Workspace.Model,
  fileTree: Tree.Model,
  files: S.Array(Tree.Node),
  workspace: Workspace.Model,
  editor: CodeEditor.Model,
  reference: CodeEditor.Model,
  savedText: S.String,
  savedSession: S.Number,
  announcement: S.String,
});
export type Model = typeof Model.Type;
export const init = (): Model => ({
  navigator: Workspace.init({ id: "code-navigator", size: 210, minSize: 180, maxSize: 320, secondaryMinSize: 440 }),
  fileTree: Tree.init({ id: "code-file-tree", expandedIds: ["project", "src", "examples"], selectedId: "working" }),
  files: [
    { id: "project", label: "Workspace", parentId: null, branch: true, renamable: true, movable: false },
    { id: "src", label: "src", parentId: "project", branch: true, renamable: true, movable: true },
    { id: "working", label: "configuration.json", parentId: "src", branch: false, renamable: true, movable: true },
    { id: "examples", label: "examples", parentId: "project", branch: true, renamable: true, movable: true },
    { id: "reference", label: "configuration.ts", parentId: "examples", branch: false, renamable: true, movable: true },
  ],
  workspace: Workspace.init({ id: "code-workspace", side: "End", size: 400, minSize: 280, maxSize: 700, secondaryMinSize: 400 }),
  editor: ConfigurationEditor.init({ id: "native-working", uri: "file:///configuration.json", languageId: "json", text: jsonSample }),
  reference: CodeEditor.init({ id: "native-reference", uri: "file:///configuration.ts", languageId: "typescript", text: typescriptSample, readOnly: true }),
  savedText: jsonSample, savedSession: 0, announcement: "Ready to edit.",
});
