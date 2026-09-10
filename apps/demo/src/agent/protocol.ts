import { Schema as S } from "effect";

export const Segment = S.Literals(["Initial", "Approved", "Denied"]);
export type Segment = typeof Segment.Type;

export const AgentStreamEvent = S.Union([
  S.Struct({ _tag: S.Literal("Started"), runId: S.String, modelId: S.String }),
  S.Struct({ _tag: S.Literal("TextStarted"), runId: S.String, partId: S.String }),
  S.Struct({ _tag: S.Literal("TextDelta"), runId: S.String, partId: S.String, delta: S.String }),
  S.Struct({ _tag: S.Literal("TextFinished"), runId: S.String, partId: S.String }),
  S.Struct({ _tag: S.Literal("ToolInputStarted"), runId: S.String, callId: S.String, name: S.String }),
  S.Struct({ _tag: S.Literal("ToolInputDelta"), runId: S.String, callId: S.String, delta: S.String }),
  S.Struct({ _tag: S.Literal("ToolCallReady"), runId: S.String, callId: S.String }),
  S.Struct({ _tag: S.Literal("ToolStarted"), runId: S.String, callId: S.String }),
  S.Struct({ _tag: S.Literal("ToolResult"), runId: S.String, callId: S.String, output: S.String }),
  S.Struct({ _tag: S.Literal("PermissionRequested"), runId: S.String, callId: S.String, reason: S.String }),
  S.Struct({ _tag: S.Literal("Finished"), runId: S.String }),
  S.Struct({ _tag: S.Literal("Failed"), runId: S.String, message: S.String }),
]);
export type AgentStreamEvent = typeof AgentStreamEvent.Type;

export const EventEnvelope = S.Struct({
  sequence: S.Int,
  event: AgentStreamEvent,
});
export type EventEnvelope = typeof EventEnvelope.Type;
