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
});
