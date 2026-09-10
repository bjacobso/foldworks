import { describe, expect, it } from "vitest";
import { Agent } from "@foldworks/agent";

import { scenarioEvents } from "./scenario";

const dispatch = (model: Agent.Model, message: Agent.Message): Agent.Model => Agent.update(model, message).model;

const init = (): Agent.Model => Agent.init({ id: "agent", selectedModel: "atlas-balanced" });

const send = (prompt = "Inspect the project"): Agent.Model => {
  const withDraft = dispatch(init(), Agent.Message.ChangedDraft({ value: prompt }));
  return dispatch(withDraft, Agent.Message.Submitted());
};

const receiveAll = (model: Agent.Model, envelopes: ReadonlyArray<Agent.EventEnvelope>): Agent.Model =>
  envelopes.reduce((current, envelope) =>
    dispatch(current, Agent.Message.ReceivedStreamEvent({ envelope })), model);

const tools = (model: Agent.Model): ReadonlyArray<Agent.ToolPart> => model.transcript.flatMap((turn) =>
  turn.parts.filter((part): part is Agent.ToolPart => part._tag === "Tool"));

describe("agent update", () => {
  it("ignores blank input and captures a valid prompt and selected model", () => {
    const blank = dispatch(dispatch(init(), Agent.Message.ChangedDraft({ value: "   " })), Agent.Message.Submitted());
    expect(blank.transcript).toEqual([]);

    const started = send("  Review release readiness  ");
    expect(started.runState).toMatchObject({ _tag: "Streaming", runId: "agent-run-1", segment: "Initial" });
    expect(started.transcript).toHaveLength(2);
    expect(started.transcript[0]?.parts[0]).toMatchObject({ text: "Review release readiness" });
    expect(started.transcript[1]).toMatchObject({ role: "Assistant", modelId: "atlas-balanced" });
    expect(started.draft).toBe("");
    expect(started.nextRunNumber).toBe(2);
  });

  it("reduces ordered text and tool events into a permission checkpoint", () => {
    const waiting = receiveAll(send(), scenarioEvents("Initial", "agent-run-1", "atlas-balanced"));

    expect(waiting.runState).toMatchObject({
      _tag: "AwaitingPermission",
      callId: "agent-run-1-write",
    });
    expect(waiting.transcript[1]?.parts.map((part) => part._tag)).toEqual([
      "Text", "Tool", "Text", "Tool",
    ]);
    expect(tools(waiting)[0]).toMatchObject({
      name: "read_file",
      status: "Completed",
      input: expect.stringContaining("package.json"),
    });
    expect(tools(waiting)[1]).toMatchObject({
      name: "write_file",
      status: "WaitingApproval",
      permissionReason: expect.stringContaining("requires your approval"),
    });
  });

  it("continues through the approved branch and completes the same assistant turn", () => {
    const waiting = receiveAll(send(), scenarioEvents("Initial", "agent-run-1", "atlas-balanced"));
    const allowed = dispatch(waiting, Agent.Message.ChosePermission({ decision: "Allow" }));
    expect(allowed.runState).toMatchObject({ _tag: "Streaming", segment: "Approved" });
    expect(tools(allowed)[1]?.status).toBe("Running");

    const complete = receiveAll(allowed, scenarioEvents("Approved", "agent-run-1", "atlas-balanced"));
    expect(complete.runState._tag).toBe("Idle");
    expect(complete.transcript).toHaveLength(2);
    expect(tools(complete)[1]).toMatchObject({ status: "Completed", output: expect.stringContaining('"simulated": true') });
    expect(complete.transcript[1]?.parts.at(-1)).toMatchObject({
      _tag: "Text",
      status: "Complete",
      text: expect.stringContaining("No real file was changed"),
    });
  });

  it("records denial and streams a terminal response without running the tool", () => {
    const waiting = receiveAll(send(), scenarioEvents("Initial", "agent-run-1", "atlas-balanced"));
    const denied = dispatch(waiting, Agent.Message.ChosePermission({ decision: "Deny" }));
    expect(tools(denied)[1]).toMatchObject({ status: "Denied", output: expect.stringContaining("No action was taken") });

    const complete = receiveAll(denied, scenarioEvents("Denied", "agent-run-1", "atlas-balanced"));
    expect(complete.runState._tag).toBe("Idle");
    expect(tools(complete)[1]?.status).toBe("Denied");
  });

  it("stops unfinished work and ignores late or duplicate events", () => {
    const started = send();
    const [first, second] = scenarioEvents("Initial", "agent-run-1", "atlas-balanced");
    const streaming = receiveAll(started, [first!, second!]);
    const duplicate = dispatch(streaming, Agent.Message.ReceivedStreamEvent({ envelope: second! }));
    expect(duplicate).toEqual(streaming);

    const stopped = dispatch(streaming, Agent.Message.Stopped());
    expect(stopped.runState._tag).toBe("Idle");
    expect(stopped.transcript[1]?.parts[0]).toMatchObject({ status: "Interrupted" });

    const late = dispatch(stopped, Agent.Message.ReceivedStreamEvent({
      envelope: { sequence: 99, event: { _tag: "Finished", runId: "agent-run-1" } },
    }));
    expect(late).toEqual(stopped);
  });

  it("exposes failure, retries with a new stable run id, and resets safely", () => {
    const started = send();
    const failed = dispatch(started, Agent.Message.ReceivedStreamEvent({
      envelope: { sequence: 1, event: { _tag: "Failed", runId: "agent-run-1", message: "Fixture unavailable" } },
    }));
    expect(failed.runState).toMatchObject({ _tag: "Failed", message: "Fixture unavailable" });

    const retried = dispatch(failed, Agent.Message.Retried());
    expect(retried.runState).toMatchObject({ _tag: "Streaming", runId: "agent-run-2" });
    expect(retried.transcript).toHaveLength(3);

    const reset = dispatch(retried, Agent.Message.Reset());
    expect(reset.transcript).toEqual([]);
    expect(reset.runState._tag).toBe("Idle");
    expect(reset.nextRunNumber).toBe(3);
  });
});
