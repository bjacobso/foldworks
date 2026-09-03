import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "@lucide/icons";
import * as Icon from "@foldworks/ui/icon";

import {
  createTable,
  DEFAULT_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  columnWidth,
  type CellValue,
  type ColumnDef,
} from "./core";
import { Message } from "./message";
import type { Model } from "./model";

export type ViewConfig<Row, ParentMessage> = Readonly<{
  model: Model;
  columns: ReadonlyArray<ColumnDef<Row, ParentMessage>>;
  rows: ReadonlyArray<Row>;
  getRowId: (row: Row) => string;
  toParentMessage: (message: Message) => ParentMessage;
  label?: string;
  emptyText?: string;
  rowHeight?: number;
  appearance?: "standalone" | "embedded";
}>;

const cellPosition = (rowIndex: number, columnIndex: number) =>
  `${rowIndex}:${columnIndex}`;

const formatValue = (value: CellValue): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

export const view = <Row, ParentMessage>(
  config: ViewConfig<Row, ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const table = createTable(config);
  const selected = Option.getOrUndefined(config.model.selectedCell);
  const rowHeight = config.rowHeight ?? 42;

  return h.div(
    [
      h.Class("fk-data-grid"),
      h.Role("grid"),
      h.AriaLabel(config.label ?? "Data grid"),
      h.AriaRowcount(table.rows.length + 1),
      h.AriaColcount(table.columns.length),
      h.DataAttribute("grid-id", config.model.id),
      h.DataAttribute("appearance", config.appearance ?? "standalone"),
      h.DataAttribute(
        "resizing",
        config.model.resizeState._tag === "Resizing" ? "true" : "false",
      ),
    ],
    [
      h.div(
        [h.Class("fk-data-grid__scroller")],
        [
          h.div(
            [
              h.Class("fk-data-grid__table"),
              h.Style({ minWidth: `${table.totalWidth}px` }),
            ],
            [
              h.div(
                [
                  h.Class("fk-data-grid__header"),
                  h.Role("row"),
                  h.Style({ gridTemplateColumns: table.templateColumns }),
                ],
                table.columns.map((column, columnIndex) => {
                  const definition = column.definition;
                  const canSort = definition.enableSorting !== false;
                  const canResize = definition.enableResizing !== false;
                  const ariaSort = column.sortDirection === "Ascending"
                    ? "ascending"
                    : column.sortDirection === "Descending"
                      ? "descending"
                      : "none";
                  return h.keyed("div")(
                    definition.id,
                    [
                      h.Class("fk-data-grid__header-cell"),
                      h.Role("columnheader"),
                      h.AriaColindex(columnIndex + 1),
                      h.AriaSort(ariaSort),
                      h.DataAttribute("column-id", definition.id),
                    ],
                    [
                      h.button(
                        [
                          h.Type("button"),
                          h.Class("fk-data-grid__header-button"),
                          h.Disabled(!canSort),
                          h.OnClick(
                            config.toParentMessage(
                              Message.ToggledSort({ columnId: definition.id }),
                            ),
                          ),
                        ],
                        [
                          definition.renderHeader?.(
                            { column: definition },
                            h,
                          ) ?? definition.header,
                          canSort
                            ? h.span(
                                [
                                  h.Class("fk-data-grid__sort"),
                                  h.AriaHidden(true),
                                ],
                                [
                                  Icon.view({
                                    icon: column.sortDirection === "Ascending"
                                      ? ArrowUp
                                      : column.sortDirection === "Descending"
                                        ? ArrowDown
                                        : ChevronsUpDown,
                                    size: 12,
                                    strokeWidth: 2.25,
                                  }, h),
                                ],
                              )
                            : h.empty,
                        ],
                      ),
                      canResize
                        ? h.div(
                            [
                              h.Class("fk-data-grid__resize-handle"),
                              h.Role("separator"),
                              h.AriaLabel(`Resize ${definition.header} column`),
                              h.DataAttribute("resize-column", definition.id),
                              h.OnPointerDown((_pointerType, button, screenX) =>
                                button === 0
                                  ? Option.some(
                                      config.toParentMessage(
                                        Message.StartedColumnResize({
                                          columnId: definition.id,
                                          screenX,
                                          width: columnWidth(
                                            config.model,
                                            definition.id,
                                            definition.width ?? DEFAULT_COLUMN_WIDTH,
                                          ),
                                          minimumWidth: definition.minimumWidth ?? MIN_COLUMN_WIDTH,
                                          maximumWidth: definition.maximumWidth ?? MAX_COLUMN_WIDTH,
                                        }),
                                      ),
                                    )
                                  : Option.none(),
                              ),
                              h.OnDoubleClick(
                                config.toParentMessage(
                                  Message.ResetColumnSize({
                                    columnId: definition.id,
                                    width: definition.width ?? DEFAULT_COLUMN_WIDTH,
                                  }),
                                ),
                              ),
                            ],
                            [],
                          )
                        : h.empty,
                    ],
                  );
                }),
              ),
              table.rows.length === 0
                ? h.div([h.Class("fk-data-grid__empty")], [
                    config.emptyText ?? "No rows",
                  ])
                : h.div(
                    [h.Class("fk-data-grid__body"), h.Role("rowgroup")],
                    table.rows.map((row) =>
                      h.keyed("div")(
                        row.id,
                        [
                          h.Class("fk-data-grid__row"),
                          h.Role("row"),
                          h.AriaRowindex(row.index + 2),
                          h.Style({
                            gridTemplateColumns: table.templateColumns,
                            height: `${rowHeight}px`,
                          }),
                          h.DataAttribute("row-id", row.id),
                        ],
                        row.cells.map((cell, columnIndex) => {
                          const isSelected =
                            selected?.rowId === row.id &&
                            selected.columnId === cell.column.id;
                          const isTabStop = isSelected || (
                            selected === undefined &&
                            row.index === 0 &&
                            columnIndex === 0
                          );
                          const align = cell.column.align ?? "Start";
                          const move = (key: string) => {
                            const offsets: Record<string, readonly [number, number]> = {
                              ArrowUp: [-1, 0],
                              ArrowDown: [1, 0],
                              ArrowLeft: [0, -1],
                              ArrowRight: [0, 1],
                            };
                            const offset = offsets[key];
                            if (offset === undefined) return Option.none();
                            const nextRowIndex = Math.min(
                              table.rows.length - 1,
                              Math.max(0, row.index + offset[0]),
                            );
                            const nextColumnIndex = Math.min(
                              table.columns.length - 1,
                              Math.max(0, columnIndex + offset[1]),
                            );
                            const nextRow = table.rows[nextRowIndex];
                            const nextColumn = table.columns[nextColumnIndex];
                            if (nextRow === undefined || nextColumn === undefined) {
                              return Option.none();
                            }
                            return Option.some({
                              focusSelector: `[data-grid-cell-position="${cellPosition(nextRowIndex, nextColumnIndex)}"]`,
                              message: config.toParentMessage(
                                Message.SelectedCell({
                                  rowId: nextRow.id,
                                  columnId: nextColumn.definition.id,
                                }),
                              ),
                            });
                          };
                          return h.keyed("div")(
                            cell.id,
                            [
                              h.Class("fk-data-grid__cell"),
                              h.Role("gridcell"),
                              h.AriaColindex(columnIndex + 1),
                              h.AriaSelected(isSelected),
                              h.Tabindex(isTabStop ? 0 : -1),
                              h.DataAttribute(
                                "grid-cell-position",
                                cellPosition(row.index, columnIndex),
                              ),
                              h.DataAttribute("selected", isSelected ? "true" : "false"),
                              h.DataAttribute("align", align.toLowerCase()),
                              h.OnClick(
                                config.toParentMessage(
                                  Message.SelectedCell({
                                    rowId: row.id,
                                    columnId: cell.column.id,
                                  }),
                                ),
                              ),
                              h.OnKeyDownFocus(move),
                            ],
                            [
                              cell.column.renderCell?.(
                                {
                                  row: row.original,
                                  rowId: row.id,
                                  rowIndex: row.index,
                                  columnId: cell.column.id,
                                  value: cell.value,
                                },
                                h,
                              ) ?? formatValue(cell.value),
                            ],
                          );
                        }),
                      ),
                    ),
                  ),
            ],
          ),
        ],
      ),
    ],
  );
};
