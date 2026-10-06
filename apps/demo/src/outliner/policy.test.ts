import { describe, expect, it } from "vitest";
import { Outliner, find, walk } from "@foldworks/outliner";

import { Message } from "./message";
import { initialModel, type Model } from "./model";
import { QUOTED_ID } from "./sample";
import { update } from "./update";

const idOf = (model: Model, text: string): string =>
  walk(model.outline.items).find((node) => node.text === text)!.id;

const outline = (model: Model, message: Outliner.Message): Model =>
  update(model, Message.GotOutlinerMessage({ message })).model;

const press = (model: Model, action: "Indent" | "Outdent", text: string): Model =>
  outline(
    model,
    Outliner.Message.Pressed({ action, id: idOf(model, text), start: 0, end: 0, goalX: 0 }),
  );

describe("outliner demo policy", () => {
  it("refuses moving an item into a done one", () => {
    const model = initialModel();
    // "Reading the weather" follows "What to pack", which is done.
    const next = press(model, "Indent", "Reading the weather");
    expect(next.outline.items).toBe(model.outline.items);
    expect(next.outline.announcement).toBe("Can't move there.");
  });

  it("allows moving an item into one that is not done", () => {
    const model = initialModel();
    const next = press(model, "Indent", "Leave-no-trace basics @ada #draft");
    const birds = find(next.outline.items, idOf(model, "Birds you'll hear before you see"));
    expect(birds?.children.map((child) => child.text)).toContain(
      "Leave-no-trace basics @ada #draft",
    );
  });

  it("keeps the quoted principles from changing", () => {
    const model = initialModel();
    const principle = idOf(model, "Plan ahead and prepare");
    const edited = outline(
      model,
      Outliner.Message.EditedText({
        id: principle,
        text: "Plan ahead",
        start: 10,
        end: 10,
        time: 0,
      }),
    );
    expect(edited.outline.items).toBe(model.outline.items);
    const moved = press(model, "Outdent", "Plan ahead and prepare");
    expect(moved.outline.items).toBe(model.outline.items);
    expect(moved.outline.announcement).toBe("Read-only items can't move.");
    expect(find(model.outline.items, QUOTED_ID)?.children).toHaveLength(7);
  });

  it("marks an entry done from a folded summary as one undoable step", () => {
    const model = initialModel();
    const signage = idOf(model, "Signage @jonah #print");
    const done = update(model, Message.ToggledDone({ id: signage })).model;
    expect(find(done.outline.items, signage)?.checked).toBe(true);
    expect(done.outline.announcement).toBe("Marked done.");
    const undone = outline(done, Outliner.Message.ClickedUndo());
    expect(find(undone.outline.items, signage)?.checked).toBe(false);
  });

  it("ignores marking a quoted principle done", () => {
    const model = initialModel();
    const next = update(model, Message.ToggledDone({ id: idOf(model, "Respect wildlife") })).model;
    expect(next.outline.items).toBe(model.outline.items);
  });
});
