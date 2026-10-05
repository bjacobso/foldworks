import { Schema as S } from "effect";
import { CodeEditor } from "@foldworks/code-editor";
import { read } from "@foldworks/code-editor/lisp";
import { evaluateRanges, imageFor, type Outcome as Result } from "./interpreter";
import { ledgerSample } from "./sample";

export const Table = S.Struct({
  columns: S.Array(S.String),
  rows: S.Array(S.Array(S.String)),
  total: S.Number,
});
export const Outcome = S.Struct({
  from: S.Number,
  to: S.Number,
  source: S.String,
  status: S.Literals(["value", "var", "error"]),
  inline: S.String,
  pretty: S.String,
  output: S.Array(S.String),
  table: S.NullOr(Table),
});
export type Outcome = typeof Outcome.Type;
export const Origin = S.Literals(["file", "repl"]);
export type Origin = typeof Origin.Type;
export const Entry = S.Struct({ id: S.Number, origin: Origin, outcome: Outcome });
export type Entry = typeof Entry.Type;

export const Model = S.Struct({
  editor: CodeEditor.Model,
  repl: CodeEditor.Model,
  live: S.Boolean,
  generation: S.Number,
  transcript: S.Array(Entry),
  nextEntryId: S.Number,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export const fileUri = "file:///ledger.clj";
export const replUri = "repl:///input.clj";
export const imageKey = (generation: number) => `lisp-demo:${generation}`;

/** Inline results: values and errors stand out, definitions stay quiet. */
export const annotationsFor = (outcomes: readonly Result[]): readonly CodeEditor.Annotation[] =>
  outcomes.map((outcome) => ({
    from: outcome.from,
    to: outcome.to,
    label: outcome.output.length
      ? `${outcome.inline}  · printed ${outcome.output.length} line${outcome.output.length === 1 ? "" : "s"}`
      : outcome.inline,
    tone: outcome.status === "error" ? "error" : outcome.status === "var" ? "muted" : "value",
    stale: false,
  }));

export const init = (): Model => {
  const editor = CodeEditor.init({
    id: "lisp-file",
    uri: fileUri,
    languageId: "clojure",
    text: ledgerSample,
  });
  // Load the file into a fresh image so the REPL can use its definitions immediately.
  const outcomes = evaluateRanges(imageFor(imageKey(0)), ledgerSample, read(ledgerSample).forms, {
    skipCommentBlocks: true,
  });
  return {
    editor: {
      ...editor,
      annotations: annotationsFor(outcomes).map((annotation) => ({
        source: "repl",
        ...annotation,
      })),
    },
    repl: CodeEditor.init({
      id: "lisp-repl",
      uri: replUri,
      languageId: "clojure",
      lineNumbers: false,
    }),
    live: true,
    generation: 0,
    transcript: [],
    nextEntryId: 1,
    announcement: "Loaded ledger.clj into the REPL.",
  };
};
