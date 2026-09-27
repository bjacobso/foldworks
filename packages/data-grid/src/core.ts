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
  /** Nesting level: 0 for top-level rows, 1 for their sub-rows, and so on. */
  depth?: number;
}>;

export type RowTone = "Neutral" | "Info" | "Success" | "Warning" | "Danger";

export type RowContext = Readonly<{
  rowId: string;
  rowIndex: number;
  depth: number;
  childCount: number;
  isExpanded: boolean;
  isSelected: boolean;
}>;

/** Per-row presentation and behavior returned by `ViewConfig.rowAttributes`. */
export type RowAttributes<ParentMessage> = Readonly<{
  /** Dispatched when the row is clicked, or when Enter is pressed on a
   * read-only cell in the row. */
  onClick?: ParentMessage;
  /** Tints the row and marks its leading edge, for example coverage gaps. */
  tone?: RowTone;
  /** Accessible row name, announced when focus enters the row. */
  label?: string;
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
  /** Renders this column's body cells as row headers. */
  rowHeader?: boolean;
  compare?: (left: Row, right: Row) => number;
  /** Plain-text hover and focus details for a cell. Multiple lines are kept.
   * Details hold no model state; one shared popover serves the whole grid. */
  details?: (context: CellContext<Row>) => string | undefined;
  clipboardValue?: (context: CellContext<Row>) => string;
  renderCell?: (context: CellContext<Row>, h: HtmlBuilder<ParentMessage>) => Html;
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
  depth: number;
  parentId: string | undefined;
  childCount: number;
  isExpanded: boolean;
  positionInSet: number;
  setSize: number;
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
  /** Returns a row's child rows. Rows with children become expandable row
   * groups whose expansion is keyed by their stable row ID. */
  getSubRows?: (row: Row) => ReadonlyArray<Row> | undefined;
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
    ...reconciled.filter((column) => column.pinned !== "Start" && column.pinned !== "End"),
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
  [reordered[fromIndex], reordered[toIndex]] = [reordered[toIndex]!, reordered[fromIndex]!];
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
): number => model.columnSizes.find((size) => size.columnId === columnId)?.width ?? fallback;

export const isRowGroupExpanded = (model: Model, rowId: string): boolean =>
  model.rowGroups.expandedByDefault !== model.rowGroups.toggledRowIds.includes(rowId);

type VisibleRow<Row> = Omit<TableRow<Row, never>, "index" | "cells">;

const flattenVisibleRows = <Row, ParentMessage>(
  config: CreateTableConfig<Row, ParentMessage>,
  compare: ((left: Row, right: Row) => number) | undefined,
): ReadonlyArray<VisibleRow<Row>> => {
  const toggled = new Set(config.model.rowGroups.toggledRowIds);
  const expandedByDefault = config.model.rowGroups.expandedByDefault;
  const output: Array<VisibleRow<Row>> = [];
  const visit = (rows: ReadonlyArray<Row>, depth: number, parentId: string | undefined): void => {
    const siblings = compare === undefined ? rows : [...rows].sort(compare);
    siblings.forEach((row, index) => {
      const id = config.getRowId(row);
      const children = config.getSubRows?.(row) ?? [];
      const isExpanded = children.length > 0 && expandedByDefault !== toggled.has(id);
      output.push({
        id,
        original: row,
        depth,
        parentId,
        childCount: children.length,
        isExpanded,
        positionInSet: index + 1,
        setSize: siblings.length,
      });
      if (isExpanded) visit(children, depth + 1, id);
    });
  };
  visit(config.rows, 0, undefined);
  return output;
};

/** Flattens grouped rows depth-first, including rows inside collapsed groups. */
export const flattenRows = <Row>(
  rows: ReadonlyArray<Row>,
  getSubRows?: (row: Row) => ReadonlyArray<Row> | undefined,
): ReadonlyArray<Row> => {
  if (getSubRows === undefined) return rows;
  const output: Array<Row> = [];
  const visit = (items: ReadonlyArray<Row>): void => {
    for (const item of items) {
      output.push(item);
      const children = getSubRows(item);
      if (children !== undefined && children.length > 0) visit(children);
    }
  };
  visit(rows);
  return output;
};

