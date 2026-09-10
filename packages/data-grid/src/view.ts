import { Option } from "effect";
import { Mount } from "foldkit";
import type { Html, HtmlBuilder, KeyboardModifiers } from "foldkit/html";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronsUpDown } from "@lucide/icons";
import * as Icon from "@foldworks/ui/icon";

import {
  createTable,
  DEFAULT_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  columnWidth,
  isCellInSelection,
  moveColumn,
  selectionRange,
  selectionSize,
  selectionText,
  type CellValue,
  type ColumnDef,
} from "./core";
import { Message } from "./message";
import type { Model } from "./model";
import { cellId, sameCell } from "./editing-model";
import { commitMessage, editIssues, parseInput, pasteMessage } from "./editing";
import { editingToolbar, editorView } from "./editing-view";
import {
  ObserveViewport,
  virtualWindow,
  type VirtualizationConfig,
} from "./virtualization";

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
  showEditingToolbar?: boolean;
  enableColumnReordering?: boolean;
  virtualization?: VirtualizationConfig;
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
  const range = selectionRange(config.model, table);
  const selectedCount = selectionSize(range);
  const rowHeight = Math.max(1, config.rowHeight ?? 42);
  const active = Option.getOrUndefined(config.model.activeEdit);
  const pending = Option.isSome(config.model.pendingSubmission);
  const issues = editIssues(config);
  const clipboard = selectionText(table, range);
  const isVirtualized = config.virtualization !== undefined;
  const viewportHeight = config.model.viewport.height > 0
    ? config.model.viewport.height
    : config.virtualization?.initialViewportHeight ?? rowHeight * 10;
  const selectedRowIndex = selected === undefined
    ? undefined
    : table.rows.findIndex((row) => row.id === selected.rowId);
  const rowWindow = isVirtualized
    ? virtualWindow(
        table.rows.length,
        rowHeight,
        { ...config.model.viewport, height: viewportHeight },
        config.virtualization?.overscan,
        selectedRowIndex === -1 ? undefined : selectedRowIndex,
      )
    : {
        startIndex: 0,
        endIndex: table.rows.length,
        paddingTop: 0,
        paddingBottom: 0,
      };
  const renderedRows = table.rows.slice(rowWindow.startIndex, rowWindow.endIndex);
  const columnIds = table.columns.map((column) => column.definition.id);
  const spacer = (position: "top" | "bottom", height: number) => h.div(
    [
      h.Class("fk-data-grid__virtual-spacer"),
      h.Role("presentation"),
      h.AriaHidden(true),
      h.DataAttribute("virtual-spacer", position),
      h.Style({ height: `${height}px` }),
    ],
    [],
  );

  const grid = h.div(
    [
      h.Class("fk-data-grid"),
      h.Role("grid"),
      h.AriaLabel(config.label ?? "Data grid"),
      h.AriaMultiSelectable(true),
      h.AriaRowcount(table.rows.length + 1),
      h.AriaColcount(table.columns.length),
      h.DataAttribute("grid-id", config.model.id),
      h.DataAttribute("selection-size", String(selectedCount)),
      h.DataAttribute("virtualized", isVirtualized ? "true" : "false"),
      h.DataAttribute("rendered-row-count", String(renderedRows.length)),
      h.DataAttribute("virtual-start", String(rowWindow.startIndex)),
      h.DataAttribute("virtual-end", String(rowWindow.endIndex)),
      h.DataAttribute("appearance", config.appearance ?? "standalone"),
      h.DataAttribute(
        "resizing",
        config.model.resizeState._tag === "Resizing" ? "true" : "false",
      ),
      ...(active === undefined && range !== undefined ? [h.OnCopyText(clipboard)] : []),
      ...(
        config.model.editingMode !== "Disabled" && active === undefined && !pending
          ? [h.OnPastePreventDefault((text) =>
              Option.map(pasteMessage(config, text), config.toParentMessage))]
          : []
      ),
    ],
    [
      h.div(
        [
          h.Key(`${config.model.id}:scroller:${isVirtualized ? "virtual" : "full"}`),
          h.Class("fk-data-grid__scroller"),
          ...(isVirtualized
            ? [h.OnMount(Mount.mapMessage(ObserveViewport(), config.toParentMessage))]
            : []),
        ],
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
                  const canMoveBefore = columnIndex > 0 &&
                    table.columns[columnIndex - 1]?.pinned === column.pinned;
                  const canMoveAfter = columnIndex < table.columns.length - 1 &&
                    table.columns[columnIndex + 1]?.pinned === column.pinned;
                  const canReorder = config.enableColumnReordering === true &&
                    (canMoveBefore || canMoveAfter);
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
                      h.DataAttribute("reordering", canReorder ? "true" : "false"),
                      h.DataAttribute("pinned", column.pinned?.toLowerCase() ?? "false"),
                      h.DataAttribute("pin-boundary", column.isPinBoundary ? "true" : "false"),
                      ...(column.pinned === "Start"
                        ? [h.Style({ left: `${column.pinOffset}px` })]
                        : column.pinned === "End"
                          ? [h.Style({ right: `${column.pinOffset}px` })]
                          : []),
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
                      canReorder
                        ? h.div(
                            [
                              h.Class("fk-data-grid__reorder-controls"),
                              h.Role("group"),
                              h.AriaLabel(`Reorder ${definition.header} column`),
                            ],
                            (["Before", "After"] as const).map((direction) => {
                              const isBefore = direction === "Before";
                              return h.button(
                                [
                                  h.Type("button"),
                                  h.Class("fk-data-grid__reorder-button"),
                                  h.AriaLabel(
                                    `Move ${definition.header} column ${isBefore ? "left" : "right"}`,
                                  ),
                                  h.Title(
                                    `Move ${definition.header} column ${isBefore ? "left" : "right"}`,
                                  ),
                                  h.Disabled(
                                    isBefore
                                      ? !canMoveBefore
                                      : !canMoveAfter,
                                  ),
                                  h.OnClick(config.toParentMessage(
                                    Message.ChangedColumnOrder({
                                      columnIds: moveColumn(
                                        columnIds,
                                        definition.id,
                                        direction,
                                      ),
                                    }),
                                  )),
                                ],
                                [
                                  Icon.view({
                                    icon: isBefore ? ArrowLeft : ArrowRight,
                                    size: 13,
                                    strokeWidth: 2.25,
                                  }, h),
                                ],
                              );
                            }),
                          )
                        : h.empty,
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
                    [
                      ...(rowWindow.paddingTop > 0
                        ? [spacer("top", rowWindow.paddingTop)]
                        : []),
                      ...renderedRows.map((row) =>
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
                          const tableColumn = table.columns[columnIndex];
                          const isFocus =
                            selected?.rowId === row.id &&
                            selected.columnId === cell.column.id;
                          const isSelected = isCellInSelection(range, row.index, columnIndex);
                          const isTabStop = isFocus || (
                            selected === undefined &&
                            row.index === 0 &&
                            columnIndex === 0
                          );
                          const align = cell.column.align ?? "Start";
                          const address = { rowId: row.id, columnId: cell.column.id };
                          const id = cellId(config.model.id, row.id, cell.column.id);
                          const draft = config.model.drafts.find((draft) => sameCell(draft, address));
                          const editing = active !== undefined && sameCell(active, address);
                          const editor = cell.column.editor;
                          const editable = editor !== undefined && config.model.editingMode !== "Disabled";
                          const error = issues.find((issue) => sameCell(issue, address))?.error || draft?.error || "";
                          const start = () => Message.StartedEditing({
                            ...address,
                            previousValue: draft === undefined ? cell.column.accessor(row.original) : draft.previousValue,
                            ...parseInput(editor!, cell.value == null ? "" : String(cell.value), row.original),
                          });
                          const move = (key: string, modifiers: KeyboardModifiers) => {
                            // Editors retain native arrow-key behavior. Enter/Escape are grid actions.
                            if (editing) return key === "Enter" || key === "Escape" ? Option.some({
                              focusSelector: `[id="${id}:editor"]`,
                              message: config.toParentMessage(key === "Escape" ? Message.CancelledEdit() : commitMessage(config)),
                            }) : Option.none();
                            if (active !== undefined) return Option.none();
                            if ((key === "Enter" || key === "F2") && editable && !pending) return Option.some({
                              focusSelector: `[id="${id}"]`, message: config.toParentMessage(start()),
                            });
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
                              focusSelector: `[id="${cellId(config.model.id, nextRow.id, nextColumn.definition.id)}"]`,
                              message: config.toParentMessage(
                                modifiers.shiftKey
                                  ? Message.ExtendedSelection({
                                      rowId: nextRow.id,
                                      columnId: nextColumn.definition.id,
                                      anchorRowId: row.id,
                                      anchorColumnId: cell.column.id,
                                    })
                                  : Message.SelectedCell({
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
                              h.Id(id),
                              h.Role("gridcell"),
                              h.AriaColindex(columnIndex + 1),
                              h.AriaSelected(isSelected),
                              h.Tabindex(isTabStop ? 0 : -1),
                              h.DataAttribute("cell-column-id", cell.column.id),
                              h.DataAttribute("pinned", tableColumn?.pinned?.toLowerCase() ?? "false"),
                              h.DataAttribute("pin-boundary", tableColumn?.isPinBoundary ? "true" : "false"),
                              ...(tableColumn?.pinned === "Start"
                                ? [h.Style({ left: `${tableColumn.pinOffset}px` })]
                                : tableColumn?.pinned === "End"
                                  ? [h.Style({ right: `${tableColumn.pinOffset}px` })]
                                  : []),
                              h.DataAttribute(
                                "grid-cell-position",
                                cellPosition(row.index, columnIndex),
                              ),
                              h.DataAttribute("selected", isSelected ? "true" : "false"),
                              h.DataAttribute("selection-focus", isFocus ? "true" : "false"),
                              h.DataAttribute("align", align.toLowerCase()),
                              h.DataAttribute("dirty", draft === undefined ? "false" : "true"),
                              h.DataAttribute("editable", editable ? "true" : "false"),
                              h.DataAttribute("error", error ? "true" : "false"),
                              h.AriaReadonly(!editable || pending),
                              h.AriaInvalid(!!error),
                              ...(draft === undefined ? [] : [h.Title(`Original: ${formatValue(draft.previousValue)}${error ? ` · ${error}` : " · Unsaved change"}`)]),
                              ...(editable && !pending && active === undefined ? [h.OnDoubleClick(config.toParentMessage(start()))] : []),
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
                              editing && editor !== undefined ? (cell.column.renderEditor?.({
                                id: `${id}:editor`, label: `Edit ${cell.column.header}`,
                                input: active.input, value: active.value, error: active.error,
                                onInput: (input) => config.toParentMessage(Message.ChangedEdit(parseInput(editor, input, row.original))),
                                onCommit: config.toParentMessage(commitMessage(config)),
                                onCancel: config.toParentMessage(Message.CancelledEdit()),
                              }, h) ?? editorView(editor, active, row.original, `${id}:editor`, `Edit ${cell.column.header}`, config.toParentMessage, h)) : cell.column.renderCell?.(
                                {
                                  row: row.original,
                                  rowId: row.id,
                                  rowIndex: row.index,
                                  columnId: cell.column.id,
                                  value: cell.value,
                                },
                                h,
                              ) ?? formatValue(cell.value),
                              ...(draft === undefined || editing ? [] : [h.span([h.Class("fk-data-grid__dirty-marker"), h.AriaLabel(error || "Unsaved change")], [error ? "!" : "•"])]),
                              ...(editing ? [h.span([h.Id(`${id}:editor:help`), h.Class("fk-data-grid__sr-only")], [active.error || "Enter to commit. Escape to cancel."])] : []),
                            ],
                          );
                          }),
                        ),
                      ),
                      ...(rowWindow.paddingBottom > 0
                        ? [spacer("bottom", rowWindow.paddingBottom)]
                        : []),
                    ],
                  ),
            ],
          ),
        ],
      ),
    ],
  );
  return config.model.editingMode === "Disabled" ? grid : h.div([h.Class("fk-data-grid__editable-container")], [
    config.showEditingToolbar === false ? h.empty : editingToolbar(config, h),
    grid,
  ]);
};
