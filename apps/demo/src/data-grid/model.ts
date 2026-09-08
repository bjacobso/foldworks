import { Schema as S } from "effect";

import { DataGrid } from "@foldworks/data-grid";

import { columns } from "./demo";
import { Person, people } from "./rows";

export const Model = S.Struct({ grid: DataGrid.Model, rows: S.Array(Person) });
export type Model = typeof Model.Type;

export const initialModel: Model = {
  grid: DataGrid.init({
    id: "people-directory",
    columns,
    editing: { mode: "Batch" },
  }),
  rows: people,
};
