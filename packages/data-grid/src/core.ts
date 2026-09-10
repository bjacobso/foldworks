import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import type { Model, SortDirection } from "./model";
import { sameCell } from "./editing-model";

export const DEFAULT_COLUMN_WIDTH = 160;
export const MIN_COLUMN_WIDTH = 72;
export const MAX_COLUMN_WIDTH = 640;

export type CellValue = string | number | boolean | null | undefined;
export type ColumnPin = "Start" | "End";

export type CellEditor<Row> = Readonly<{
  kind: "Text" | "Number" | "Select" | "Checkbox";
  options?: ReadonlyArray<Readonly<{ value: string; label: string }>>;
  validate?: (value: CellValue, row: Row) => string | undefined;
}>;

export type EditorContext<ParentMessage> = Readonly<{
  id: string;
  label: string;
  input: string;
  value: CellValue;
  error: string;
  onInput: (input: string) => ParentMessage;
  onCommit: ParentMessage;
  onCancel: ParentMessage;
}>;

export type CellContext<Row> = Readonly<{
  row: Row;
  rowId: string;
  rowIndex: number;
  columnId: string;
  value: CellValue;
}>;

export type HeaderContext<Row, ParentMessage> = Readonly<{
  column: ColumnDef<Row, ParentMessage>;
}>;

export type ColumnDef<Row, ParentMessage = never> = Readonly<{
  id: string;
  header: string;
  accessor: (row: Row) => CellValue;
  width?: number;
  minimumWidth?: number;
  maximumWidth?: number;
  align?: "Start" | "Center" | "End";
  enableSorting?: boolean;
  enableResizing?: boolean;
  pinned?: ColumnPin;
  compare?: (left: Row, right: Row) => number;
  clipboardValue?: (context: CellContext<Row>) => string;
  renderCell?: (
    context: CellContext<Row>,
    h: HtmlBuilder<ParentMessage>,
  ) => Html;
  renderHeader?: (
    context: HeaderContext<Row, ParentMessage>,
    h: HtmlBuilder<ParentMessage>,
  ) => Html;
  meta?: unknown;
  editor?: CellEditor<Row>;
  renderEditor?: (context: EditorContext<ParentMessage>, h: HtmlBuilder<ParentMessage>) => Html;
}>;

export type TableCell<Row, ParentMessage> = Readonly<{
  id: string;
  column: ColumnDef<Row, ParentMessage>;
  value: CellValue;
}>;

export type TableRow<Row, ParentMessage> = Readonly<{
  id: string;
  index: number;
  original: Row;
  cells: ReadonlyArray<TableCell<Row, ParentMessage>>;
}>;

export type TableColumn<Row, ParentMessage> = Readonly<{
  definition: ColumnDef<Row, ParentMessage>;
  width: number;
  sortDirection: SortDirection | undefined;
  pinned: ColumnPin | undefined;
  pinOffset: number;
  isPinBoundary: boolean;
}>;

export type Table<Row, ParentMessage> = Readonly<{
  columns: ReadonlyArray<TableColumn<Row, ParentMessage>>;
  rows: ReadonlyArray<TableRow<Row, ParentMessage>>;
  templateColumns: string;
  totalWidth: number;
}>;

export type SelectionRange = Readonly<{
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
}>;

export type CreateTableConfig<Row, ParentMessage> = Readonly<{
  model: Model;
  columns: ReadonlyArray<ColumnDef<Row, ParentMessage>>;
  rows: ReadonlyArray<Row>;
  getRowId: (row: Row) => string;
}>;

export type ColumnMoveDirection = "Before" | "After";

export const orderedColumns = <Row, ParentMessage>(
  columns: ReadonlyArray<ColumnDef<Row, ParentMessage>>,
  columnOrder: ReadonlyArray<string>,
): ReadonlyArray<ColumnDef<Row, ParentMessage>> => {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const seen = new Set<string>();
  const ordered = columnOrder.flatMap((columnId) => {
    const column = byId.get(columnId);
    if (column === undefined || seen.has(columnId)) return [];
    seen.add(columnId);
    return [column];
  });
  const reconciled = [...ordered, ...columns.filter((column) => !seen.has(column.id))];
  return [
    ...reconciled.filter((column) => column.pinned === "Start"),
    ...reconciled.filter((column) =>
      column.pinned !== "Start" && column.pinned !== "End"),
    ...reconciled.filter((column) => column.pinned === "End"),
  ];
};

export const moveColumn = (
  columnIds: ReadonlyArray<string>,
  columnId: string,
  direction: ColumnMoveDirection,
): ReadonlyArray<string> => {
  const uniqueIds = [...new Set(columnIds)];
  const fromIndex = uniqueIds.indexOf(columnId);
  const toIndex = fromIndex + (direction === "Before" ? -1 : 1);
  if (fromIndex < 0 || toIndex < 0 || toIndex >= uniqueIds.length) return uniqueIds;
  const reordered = [...uniqueIds];
  [reordered[fromIndex], reordered[toIndex]] = [
    reordered[toIndex]!,
    reordered[fromIndex]!,
  ];
  return reordered;
};

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

export const columnWidth = (
  model: Model,
  columnId: string,
  fallback = DEFAULT_COLUMN_WIDTH,
): number =>
  model.columnSizes.find((size) => size.columnId === columnId)?.width ?? fallback;

