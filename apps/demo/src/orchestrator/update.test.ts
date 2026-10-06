import { Schema as S } from "effect";
import { describe, expect, it } from "vitest";
import { Agent } from "@foldworks/agent";
import { find, item, Outliner, removeItems, updateItem } from "@foldworks/outliner";
import { DateInput } from "@foldworks/ui";
import {
  contextFor,
  Document,
  documentOf,
  initialModel,
  newThread,
  restore,
  statusOf,
  type Model,
} from "./model";
import { Message } from "./message";
import { update } from "./update";

const send = (model: Model, message: Message): Model => update(model, message).model;
const outline = (model: Model, message: Outliner.Message) =>
  send(model, Message.GotOutlineMessage({ message }));
const start = (model: Model, id: string) => send(model, Message.StartedThread({ id }));
const tick = (model: Model) => send(model, Message.AdvancedRuns());
const decide = (model: Model, id: string, decision: "Allow" | "Deny") =>
  send(
    model,
    Message.GotThreadMessage({ id, message: Agent.Message.ChosePermission({ decision }) }),
  );
const settle = (model: Model): Model => {
  let next = model;
  for (
    let count = 0;
    count < 60 &&
    Object.values(next.threads).some((thread) => thread.agent.runState._tag === "Streaming");
    count++
  )
    next = tick(next);
  return next;
};
const edit = (model: Model, id: string, text: string) =>
  outline(
    model,
    Outliner.Message.EditedText({ id, text, start: text.length, end: text.length, time: 1000 }),
  );

