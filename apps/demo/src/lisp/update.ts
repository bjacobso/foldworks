import { Effect, Option, Schema as S } from "effect";
import { Command, Update } from "foldkit";
import { CodeEditor } from "@foldworks/code-editor";
import { read } from "@foldworks/code-editor/lisp";
import { evaluateRanges, imageFor } from "./interpreter";
import { Message } from "./message";
import { annotationsFor, imageKey, Origin, replUri, type Model } from "./model";

type Result = Update.Return<Model, Message>;
type Range = Readonly<{ from: number; to: number }>;

/** The runtime lives outside the model, so evaluation is a command whose results return as data. */
const Evaluate = Command.define("EvaluateLisp", {
  args: {
    origin: Origin,
    record: S.Boolean,
    scope: CodeEditor.EvaluationScope,
    version: CodeEditor.DocumentVersion,
    generation: S.Number,
    file: S.String,
    text: S.String,
    ranges: S.Array(S.Struct({ from: S.Number, to: S.Number })),
  },
  messages: [Message.Evaluated],
  execute: ({ file, text, ranges, ...request }) =>
    Effect.sync(() =>
      Message.Evaluated({
        ...request,
        outcomes: evaluateRanges(imageFor(imageKey(request.generation), file), text, ranges, {
          skipCommentBlocks: request.scope === "document",
        }),
      }),
    ),
});

const evaluateFile = (
  model: Model,
  scope: CodeEditor.EvaluationScope,
  ranges: readonly Range[],
  record: boolean,
) =>
  Evaluate({
    origin: "file",
    record,
    scope,
    version: CodeEditor.documentVersion(model.editor.document),
    generation: model.generation,
    file: model.editor.document.text,
    text: model.editor.document.text,
    ranges,
  });
const loadFile = (model: Model) =>
  evaluateFile(model, "document", read(model.editor.document.text).forms, false);

const foldEditor = Update.foldChild({
  update: CodeEditor.update,
  read: (model: Model) => Option.some(model.editor),
  write: (model, editor) => ({ ...model, editor }),
  toParentMessage: (message) => Message.Editor({ message }),
  foldOutMessage:
    (event: CodeEditor.OutMessage) =>
    (model: Model): Result => {
      switch (event._tag) {
        case "RequestedEvaluation":
          return {
            model,
            commands: [evaluateFile(model, event.scope, event.ranges, event.scope === "form")],
          };
        case "ChangedDocument":
          return { model, commands: model.live ? [loadFile(model)] : [] };
        case "RejectedOperation":
          return { model: { ...model, announcement: event.reason } };
        default:
          return { model };
      }
    },
});

const foldRepl = Update.foldChild({
  update: CodeEditor.update,
  read: (model: Model) => Option.some(model.repl),
  write: (model, repl) => ({ ...model, repl }),
  toParentMessage: (message) => Message.Repl({ message }),
  foldOutMessage:
    (event: CodeEditor.OutMessage) =>
    (model: Model): Result => {
      if (event._tag !== "RequestedEvaluation") return { model };
      const text = model.repl.document.text;
      if (!text.trim()) return { model };
      return {
        model,
        commands: [
          Evaluate({
            origin: "repl",
            record: true,
            scope: "form",
            version: event.version,
            generation: model.generation,
            file: model.editor.document.text,
            text,
            ranges: [{ from: 0, to: text.length }],
          }),
        ],
      };
    },
});

const setAnnotations = (model: Model, annotations: readonly CodeEditor.Annotation[]): Result =>
  foldEditor(
    model,
    CodeEditor.execute(
      CodeEditor.Operation.SetAnnotations({
        ...CodeEditor.documentVersion(model.editor.document),
        source: "repl",
        annotations,
      }),
    ),
  );

const clearRepl = (model: Model): Result =>
  foldRepl(
    model,
    CodeEditor.execute(
      CodeEditor.Operation.ReplaceDocument({ uri: replUri, text: "", languageId: "clojure" }),
    ),
  );

const then = (result: Result, next: (model: Model) => Result): Result => {
  const after = next(result.model);
  return { model: after.model, commands: [...(result.commands ?? []), ...(after.commands ?? [])] };
};

const sameVersion = (model: Model, version: CodeEditor.DocumentVersion) =>
  version.uri === model.editor.document.uri &&
  version.session === model.editor.document.session &&
  version.revision === model.editor.document.revision;

const describe = (outcomes: readonly { status: string; inline: string; source: string }[]) => {
  const last = outcomes.at(-1);
  if (!last) return "Nothing to evaluate.";
  const source = last.source.length > 40 ? `${last.source.slice(0, 39)}…` : last.source;
  return last.status === "error"
    ? `${source} failed: ${last.inline}`
    : `${source} ⇒ ${last.inline}`;
};

