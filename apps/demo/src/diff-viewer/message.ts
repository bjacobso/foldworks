import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { CodeEditor } from "@foldworks/code-editor";
import { ChangedFiles, ReviewThreads, Suggestion, Verdict } from "@foldworks/review";

const Line = { path: S.String, side: S.Literals(["old", "new"]), line: S.Number };
export const Message = defineMessageUnion({
  GotEditorMessage: { message: CodeEditor.Message },
  GotThreadsMessage: { message: ReviewThreads.Message },
  GotFilesMessage: { message: ChangedFiles.Message },
  SelectedFile: { path: S.String },
  ChangedMode: { mode: S.Literals(["Unified", "Split"]) },
  ToggledSemantic: {},
  ToggledDark: {},
  SelectedLine: Line,
  StartedSelection: Line,
  ExtendedSelection: { ...Line, method: S.Literals(["Pointer", "Keyboard"]) },
  EndedSelection: {},
  CancelledSelection: {},
  ExpandedGap: { id: S.String },
  ChangedViewed: { path: S.String, viewed: S.Boolean },
  SwitchedActor: { actor: S.Literals(["author", "reviewer"]) },
  OpenedRequest: {},
  AppliedSuggestion: { suggestion: Suggestion, threadId: S.String },
  ChangedSummary: { value: S.String },
  ChangedVerdict: { verdict: Verdict },
  SubmittedReview: {},
  ReranChecks: {},
  Merged: {},
  Reset: {},
  Persisted: { error: S.String },
  CompletedReveal: {},
});
export type Message = typeof Message.Type;
