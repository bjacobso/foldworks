import type { Html, HtmlBuilder } from "foldkit/html";

export const DEFAULT_COLUMN_WIDTH = 180;
export const MIN_COLUMN_WIDTH = 80;

export type CellValue = string | number | boolean | null | undefined;
export type ColumnPin = "Start" | "End";
export type SortDirection = "Ascending" | "Descending";
export type SelectionState = "None" | "Some" | "All";

export type Sorting = Readonly<{
  columnId: string;
  direction: SortDirection;
}>;

export type CellContext<Row> = Readonly<{
  row: Row;
  rowId: string;
  rowIndex: number;
  columnId: string;
  value: CellValue;
}>;

export type HeaderContext<Row, Message> = Readonly<{
  column: ColumnDef<Row, Message>;
}>;

export type ColumnDef<Row, Message = never> = Readonly<{
  id: string;
  header: string;
  accessor: (row: Row) => CellValue;
  width?: number;
  align?: "Start" | "Center" | "End";
  pinned?: ColumnPin;
  isPrimary?: boolean;
  enableSorting?: boolean;
  compare?: (left: Row, right: Row) => number;
  href?: (row: Row) => string;
  renderCell?: (context: CellContext<Row>, h: HtmlBuilder<Message>) => Html;
  renderHeader?: (context: HeaderContext<Row, Message>, h: HtmlBuilder<Message>) => Html;
  meta?: unknown;
}>;

export type ResolvedColumn<Row, Message> = Readonly<{
  definition: ColumnDef<Row, Message>;
  width: number;
  pinOffset: number;
  isPinBoundary: boolean;
}>;

export const defineColumns = <Row, Message = never>() =>
  <const Columns extends ReadonlyArray<ColumnDef<Row, Message>>>(columns: Columns) =>
    columns;

export const compareValues = (left: CellValue, right: CellValue): number => {
  if (left === right) return 0;
  if (left === null || left === undefined) return -1;
  if (right === null || right === undefined) return 1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

export const nextSorting = (
  sorting: Sorting | undefined,
  columnId: string,
): Sorting | undefined => {
  if (sorting?.columnId !== columnId) return { columnId, direction: "Ascending" };
  return sorting.direction === "Ascending"
    ? { columnId, direction: "Descending" }
    : undefined;
};

export const sortRows = <Row, Message>(
  rows: ReadonlyArray<Row>,
  columns: ReadonlyArray<ColumnDef<Row, Message>>,
  sorting: Sorting | undefined,
): ReadonlyArray<Row> => {
  if (sorting === undefined) return rows;
  const column = columns.find((candidate) => candidate.id === sorting.columnId);
  if (column === undefined) return rows;
  const direction = sorting.direction === "Ascending" ? 1 : -1;
  return rows.map((row, index) => ({ row, index })).sort((left, right) => {
    const compared = column.compare?.(left.row, right.row) ??
      compareValues(column.accessor(left.row), column.accessor(right.row));
    return direction * compared || left.index - right.index;
  }).map(({ row }) => row);
};

const unique = (ids: ReadonlyArray<string>): ReadonlyArray<string> => [...new Set(ids)];

export const selectionState = (
  rowIds: ReadonlyArray<string>,
  selectedRowIds: ReadonlyArray<string>,
): SelectionState => {
  if (rowIds.length === 0) return "None";
  const selected = new Set(selectedRowIds);
  const count = rowIds.filter((rowId) => selected.has(rowId)).length;
  return count === 0 ? "None" : count === rowIds.length ? "All" : "Some";
};

export const toggleRowSelection = (
  selectedRowIds: ReadonlyArray<string>,
  rowId: string,
): ReadonlyArray<string> => selectedRowIds.includes(rowId)
  ? selectedRowIds.filter((selectedRowId) => selectedRowId !== rowId)
  : unique([...selectedRowIds, rowId]);

export const toggleAllRows = (
  rowIds: ReadonlyArray<string>,
  selectedRowIds: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const visible = new Set(rowIds);
  if (selectionState(rowIds, selectedRowIds) === "All") {
    return selectedRowIds.filter((rowId) => !visible.has(rowId));
  }
  return unique([...selectedRowIds, ...rowIds]);
};

export const resolveColumns = <Row, Message>(
  columns: ReadonlyArray<ColumnDef<Row, Message>>,
): ReadonlyArray<ResolvedColumn<Row, Message>> => {
  const ordered = [
    ...columns.filter((column) => column.pinned === "Start"),
    ...columns.filter((column) => column.pinned !== "Start" && column.pinned !== "End"),
    ...columns.filter((column) => column.pinned === "End"),
  ].map((definition) => ({
    definition,
    width: Math.max(MIN_COLUMN_WIDTH, definition.width ?? DEFAULT_COLUMN_WIDTH),
  }));
  const startOffsets = new Map<string, number>();
  let startOffset = 0;
  for (const column of ordered) {
    if (column.definition.pinned !== "Start") continue;
    startOffsets.set(column.definition.id, startOffset);
    startOffset += column.width;
  }
  const endOffsets = new Map<string, number>();
  let endOffset = 0;
  for (const column of [...ordered].reverse()) {
    if (column.definition.pinned !== "End") continue;
    endOffsets.set(column.definition.id, endOffset);
    endOffset += column.width;
  }
  return ordered.map((column, index) => {
    const pin = column.definition.pinned;
    const neighbor = pin === "Start" ? ordered[index + 1] : pin === "End" ? ordered[index - 1] : undefined;
    return {
      ...column,
      pinOffset: pin === "Start"
        ? startOffsets.get(column.definition.id) ?? 0
        : pin === "End"
          ? endOffsets.get(column.definition.id) ?? 0
          : 0,
      isPinBoundary: pin !== undefined && neighbor?.definition.pinned !== pin,
    };
  });
};
