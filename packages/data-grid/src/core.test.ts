import { Option } from "effect";
import { describe, expect, it } from "vitest";

import { createTable, defineColumns } from "./core";
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
