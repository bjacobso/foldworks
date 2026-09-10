import { Option } from "effect";
import { describe, expect, it } from "vitest";

import { Message } from "./message";
import { init } from "./model";
import { update } from "./update";

const model = () => init({
  id: "people",
  columns: [{ id: "name", width: 180 }],
});

describe("update", () => {
  it("stores a deduplicated column order and skips redundant updates", () => {
    const reordered = update(
      model(),
      Message.ChangedColumnOrder({ columnIds: ["department", "name", "name"] }),
    ).model;

    expect(reordered.columnOrder).toEqual(["department", "name"]);
    expect(update(
      reordered,
      Message.ChangedColumnOrder({ columnIds: ["department", "name"] }),
    ).model).toBe(reordered);
  });

  it("records a clamped viewport measurement without redundant updates", () => {
    const measured = update(
      model(),
      Message.MeasuredViewport({ scrollTop: -20, height: 480 }),
    ).model;

    expect(measured.viewport).toEqual({ scrollTop: 0, height: 480 });
    expect(update(
      measured,
      Message.MeasuredViewport({ scrollTop: 0, height: 480 }),
    ).model).toBe(measured);
  });

  it("ignores resize movement while idle", () => {
    const idle = model();
    expect(update(idle, Message.MovedColumnResize({ screenX: 400 })).model)
      .toBe(idle);
  });

  it("cycles a column through ascending, descending, and unsorted", () => {
    const ascending = update(model(), Message.ToggledSort({ columnId: "name" })).model;
    const descending = update(
      ascending,
      Message.ToggledSort({ columnId: "name" }),
    ).model;
    const unsorted = update(
      descending,
      Message.ToggledSort({ columnId: "name" }),
    ).model;

    expect(Option.getOrUndefined(ascending.sorting)?.direction).toBe("Ascending");
    expect(Option.getOrUndefined(descending.sorting)?.direction).toBe("Descending");
    expect(Option.isNone(unsorted.sorting)).toBe(true);
  });

  it("selects a cell by stable row and column ids", () => {
    const selected = update(
      model(),
      Message.SelectedCell({ rowId: "person-1", columnId: "name" }),
    ).model;

    expect(Option.getOrUndefined(selected.selectedCell)).toEqual({
      rowId: "person-1",
      columnId: "name",
    });
    expect(Option.getOrUndefined(selected.selectionAnchor)).toEqual({
      rowId: "person-1",
      columnId: "name",
    });
  });

  it("extends from the stable anchor and collapses on ordinary selection", () => {
    const selected = update(
      model(),
      Message.SelectedCell({ rowId: "person-1", columnId: "name" }),
    ).model;
    const extended = update(
      selected,
      Message.ExtendedSelection({
        rowId: "person-3",
        columnId: "department",
        anchorRowId: "person-1",
        anchorColumnId: "name",
      }),
    ).model;
    const collapsed = update(
      extended,
      Message.SelectedCell({ rowId: "person-2", columnId: "department" }),
    ).model;

    expect(Option.getOrUndefined(extended.selectionAnchor)).toEqual({
      rowId: "person-1",
      columnId: "name",
    });
    expect(Option.getOrUndefined(extended.selectedCell)).toEqual({
      rowId: "person-3",
      columnId: "department",
    });
    expect(Option.getOrUndefined(collapsed.selectionAnchor)).toEqual(
      Option.getOrUndefined(collapsed.selectedCell),
    );
  });

  it("uses the focused origin when extending an initially empty selection", () => {
    const extended = update(
      model(),
      Message.ExtendedSelection({
        rowId: "person-1",
        columnId: "department",
        anchorRowId: "person-1",
        anchorColumnId: "name",
      }),
    ).model;

    expect(Option.getOrUndefined(extended.selectionAnchor)).toEqual({
      rowId: "person-1",
      columnId: "name",
    });
  });

  it("starts a different sort column in ascending order", () => {
    const descending = update(
      update(model(), Message.ToggledSort({ columnId: "name" })).model,
      Message.ToggledSort({ columnId: "name" }),
    ).model;
    const changed = update(
      descending,
      Message.ToggledSort({ columnId: "department" }),
    ).model;

    expect(Option.getOrUndefined(changed.sorting)).toEqual({
      columnId: "department",
      direction: "Ascending",
    });
  });

  it("clamps a resize and restores the configured width on reset", () => {
    const resizing = update(
      model(),
      Message.StartedColumnResize({
        columnId: "name",
        screenX: 100,
        width: 180,
        minimumWidth: 100,
        maximumWidth: 240,
      }),
    ).model;
    const widened = update(
      resizing,
      Message.MovedColumnResize({ screenX: 400 }),
    ).model;
    const reset = update(
      widened,
      Message.ResetColumnSize({ columnId: "name", width: 180 }),
    ).model;

    expect(widened.columnSizes[0]?.width).toBe(240);
    expect(reset.columnSizes[0]?.width).toBe(180);
  });

  it("appends a width for a column that was not initialized", () => {
    const resized = update(
      model(),
      Message.ResetColumnSize({ columnId: "department", width: 210 }),
    ).model;

    expect(resized.columnSizes).toEqual([
      { columnId: "name", width: 180 },
      { columnId: "department", width: 210 },
    ]);
  });
});
