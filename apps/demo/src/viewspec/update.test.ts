import { validateSpec, type ActionIntent } from "@foldworks/generative-ui/core";
import { Result } from "effect";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { catalog } from "./catalog";
import { document } from "./document";
import { Message } from "./message";
import { init, type Model } from "./model";
import { update } from "./update";
import { view } from "./view";

const send = (model: Model, intent: ActionIntent): Model =>
  update(model, Message.ReceivedIntent({ intent })).model;

describe("ViewSpec fixture host", () => {
  it("validates complete documents through filter, empty, selection, and draft states", () => {
    for (const model of [
      init(),
      { ...init(), filter: "zzz" },
      { ...init(), selected: "marvin" as const, note: "Review systems" },
    ]) {
      expect(Result.isSuccess(validateSpec(catalog, document(model)))).toBe(true);
    }
  });

  it("connects rendered field edits and buttons to local state and host review", () => {
    Scene.scene(
      { view, update },
      Scene.given(init()),
      Scene.type(Scene.role("textbox", { name: "Filter crew" }), "Ford"),
      Scene.expect(Scene.role("button", { name: "Select Ford Prefect" })).toExist(),
      Scene.click(Scene.role("button", { name: "Select Ford Prefect" })),
      Scene.type(Scene.role("textbox", { name: "Assignment note" }), "Survey the landing site"),
      Scene.click(Scene.role("button", { name: "Request assignment" })),
      Scene.expect(Scene.role("status")).toHaveText(
        "Fixture host accepted the assignment for Ford Prefect.",
      ),
    );
  });

  it("refuses off-duty records and requests that do not match the current draft", () => {
    const model = { ...init(), selected: "marvin" as const, note: "Review systems" };
    const intent = {
      action: "request_assignment",
      elementId: "submit",
      event: "press",
      params: { crewId: "marvin", note: model.note },
    };
    const refused = send(model, intent);
    expect(refused.outcome).toBe("Refused");
    expect(refused.receipt).toContain("off duty");
    expect(JSON.parse(refused.lastIntent)).toEqual(intent);
    expect(
      send(init(), { ...intent, params: { crewId: "ford", note: "Forged draft" } }).outcome,
    ).toBe("Refused");
  });

  it("rejects malformed events, clears notes when changing records, and resets locally", () => {
    expect(
      send(init(), {
        action: "edit_note",
        elementId: "request-note",
        event: "change",
        params: {},
        data: { value: 42 },
      }).outcome,
    ).toBe("Invalid");
    const edited = send(init(), {
      action: "edit_note",
      elementId: "request-note",
      event: "change",
      params: {},
      data: { value: "Draft" },
    });
    const selected = send(edited, {
      action: "select_crew",
      elementId: "crew-ford",
      event: "press",
      params: { crewId: "ford" },
    });
    expect(selected.note).toBe("");
    expect(update(selected, Message.Reset()).model).toEqual({
      ...init(),
      requestId: selected.requestId + 1,
    });
  });
});
