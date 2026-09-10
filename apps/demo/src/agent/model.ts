import { Schema as S } from "effect";
import { Stateful } from "@foldworks/ui";

import { Segment } from "./protocol";

export const ModelId = S.Literals(["atlas-fast", "atlas-balanced", "atlas-reasoning"]);
export type ModelId = typeof ModelId.Type;

export type ModelFixture = Readonly<{
  id: ModelId;
  label: string;
  provider: string;
  description: string;
}>;

export const modelFixtures: ReadonlyArray<ModelFixture> = [
  { id: "atlas-fast", label: "Atlas Fast", provider: "Local fixture", description: "Quick responses with compact tool summaries" },
  { id: "atlas-balanced", label: "Atlas Balanced", provider: "Local fixture", description: "Balanced planning and implementation detail" },
  { id: "atlas-reasoning", label: "Atlas Reasoning", provider: "Local fixture", description: "Deeper analysis with deliberate tool use" },
];

export const TextPart = S.Struct({
  _tag: S.Literal("Text"),
  id: S.String,
  text: S.String,
  status: S.Literals(["Streaming", "Complete", "Interrupted", "Failed"]),
});
export type TextPart = typeof TextPart.Type;

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

export const ConversationPart = S.Union([TextPart, ToolPart]);
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
  transcript: S.Array(Turn),
  draft: S.String,
  selectedModel: ModelId,
  modelPicker: Stateful.Select.Model,
  runState: RunState,
  nextRunNumber: S.Int,
  isFollowing: S.Boolean,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export const init = (): Model => ({
  transcript: [],
  draft: "",
  selectedModel: "atlas-balanced",
  modelPicker: Stateful.Select.init({ id: "agent-model-picker", isAnimated: true }),
  runState: { _tag: "Idle" },
  nextRunNumber: 1,
  isFollowing: true,
  announcement: "Agent playground ready.",
});

export const isActive = (model: Model): boolean =>
  model.runState._tag === "Streaming" || model.runState._tag === "AwaitingPermission";

export const selectedModelFixture = (model: Model): ModelFixture =>
  modelFixtures.find((fixture) => fixture.id === model.selectedModel) ?? modelFixtures[1]!;
