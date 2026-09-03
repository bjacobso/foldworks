import { Schema as S } from "effect";

import { DataGrid } from "@foldworks/data-grid";

import { columns } from "./demo";

export const Model = S.Struct({ grid: DataGrid.Model });
export type Model = typeof Model.Type;

export const initialModel: Model = {
  grid: DataGrid.init({
    id: "people-directory",
    columns,
  }),
};
