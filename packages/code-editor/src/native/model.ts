import { Schema as S } from "effect";
import { Completion, HoverSource, SemanticToken } from "@foldworks/text-intelligence";
import { Document, Selection } from "../document";
import { DiagnosticBatch } from "../diagnostics";
import { Options, init as initDocument, type InitConfig } from "../model";
import { Line, lineStarts, tokenize } from "./tokenize";
import { TextEdit } from "../document";

export const HistoryStep = S.Struct({
  edits: S.Array(TextEdit),
  inverse: S.Array(TextEdit),
  before: Selection,
  after: Selection,
});
export type HistoryStep = typeof HistoryStep.Type;
export const HistoryGroup = S.Struct({
  id: S.Number,
  kind: S.String,
  time: S.Number,
  steps: S.Array(HistoryStep),
});
export type HistoryGroup = typeof HistoryGroup.Type;
export const Model = S.Struct({
  id: S.String,
  document: Document,
  selection: Selection,
  options: Options,
  lines: S.Array(Line),
  starts: S.Array(S.Number),
  past: S.Array(HistoryGroup),
  future: S.Array(HistoryGroup),
  nextHistoryId: S.Number,
  diagnostics: S.Array(DiagnosticBatch),
  viewport: S.Struct({ top: S.Number, left: S.Number, height: S.Number }),
  search: S.Struct({
    open: S.Boolean,
    query: S.String,
    replacement: S.String,
    caseSensitive: S.Boolean,
  }),
  /** Host token kinds, carried through edits until the next batch. */
  tokens: S.Array(SemanticToken),
  /** Suggestions being shown, or `null`. */
  completion: S.NullOr(Completion.List),
  hover: S.NullOr(S.Struct({ offset: S.Number, source: HoverSource })),
  goToLine: S.String,
  lease: S.String,
  composing: S.Boolean,
  status: S.Literals(["Loading", "Ready", "Failed"]),
  error: S.String,
});
export type Model = typeof Model.Type;
export const init = (config: InitConfig): Model => {
  const base = initDocument(config);
  const lines = tokenize(base.document.text, base.document.languageId);
  return {
    ...base,
    lease: "",
    lines,
    starts: lineStarts(lines),
    past: [],
    future: [],
    nextHistoryId: 1,
    viewport: { top: 0, left: 0, height: 352 },
    search: { open: false, query: "", replacement: "", caseSensitive: true },
    tokens: [],
    completion: null,
    hover: null,
    goToLine: "1",
    composing: false,
  };
};
