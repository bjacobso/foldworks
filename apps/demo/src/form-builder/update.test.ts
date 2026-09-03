import { describe, expect, it } from "vitest";

import { findField } from "@foldworks/form-builder";

import { initialModel } from "./editor-model";
import { Message } from "./message";
import { loadExample, update } from "./update";

describe("form editor update", () => {
  it("coalesces text edits and keeps each example draft independent", () => {
    const selected = update(
      initialModel,
      Message.SelectedItem({ kind: "Field", id: "handoff-name" }),
    ).model;
    const first = update(selected, Message.ChangedItemTitle({ value: "Legal name" })).model;
    const second = update(first, Message.ChangedItemTitle({ value: "Full legal name" })).model;
    expect(second.history.past).toHaveLength(1);
    expect(second.documents.Handoff).toBe(second.document);
    expect(second.documents.Simple).toBe(initialModel.documents.Simple);

    const undone = update(second, Message.ClickedUndo()).model;
    expect(findField(undone.document, "handoff-name")?.label).toBe("Preferred name");
  });

  it("does not let undo cross an example replacement boundary", () => {
    const selected = update(
      initialModel,
      Message.SelectedItem({ kind: "Field", id: "handoff-name" }),
    ).model;
    const edited = update(
      selected,
      Message.ChangedItemTitle({ value: "Edited handoff field" }),
    ).model;
    const switched = loadExample(edited, "Simple");
    const undone = update(switched, Message.ClickedUndo()).model;

    expect(undone.exampleId).toBe("Simple");
    expect(undone.document).toBe(switched.document);
    expect(undone.history.past).toEqual([]);
  });
});
