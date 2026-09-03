import { Schema as S } from "effect";
import { describe, expect, it } from "vitest";

import { History } from "./index";

describe("history", () => {
  it("reports empty history and rejects empty restores", () => {
    const empty = History.init<number>();
    expect(History.canUndo(empty)).toBe(false);
    expect(History.canRedo(empty)).toBe(false);
    expect(History.undo(empty, 1)).toBeUndefined();
    expect(History.redo(empty, 1)).toBeUndefined();
  });

  it("builds a schema for the stored value", () => {
    const schema = History.Schema(S.String);
    expect(S.is(schema)({
      past: ["before"],
      future: [],
      coalescingKey: null,
    })).toBe(true);
  });

  it("records, undoes, and redoes immutable values", () => {
    const recorded = History.record(History.init<number>(), 1);
    const undone = History.undo(recorded, 2);
    expect(undone?.value).toBe(1);
    expect(History.canRedo(undone?.history ?? History.init())).toBe(true);

    const redone = undone === undefined ? undefined : History.redo(undone.history, undone.value);
    expect(redone?.value).toBe(2);
    expect(History.canUndo(redone?.history ?? History.init())).toBe(true);
  });

  it("coalesces consecutive edits with the same key", () => {
    const first = History.record(History.init<string>(), "before", { coalescingKey: "title" });
    const second = History.record(first, "b", { coalescingKey: "title" });
    expect(second.past).toEqual(["before"]);
    expect(History.undo(second, "be")?.value).toBe("before");
  });

  it("starts a new entry after the coalescing boundary is broken", () => {
    const first = History.record(History.init<string>(), "before", { coalescingKey: "title" });
    const second = History.record(History.breakCoalescing(first), "after", { coalescingKey: "title" });
    expect(second.past).toEqual(["before", "after"]);
  });

  it("truncates to the limit and clamps the limit to at least one", () => {
    const limited = [1, 2, 3].reduce(
      (history, previous) => History.record(history, previous, { limit: 2 }),
      History.init<number>(),
    );
    const clamped = [1, 2].reduce(
      (history, previous) => History.record(history, previous, { limit: 0 }),
      History.init<number>(),
    );

    expect(limited.past).toEqual([2, 3]);
    expect(clamped.past).toEqual([2]);
  });

  it("clears the redo future when recording after undo", () => {
    const recorded = History.record(History.record(History.init<number>(), 1), 2);
    const undone = History.undo(recorded, 3);
    if (undone === undefined) throw new Error("Expected undo state");
    expect(History.canRedo(undone.history)).toBe(true);

    const branched = History.record(undone.history, undone.value);
    expect(branched.future).toEqual([]);
    expect(History.canRedo(branched)).toBe(false);
  });
});
