import { describe, expect, it } from "vitest";

import { breakCoalescing, canRedo, canUndo, init, record, redo, undo } from "./index";

describe("history", () => {
  it("records, undoes, and redoes immutable values", () => {
    const recorded = record(init<number>(), 1);
    const undone = undo(recorded, 2);
    expect(undone?.value).toBe(1);
    expect(canRedo(undone?.history ?? init())).toBe(true);

    const redone = undone === undefined ? undefined : redo(undone.history, undone.value);
    expect(redone?.value).toBe(2);
    expect(canUndo(redone?.history ?? init())).toBe(true);
  });

  it("coalesces consecutive edits with the same key", () => {
    const first = record(init<string>(), "before", { coalescingKey: "title" });
    const second = record(first, "b", { coalescingKey: "title" });
    expect(second.past).toEqual(["before"]);
    expect(undo(second, "be")?.value).toBe("before");
  });

  it("starts a new entry after the coalescing boundary is broken", () => {
    const first = record(init<string>(), "before", { coalescingKey: "title" });
    const second = record(breakCoalescing(first), "after", { coalescingKey: "title" });
    expect(second.past).toEqual(["before", "after"]);
  });
});
