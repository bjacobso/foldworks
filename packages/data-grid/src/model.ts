import { Option, Schema as S } from "effect";
import { defineTaggedUnion } from "foldkit/schema";

import { DEFAULT_COLUMN_WIDTH, type ColumnDef } from "./core";

export const SortDirection = S.Literals(["Ascending", "Descending"]);
export type SortDirection = typeof SortDirection.Type;

export const CellAddress = S.Struct({
  rowId: S.String,
  columnId: S.String,
});
export type CellAddress = typeof CellAddress.Type;

export const Sorting = S.Struct({
  columnId: S.String,
  direction: SortDirection,
});
export type Sorting = typeof Sorting.Type;

export const ColumnSize = S.Struct({
  columnId: S.String,
  width: S.Number,
});
export type ColumnSize = typeof ColumnSize.Type;

export const ResizeState = defineTaggedUnion({
  Idle: {},
  Resizing: {
    columnId: S.String,
    originX: S.Number,
    originWidth: S.Number,
    minimumWidth: S.Number,
    maximumWidth: S.Number,
  },
});
export type ResizeState = typeof ResizeState.Type;

export const Model = S.Struct({
  id: S.String,
  selectedCell: S.Option(CellAddress),
  sorting: S.Option(Sorting),
  columnSizes: S.Array(ColumnSize),
  resizeState: ResizeState,
});
export type Model = typeof Model.Type;

export type InitConfig<Row = unknown, ParentMessage = never> = Readonly<{
  id: string;
  columns: ReadonlyArray<Pick<ColumnDef<Row, ParentMessage>, "id" | "width">>;
}>;

export const init = (config: InitConfig): Model => ({
  id: config.id,
  selectedCell: Option.none(),
  sorting: Option.none(),
  columnSizes: config.columns.map((column) => ({
    columnId: column.id,
    width: column.width ?? DEFAULT_COLUMN_WIDTH,
  })),
  resizeState: ResizeState.Idle(),
});
