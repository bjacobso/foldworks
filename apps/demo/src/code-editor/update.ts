import { Option } from "effect";
import { Update } from "foldkit";
import { CodeEditor } from "@foldworks/code-editor";
import { Message } from "./message";
import { jsonSample, typescriptSample, type Model } from "./model";
import { ConfigurationEditor, yamlSample } from "./configuration";

type Result = Update.Return<Model, Message>;
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
  Editor: ({ message }) => foldEditor(model, message),
  Reference: ({ message }) => foldReference(model, message),
  LoadSample: ({ languageId }) => {
    const text = languageId === "json" ? jsonSample : languageId === "yaml" ? yamlSample : languageId === "typescript" ? typescriptSample
      : languageId === "large" ? Array.from({ length: 2000 }, (_, i) => `export const item${i + 1} = { name: "Line ${i + 1}", enabled: true };`).join("\n")
      : "A document built from Foldkit state.\n\nTry selecting lines, indentation, search, and undo.\n";
    return foldEditor({ ...model, savedText: text, savedSession: model.editor.document.session + 1 }, CodeEditor.execute(CodeEditor.Operation.ReplaceDocument({
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
