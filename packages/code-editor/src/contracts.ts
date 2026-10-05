import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import {
  CompletionItem,
  HoverSource,
  SemanticToken,
  TextRange,
  type Hover,
} from "@foldworks/text-intelligence";
import type { Update } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import { Document, Selection, TextEdit } from "./document";
import { DiagnosticBatch } from "./diagnostics";
import { Options, type InitConfig, Model as BaseModel } from "./model";

export {
  Document,
  Selection,
  TextEdit,
  applyEdits,
  normalizeText,
  exportText,
  positionAt,
  offsetAt,
} from "./document";
export { Diagnostic, DiagnosticBatch, jsonValidator, type Validator } from "./diagnostics";
export { CompletionItem, SemanticToken, TextRange, type Hover } from "@foldworks/text-intelligence";
export { Options, type InitConfig } from "./model";

export const DocumentVersion = S.Struct({ uri: S.String, session: S.Number, revision: S.Number });
export type DocumentVersion = typeof DocumentVersion.Type;
export const documentVersion = ({ uri, session, revision }: Document): DocumentVersion => ({
  uri,
  session,
  revision,
});

/** Host operations shared by editor implementations. Edit batches are atomic and undoable. */
export const Operation = defineMessageUnion({
  ApplyEdits: {
    expected: DocumentVersion,
    edits: S.Array(TextEdit),
    selection: S.optional(Selection),
  },
  Select: { expected: DocumentVersion, selection: Selection },
  Focus: {},
  Undo: {},
  Redo: {},
  ReplaceDocument: { uri: S.String, text: S.String, languageId: S.String },
  SetLanguage: { languageId: S.String },
  SetOptions: Options.fields,
  SetDiagnostics: DiagnosticBatch.fields,
  /**
   * Paints token kinds over the built-in lexer, for the revision they were
   * computed for. Later edits carry them along until the next batch.
   */
  SetSemanticTokens: {
    uri: S.String,
    session: S.Number,
    revision: S.Number,
    tokens: S.Array(SemanticToken),
  },
  /** Offers items that replace `from`–`to`. Ignored unless the caret is in that range. */
  ShowCompletions: {
    expected: DocumentVersion,
    from: S.Number,
    to: S.Number,
    items: S.Array(CompletionItem),
  },
  /** Scrolls a range into view without moving focus or the selection. */
  Reveal: { expected: DocumentVersion, range: TextRange },
});
export type Operation = typeof Operation.Type;
export const Origin = S.Literals(["input", "external", "undo", "redo"]);
export type Origin = typeof Origin.Type;
export const OutMessage = defineMessageUnion({
  ChangedDocument: { document: Document, origin: Origin },
  ChangedSelection: { selection: Selection },
  RejectedOperation: { reason: S.String },
  /** Ctrl+Space or the Suggest button. Answer with `ShowCompletions`. */
  RequestedCompletion: { version: DocumentVersion, offset: S.Number },
  /** The pointer rested on a character, or Ctrl+Shift+Space asked about the caret. */
  Hovered: { version: DocumentVersion, offset: S.NullOr(S.Number), source: HoverSource },
});
export type OutMessage = typeof OutMessage.Type;

/** Implementation-specific caches, history, and mount identities stay out of host snapshots. */
export const EditorSnapshot = BaseModel;
export type EditorSnapshot = typeof EditorSnapshot.Type;
export type ViewConfig<State, Message, ParentMessage> = Readonly<{
  model: State;
  label: string;
  toParentMessage: (message: Message) => ParentMessage;
  /** Header detail. Omit for language and read-only status, or pass null to hide it. */
  meta?: string | null;
  /** Hide the command row when the host provides its own controls. */
  showToolbar?: boolean;
  showInspector?: boolean;
  /**
   * Information about the text under the pointer or at the caret: the range it
   * describes and content built with the parent's `h`, or `null`. Diagnostics
   * at the offset are shown with it.
   */
  hover?: (request: HoverRequest) => Hover | null;
  /** Ranges another view corresponds to, painted behind the text. */
  highlights?: ReadonlyArray<Highlight>;
}>;

export type HoverRequest = Readonly<{
  offset: number;
  document: Document;
  source: HoverSource;
}>;

/** A range painted behind the text, with `kind` exposed as `data-highlight`. */
export type Highlight = Readonly<{ from: number; to: number; kind?: string }>;

/** Implementations retain their own Foldkit model/message schemas and runtime lifecycle. */
export interface EditorImplementation<State, Message> {
  readonly id: string;
  readonly Model: S.Schema<State>;
  readonly Message: S.Schema<Message>;
  readonly init: (config: InitConfig) => State;
  readonly execute: (operation: Operation) => Message;
  readonly update: (
    model: State,
    message: Message,
  ) => Update.ReturnWithOutMessage<State, Message, OutMessage>;
  readonly view: <ParentMessage>(
    config: ViewConfig<State, Message, ParentMessage>,
    h: HtmlBuilder<ParentMessage>,
  ) => Html;
  readonly snapshot: (model: State) => EditorSnapshot;
}
