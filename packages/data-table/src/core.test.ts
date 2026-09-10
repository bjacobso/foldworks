import { describe, expect, it } from "vitest";

import {
  defineColumns,
  nextSorting,
  resolveColumns,
  selectionState,
  sortRows,
  toggleAllRows,
  toggleRowSelection,
} from "./core";

type Person = Readonly<{ id: string; name: string; score: number }>;
const rows: ReadonlyArray<Person> = [
  { id: "two", name: "Beta", score: 12 },
  { id: "one", name: "Alpha", score: 4 },
  { id: "three", name: "Alpha", score: 8 },
];
const columns = defineColumns<Person>()([
  { id: "name", header: "Name", accessor: (row) => row.name, width: 220, pinned: "Start" },
  { id: "score", header: "Score", accessor: (row) => row.score, width: 60 },
  { id: "id", header: "ID", accessor: (row) => row.id, width: 100, pinned: "End" },
]);

describe("data table core", () => {
  it("cycles controlled sorting and stably sorts supplied rows", () => {
    const ascending = nextSorting(undefined, "name");
    const descending = nextSorting(ascending, "name");
    expect(ascending).toEqual({ columnId: "name", direction: "Ascending" });
    expect(descending).toEqual({ columnId: "name", direction: "Descending" });
    expect(nextSorting(descending, "name")).toBeUndefined();
    expect(sortRows(rows, columns, ascending).map((row) => row.id))
      .toEqual(["one", "three", "two"]);
    expect(rows.map((row) => row.id)).toEqual(["two", "one", "three"]);
  });

  it("reports and toggles page selection without dropping off-page ids", () => {
    expect(selectionState(["one", "two"], [])).toBe("None");
    expect(selectionState(["one", "two"], ["one"])).toBe("Some");
    expect(selectionState(["one", "two"], ["one", "two", "off-page"])).toBe("All");
    expect(toggleRowSelection(["one"], "one")).toEqual([]);
    expect(toggleRowSelection(["one"], "two")).toEqual(["one", "two"]);
    expect(toggleAllRows(["one", "two"], ["one", "two", "off-page"]))
      .toEqual(["off-page"]);
    expect(toggleAllRows(["one", "two"], ["one", "off-page"]))
      .toEqual(["one", "off-page", "two"]);
  });

  it("groups pinned columns and computes minimum-width-aware offsets", () => {
    expect(resolveColumns(columns).map((column) => ({
      id: column.definition.id,
      width: column.width,
      offset: column.pinOffset,
      boundary: column.isPinBoundary,
    }))).toEqual([
      { id: "name", width: 220, offset: 0, boundary: true },
      { id: "score", width: 80, offset: 0, boundary: false },
      { id: "id", width: 100, offset: 0, boundary: true },
    ]);
  });
});
