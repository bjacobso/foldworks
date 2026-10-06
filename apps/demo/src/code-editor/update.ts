import { Option } from "effect";
import { Update } from "foldkit";
import { CodeEditor } from "@foldworks/code-editor";
import { Tree, Workspace } from "@foldworks/ui";
import { Message } from "./message";
import { jsonSample, typescriptSample, type Model } from "./model";
import { ConfigurationEditor, yamlSample } from "./configuration";
import {
  analyze,
  complete,
  diagnostics,
  environmentLanguage,
  environmentSample,
  occurrences,
  tokens,
} from "./environment";

type Result = Update.Return<Model, Message>;
const foldNavigator = Update.foldChild({
  update: Workspace.update,
  read: (model: Model) => Option.some(model.navigator),
  write: (model, navigator) => ({ ...model, navigator }),
  toParentMessage: (message) => Message.Navigator({ message }),
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
  foldOutMessage:
    (event: CodeEditor.OutMessage) =>
    (model: Model): Result =>
      editorEvent(model, event),
});

/** Continues an update with an operation on the working document, keeping the commands of both. */
const andThenEditor = (result: Result, operation: CodeEditor.Operation): Result => {
  const next = foldEditor(result.model, CodeEditor.execute(operation));
  return { model: next.model, commands: [...(result.commands ?? []), ...(next.commands ?? [])] };
};

/**
 * Explains a version of an environment file: its highlighting and its
 * problems. Both are tagged with the version, so a late batch is ignored.
 */
const annotate = (result: Result, document: CodeEditor.Document): Result => {
  if (document.languageId !== environmentLanguage) return result;
  const analysis = analyze(document.text);
  const version = CodeEditor.documentVersion(document);
  const painted = andThenEditor(
    result,
    CodeEditor.Operation.SetSemanticTokens({ ...version, tokens: tokens(analysis) }),
  );
  return andThenEditor(
    painted,
    CodeEditor.Operation.SetDiagnostics({
      ...version,
      languageId: document.languageId,
      source: environmentLanguage,
      diagnostics: diagnostics(analysis),
    }),
  );
};

/** Offers settings, values, or references at the caret, when the service has any. */
const offer = (result: Result, caret: number, invoked: boolean): Result => {
  const { document } = result.model.editor;
  if (document.languageId !== environmentLanguage) return result;
  const found = complete(analyze(document.text), caret, invoked);
  return found === undefined
    ? result
    : andThenEditor(
        result,
        CodeEditor.Operation.ShowCompletions({
          expected: CodeEditor.documentVersion(document),
          ...found,
        }),
      );
};

