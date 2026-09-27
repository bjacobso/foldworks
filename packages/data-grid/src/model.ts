import { Option, Schema as S } from "effect";
import { defineTaggedUnion } from "foldkit/schema";

import { DEFAULT_COLUMN_WIDTH, type ColumnDef } from "./core";
import { ActiveEdit, Draft, Submission } from "./editing-model";

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

export const Viewport = S.Struct({
  scrollTop: S.Number,
  height: S.Number,
});
export type Viewport = typeof Viewport.Type;

export const RowSelectionMode = S.Literals(["None", "Single"]);
export type RowSelectionMode = typeof RowSelectionMode.Type;

/** Group expansion is stored as exceptions to a default, keyed by the parent
 * row's stable ID, so it survives filtering, sorting, and virtualization. */
export const RowGroupExpansion = S.Struct({
  expandedByDefault: S.Boolean,
  toggledRowIds: S.Array(S.String),
});
export type RowGroupExpansion = typeof RowGroupExpansion.Type;

export const Model = S.Struct({
  id: S.String,
  columnOrder: S.Array(S.String),
  selectedCell: S.Option(CellAddress),
  selectionAnchor: S.Option(CellAddress),
  rowSelection: RowSelectionMode,
  selectedRowId: S.Option(S.String),
  rowGroups: RowGroupExpansion,
  sorting: S.Option(Sorting),
  columnSizes: S.Array(ColumnSize),
  resizeState: ResizeState,
  viewport: Viewport,
  editingMode: S.Literals(["Disabled", "Immediate", "Batch"]),
  drafts: S.Array(Draft),
  activeEdit: S.Option(ActiveEdit),
  pendingSubmission: S.Option(Submission),
  nextSubmissionId: S.Number,
  saveError: S.String,
});
export type Model = typeof Model.Type;

export type InitConfig<Row = unknown, ParentMessage = never> = Readonly<{
  id: string;
  columns: ReadonlyArray<Pick<ColumnDef<Row, ParentMessage>, "id" | "width">>;
  editing?: Readonly<{ mode: "Immediate" | "Batch" }>;
  /** `"Single"` selects the focused row when a cell is clicked or reached
   * with an unshifted arrow key, independent of the cell-range selection. */
  rowSelection?: RowSelectionMode;
  rowGroups?: Readonly<{ initiallyExpanded?: boolean }>;
}>;

export const init = (config: InitConfig): Model => ({
  id: config.id,
  columnOrder: config.columns.map((column) => column.id),
  selectedCell: Option.none(),
  selectionAnchor: Option.none(),
  rowSelection: config.rowSelection ?? "None",
  selectedRowId: Option.none(),
  rowGroups: {
    expandedByDefault: config.rowGroups?.initiallyExpanded ?? true,
    toggledRowIds: [],
  },
  sorting: Option.none(),
  columnSizes: config.columns.map((column) => ({
    columnId: column.id,
    width: column.width ?? DEFAULT_COLUMN_WIDTH,
  })),
  resizeState: ResizeState.Idle(),
  viewport: { scrollTop: 0, height: 0 },
  editingMode: config.editing?.mode ?? "Disabled",
  drafts: [],
  activeEdit: Option.none(),
  pendingSubmission: Option.none(),
  nextSubmissionId: 1,
  saveError: "",
});
