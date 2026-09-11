import { Effect, Stream } from "effect";
import { describe, expect, it } from "vitest";

import { createScenario } from "./testing";

describe("agent scenario builder", () => {
  const scenario = createScenario({
    initial: (writer) => {
      writer.reasoning("Inspect first.", { id: "reason" });
      writer.text("Working.", { chunks: ["Work", "ing."] });
      writer.requestPermission({
        id: "write",
        name: "write_file",
        input: "{\"path\":\"README.md\"}",
        reason: "Writing changes the project.",
      });
    },
    approved: (writer) => writer.completeTool("write", "Updated."),
    denied: (writer) => writer.text("No changes made."),
    delayFor: () => 0,
  });

  it("creates stable lifecycle events and permission continuations", () => {
    const initial = scenario.events("Initial", "run-1", "balanced");
    expect(initial.map(({ event }) => event._tag)).toEqual([
      "Started",
      "ReasoningStarted",
      "ReasoningDelta",
      "ReasoningFinished",
      "TextStarted",
      "TextDelta",
      "TextDelta",
      "TextFinished",
      "ToolInputStarted",
      "ToolInputDelta",
      "ToolCallReady",
      "PermissionRequested",
    ]);
    expect(initial.at(-1)?.event).toMatchObject({ callId: "run-1-write" });
    expect(scenario.events("Approved", "run-1", "balanced").at(-1)?.event._tag)
      .toBe("Finished");
  });

  it("streams the same deterministic envelopes", async () => {
    const streamed = await Effect.runPromise(
      Stream.runCollect(scenario.stream("Denied", "run-1", "balanced")),
    );
    expect([...streamed]).toEqual(scenario.events("Denied", "run-1", "balanced"));
  });
});
