import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { CodeEditor } from "@foldworks/code-editor";
import { Outliner } from "@foldworks/outliner";
import { ValueTree } from "@foldworks/ui";

export const Refactoring = S.Literals(["Wrap", "Unwrap", "Raise", "Join", "Explode"]);
export type Refactoring = typeof Refactoring.Type;

export const Shortcut = S.Literals(["ToggleSource", "Ask"]);
export type Shortcut = typeof Shortcut.Type;

export const Message = defineMessageUnion({
  GotOutlinerMessage: { message: Outliner.Message },
  ToggledSource: {},
  ChoseNotation: { notation: S.Literals(["Outline", "Lisp"]) },
  GotSourceMessage: { message: CodeEditor.Message },
  GotValueMessage: { message: ValueTree.Message },
  /** Focus left the source pane; a valid draft is printed again. */
  BlurredSource: {},
  ChangedPrompt: { text: S.String },
  SubmittedPrompt: {},
  ChoseSuggestion: { prompt: S.String },
  /** Starts a request for the user to finish, such as "Extract this as ". */
  PrefilledPrompt: { text: S.String },
  AcceptedProposal: {},
  DiscardedProposal: {},
  DismissedReply: {},
  /** `head` is the form to wrap with, for `Wrap`. */
  Refactored: { refactoring: Refactoring, head: S.String },
  ClickedReference: { id: S.String },
  /** Starts stepping through how a row's form evaluated. */
  StartedStepping: { id: S.String },
  SteppedTo: { index: S.Number },
  StoppedStepping: {},
  PressedShortcut: { shortcut: Shortcut },
  CompletedFocus: {},
});
export type Message = typeof Message.Type;
