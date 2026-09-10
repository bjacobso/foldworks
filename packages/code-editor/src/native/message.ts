import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { Selection, TextEdit } from "../document";
import { Options } from "../model";
import { DiagnosticBatch } from "../diagnostics";

import { Operation } from "../contracts";
export { OutMessage } from "../contracts";

export const Action = S.Literals(["undo", "redo", "indent", "outdent", "newline", "comment", "duplicate", "deleteLine", "format", "findNext", "findPrevious", "replace", "replaceAll", "complete", "goToLine", "focus"]);
export type Action = typeof Action.Type;
export const Identity = { session: S.Number, lease: S.String };
export const Message = defineMessageUnion({
  Mounted: { ...Identity },
  FailedMount: { reason: S.String },
  Edited: { ...Identity, baseRevision: S.Number, edits: S.Array(TextEdit), before: Selection, selection: Selection, kind: S.String, time: S.Number, groupId: S.Number },
  Selected: { ...Identity, revision: S.Number, selection: Selection },
  Scrolled: { ...Identity, top: S.Number, left: S.Number, height: S.Number },
  Composition: { ...Identity, active: S.Boolean },
  Run: { action: Action },
  Execute: { operation: Operation },
  CompletedCommand: { ...Identity, reason: S.String },
  ReplaceDocument: { uri: S.String, text: S.String, languageId: S.String },
  SetOptions: Options.fields,
  SetLanguage: { languageId: S.String },
  SetDiagnostics: DiagnosticBatch.fields,
  OpenSearch: { open: S.Boolean },
  SearchQuery: { query: S.String },
  SearchReplacement: { replacement: S.String },
  ToggleCase: {},
  OpenCompletion: { open: S.Boolean },
  MoveCompletion: { delta: S.Number },
  ChooseCompletion: { index: S.Number },
  GoToLine: { value: S.String },
  Reveal: { selection: Selection },
});
export type Message = typeof Message.Type;
