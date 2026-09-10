import { Effect, Stream } from "effect";
import type { Agent } from "@foldworks/agent";

type Step = Readonly<{ delay: number; event: Agent.StreamEvent }>;

const initialEvents = (runId: string, modelId: string): ReadonlyArray<Agent.StreamEvent> => [
  { _tag: "Started", runId, modelId },
  { _tag: "TextStarted", runId, partId: `${runId}-text-1` },
  { _tag: "TextDelta", runId, partId: `${runId}-text-1`, delta: "I’ll inspect the release setup first, " },
  { _tag: "TextDelta", runId, partId: `${runId}-text-1`, delta: "then I’ll prepare the smallest " },
  { _tag: "TextDelta", runId, partId: `${runId}-text-1`, delta: "safe checklist update." },
  { _tag: "TextFinished", runId, partId: `${runId}-text-1` },
  { _tag: "ToolInputStarted", runId, callId: `${runId}-read`, name: "read_file" },
  { _tag: "ToolInputDelta", runId, callId: `${runId}-read`, delta: "{\n  \"path\": " },
  { _tag: "ToolInputDelta", runId, callId: `${runId}-read`, delta: "\"package.json\"\n}" },
  { _tag: "ToolCallReady", runId, callId: `${runId}-read` },
  { _tag: "ToolStarted", runId, callId: `${runId}-read` },
  { _tag: "ToolResult", runId, callId: `${runId}-read`, output: "{\n  \"scripts\": [\"build\", \"test\", \"typecheck\"],\n  \"packageManager\": \"pnpm\"\n}" },
  { _tag: "TextStarted", runId, partId: `${runId}-text-2` },
  { _tag: "TextDelta", runId, partId: `${runId}-text-2`, delta: "The project already has build, test, and typecheck gates. " },
  { _tag: "TextDelta", runId, partId: `${runId}-text-2`, delta: "I’m ready to add them to the launch checklist." },
  { _tag: "TextFinished", runId, partId: `${runId}-text-2` },
  { _tag: "ToolInputStarted", runId, callId: `${runId}-write`, name: "write_file" },
  { _tag: "ToolInputDelta", runId, callId: `${runId}-write`, delta: "{\n  \"path\": \"docs/launch-checklist.md\",\n" },
  { _tag: "ToolInputDelta", runId, callId: `${runId}-write`, delta: "  \"change\": \"Add release verification gates\"\n}" },
  { _tag: "ToolCallReady", runId, callId: `${runId}-write` },
  { _tag: "PermissionRequested", runId, callId: `${runId}-write`, reason: "Writing a project file changes the workspace and requires your approval." },
];

const approvedEvents = (runId: string): ReadonlyArray<Agent.StreamEvent> => [
  { _tag: "ToolStarted", runId, callId: `${runId}-write` },
  { _tag: "ToolResult", runId, callId: `${runId}-write`, output: "{\n  \"updated\": \"docs/launch-checklist.md\",\n  \"linesAdded\": 4,\n  \"simulated\": true\n}" },
  { _tag: "TextStarted", runId, partId: `${runId}-text-3` },
  { _tag: "TextDelta", runId, partId: `${runId}-text-3`, delta: "Done — the simulated checklist now includes:\n\n" },
  { _tag: "TextDelta", runId, partId: `${runId}-text-3`, delta: "- `pnpm test`\n- `pnpm typecheck`\n" },
  { _tag: "TextDelta", runId, partId: `${runId}-text-3`, delta: "- `pnpm build`\n\nNo real file was changed." },
  { _tag: "TextFinished", runId, partId: `${runId}-text-3` },
  { _tag: "Finished", runId },
];

const deniedEvents = (runId: string): ReadonlyArray<Agent.StreamEvent> => [
  { _tag: "TextStarted", runId, partId: `${runId}-text-3` },
  { _tag: "TextDelta", runId, partId: `${runId}-text-3`, delta: "Understood — I didn’t apply the checklist update. " },
  { _tag: "TextDelta", runId, partId: `${runId}-text-3`, delta: "The inspection result is still available above, and no file was changed." },
  { _tag: "TextFinished", runId, partId: `${runId}-text-3` },
  { _tag: "Finished", runId },
];

export const scenarioEvents = (
  segment: Agent.Segment,
  runId: string,
  modelId: string,
): ReadonlyArray<Agent.EventEnvelope> => {
  const events = segment === "Initial"
    ? initialEvents(runId, modelId)
    : segment === "Approved"
      ? approvedEvents(runId)
      : deniedEvents(runId);
  const start = segment === "Initial" ? 1 : segment === "Approved" ? 100 : 200;
  return events.map((event, index) => ({ sequence: start + index, event }));
};

const delayFor = (event: Agent.StreamEvent): number =>
  event._tag === "TextDelta" ? 85
    : event._tag === "ToolStarted" || event._tag === "ToolResult" ? 240
      : event._tag === "PermissionRequested" ? 160
        : 45;

export const scenarioStream = (
  segment: Agent.Segment,
  runId: string,
  modelId: string,
): Stream.Stream<Agent.EventEnvelope> => Stream.fromIterable(
  scenarioEvents(segment, runId, modelId).map((envelope): Step & Readonly<{ envelope: Agent.EventEnvelope }> => ({
    delay: delayFor(envelope.event),
    event: envelope.event,
    envelope,
  })),
).pipe(
  Stream.mapEffect((step) => Effect.sleep(`${step.delay} millis`).pipe(Effect.as(step.envelope))),
);
