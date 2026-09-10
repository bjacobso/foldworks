import { describe, expect, it } from "vitest";

import { Message } from "./message";
import { init, type Model, type ToolPart } from "./model";
import type { EventEnvelope, StreamEvent } from "./protocol";
import { update } from "./update";

const dispatch = (model: Model, message: Message): Model => update(model, message).model;

const initialized = (): Model => init({ id: "test-agent", selectedModel: "balanced" });

const send = (prompt = "Inspect the project"): Model => {
  const withDraft = dispatch(initialized(), Message.ChangedDraft({ value: prompt }));
  return dispatch(withDraft, Message.Submitted());
};

const envelope = (sequence: number, event: StreamEvent): EventEnvelope => ({ sequence, event });

const tools = (model: Model): ReadonlyArray<ToolPart> => model.transcript.flatMap((turn) =>
  turn.parts.filter((part): part is ToolPart => part._tag === "Tool"));

describe("agent update", () => {
  it("ignores blank input and starts a stable run with the selected model", () => {
    const blank = dispatch(dispatch(initialized(), Message.ChangedDraft({ value: "   " })), Message.Submitted());
    expect(blank.transcript).toEqual([]);

    const started = send("  Review release readiness  ");
    expect(started.runState).toMatchObject({ _tag: "Streaming", runId: "test-agent-run-1", segment: "Initial" });
    expect(started.transcript[0]?.parts[0]).toMatchObject({ text: "Review release readiness" });
    expect(started.transcript[1]).toMatchObject({ role: "Assistant", modelId: "balanced" });
    expect(started.nextRunNumber).toBe(2);
  });

  it("reduces ordered text and tool events into a permission checkpoint", () => {
    const runId = "test-agent-run-1";
    const events: ReadonlyArray<EventEnvelope> = [
      envelope(1, { _tag: "TextStarted", runId, partId: "text" }),
      envelope(2, { _tag: "TextDelta", runId, partId: "text", delta: "Checking." }),
      envelope(3, { _tag: "TextFinished", runId, partId: "text" }),
      envelope(4, { _tag: "ToolInputStarted", runId, callId: "write", name: "write_file" }),
      envelope(5, { _tag: "ToolInputDelta", runId, callId: "write", delta: "{\"path\":\"README.md\"}" }),
      envelope(6, { _tag: "PermissionRequested", runId, callId: "write", reason: "Writing changes the project." }),
    ];
    const waiting = events.reduce(
      (model, event) => dispatch(model, Message.ReceivedStreamEvent({ envelope: event })),
      send(),
    );

    expect(waiting.runState).toMatchObject({ _tag: "AwaitingPermission", callId: "write" });
    expect(waiting.transcript[1]?.parts.map((part) => part._tag)).toEqual(["Text", "Tool"]);
    expect(tools(waiting)[0]).toMatchObject({
      name: "write_file",
      status: "WaitingApproval",
      input: expect.stringContaining("README.md"),
    });
  });

  it("continues after either permission decision", () => {
    const runId = "test-agent-run-1";
    const waiting = dispatch(
      dispatch(send(), Message.ReceivedStreamEvent({ envelope: envelope(1, {
        _tag: "ToolInputStarted", runId, callId: "write", name: "write_file",
      }) })),
      Message.ReceivedStreamEvent({ envelope: envelope(2, {
        _tag: "PermissionRequested", runId, callId: "write", reason: "Approval required.",
      }) }),
    );

    const allowed = dispatch(waiting, Message.ChosePermission({ decision: "Allow" }));
    expect(allowed.runState).toMatchObject({ _tag: "Streaming", segment: "Approved" });
    expect(tools(allowed)[0]?.status).toBe("Running");

    const denied = dispatch(waiting, Message.ChosePermission({ decision: "Deny" }));
    expect(denied.runState).toMatchObject({ _tag: "Streaming", segment: "Denied" });
    expect(tools(denied)[0]).toMatchObject({ status: "Denied", output: expect.stringContaining("No action") });
  });

  it("ignores late events, interrupts active parts, retries, and resets", () => {
    const runId = "test-agent-run-1";
    const streaming = dispatch(send(), Message.ReceivedStreamEvent({ envelope: envelope(1, {
      _tag: "TextStarted", runId, partId: "text",
    }) }));
    const duplicate = dispatch(streaming, Message.ReceivedStreamEvent({ envelope: envelope(1, {
      _tag: "TextDelta", runId, partId: "text", delta: "duplicate",
    }) }));
    expect(duplicate).toEqual(streaming);

    const stopped = dispatch(streaming, Message.Stopped());
    expect(stopped.transcript[1]?.parts[0]).toMatchObject({ status: "Interrupted" });

    const failed = dispatch(send(), Message.ReceivedStreamEvent({ envelope: envelope(1, {
      _tag: "Failed", runId, message: "Unavailable",
    }) }));
    const retried = dispatch(failed, Message.Retried());
    expect(retried.runState).toMatchObject({ _tag: "Streaming", runId: "test-agent-run-2" });

    const reset = dispatch(retried, Message.Reset());
    expect(reset.transcript).toEqual([]);
    expect(reset.nextRunNumber).toBe(3);
    expect(reset.id).toBe("test-agent");
  });
});
