import { describe, expect, it } from "vitest";

import { Message } from "./message";
import { initialModel, type Model } from "./model";
import { update } from "./update";

const reduce = (model: Model, message: Message): Model => update(model, message).model;

describe("diff review selection", () => {
  it("selects a pointer range and stores normalized comment endpoints", () => {
    const path = initialModel.activePath;
    let model = reduce(initialModel, Message.StartedSelection({ path, side: "new", line: 24 }));
    model = reduce(model, Message.ExtendedSelection({ path, side: "new", line: 21, method: "Pointer" }));
    model = reduce(model, Message.EndedSelection());

    expect(model).toMatchObject({
      selectionStartLine: 24,
      selectionEndLine: 21,
      selectionDragging: false,
    });

    model = reduce(model, Message.ChangedDraft({ value: "Cover this whole branch." }));
    model = reduce(model, Message.SubmittedComment());

    expect(model.comments.at(-1)).toMatchObject({
      path,
      side: "new",
      startLine: 21,
      endLine: 24,
      body: "Cover this whole branch.",
      resolved: false,
    });
    expect(model.selectionPath).toBe("");
  });

  it("extends a keyboard selection but ignores pointer hover outside a drag", () => {
    const path = initialModel.activePath;
    let model = reduce(initialModel, Message.SelectedLine({ path, side: "new", line: 20 }));
    model = reduce(model, Message.ExtendedSelection({ path, side: "new", line: 21, method: "Pointer" }));
    expect(model.selectionEndLine).toBe(20);

    model = reduce(model, Message.ExtendedSelection({ path, side: "new", line: 21, method: "Keyboard" }));
    expect(model).toMatchObject({ selectionStartLine: 20, selectionEndLine: 21 });
  });
});
