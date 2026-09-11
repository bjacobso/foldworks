import { Schema as S } from "effect";
import { Stateful } from "@foldworks/ui";

import { Segment } from "./protocol";

export type ModelOption = Readonly<{
  id: string;
  label: string;
  provider: string;
  description: string;
}>;

export const TextPart = S.Struct({
  _tag: S.Literal("Text"),
  id: S.String,
  text: S.String,
  status: S.Literals(["Streaming", "Complete", "Interrupted", "Failed"]),
});
export type TextPart = typeof TextPart.Type;

export const ReasoningPart = S.Struct({
  _tag: S.Literal("Reasoning"),
  id: S.String,
  text: S.String,
  status: S.Literals(["Streaming", "Complete", "Interrupted", "Failed"]),
});
export type ReasoningPart = typeof ReasoningPart.Type;

export const ToolPart = S.Struct({
  _tag: S.Literal("Tool"),
  callId: S.String,
  name: S.String,
  input: S.String,
  output: S.String,
  permissionReason: S.String,
  status: S.Literals([
    "Preparing",
    "Running",
    "WaitingApproval",
    "Completed",
    "Denied",
    "Cancelled",
    "Failed",
  ]),
});
export type ToolPart = typeof ToolPart.Type;

export const ConversationPart = S.Union([TextPart, ReasoningPart, ToolPart]);
export type ConversationPart = typeof ConversationPart.Type;

export const Turn = S.Struct({
  id: S.String,
  role: S.Literals(["User", "Assistant"]),
  modelId: S.String,
  parts: S.Array(ConversationPart),
});
export type Turn = typeof Turn.Type;

export const RunState = S.Union([
  S.Struct({ _tag: S.Literal("Idle") }),
  S.Struct({
    _tag: S.Literal("Streaming"),
    runId: S.String,
    segment: Segment,
    lastSequence: S.Int,
  }),
  S.Struct({
    _tag: S.Literal("AwaitingPermission"),
    runId: S.String,
    callId: S.String,
    lastSequence: S.Int,
  }),
  S.Struct({
    _tag: S.Literal("Failed"),
    runId: S.String,
    message: S.String,
  }),
]);
export type RunState = typeof RunState.Type;

export const Model = S.Struct({
  id: S.String,
  transcript: S.Array(Turn),
  draft: S.String,
  selectedModel: S.String,
  defaultModel: S.String,
  modelPicker: Stateful.Select.Model,
  runState: RunState,
  nextRunNumber: S.Int,
  isFollowing: S.Boolean,
  anchoredTurnId: S.String,
  currentTurnId: S.String,
  visibleTurnIds: S.Array(S.String),
  copiedTurnId: S.String,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export type InitConfig = Readonly<{
  id: string;
  selectedModel: string;
}>;

export const init = ({ id, selectedModel }: InitConfig): Model => ({
  id,
  transcript: [],
  draft: "",
  selectedModel,
  defaultModel: selectedModel,
  modelPicker: Stateful.Select.init({ id: `${id}-model-picker`, isAnimated: true }),
  runState: { _tag: "Idle" },
  nextRunNumber: 1,
  isFollowing: true,
  anchoredTurnId: "",
  currentTurnId: "",
  visibleTurnIds: [],
  copiedTurnId: "",
  announcement: "Agent ready.",
});

export const isActive = (model: Model): boolean =>
  model.runState._tag === "Streaming" || model.runState._tag === "AwaitingPermission";

export const transcriptId = (model: Model): string => `${model.id}-transcript`;

export const turnElementId = (model: Model, turnId: string): string =>
  `${model.id}-turn-${turnId}`;

export const turnText = (turn: Turn): string => turn.parts
  .filter((part): part is TextPart => part._tag === "Text")
  .map((part) => part.text)
  .join("\n\n");

export const latestUserPrompt = (model: Model): string => {
  for (let index = model.transcript.length - 1; index >= 0; index -= 1) {
    const turn = model.transcript[index];
    if (turn?.role !== "User") continue;
    const part = turn.parts.find((item) => item._tag === "Text");
    return part?._tag === "Text" ? part.text : "";
  }
  return "";
};