const editorEvent = (model: Model, event: CodeEditor.OutMessage): Result => {
  switch (event._tag) {
    case "ChangedDocument": {
      const annotated = annotate({ model }, event.document);
      // Typing a name, `=`, or `${` suggests what could follow.
      const { editor } = annotated.model;
      return event.origin === "input" && editor.completion === null
        ? offer(annotated, editor.selection.head, false)
        : annotated;
    }
    case "RequestedCompletion":
      return offer({ model }, event.offset, true);
    case "RejectedOperation":
      return { model: { ...model, announcement: event.reason } };
    default:
      return { model };
  }
};
const foldReference = Update.foldChild({
  update: CodeEditor.update,
  read: (model: Model) => Option.some(model.reference),
  write: (model, reference) => ({ ...model, reference }),
  toParentMessage: (message) => Message.Reference({ message }),
  foldOutMessage:
    () =>
    (model: Model): Result => ({ model }),
});
export const update = (model: Model, message: Message): Result =>
  Message.match<Result>(message, {
    Navigator: ({ message }) => foldNavigator(model, message),
    FileTree: ({ message }) =>
      Update.foldChild({
        update: (tree: Tree.Model, event: Tree.Message) =>
          Tree.update(tree, event, { nodes: model.files }),
        read: (parent: Model) => Option.some(parent.fileTree),
        write: (parent, fileTree) => ({ ...parent, fileTree }),
        toParentMessage: (event) => Message.FileTree({ message: event }),
        foldOutMessage:
          (event: Tree.OutMessage) =>
          (parent: Model): Result => {
            if (event._tag === "Renamed")
              return {
                model: {
                  ...parent,
                  files: parent.files.map((file) =>
                    file.id === event.id ? { ...file, label: event.label } : file,
                  ),
                },
              };
            if (event._tag === "Moved")
              return { model: { ...parent, files: Tree.moveNodes(parent.files, event) } };
            return {
              model: {
                ...parent,
                workspace:
                  event.id === "reference"
                    ? { ...parent.workspace, collapsed: false }
                    : parent.workspace,
                announcement: `Selected ${parent.files.find((file) => file.id === event.id)?.label ?? "document"}.`,
              },
            };
          },
      })(model, message),
    Workspace: ({ message }) => foldWorkspace(model, message),
    ArrangeDocuments: () => {
      const stacked = model.workspace.orientation === "Horizontal";
      return {
        model: {
          ...model,
          workspace: Workspace.init({
            ...model.workspace,
            orientation: stacked ? "Vertical" : "Horizontal",
            size: stacked ? 260 : 400,
            minSize: stacked ? 180 : 280,
            secondaryMinSize: stacked ? 240 : 400,
          }),
        },
      };
    },
    Editor: ({ message }) => foldEditor(model, message),
    Reference: ({ message }) => foldReference(model, message),
    LoadSample: ({ languageId }) => {
      const text =
        languageId === "json"
          ? jsonSample
          : languageId === "yaml"
            ? yamlSample
            : languageId === "typescript"
              ? typescriptSample
              : languageId === environmentLanguage
                ? environmentSample
                : languageId === "large"
                  ? Array.from(
                      { length: 2000 },
                      (_, i) =>
                        `export const item${i + 1} = { name: "Line ${i + 1}", enabled: true };`,
                    ).join("\n")
                  : "A document built from Foldkit state.\n\nTry selecting lines, indentation, search, and undo.\n";
      // Environment files take suggestions only from their language service.
      const prepared = foldEditor(
        {
          ...model,
          savedText: text,
          savedSession: model.editor.document.session + 1,
          selectedSetting: null,
          files: model.files.map((file) =>
            file.id === "working" ? { ...file, label: `configuration.${languageId}` } : file,
          ),
        },
        CodeEditor.execute(
          CodeEditor.Operation.SetOptions({
            ...model.editor.options,
            suggestions: languageId === environmentLanguage ? "host" : "words",
          }),
        ),
      );
      return andThenEditor(
        prepared,
        CodeEditor.Operation.ReplaceDocument({
          uri: `file:///configuration.${languageId}`,
          languageId: languageId === "large" ? "typescript" : languageId,
          text,
        }),
      );
    },
    ToggleWrapping: () =>
      foldEditor(
        model,
        CodeEditor.execute(
          CodeEditor.Operation.SetOptions({
            ...model.editor.options,
            lineWrapping: !model.editor.options.lineWrapping,
          }),
        ),
      ),
    ToggleReadOnly: () =>
      foldReference(
        model,
        CodeEditor.execute(
          CodeEditor.Operation.SetOptions({
            ...model.reference.options,
            readOnly: !model.reference.options.readOnly,
          }),
        ),
      ),
    Save: () => {
      const { document } = CodeEditor.snapshot(model.editor);
      return {
        model: {
          ...model,
          savedText: document.text,
          savedSession: document.session,
          announcement: "Snapshot saved for this demo session.",
        },
      };
    },
    SelectSetting: ({ name }) => {
      if (model.selectedSetting === name)
        return { model: { ...model, selectedSetting: null, announcement: `Cleared ${name}.` } };
      const { document } = model.editor;
      const found = occurrences(analyze(document.text), name);
      const uses = found.filter((occurrence) => occurrence.kind === "reference").length;
      const selected = {
        model: {
          ...model,
          selectedSetting: name,
          announcement:
            uses === 0
              ? `${name} is not used in this file.`
              : `${name} is used ${uses === 1 ? "once" : `${uses} times`}.`,
        },
      };
      return found[0] === undefined
        ? selected
        : andThenEditor(
            selected,
            CodeEditor.Operation.Reveal({
              expected: CodeEditor.documentVersion(document),
              range: found[0],
            }),
          );
    },
  });
