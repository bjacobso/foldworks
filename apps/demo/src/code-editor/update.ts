import { Option } from "effect";
import { Update } from "foldkit";
import { CodeEditor } from "@foldworks/code-editor";
import { Tree, Workspace } from "@foldworks/ui";
import { Message } from "./message";
import { jsonSample, typescriptSample, type Model } from "./model";
import { ConfigurationEditor, yamlSample } from "./configuration";

type Result = Update.Return<Model, Message>;
const foldNavigator = Update.foldChild({
  update: Workspace.update, read: (model: Model) => Option.some(model.navigator),
  write: (model, navigator) => ({ ...model, navigator }),
  toParentMessage: message => Message.Navigator({ message }),
});
const foldWorkspace = Update.foldChild({
  update: Workspace.update,
  read: (model: Model) => Option.some(model.workspace),
  write: (model, workspace) => ({ ...model, workspace }),
  toParentMessage: (message) => Message.Workspace({ message }),
});
const foldEditor = Update.foldChild({
  update: ConfigurationEditor.update,
  read: (model: Model) => Option.some(model.editor),
  write: (model, editor) => ({ ...model, editor }),
  toParentMessage: (message) => Message.Editor({ message }),
  foldOutMessage: (event: CodeEditor.OutMessage) => (model: Model): Result => ({
    model: event._tag === "RejectedOperation" ? { ...model, announcement: event.reason } : model,
  }),
});
const foldReference = Update.foldChild({
  update: CodeEditor.update,
  read: (model: Model) => Option.some(model.reference),
  write: (model, reference) => ({ ...model, reference }),
  toParentMessage: (message) => Message.Reference({ message }),
  foldOutMessage: () => (model: Model): Result => ({ model }),
});
export const update = (model: Model, message: Message): Result => Message.match<Result>(message, {
  Navigator: ({ message }) => foldNavigator(model, message),
  FileTree: ({ message }) => Update.foldChild({
    update: (tree: Tree.Model, event: Tree.Message) => Tree.update(tree, event, { nodes: model.files }),
    read: (parent: Model) => Option.some(parent.fileTree),
    write: (parent, fileTree) => ({ ...parent, fileTree }),
    toParentMessage: event => Message.FileTree({ message: event }),
    foldOutMessage: (event: Tree.OutMessage) => (parent: Model): Result => {
      if (event._tag === "Renamed") return { model: { ...parent, files: parent.files.map(file => file.id === event.id ? { ...file, label: event.label } : file) } };
      if (event._tag === "Moved") return { model: { ...parent, files: Tree.moveNodes(parent.files, event) } };
      return { model: { ...parent,
        workspace: event.id === "reference" ? { ...parent.workspace, collapsed: false } : parent.workspace,
        announcement: `Selected ${parent.files.find(file => file.id === event.id)?.label ?? "document"}.`,
      } };
    },
  })(model, message),
  Workspace: ({ message }) => foldWorkspace(model, message),
  ArrangeDocuments: () => {
    const stacked = model.workspace.orientation === "Horizontal";
    return { model: { ...model, workspace: Workspace.init({
      ...model.workspace, orientation: stacked ? "Vertical" : "Horizontal",
      size: stacked ? 260 : 400, minSize: stacked ? 180 : 280, secondaryMinSize: stacked ? 240 : 400,
    }) } };
  },
  Editor: ({ message }) => foldEditor(model, message),
  Reference: ({ message }) => foldReference(model, message),
  LoadSample: ({ languageId }) => {
    const text = languageId === "json" ? jsonSample : languageId === "yaml" ? yamlSample : languageId === "typescript" ? typescriptSample
      : languageId === "large" ? Array.from({ length: 2000 }, (_, i) => `export const item${i + 1} = { name: "Line ${i + 1}", enabled: true };`).join("\n")
      : "A document built from Foldkit state.\n\nTry selecting lines, indentation, search, and undo.\n";
    return foldEditor({ ...model, savedText: text, savedSession: model.editor.document.session + 1,
      files: model.files.map(file => file.id === "working" ? { ...file, label: `configuration.${languageId}` } : file),
    }, CodeEditor.execute(CodeEditor.Operation.ReplaceDocument({
      uri: `file:///configuration.${languageId}`, languageId: languageId === "large" ? "typescript" : languageId, text,
    })));
  },
  ToggleWrapping: () => foldEditor(model, CodeEditor.execute(CodeEditor.Operation.SetOptions({ ...model.editor.options, lineWrapping: !model.editor.options.lineWrapping }))),
  ToggleReadOnly: () => foldReference(model, CodeEditor.execute(CodeEditor.Operation.SetOptions({ ...model.reference.options, readOnly: !model.reference.options.readOnly }))),
  Save: () => {
    const { document } = CodeEditor.snapshot(model.editor);
    return { model: { ...model, savedText: document.text, savedSession: document.session, announcement: "Snapshot saved for this demo session." } };
  },
});
