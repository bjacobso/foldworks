import { describe, expect, it } from "vitest";

import { Message } from "./message";
import { init, type Model } from "./model";
import { item, visibleRows } from "./outline";
import { keepsReadOnly, reparented, type Policy } from "./policy";
import { update } from "./update";

const start = (): Model =>
  init({
    id: "o",
    items: [
      item("flow", "Flow", [item("s1", "Step one"), item("s2", "Step two")]),
      item("lib", "Library", [item("l1", "Shared"), item("l2", "Helper")]),
      item("note", "Note"),
    ],
  });

const texts = (model: Model) =>
  visibleRows(model.items, model.scopeId).map((row) => `${"  ".repeat(row.depth)}${row.text}`);

const locked = (id: string) => id === "lib" || id === "l1" || id === "l2";
const policy: Policy = {
  isReadOnly: (node) => locked(node.id),
  // Steps stay inside the flow.
  canMove: ({ before, after }) =>
    reparented(before, after).every((move) => !move.id.startsWith("s") || move.parentId === "flow"),
};

const press = (
  model: Model,
  action: Parameters<typeof Message.Pressed>[0]["action"],
  id: string,
  start = 0,
) => update(model, Message.Pressed({ action, id, start, end: start, goalX: 0 }), policy);

describe("policy", () => {
  it("refuses moves the host does not allow and says why", () => {
    const refused = press(start(), "Outdent", "s2");
    expect(texts(refused.model)).toEqual(texts(start()));
    expect(refused.model.announcement).toBe("Can't move there.");
    // Moving within the flow is fine.
    expect(texts(press(start(), "MoveUp", "s2").model).slice(0, 3)).toEqual([
      "Flow",
      "  Step two",
      "  Step one",
    ]);
  });

  it("keeps read-only items' text, place, and children", () => {
    expect(press(start(), "Indent", "l2").model.announcement).toBe("Read-only items can't move.");
    const typed = update(
      start(),
      Message.EditedText({ id: "l1", text: "Sharedx", start: 7, end: 7, time: 0 }),
      policy,
    );
    expect(typed.model.items[1]?.children[0]?.text).toBe("Shared");
    expect(press(start(), "Delete", "lib").model.items).toEqual(start().items);
    // Joining Note onto the read-only row above it would change that row's text.
    expect(press(start(), "MergePrevious", "note").model.announcement).toBe(
      "Read-only items can't change.",
    );
    // A new item after a read-only one leaves it as it was.
    const split = press(start(), "Split", "note", 4).model;
    expect(texts(split).at(-1)).toBe("");
    // The host's own edits are not checked.
    const replaced = update(
      start(),
      Message.Replace({ items: [item("lib", "Renamed")], announcement: "" }),
      policy,
    );
    expect(replaced.model.items).toEqual([item("lib", "Renamed")]);
  });

  it("refuses a drop on a refused target and clears the drag", () => {
    const dragging = update(start(), Message.StartedDrag({ ids: ["s1"] }), policy).model;
    const aimed = update(
      dragging,
      Message.MovedDrag({
        target: {
          placement: { _tag: "After", siblingId: "note" },
          depth: 0,
          afterRowId: "note",
          refused: true,
        },
      }),
      policy,
    ).model;
    const dropped = update(aimed, Message.Dropped(), policy).model;
    expect(dropped.drag).toBeNull();
    expect(texts(dropped)).toEqual(texts(start()));
    expect(dropped.announcement).toBe("Can't move there.");
  });

  it("lists reparented items and checks read-only items", () => {
    const before = start().items;
    const after = [
      item("flow", "Flow", [item("s1", "Step one")]),
      item("s2", "Step two"),
      before[1]!,
      before[2]!,
    ];
    expect(reparented(before, after)).toEqual([
      { id: "s2", parentId: null, index: 1, previousParentId: "flow" },
    ]);
    expect(keepsReadOnly(before, after, (node) => locked(node.id))).toBe(true);
    expect(
      keepsReadOnly(before, [before[0]!, item("lib", "Library", [item("l1", "Shared")])], (node) =>
        locked(node.id),
      ),
    ).toBe(false);
  });
});
