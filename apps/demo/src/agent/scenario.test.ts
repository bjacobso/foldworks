import { describe, expect, it } from "vitest";

import { scenarioEvents } from "./scenario";

describe("agent scenario", () => {
  it("streams text and tools before stopping at an approval boundary", () => {
    const events = scenarioEvents("Initial", "run-1", "atlas-balanced");

    expect(events.map(({ event }) => event._tag)).toEqual([
      "Started",
      "ReasoningStarted",
      "ReasoningDelta",
      "ReasoningDelta",
      "ReasoningFinished",
      "TextStarted",
      "TextDelta",
      "TextDelta",
      "TextDelta",
      "TextFinished",
      "ToolInputStarted",
      "ToolInputDelta",
      "ToolInputDelta",
      "ToolCallReady",
      "ToolStarted",
      "ToolResult",
      "TextStarted",
      "TextDelta",
      "TextDelta",
      "TextFinished",
      "ToolInputStarted",
      "ToolInputDelta",
      "ToolInputDelta",
      "ToolCallReady",
      "PermissionRequested",
    ]);
    expect(events.at(-1)?.event).toMatchObject({
      _tag: "PermissionRequested",
      callId: "run-1-write",
    });
    expect(events.map(({ sequence }) => sequence)).toEqual(
      Array.from({ length: events.length }, (_, index) => index + 1),
    );
  });

  it("provides deterministic allow and deny continuations", () => {
    const approved = scenarioEvents("Approved", "run-1", "atlas-balanced");
    const denied = scenarioEvents("Denied", "run-1", "atlas-balanced");

    expect(approved[0]).toMatchObject({ sequence: 100, event: { _tag: "ToolStarted" } });
    expect(approved.at(-1)?.event._tag).toBe("Finished");
    expect(denied[0]).toMatchObject({ sequence: 200, event: { _tag: "TextStarted" } });
    expect(denied.some(({ event }) => event._tag === "ToolStarted")).toBe(false);
    expect(denied.at(-1)?.event._tag).toBe("Finished");
  });
});
