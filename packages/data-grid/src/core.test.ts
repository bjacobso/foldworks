import { Option } from "effect";
import { describe, expect, it } from "vitest";

import {
  compareValues,
  createTable,
  defineColumns,
  isCellInSelection,
  selectionRange,
  selectionSize,
  selectionText,
} from "./core";
import { init } from "./model";

type Person = Readonly<{
  id: string;
  name: string;
  score: number;
}>;

const columns = defineColumns<Person>()([
  { id: "name", header: "Name", accessor: (person) => person.name, width: 220 },
  { id: "score", header: "Score", accessor: (person) => person.score, width: 90 },
]);

const rows: ReadonlyArray<Person> = [
  { id: "two", name: "Beta", score: 12 },
  { id: "one", name: "Alpha", score: 4 },
];

describe("createTable", () => {
  it("derives rows, cells, and the grid template from data and columns", () => {
    const table = createTable({
      model: init({ id: "people", columns }),
      columns,
      rows,
      getRowId: (person) => person.id,
    });

    expect(table.templateColumns).toBe("220px 90px");
    expect(table.totalWidth).toBe(310);
    expect(table.rows.map((row) => row.id)).toEqual(["two", "one"]);
    expect(table.rows[0]?.cells.map((cell) => cell.value)).toEqual(["Beta", 12]);
  });

  it("sorts values without mutating the supplied rows", () => {
    const model = {
      ...init({ id: "people", columns }),
      sorting: Option.some({ columnId: "score", direction: "Ascending" as const }),
    };
    const table = createTable({
      model,
      columns,
      rows,
      getRowId: (person) => person.id,
    });

    expect(table.rows.map((row) => row.id)).toEqual(["one", "two"]);
    expect(rows.map((row) => row.id)).toEqual(["two", "one"]);
  });
});

describe("selection", () => {
  it("derives a rectangular range from stable row and column ids", () => {
    const model = {
      ...init({ id: "people", columns }),
      selectionAnchor: Option.some({ rowId: "two", columnId: "name" }),
      selectedCell: Option.some({ rowId: "one", columnId: "score" }),
    };
    const table = createTable({
      model,
      columns,
      rows,
      getRowId: (person) => person.id,
    });
    const range = selectionRange(model, table);

    expect(range).toEqual({
      startRowIndex: 0,
      endRowIndex: 1,
      startColumnIndex: 0,
      endColumnIndex: 1,
    });
    expect(selectionSize(range)).toBe(4);
    expect(isCellInSelection(range, 1, 1)).toBe(true);
    expect(isCellInSelection(range, 2, 1)).toBe(false);
    expect(selectionText(table, range)).toBe("Beta\t12\nAlpha\t4");
  });

  it("uses custom clipboard values and quotes fields for TSV", () => {
    const clipboardColumns = defineColumns<Person>()([
      {
        id: "name",
        header: "Name",
        accessor: (person) => person.name,
        clipboardValue: ({ row }) => `${row.name}\t\"quoted\"`,
      },
    ]);
    const model = {
      ...init({ id: "people", columns: clipboardColumns }),
      selectedCell: Option.some({ rowId: "two", columnId: "name" }),
      selectionAnchor: Option.some({ rowId: "two", columnId: "name" }),
    };
    const table = createTable({
      model,
      columns: clipboardColumns,
      rows,
      getRowId: (person) => person.id,
    });

    expect(selectionText(table, selectionRange(model, table)))
      .toBe("\"Beta\t\"\"quoted\"\"\"");
  });
});

describe("compareValues", () => {
  it("orders nulls, booleans, numbers, and strings deterministically", () => {
    expect(compareValues(null, "value")).toBeLessThan(0);
    expect(compareValues(undefined, false)).toBeLessThan(0);
    expect(compareValues(false, true)).toBeLessThan(0);
    expect(compareValues(2, 10)).toBeLessThan(0);
    expect(compareValues("item 2", "item 10")).toBeLessThan(0);
    expect(compareValues("Same", "same")).toBe(0);
  });
});
