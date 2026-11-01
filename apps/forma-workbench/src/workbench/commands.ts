// The language host's work, as Foldkit commands. Each one reads the
// `FormaHost` resource and answers with a message.

import { Duration, Effect, Schema as S } from "effect";
import { Command } from "foldkit";

import { CodeEditor } from "@foldworks/code-editor";
import { readSource } from "./source.js";
import { valueChildren } from "./values.js";
import { analyzeProgram } from "./analysis.js";
import { Document, OutlineRow } from "./document.js";
import { FormaHost, call, required, closeValueSession } from "./host.js";
import { Message } from "./message.js";

/** How long typing must pause before the program is analyzed. */
export const ANALYSIS_DELAY = Duration.millis(120);

/** Reads a program's source as outline rows, with ids for every node. */
export const ReadProgram = Command.define("ReadFormaProgram", {
  args: { source: S.String },
  messages: [Message.LoadedProgram, Message.FailedProgram],
  execute: ({ source }) =>
    Effect.gen(function* () {
      const { host, config } = yield* FormaHost;
      const sourceToOutline = yield* required(host, "sourceToOutline");
      const read = yield* call(() => sourceToOutline({ sourceId: config.sourceId, source }));
      return Message.LoadedProgram({
        document: { revision: 0, source, identity: read.identity },
        rows: read.items,
      });
    }).pipe(Effect.catch((reason) => Effect.succeed(Message.FailedProgram({ reason })))),
});

/** Waits for typing to pause, then asks for an analysis of a revision. */
export const ScheduleAnalysis = Command.define("ScheduleFormaAnalysis", {
  args: { revision: S.Number },
  messages: [Message.AnalysisDue],
  execute: ({ revision }) =>
    Effect.sleep(ANALYSIS_DELAY).pipe(Effect.as(Message.AnalysisDue({ revision }))),
});

/** Prints a revision of the outline against the previous document and analyzes it. */
export const AnalyzeProgram = Command.define("AnalyzeFormaProgram", {
  args: { revision: S.Number, rows: S.Array(OutlineRow), base: S.NullOr(Document) },
  messages: [Message.Analyzed, Message.FailedAnalysis],
  execute: (input) =>
    analyzeProgram(input).pipe(
      Effect.map((analysis) => Message.Analyzed({ analysis })),
      Effect.catch((reason) =>
        Effect.succeed(Message.FailedAnalysis({ revision: input.revision, reason })),
      ),
    ),
});

/** Releasing an analysis releases all its retained values, including nested handles. */
export const ReleaseAnalysis = Command.define("ReleaseFormaAnalysis", {
  args: { sessionId: S.String },
  messages: [Message.ReleasedAnalysis],
  execute: ({ sessionId }) =>
    Effect.gen(function* () {
      const service = yield* FormaHost;
      yield* closeValueSession(service, sessionId).pipe(Effect.ignore);
      return Message.ReleasedAnalysis();
    }),
});

export const LoadValue = Command.define("LoadFormaValue", {
  args: { sessionId: S.String, id: S.String },
  messages: [Message.LoadedValue, Message.FailedValue],
  execute: ({ sessionId, id }) =>
    Effect.gen(function* () {
      const { host } = yield* FormaHost;
      const result = yield* call(() =>
        host.projectValue({ sessionId, valueRef: id, projections: ["summary"] }),
      );
      if (result.diagnostics.length > 0)
        return Message.FailedValue({
          sessionId,
          reason: result.diagnostics.map((d) => d.message).join("; "),
        });
      return Message.LoadedValue({ sessionId, id, nodes: valueChildren(result.value, id) });
    }).pipe(Effect.catch((reason) => Effect.succeed(Message.FailedValue({ sessionId, reason })))),
});

export const ParseSource = Command.define("ReadEditedFormaSource", {
  args: { expected: CodeEditor.DocumentVersion, source: S.String, base: Document },
  messages: [Message.ReadSource, Message.FailedProgram],
  execute: ({ expected, source, base }) =>
    Effect.sleep(ANALYSIS_DELAY).pipe(
      Effect.andThen(readSource(source, base)),
      Effect.map((result) => Message.ReadSource({ expected, ...result })),
      Effect.catch((reason) => Effect.succeed(Message.FailedProgram({ reason }))),
    ),
});
