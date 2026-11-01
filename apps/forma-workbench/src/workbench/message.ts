import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { CodeEditor } from "@foldworks/code-editor";
import { ValueTree } from "@foldworks/ui";
import { ValueNodeSchema } from "./values.js";
import { Outliner } from "@foldworks/outliner";

import { RunOutcome } from "./run.js";
import { Proposal } from "./edits.js";
import { Analysis } from "./analysis.js";
import { Document, OutlineRow } from "./document.js";

export const Message = defineMessageUnion({
  SetPrompt: { value: S.String },
  AskAssistant: {},
  AssistantReply: { token: S.Number, proposer: S.String, text: S.String },
  Run: {},
  DecideCapability: { allow: S.Boolean },
  Ran: { outcome: RunOutcome },
  FailedRun: { token: S.Number, reason: S.String },
  EditArgument: { value: S.String },
  Refactor: { action: S.Literals(["wrap", "unwrap", "raise", "splice", "rename", "extract"]) },
  PreparedEdit: { proposal: Proposal, direct: S.Boolean },
  FailedEdit: { token: S.Number, reason: S.String },
  AcceptProposal: {},
  DiscardProposal: {},
  SetPane: { pane: S.Literals(["outline", "source"]) },
  GotSourceMessage: { message: CodeEditor.Message },
  ReadSource: {
    expected: CodeEditor.DocumentVersion,
    document: Document,
    rows: S.Array(OutlineRow),
    errors: S.Array(CodeEditor.Diagnostic),
  },
  SetNotation: { notation: S.Literals(["Outline", "Brackets"]) },
  CloseInspector: {},
  Inspect: { id: S.String },
  GotValueMessage: { message: ValueTree.Message },
  RevealNode: { id: S.String },
  GoToDefinition: { key: S.String },
  DefinitionAtCaret: {},
  FailedValue: { sessionId: S.String, reason: S.String },
  LoadedValue: { sessionId: S.String, id: S.String, nodes: S.Array(ValueNodeSchema) },
  ReleasedAnalysis: {},
  GotOutlinerMessage: { message: Outliner.Message },
  /** The host read the program's source as rows. */
  LoadedProgram: { document: Document, rows: S.Array(OutlineRow) },
  /** The host could not read the program. */
  FailedProgram: { reason: S.String },
  /** Typing paused long enough to analyze this revision. */
  AnalysisDue: { revision: S.Number },
  Analyzed: { analysis: Analysis },
  FailedAnalysis: { revision: S.Number, reason: S.String },
});
export type Message = typeof Message.Type;
