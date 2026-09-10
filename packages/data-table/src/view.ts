import { ArrowDown, ArrowUp, Check, ChevronsUpDown, Minus } from "@lucide/icons";
import * as Icon from "@foldworks/ui/icon";
import type { Html, HtmlBuilder } from "foldkit/html";

import {
  nextSorting,
  resolveColumns,
  selectionState,
  toggleAllRows,
  toggleRowSelection,
  type CellValue,
  type ColumnDef,
  type SelectionState,
  type Sorting,
} from "./core";

export type Density = "Compact" | "Comfortable";

export type ViewConfig<Row, Message> = Readonly<{
  id: string;
  label: string;
  columns: ReadonlyArray<ColumnDef<Row, Message>>;
  rows: ReadonlyArray<Row>;
  getRowId: (row: Row) => string;
  getRowLabel?: (row: Row) => string;
  sorting?: Sorting;
  onSortingChange?: (sorting: Sorting | undefined) => Message;
  selectedRowIds?: ReadonlyArray<string>;
  onSelectedRowsChange?: (rowIds: ReadonlyArray<string>) => Message;
  density?: Density;
  isLoading?: boolean;
  loadingRowCount?: number;
  emptyText?: string;
}>;

const formatValue = (value: CellValue): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const checkbox = <Message>(
  state: SelectionState,
  label: string,
  onToggle: Message,
  h: HtmlBuilder<Message>,
): Html => h.button(
  [
    h.Type("button"),
    h.Class("fk-data-table__checkbox"),
    h.Role("checkbox"),
    h.AriaLabel(label),
    h.AriaChecked(state === "All" ? true : state === "Some" ? "mixed" : false),
    h.DataAttribute("state", state.toLowerCase()),
    h.OnClick(onToggle),
  ],
  state === "None"
    ? []
    : [Icon.view({ icon: state === "Some" ? Minus : Check, size: 12, strokeWidth: 2.75 }, h)],
);

