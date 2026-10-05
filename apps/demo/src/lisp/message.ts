import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { CodeEditor } from "@foldworks/code-editor";
import { Origin, Outcome } from "./model";

export const Message = defineMessageUnion({
  Editor: { message: CodeEditor.Message },
  Repl: { message: CodeEditor.Message },
  ToggleLive: {},
  LoadFile: {},
  ResetImage: {},
  ClearTranscript: {},
  Evaluated: {
    origin: Origin,
    record: S.Boolean,
    scope: CodeEditor.EvaluationScope,
    version: CodeEditor.DocumentVersion,
    generation: S.Number,
    outcomes: S.Array(Outcome),
  },
  Promote: { id: S.Number },
  Recall: { id: S.Number },
  Reveal: { id: S.Number },
});
export type Message = typeof Message.Type;