export const update = (model: Model, message: Message): Result =>
  Message.match<Result>(message, {
    Editor: ({ message }) => foldEditor(model, message),
    Repl: ({ message }) => foldRepl(model, message),
    ToggleLive: () => {
      const live = !model.live;
      const next = {
        ...model,
        live,
        announcement: live
          ? "Live evaluation on."
          : "Live evaluation off. Edited results will dim until you evaluate them.",
      };
      return { model: next, commands: live ? [loadFile(next)] : [] };
    },
    LoadFile: () => ({
      model: { ...model, announcement: "Loaded ledger.clj into the REPL." },
      commands: [loadFile(model)],
    }),
    ResetImage: () => {
      const next = {
        ...model,
        generation: model.generation + 1,
        announcement: "Started a fresh image. Definitions are gone until you load the file.",
      };
      const cleared = setAnnotations(next, []);
      return next.live
        ? then(cleared, (after) => ({
            model: { ...after, announcement: "Started a fresh image and reloaded the file." },
            commands: [loadFile(after)],
          }))
        : cleared;
    },
    ClearTranscript: () => ({ model: { ...model, transcript: [] } }),
    Evaluated: ({ origin, record, scope, version, generation, outcomes }) => {
      if (generation !== model.generation) return { model };
      const entries = record
        ? outcomes.map((outcome, index) => ({ id: model.nextEntryId + index, origin, outcome }))
        : [];
      const recorded: Model = {
        ...model,
        transcript: [...model.transcript, ...entries].slice(-60),
        nextEntryId: model.nextEntryId + entries.length,
        announcement: record || scope === "form" ? describe(outcomes) : model.announcement,
      };
      if (origin === "repl")
        return outcomes.some((outcome) => outcome.status === "error")
          ? { model: recorded }
          : clearRepl(recorded);
      // A result for an older revision would describe code that no longer exists.
      if (!sameVersion(recorded, version)) return { model: recorded };
      const fresh = annotationsFor(outcomes);
      // Keep results these outcomes do not replace, such as forms run inside a rich comment block.
      const kept = recorded.editor.annotations
        .filter(
          (item) =>
            item.source === "repl" &&
            item.to > item.from &&
            !outcomes.some((outcome) => outcome.from < item.to && outcome.to > item.from),
        )
        .map(({ from, to, label, tone, stale }) => ({ from, to, label, tone, stale }));
      return setAnnotations(
        recorded,
        [...kept, ...fresh].sort((a, b) => a.from - b.from),
      );
    },
    Promote: ({ id }) => {
      const entry = model.transcript.find((item) => item.id === id);
      if (!entry) return { model };
      const { text } = model.editor.document;
      const insert = `${text.endsWith("\n") ? "" : "\n"}\n${entry.outcome.source}\n`;
      const at = text.length;
      const start = at + insert.indexOf(entry.outcome.source);
      return foldEditor(
        { ...model, announcement: "Added the form to ledger.clj." },
        CodeEditor.execute(
          CodeEditor.Operation.ApplyEdits({
            expected: CodeEditor.documentVersion(model.editor.document),
            edits: [{ from: at, to: at, insert }],
            selection: { anchor: start, head: start + entry.outcome.source.length },
          }),
        ),
      );
    },
    Recall: ({ id }) => {
      const entry = model.transcript.find((item) => item.id === id);
      if (!entry) return { model };
      return foldRepl(
        { ...model, announcement: "Copied the form into the REPL input." },
        CodeEditor.execute(
          CodeEditor.Operation.ReplaceDocument({
            uri: replUri,
            text: entry.outcome.source,
            languageId: "clojure",
          }),
        ),
      );
    },
    Reveal: ({ id }) => {
      const entry = model.transcript.find((item) => item.id === id);
      if (!entry) return { model };
      const { text } = model.editor.document;
      // Positions drift as the file changes; find the occurrence nearest to where the form was.
      const matches: number[] = [];
      for (
        let at = text.indexOf(entry.outcome.source);
        at >= 0;
        at = text.indexOf(entry.outcome.source, at + 1)
      )
        matches.push(at);
      const from = matches.sort(
        (a, b) => Math.abs(a - entry.outcome.from) - Math.abs(b - entry.outcome.from),
      )[0];
      if (from === undefined)
        return { model: { ...model, announcement: "That form has changed since it ran." } };
      return foldEditor(
        model,
        CodeEditor.Message.Reveal({
          selection: { anchor: from, head: from + entry.outcome.source.length },
        }),
      );
    },
  });