export const view = <Row, Message>(
  config: ViewConfig<Row, Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const columns = resolveColumns(config.columns);
  const selectedRowIds = config.selectedRowIds ?? [];
  const rowIds = config.rows.map(config.getRowId);
  const visibleSelection = selectionState(rowIds, selectedRowIds);
  const selectionEnabled = config.onSelectedRowsChange !== undefined;
  const selectionWidth = selectionEnabled ? 44 : 0;
  const totalWidth = columns.reduce((total, column) => total + column.width, selectionWidth);
  const columnCount = columns.length + (selectionEnabled ? 1 : 0);
  const loadingRowCount = Math.max(1, Math.floor(config.loadingRowCount ?? 6));

  const pinAttributes = (column: typeof columns[number], cell: "header" | "body") => [
    h.DataAttribute("pinned", column.definition.pinned?.toLowerCase() ?? "false"),
    h.DataAttribute("pin-boundary", column.isPinBoundary ? "true" : "false"),
    ...(column.definition.pinned === "Start"
      ? [h.Style({ left: `${column.pinOffset + selectionWidth}px` })]
      : column.definition.pinned === "End"
        ? [h.Style({ right: `${column.pinOffset}px` })]
        : []),
    h.Class(cell === "header" ? "fk-data-table__header-cell" : "fk-data-table__cell"),
  ];

  const table = h.table(
    [
      h.Class("fk-data-table__table"),
      h.Style({ minWidth: `${totalWidth}px` }),
      h.AriaBusy(config.isLoading === true),
    ],
    [
      h.caption([h.Class("fk-data-table__caption")], [config.label]),
      h.colgroup([], [
        ...(selectionEnabled
          ? [h.col([h.Style({ width: `${selectionWidth}px` })])]
          : []),
        ...columns.map((column) =>
          h.col([h.Style({ width: `${column.width}px` })])),
      ]),
      h.thead([], [
        h.tr([], [
          ...(selectionEnabled && config.onSelectedRowsChange !== undefined
            ? [h.th([
                h.Class("fk-data-table__selection-cell"),
                h.Scope("col"),
                h.Style({ left: "0px" }),
              ], [checkbox(
                visibleSelection,
                visibleSelection === "All" ? "Clear visible row selection" : "Select all visible rows",
                config.onSelectedRowsChange(toggleAllRows(rowIds, selectedRowIds)),
                h,
              )])]
            : []),
          ...columns.map((column) => {
            const definition = column.definition;
            const sortable = definition.enableSorting !== false &&
              config.onSortingChange !== undefined;
            const direction = config.sorting?.columnId === definition.id
              ? config.sorting.direction
              : undefined;
            const content = definition.renderHeader?.({ column: definition }, h) ??
              definition.header;
            return h.th(
              [
                ...pinAttributes(column, "header"),
                h.Scope("col"),
                ...(direction === undefined
                  ? []
                  : [h.AriaSort(direction === "Ascending" ? "ascending" : "descending")]),
                h.DataAttribute("column-id", definition.id),
                h.DataAttribute("align", (definition.align ?? "Start").toLowerCase()),
              ],
              sortable && config.onSortingChange !== undefined
                ? [h.button([
                    h.Type("button"),
                    h.Class("fk-data-table__sort-button"),
                    h.OnClick(config.onSortingChange(nextSorting(config.sorting, definition.id))),
                  ], [
                    content,
                    h.span([h.Class("fk-data-table__sort-icon"), h.AriaHidden(true)], [
                      Icon.view({
                        icon: direction === "Ascending"
                          ? ArrowUp
                          : direction === "Descending"
                            ? ArrowDown
                            : ChevronsUpDown,
                        size: 13,
                        strokeWidth: 2.1,
                      }, h),
                    ]),
                  ])]
                : [h.div([h.Class("fk-data-table__header-label")], [content])],
            );
          }),
        ]),
      ]),
      h.tbody([], config.isLoading === true
        ? Array.from({ length: loadingRowCount }, (_, rowIndex) =>
            h.keyed("tr")(
              `loading-${rowIndex}`,
              [h.Class("fk-data-table__row"), h.AriaHidden(true)],
              [
                ...(selectionEnabled
                  ? [h.td([
                      h.Class("fk-data-table__selection-cell"),
                      h.Style({ left: "0px" }),
                    ], [h.span([h.Class("fk-data-table__skeleton-checkbox")], [])])]
                  : []),
                ...columns.map((column) => h.td([
                  ...pinAttributes(column, "body"),
                  h.DataAttribute("cell-column-id", column.definition.id),
                ], [h.span([h.Class("fk-data-table__skeleton")], [])])),
              ],
            ))
        : config.rows.length === 0
          ? [h.tr([], [h.td([
              h.Class("fk-data-table__empty"),
              h.Colspan(Math.max(1, columnCount)),
            ], [config.emptyText ?? "No records found."])])]
          : config.rows.map((row, rowIndex) => {
              const rowId = config.getRowId(row);
              const selected = selectedRowIds.includes(rowId);
              return h.keyed("tr")(
                rowId,
                [
                  h.Class("fk-data-table__row"),
                  h.DataAttribute("row-id", rowId),
                  h.DataAttribute("selected", selected ? "true" : "false"),
                ],
                [
                  ...(selectionEnabled && config.onSelectedRowsChange !== undefined
                    ? [h.td([
                        h.Class("fk-data-table__selection-cell"),
                        h.Style({ left: "0px" }),
                      ], [checkbox(
                        selected ? "All" : "None",
                        `${selected ? "Deselect" : "Select"} ${config.getRowLabel?.(row) ?? `row ${rowIndex + 1}`}`,
                        config.onSelectedRowsChange(toggleRowSelection(selectedRowIds, rowId)),
                        h,
                      )])]
                    : []),
                  ...columns.map((column) => {
                    const definition = column.definition;
                    const value = definition.accessor(row);
                    const context = {
                      row,
                      rowId,
                      rowIndex,
                      columnId: definition.id,
                      value,
                    };
                    const content = definition.renderCell?.(context, h) ?? formatValue(value);
                    const href = definition.href?.(row);
                    return h.td(
                      [
                        ...pinAttributes(column, "body"),
                        h.DataAttribute("cell-column-id", definition.id),
                        h.DataAttribute("align", (definition.align ?? "Start").toLowerCase()),
                        h.DataAttribute("primary", definition.isPrimary === true ? "true" : "false"),
                      ],
                      href === undefined
                        ? [content]
                        : [h.a([
                            h.Class("fk-data-table__resource-link"),
                            h.Href(href),
                          ], [content])],
                    );
                  }),
                ],
              );
            }),
      ),
    ],
  );

  return h.div(
    [
      h.Class("fk-data-table"),
      h.DataAttribute("table-id", config.id),
      h.DataAttribute("density", config.density ?? "Comfortable"),
      h.DataAttribute("selected-count", String(selectedRowIds.length)),
    ],
    [h.div([h.Class("fk-data-table__scroller"), h.AriaLabel(config.label)], [table])],
  );
};
