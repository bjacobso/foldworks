import { Schema as S } from "effect";

import { DataGrid } from "@foldworks/data-grid";

import { coverageColumns } from "./coverage";
import { columns } from "./demo";
import { DataGridExample } from "./example";
import { Person, people } from "./rows";

export const CoverageModel = S.Struct({
  grid: DataGrid.Model,
  search: S.String,
  gapsOnly: S.Boolean,
});
export type CoverageModel = typeof CoverageModel.Type;

export const Model = S.Struct({
  example: DataGridExample,
  grid: DataGrid.Model,
  rows: S.Array(Person),
  coverage: CoverageModel,
});
export type Model = typeof Model.Type;

export const initialModel: Model = {
  example: "Worksheet",
  grid: DataGrid.init({
    id: "people-directory",
    columns,
    editing: { mode: "Batch" },
  }),
  rows: people,
  coverage: {
    grid: DataGrid.init({
      id: "i9-coverage",
      columns: coverageColumns,
      rowSelection: "Single",
      rowGroups: { initiallyExpanded: true },
    }),
    search: "",
    gapsOnly: false,
  },
};

export const setExample = (model: Model, example: DataGridExample): Model =>
  model.example === example ? model : { ...model, example };
