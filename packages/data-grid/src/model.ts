import { Option, Schema as S } from "effect";
import { defineTaggedUnion } from "foldkit/schema";

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

export type InitialColumn = Readonly<{
  id: string;
  width?: number;
}>;

export type InitConfig = Readonly<{
  id: string;
  columns: ReadonlyArray<InitialColumn>;
}>;

export const DEFAULT_COLUMN_WIDTH = 160;

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

export const columnWidth = (
  model: Model,
  columnId: string,
  fallback = DEFAULT_COLUMN_WIDTH,
): number =>
  model.columnSizes.find((size) => size.columnId === columnId)?.width ?? fallback;
