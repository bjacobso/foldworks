import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import type { Update } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import { Document, Selection, TextEdit } from "./document";
import { DiagnosticBatch } from "./diagnostics";
import { Options, type InitConfig, Model as BaseModel } from "./model";

export { Document, Selection, TextEdit, applyEdits, normalizeText, exportText, positionAt, offsetAt } from "./document";
export { Diagnostic, DiagnosticBatch, jsonValidator, type Validator } from "./diagnostics";
export { Options, type InitConfig } from "./model";

export const DocumentVersion = S.Struct({ uri: S.String, session: S.Number, revision: S.Number });
export type DocumentVersion = typeof DocumentVersion.Type;
export const documentVersion = ({ uri, session, revision }: Document): DocumentVersion => ({ uri, session, revision });

/** Host operations shared by editor implementations. Edit batches are atomic and undoable. */
export const Operation = defineMessageUnion({
  ApplyEdits: { expected: DocumentVersion, edits: S.Array(TextEdit), selection: S.optional(Selection) },
  Select: { expected: DocumentVersion, selection: Selection },
  Focus: {}, Undo: {}, Redo: {},
  ReplaceDocument: { uri: S.String, text: S.String, languageId: S.String },
  SetLanguage: { languageId: S.String },
  SetOptions: Options.fields,
  SetDiagnostics: DiagnosticBatch.fields,
});
export type Operation = typeof Operation.Type;
export const Origin = S.Literals(["input", "external", "undo", "redo"]);
export type Origin = typeof Origin.Type;
export const OutMessage = defineMessageUnion({
  ChangedDocument: { document: Document, origin: Origin },
  ChangedSelection: { selection: Selection },
  RejectedOperation: { reason: S.String },
});
export type OutMessage = typeof OutMessage.Type;

/** Implementation-specific caches, history, and mount identities stay out of host snapshots. */
export const EditorSnapshot = BaseModel;
export type EditorSnapshot = typeof EditorSnapshot.Type;
export type ViewConfig<State, Message, ParentMessage> = Readonly<{
  model: State;
  label: string;
  toParentMessage: (message: Message) => ParentMessage;
  showInspector?: boolean;
}>;

/** Implementations retain their own Foldkit model/message schemas and runtime lifecycle. */
export interface EditorImplementation<State, Message> {
  readonly id: string;
  readonly Model: S.Schema<State>;
  readonly Message: S.Schema<Message>;
  readonly init: (config: InitConfig) => State;
  readonly execute: (operation: Operation) => Message;
  readonly update: (model: State, message: Message) => Update.ReturnWithOutMessage<State, Message, OutMessage>;
  readonly view: <ParentMessage>(config: ViewConfig<State, Message, ParentMessage>, h: HtmlBuilder<ParentMessage>) => Html;
  readonly snapshot: (model: State) => EditorSnapshot;
}