export const createTable = <Row, ParentMessage>(
  config: CreateTableConfig<Row, ParentMessage>,
): Table<Row, ParentMessage> => {
  const definitions = orderedColumns(config.columns, config.model.columnOrder);
  const sorting = Option.getOrUndefined(config.model.sorting);
  const sortingColumn = sorting === undefined
    ? undefined
    : definitions.find((column) => column.id === sorting.columnId);
  const rows = [...config.rows];
  if (sorting !== undefined && sortingColumn !== undefined) {
    const direction = sorting.direction === "Ascending" ? 1 : -1;
    rows.sort((left, right) =>
      direction * (
        sortingColumn.compare?.(left, right) ??
        compareValues(sortingColumn.accessor(left), sortingColumn.accessor(right))
      ),
    );
  }

  const baseColumns = definitions.map((definition) => ({
    definition,
    width: columnWidth(
      config.model,
      definition.id,
      definition.width ?? DEFAULT_COLUMN_WIDTH,
    ),
    sortDirection:
      sorting?.columnId === definition.id ? sorting.direction : undefined,
  }));
  const startOffsets = new Map<string, number>();
  let startOffset = 0;
  for (const column of baseColumns) {
    if (column.definition.pinned !== "Start") continue;
    startOffsets.set(column.definition.id, startOffset);
    startOffset += column.width;
  }
  const endOffsets = new Map<string, number>();
  let endOffset = 0;
  for (const column of [...baseColumns].reverse()) {
    if (column.definition.pinned !== "End") continue;
    endOffsets.set(column.definition.id, endOffset);
    endOffset += column.width;
  }
  const columns = baseColumns.map((column, index) => {
    const pinned = column.definition.pinned;
    const neighbor = pinned === "Start"
      ? baseColumns[index + 1]
      : pinned === "End"
        ? baseColumns[index - 1]
        : undefined;
    return {
      ...column,
      pinned,
      pinOffset: pinned === "Start"
        ? startOffsets.get(column.definition.id) ?? 0
        : pinned === "End"
          ? endOffsets.get(column.definition.id) ?? 0
          : 0,
      isPinBoundary: pinned !== undefined && neighbor?.definition.pinned !== pinned,
    };
  });
  const tableRows = rows.map((row, index) => {
    const rowId = config.getRowId(row);
    return {
      id: rowId,
      index,
      original: row,
      cells: definitions.map((column) => ({
        id: `${rowId}:${column.id}`,
        column,
        value: (() => {
          const draft = config.model.drafts.find((item) => sameCell(item, { rowId, columnId: column.id }));
          return draft === undefined ? column.accessor(row) : draft.value;
        })(),
      })),
    };
  });
  const widths = columns.map((column) => column.width);
  return {
    columns,
    rows: tableRows,
    templateColumns: widths.map((width) => `${width}px`).join(" "),
    totalWidth: widths.reduce((total, width) => total + width, 0),
  };
};

const addressIndexes = <Row, ParentMessage>(
  table: Table<Row, ParentMessage>,
  address: Readonly<{ rowId: string; columnId: string }>,
): Readonly<{ rowIndex: number; columnIndex: number }> | undefined => {
  const rowIndex = table.rows.findIndex((row) => row.id === address.rowId);
  const columnIndex = table.columns.findIndex((column) => column.definition.id === address.columnId);
  return rowIndex < 0 || columnIndex < 0 ? undefined : { rowIndex, columnIndex };
};

export const selectionRange = <Row, ParentMessage>(
  model: Model,
  table: Table<Row, ParentMessage>,
): SelectionRange | undefined => {
  const focus = Option.getOrUndefined(model.selectedCell);
  if (focus === undefined) return undefined;
  const focusIndexes = addressIndexes(table, focus);
  if (focusIndexes === undefined) return undefined;
  const anchor = Option.getOrUndefined(model.selectionAnchor);
  const anchorIndexes = anchor === undefined ? focusIndexes : addressIndexes(table, anchor) ?? focusIndexes;
  return {
    startRowIndex: Math.min(anchorIndexes.rowIndex, focusIndexes.rowIndex),
    endRowIndex: Math.max(anchorIndexes.rowIndex, focusIndexes.rowIndex),
    startColumnIndex: Math.min(anchorIndexes.columnIndex, focusIndexes.columnIndex),
    endColumnIndex: Math.max(anchorIndexes.columnIndex, focusIndexes.columnIndex),
  };
};

export const isCellInSelection = (
  range: SelectionRange | undefined,
  rowIndex: number,
  columnIndex: number,
): boolean => range !== undefined &&
  rowIndex >= range.startRowIndex && rowIndex <= range.endRowIndex &&
  columnIndex >= range.startColumnIndex && columnIndex <= range.endColumnIndex;

export const selectionSize = (range: SelectionRange | undefined): number => range === undefined
  ? 0
  : (range.endRowIndex - range.startRowIndex + 1) *
    (range.endColumnIndex - range.startColumnIndex + 1);

const clipboardField = (value: string): string => /[\t\r\n"]/.test(value)
  ? `"${value.replaceAll('"', '""')}"`
  : value;

export const selectionText = <Row, ParentMessage>(
  table: Table<Row, ParentMessage>,
  range: SelectionRange | undefined,
): string => range === undefined ? "" : table.rows
  .slice(range.startRowIndex, range.endRowIndex + 1)
  .map((row) => row.cells
    .slice(range.startColumnIndex, range.endColumnIndex + 1)
    .map((cell) => clipboardField(cell.column.clipboardValue?.({
      row: row.original,
      rowId: row.id,
      rowIndex: row.index,
      columnId: cell.column.id,
      value: cell.value,
    }) ?? (cell.value === null || cell.value === undefined ? "" : String(cell.value))))
    .join("\t"))
  .join("\n");

export const defineColumns = <Row, ParentMessage = never>() =>
  <const Columns extends ReadonlyArray<ColumnDef<Row, ParentMessage>>>(columns: Columns) =>
    columns;