describe("outline workspace orchestration", () => {
  it("attaches slash commands and tags without starting work", () => {
    for (const suffix of ["/agent", "#agent"]) {
      const model = edit(initialModel(), "thought", `Explore empty states ${suffix}`);
      expect(find(model.outline.items, "thought")?.text).toBe("Explore empty states");
      expect(model.selectedId).toBe("thought");
      expect(model.threads.thought?.agent.runState._tag).toBe("Idle");
      expect(model.threads.thought?.agent.transcript).toEqual([]);
    }
  });

  it("accepts the shared completion popup as an attach action", () => {
    let model = edit(initialModel(), "thought", "Explore /ag");
    expect(model.outline.completion?.items[0]?.label).toBe("/agent");
    model = outline(model, Outliner.Message.AcceptedCompletion({}));
    expect(model.threads.thought).toBeDefined();
    expect(find(model.outline.items, "thought")?.text).toBe("Explore");
  });

  it("keeps ordinary notes editable and creates a new bullet for a new thread", () => {
    let model = edit(initialModel(), "thought", "An ordinary thought.");
    expect(model.threads.thought).toBeUndefined();
    model = send(model, Message.AddedThread());
    const id = model.selectedId!;
    expect(find(model.outline.items, id)?.text).toBe("Untitled thread");
    expect(model.threads[id]?.agent.runState._tag).toBe("Idle");
    expect(model.outline.focus?.id).toBe(id);
  });

  it("captures parent briefs and marked context, excluding other thread subtrees", () => {
    let model = initialModel();
    model = {
      ...model,
      outline: Outliner.init({
        id: "orchestrator",
        items: [
          item("root", "Project brief", [
            item("shared", "Constraint #context"),
            item("task", "Task", [
              item("own", "Own note"),
              item("nested", "Other task", [item("private", "Private note")]),
            ]),
            item("sibling", "Unrelated note"),
          ]),
        ],
      }),
      threads: { task: newThread("task"), nested: newThread("nested") },
    };
    expect(contextFor(model, "task").map((source) => source.id)).toEqual(["root", "shared", "own"]);
  });

  it("runs multiple folded threads independently without moving the caret", () => {
    let model = outline(
      initialModel(),
      Outliner.Message.FocusedText({ id: "thought", start: 4, end: 4 }),
    );
    model = start(start(model, "onboarding"), "keyboard");
    model = outline(model, Outliner.Message.SetAllCollapsed({ collapsed: true }));
    const focus = model.outline.focus;
    const items = model.outline.items;
    model = settle(model);
    expect(statusOf(model.threads.onboarding!)).toBe("Needs you");
    expect(statusOf(model.threads.keyboard!)).toBe("Needs you");
    expect(model.outline.focus).toEqual(focus);
    expect(model.outline.items).toBe(items);
    model = settle(decide(model, "onboarding", "Allow"));
    expect(statusOf(model.threads.onboarding!)).toBe("Ready");
    expect(model.threads.onboarding?.result).toContain("Open directly");
    expect(statusOf(model.threads.keyboard!)).toBe("Needs you");
  });

  it("freezes context during a run and recaptures it on a new direction", () => {
    let model = start(initialModel(), "onboarding");
    const captured = model.threads.onboarding!.context;
    model = edit(model, "principle", "New constraint #context");
    expect(model.threads.onboarding!.context).toBe(captured);
    model = send(
      model,
      Message.GotThreadMessage({ id: "onboarding", message: Agent.Message.Stopped() }),
    );
    model = send(
      model,
      Message.GotThreadMessage({
        id: "onboarding",
        message: Agent.Message.SelectedSuggestion({ prompt: "Try a smaller onboarding" }),
      }),
    );
    expect(
      model.threads.onboarding!.context.find((source) => source.id === "principle")?.text,
    ).toBe("New constraint #context");
    expect(model.threads.onboarding!.prompt).toBe("Try a smaller onboarding");
  });

  it("keeps thread identity and captured context when its bullet moves", () => {
    let model = start(initialModel(), "onboarding");
    const thread = model.threads.onboarding;
    const moved = find(model.outline.items, "onboarding")!;
    model = outline(
      model,
      Outliner.Message.Replace({
        items: [...removeItems(model.outline.items, ["onboarding"]).items, moved],
        announcement: "Moved",
      }),
    );
    expect(model.threads.onboarding).toBe(thread);
    expect(model.threads.onboarding?.agent.runState._tag).toBe("Streaming");
  });

  it("stops removed threads and retains their attachment for undo", () => {
    let model = start(initialModel(), "onboarding");
    model = outline(
      model,
      Outliner.Message.Replace({
        items: removeItems(model.outline.items, ["onboarding"]).items,
        announcement: "Removed",
      }),
    );
    expect(Agent.isActive(model.threads.onboarding!.agent)).toBe(false);
    model = outline(model, Outliner.Message.ClickedUndo());
    expect(find(model.outline.items, "onboarding")).toBeDefined();
    expect(model.threads.onboarding!.agent.runState._tag).toBe("Idle");
  });

  it("keeps a denied recommendation out of results", () => {
    const model = settle(decide(settle(start(initialModel(), "keyboard")), "keyboard", "Deny"));
    expect(model.threads.keyboard?.result).toBe("");
    expect(model.threads.keyboard?.summary).toContain("Discarded");
  });

  it("promotes results only explicitly, with undo and no duplicate child", () => {
    let model = settle(decide(settle(start(initialModel(), "onboarding")), "onboarding", "Allow"));
    expect(find(model.outline.items, "onboarding-result")).toBeUndefined();
    model = send(model, Message.PromotedResult({ id: "onboarding" }));
    expect(find(model.outline.items, "onboarding-result")?.text).toContain("Result: Open directly");
    model = send(model, Message.PromotedResult({ id: "onboarding" }));
    expect(
      find(model.outline.items, "onboarding")!.children.filter(
        (child) => child.id === "onboarding-result",
      ),
    ).toHaveLength(1);
    model = outline(model, Outliner.Message.ClickedUndo());
    expect(find(model.outline.items, "onboarding-result")).toBeUndefined();
    model = outline(model, Outliner.Message.ClickedRedo());
    expect(find(model.outline.items, "onboarding-result")).toBeDefined();
  });

  it("validates dates with the date input primitive and persists clear dates", () => {
    let model = initialModel();
    const dateMessage = (message: DateInput.Message) =>
      Message.GotDueDateMessage({ id: "onboarding", message });
    model = send(model, dateMessage(DateInput.Message.Changed({ text: "2026-02-30" })));
    model = send(model, dateMessage(DateInput.Message.Committed()));
    expect(model.dates.onboarding).toBeUndefined();
    expect(model.dateInputs.onboarding?.error).toBeTruthy();
    model = send(model, dateMessage(DateInput.Message.Changed({ text: "2026-10-09" })));
    model = send(model, dateMessage(DateInput.Message.Committed()));
    expect(model.dates.onboarding).toBe("2026-10-09");
    model = send(model, dateMessage(DateInput.Message.Changed({ text: "" })));
    model = send(model, dateMessage(DateInput.Message.Committed()));
    expect(model.dates.onboarding).toBe("");
  });

  it("round-trips saved documents and pauses active runs when reopening", () => {
    const model = start(initialModel(), "onboarding");
    const document = S.decodeUnknownSync(Document)(JSON.parse(JSON.stringify(documentOf(model))));
    const restored = restore(document);
    expect(restored.threads.onboarding?.agent.runState._tag).toBe("Idle");
    expect(restored.threads.onboarding?.context).toEqual(model.threads.onboarding?.context);
    expect(restored.threads.onboarding?.summary).toContain("Paused after reopening");
    expect(restored.selectedId).toBeNull();
  });

  it("ignores stale events and ticks after cancellation", () => {
    let model = start(initialModel(), "onboarding");
    model = tick(model);
    const state = model.threads.onboarding!.agent.runState;
    expect(state._tag).toBe("Streaming");
    if (state._tag !== "Streaming") return;
    model = send(
      model,
      Message.GotThreadMessage({
        id: "onboarding",
        message: Agent.Message.ReceivedStreamEvent({
          envelope: { sequence: 0, event: { _tag: "Finished", runId: state.runId } },
        }),
      }),
    );
    expect(model.threads.onboarding?.result).toBe("");
    model = send(
      model,
      Message.GotThreadMessage({ id: "onboarding", message: Agent.Message.Stopped() }),
    );
    const thread = model.threads.onboarding;
    expect(tick(model).threads.onboarding).toBe(thread);
  });

  it("recaptures the updated brief while leaving previously promoted results out of context", () => {
    let model = initialModel();
    model = {
      ...model,
      outline: {
        ...model.outline,
        items: updateItem(model.outline.items, "onboarding", (node) => ({
          ...node,
          children: [
            ...node.children,
            item("onboarding-result", "Result: Previous recommendation"),
          ],
        })),
      },
    };
    expect(
      contextFor(model, "onboarding").some((source) => source.id === "onboarding-result"),
    ).toBe(false);
  });
});