export const createTable = <Row, ParentMessage>(
  config: CreateTableConfig<Row, ParentMessage>,
): Table<Row, ParentMessage> => {
  const definitions = orderedColumns(config.columns, config.model.columnOrder);
  const sorting = Option.getOrUndefined(config.model.sorting);
  const sortingColumn =
    sorting === undefined
      ? undefined
      : definitions.find((column) => column.id === sorting.columnId);
  const compare =
    sorting === undefined || sortingColumn === undefined
      ? undefined
      : (left: Row, right: Row) =>
          (sorting.direction === "Ascending" ? 1 : -1) *
          (sortingColumn.compare?.(left, right) ??
            compareValues(sortingColumn.accessor(left), sortingColumn.accessor(right)));
  const visibleRows = flattenVisibleRows(config, compare);
  const baseColumns = definitions.map((definition) => ({
    definition,
    width: columnWidth(config.model, definition.id, definition.width ?? DEFAULT_COLUMN_WIDTH),
    sortDirection: sorting?.columnId === definition.id ? sorting.direction : undefined,
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
    const neighbor =
      pinned === "Start"
        ? baseColumns[index + 1]
        : pinned === "End"
          ? baseColumns[index - 1]
          : undefined;
    return {
      ...column,
      pinned,
      pinOffset:
        pinned === "Start"
          ? (startOffsets.get(column.definition.id) ?? 0)
          : pinned === "End"
            ? (endOffsets.get(column.definition.id) ?? 0)
            : 0,
      isPinBoundary: pinned !== undefined && neighbor?.definition.pinned !== pinned,
    };
  });
  const tableRows = visibleRows.map((row, index) => ({
    ...row,
    index,
    cells: definitions.map((column) => ({
      id: `${row.id}:${column.id}`,
      column,
      value: (() => {
        const draft =
          config.model.drafts.length === 0
            ? undefined
            : config.model.drafts.find((item) =>
                sameCell(item, { rowId: row.id, columnId: column.id }),
              );
        return draft === undefined ? column.accessor(row.original) : draft.value;
      })(),
    })),
  }));
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
  const columnIndex = table.columns.findIndex(
    (column) => column.definition.id === address.columnId,
  );
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
  const anchorIndexes =
    anchor === undefined ? focusIndexes : (addressIndexes(table, anchor) ?? focusIndexes);
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
): boolean =>
  range !== undefined &&
  rowIndex >= range.startRowIndex &&
  rowIndex <= range.endRowIndex &&
  columnIndex >= range.startColumnIndex &&
  columnIndex <= range.endColumnIndex;

export const selectionSize = (range: SelectionRange | undefined): number =>
  range === undefined
    ? 0
    : (range.endRowIndex - range.startRowIndex + 1) *
      (range.endColumnIndex - range.startColumnIndex + 1);

const clipboardField = (value: string): string =>
  /[\t\r\n"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export const selectionText = <Row, ParentMessage>(
  table: Table<Row, ParentMessage>,
  range: SelectionRange | undefined,
): string =>
  range === undefined
    ? ""
    : table.rows
        .slice(range.startRowIndex, range.endRowIndex + 1)
        .map((row) =>
          row.cells
            .slice(range.startColumnIndex, range.endColumnIndex + 1)
            .map((cell) =>
              clipboardField(
                cell.column.clipboardValue?.({
                  row: row.original,
                  rowId: row.id,
                  rowIndex: row.index,
                  columnId: cell.column.id,
                  value: cell.value,
                  depth: row.depth,
                }) ?? (cell.value === null || cell.value === undefined ? "" : String(cell.value)),
              ),
            )
            .join("\t"),
        )
        .join("\n");

export const defineColumns =
  <Row, ParentMessage = never>() =>
  <const Columns extends ReadonlyArray<ColumnDef<Row, ParentMessage>>>(columns: Columns) =>
    columns;
