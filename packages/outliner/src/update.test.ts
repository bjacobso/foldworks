import { describe, expect, it } from "vitest";

import type { Action } from "./keymap";
import { Message } from "./message";
import { init, type Model } from "./model";
import { item, visibleRows } from "./outline";
import { selectedIds } from "./selectors";
import { update } from "./update";

const start = (): Model =>
  init({
    id: "o",
    items: [item("a", "Alpha", [item("a1", "One"), item("a2", "Two")]), item("b", "Beta")],
  });

const press = (model: Model, action: Action, id: string, start = 0, end = start) =>
  update(model, Message.Pressed({ action, id, start, end, goalX: 0 })).model;

const texts = (model: Model) =>
  visibleRows(model.items, model.scopeId).map((row) => `${"  ".repeat(row.depth)}${row.text}`);

describe("update", () => {
  it("splits at the caret and focuses the new row", () => {
    const model = press(start(), "Split", "b", 2);
    expect(texts(model)).toEqual(["Alpha", "  One", "  Two", "Be", "ta"]);
    expect(model.focus).toEqual({ id: "o-1", start: 0, end: 0 });
  });

  it("outdents an empty last child on Return instead of adding another", () => {
    const opened = press(start(), "Split", "a2", 3);
    const model = press(opened, "Split", "o-1", 0);
    expect(texts(model)).toEqual(["Alpha", "  One", "  Two", "", "Beta"]);
  });

  it("restores text and caret with undo, and coalesces typing", () => {
    let model = update(
      start(),
      Message.EditedText({ id: "b", text: "Bet", start: 3, end: 3, time: 5000 }),
    ).model;
    model = update(
      model,
      Message.EditedText({ id: "b", text: "Be", start: 2, end: 2, time: 5100 }),
    ).model;
    model = update(
      model,
      Message.EditedText({ id: "b", text: "Bee", start: 3, end: 3, time: 5200 }),
    ).model;
    const undone = press(model, "Undo", "b", 3);
    expect(undone.items[1]?.text).toBe("Beta");
    expect(undone.focus?.id).toBe("b");
    const redone = press(undone, "Redo", "b", 4);
    expect(redone.items[1]?.text).toBe("Bee");
  });

  it("starts a new undo step after a pause in typing", () => {
    let model = update(
      start(),
      Message.EditedText({ id: "b", text: "Beta!", start: 5, end: 5, time: 1000 }),
    ).model;
    model = update(
      model,
      Message.EditedText({ id: "b", text: "Beta!!", start: 6, end: 6, time: 4000 }),
    ).model;
    expect(press(model, "Undo", "b", 6).items[1]?.text).toBe("Beta!");
  });

  it("moves a caret that collapsing hides to its visible ancestor", () => {
    const focused = update(start(), Message.FocusedText({ id: "a2", start: 1, end: 1 })).model;
    const model = update(focused, Message.SetAllCollapsed({ collapsed: true })).model;
    expect(texts(model)).toEqual(["Alpha", "Beta"]);
    expect(model.focus).toEqual({ id: "a", start: 5, end: 5 });
  });

  it("undoes structure without refolding the outline", () => {
    const indented = press(start(), "Indent", "b", 1);
    expect(texts(indented)).toEqual(["Alpha", "  One", "  Two", "  Beta"]);
    const collapsed = update(
      indented,
      Message.ToggledCollapsed({ id: "a", recursive: false }),
    ).model;
    const undone = press(collapsed, "Undo", "a", 0);
    expect(texts(undone)).toEqual(["Alpha", "Beta"]);
  });

  it("extends from text into a row selection and indents it as a unit", () => {
    let model = press(start(), "ExtendUp", "a2", 0);
    expect(model.mode).toBe("Rows");
    expect(selectedIds(model)).toEqual(["a1", "a2"]);
    model = press(model, "ExtendDown", "a1");
    model = press(model, "ExtendDown", "a2");
    expect(selectedIds(model)).toEqual(["a2", "b"]);
    model = press(model, "Indent", "b");
    expect(texts(model)).toEqual(["Alpha", "  One", "    Two", "  Beta"]);
  });

  it("deletes a selection and selects the next row", () => {
    let model = press(start(), "SelectRow", "a", 0);
    model = press(model, "Delete", "a");
    expect(texts(model)).toEqual(["Beta"]);
    expect(model.selection).toEqual({ anchorId: "b", headId: "b" });
  });

  it("navigates rows with Finder keys", () => {
    let model = press(start(), "SelectRow", "a1", 0);
    model = press(model, "CollapseOrParent", "a1");
    expect(model.selection?.headId).toBe("a");
    model = press(model, "CollapseOrParent", "a");
    expect(texts(model)).toEqual(["Alpha", "Beta"]);
    model = press(model, "ExpandOrChild", "a");
    model = press(model, "ExpandOrChild", "a");
    expect(model.selection?.headId).toBe("a1");
  });

  it("hoists and unhoists", () => {
    let model = press(start(), "ZoomIn", "a", 0);
    expect(model.scopeId).toBe("a");
    expect(texts(model)).toEqual(["One", "Two"]);
    model = press(model, "Outdent", "a1", 0);
    expect(texts(model)).toEqual(["One", "Two"]);
    model = press(model, "ZoomOut", "a1", 0);
    expect(model.scopeId).toBeNull();
    expect(model.focus?.id).toBe("a");
  });

  it("pastes several lines as items, splitting around the caret", () => {
    const model = update(
      start(),
      Message.PastedText({ id: "b", mode: "Text", start: 2, end: 2, text: "X\n\tY\nZ" }),
    ).model;
    expect(texts(model)).toEqual(["Alpha", "  One", "  Two", "BeX", "  Y", "Zta"]);
    expect(model.focus).toMatchObject({ start: 1, end: 1 });
  });

  it("drops dragged rows at the target and keeps them selected", () => {
    let model = update(start(), Message.StartedDrag({ ids: ["b"] })).model;
    model = update(
      model,
      Message.MovedDrag({
        target: { placement: { _tag: "Start", parentId: "a" }, depth: 1, afterRowId: "a" },
      }),
    ).model;
    model = update(model, Message.Dropped()).model;
    expect(texts(model)).toEqual(["Alpha", "  Beta", "  One", "  Two"]);
    expect(model.drag).toBeNull();
    expect(selectedIds(model)).toEqual(["b"]);
  });

  it("merges into the previous row with Backspace", () => {
    const model = press(start(), "MergePrevious", "b", 0);
    expect(texts(model)).toEqual(["Alpha", "  One", "  TwoBeta"]);
    expect(model.focus).toEqual({ id: "a2", start: 3, end: 3 });
  });

  it("replaces the document as one undoable step without moving focus", () => {
    const focused = update(start(), Message.FocusedText({ id: "b", start: 1, end: 1 })).model;
    const replaced = update(
      focused,
      Message.Replace({
        items: [item("b", "Beta"), item("a", "Alpha", [item("a1", "One"), item("a2", "Two")])],
        announcement: "Swapped.",
      }),
    );
    expect(replaced.commands ?? []).toEqual([]);
    expect(texts(replaced.model)).toEqual(["Beta", "Alpha", "  One", "  Two"]);
    expect(replaced.model.focus).toEqual({ id: "b", start: 1, end: 1 });
    expect(replaced.model.announcement).toBe("Swapped.");
    const undone = press(replaced.model, "Undo", "b", 1);
    expect(texts(undone)).toEqual(["Alpha", "  One", "  Two", "Beta"]);
  });

  it("coalesces replacements that share a key and drops focus on removed items", () => {
    let model = update(start(), Message.FocusedText({ id: "a2", start: 0, end: 0 })).model;
    for (const text of ["B", "Be"]) {
      model = update(
        model,
        Message.Replace({ items: [item("b", text)], announcement: "", coalescingKey: "source" }),
      ).model;
    }
    expect(model.focus).toBeNull();
    expect(texts(press(model, "Undo", "b"))).toEqual(["Alpha", "  One", "  Two", "Beta"]);
  });

  it("reveals an item inside a collapsed parent and outside the hoisted scope", () => {
    const collapsed = press(start(), "Collapse", "a");
    const hoisted = update(collapsed, Message.Hoisted({ id: "b" })).model;
    const revealed = update(hoisted, Message.Reveal({ id: "a2" }));
    expect(revealed.model.scopeId).toBeNull();
    expect(texts(revealed.model)).toEqual(["Alpha", "  One", "  Two", "Beta"]);
    expect(revealed.model.focus).toEqual({ id: "a2", start: 3, end: 3 });
  });

  it("shows hover information for the pointer or the caret until something else happens", () => {
    const pointed = update(start(), Message.Hovered({ target: { id: "b", offset: 2 } })).model;
    expect(pointed.hover).toEqual({ id: "b", offset: 2, source: "Pointer" });
    expect(update(pointed, Message.Hovered({ target: { id: "b", offset: 2 } })).model).toBe(
      pointed,
    );
    const typed = update(
      pointed,
      Message.EditedText({ id: "b", text: "Betas", start: 5, end: 5, time: 1 }),
    ).model;
    expect(typed.hover).toBeNull();
    const asked = press(start(), "ShowInfo", "a", 3);
    expect(asked.hover).toEqual({ id: "a", offset: 3, source: "Keyboard" });
    expect(update(asked, Message.DismissedHover()).model.hover).toBeNull();
    expect(press(asked, "Collapse", "a").hover).toBeNull();
  });

  it("offers, narrows, and accepts suggestions as one undoable step", () => {
    const items = [{ label: "Bear" }, { label: "Beta" }, { label: "Beehive", insert: "Beehive!" }];
    let model = update(start(), Message.RequestedCompletion({ id: "b", start: 2, end: 2 })).model;
    expect(model.focus).toEqual({ id: "b", start: 2, end: 2 });
    // An offer for a range the caret is not in is ignored.
    expect(
      update(model, Message.ShowCompletions({ id: "b", from: 3, to: 4, items })).model.completion,
    ).toBeNull();
    model = update(model, Message.ShowCompletions({ id: "b", from: 0, to: 2, items })).model;
    expect(model.completion).toEqual({ id: "b", from: 0, to: 2, items, index: 0 });
    expect(model.announcement).toBe("3 suggestions.");
    model = update(
      model,
      Message.EditedText({ id: "b", text: "Beeta", start: 3, end: 3, time: 1 }),
    ).model;
    expect(model.completion).toMatchObject({ from: 0, to: 3 });
    model = update(model, Message.MovedCompletion({ delta: 1 })).model;
    // Only "Beehive" matches "Bee", so moving wraps back to it.
    expect(model.completion?.index).toBe(0);
    const accepted = update(model, Message.AcceptedCompletion({ index: 0 }));
    expect(accepted.model.items[1]?.text).toBe("Beehive!ta");
    expect(accepted.model.focus).toEqual({ id: "b", start: 8, end: 8 });
    expect(accepted.model.completion).toBeNull();
    expect(accepted.commands).toHaveLength(1);
    expect(press(accepted.model, "Undo", "b", 4).items[1]?.text).toBe("Beeta");
  });

  it("closes suggestions when nothing matches or the outline does something else", () => {
    const items = [{ label: "Alpha" }];
    let model = update(start(), Message.RequestedCompletion({ id: "a", start: 1, end: 1 })).model;
    model = update(model, Message.ShowCompletions({ id: "a", from: 0, to: 1, items })).model;
    expect(model.completion).not.toBeNull();
    expect(press(model, "Indent", "a", 1).completion).toBeNull();
    const typed = update(
      model,
      Message.EditedText({ id: "a", text: "AXlpha", start: 2, end: 2, time: 1 }),
    ).model;
    expect(typed.completion).toBeNull();
  });

  it("accepts the active suggestion when no index is given", () => {
    const items = [{ label: "Bear" }, { label: "Beta" }, { label: "Bee" }];
    let model = update(start(), Message.RequestedCompletion({ id: "b", start: 2, end: 2 })).model;
    model = update(model, Message.ShowCompletions({ id: "b", from: 0, to: 2, items })).model;
    model = update(model, Message.MovedCompletion({ delta: 1 })).model;
    expect(update(model, Message.AcceptedCompletion({})).model.items[1]?.text).toBe("Betata");
  });
});

