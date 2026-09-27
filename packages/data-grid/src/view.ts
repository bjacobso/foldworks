import { Option } from "effect";
import { Mount } from "foldkit";
import type { Html, HtmlBuilder, KeyboardModifiers } from "foldkit/html";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  ChevronsUpDown,
} from "@lucide/icons";
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
  type TableRow,
  type RowAttributes,
  type RowContext,
} from "./core";
import { detailsId, HoverDetails } from "./hover-details";
import { Message } from "./message";
import type { Model } from "./model";
import { cellId, sameCell } from "./editing-model";
import { commitMessage, editIssues, parseInput, pasteMessage } from "./editing";
import { editingToolbar, editorView } from "./editing-view";
import {
  DATA_GRID_HEADER_HEIGHT,
  ObserveViewport,
  virtualWindow,
  type VirtualizationConfig,
} from "./virtualization";

export type ViewConfig<Row, ParentMessage> = Readonly<{
  model: Model;
  columns: ReadonlyArray<ColumnDef<Row, ParentMessage>>;
  rows: ReadonlyArray<Row>;
  getRowId: (row: Row) => string;
  getSubRows?: (row: Row) => ReadonlyArray<Row> | undefined;
  toParentMessage: (message: Message) => ParentMessage;
  /** Per-row click message, tone, and accessible label. Called only for
   * rendered rows, so it stays cheap under virtualization. */
  rowAttributes?: (row: Row, context: RowContext) => RowAttributes<ParentMessage>;
  /** Column that shows the group disclosure and indentation. Defaults to the
   * first displayed column. */
  groupColumnId?: string;
  label?: string;
  emptyText?: string;
  rowHeight?: number;
  appearance?: "standalone" | "embedded";
  showRowNumbers?: boolean;
  showEditingToolbar?: boolean;
  enableColumnReordering?: boolean;
  virtualization?: VirtualizationConfig;
}>;

const GROUP_INDENT = 20;

const cellPosition = (rowIndex: number, columnIndex: number) => `${rowIndex}:${columnIndex}`;

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
  const rowNumberWidth = config.showRowNumbers === true ? 44 : 0;
  const columnIndexOffset = config.showRowNumbers === true ? 1 : 0;
  const templateColumns =
    config.showRowNumbers === true
      ? `${rowNumberWidth}px ${table.templateColumns}`
      : table.templateColumns;
  const viewportHeight =
    config.model.viewport.height > 0
      ? config.model.viewport.height
      : (config.virtualization?.initialViewportHeight ?? rowHeight * 10);
  const selectedRowIndex =
    selected === undefined ? undefined : table.rows.findIndex((row) => row.id === selected.rowId);
  const rowWindow = isVirtualized
    ? virtualWindow(
        table.rows.length,
        rowHeight,
        { ...config.model.viewport, height: viewportHeight },
        config.virtualization?.overscan,
      )
    : {
        startIndex: 0,
        endIndex: table.rows.length,
        paddingTop: 0,
        paddingBottom: 0,
      };
  const renderedRows = table.rows.slice(rowWindow.startIndex, rowWindow.endIndex);
  // The focused row stays mounted so keyboard focus survives scrolling. Far
  // from the window it renders on its own between spacers, rather than
  // widening the window to every row in between.
  const islandIndex =
    isVirtualized &&
    selectedRowIndex !== undefined &&
    selectedRowIndex >= 0 &&
    (selectedRowIndex < rowWindow.startIndex || selectedRowIndex >= rowWindow.endIndex)
      ? selectedRowIndex
      : undefined;
  const columnIds = table.columns.map((column) => column.definition.id);
  const isGrouped = config.getSubRows !== undefined;
  const groupColumnId = config.groupColumnId ?? columnIds[0];
  const selectedRowId = Option.getOrUndefined(config.model.selectedRowId);
  const hasRowSelection = config.model.rowSelection !== "None";
  const hasDetails = config.columns.some((column) => column.details !== undefined);
  const pageSize = Math.max(
    1,
    Math.floor((viewportHeight - DATA_GRID_HEADER_HEIGHT) / rowHeight) - 1,
  );
  const spacer = (position: "top" | "gap" | "bottom", height: number) =>
    h.keyed("div")(
      `spacer:${position}`,
      [
        h.Class("fk-data-grid__virtual-spacer"),
        h.Role("presentation"),
        h.AriaHidden(true),
        h.DataAttribute("virtual-spacer", position),
        h.Style({ height: `${height}px` }),
      ],
      [],
    );

  const renderRow = (row: TableRow<Row, ParentMessage>): Html => {
    const isRowSelected = hasRowSelection && selectedRowId === row.id;
    const rowAttributes =
      config.rowAttributes?.(row.original, {
        rowId: row.id,
        rowIndex: row.index,
        depth: row.depth,
        childCount: row.childCount,
        isExpanded: row.isExpanded,
        isSelected: isRowSelected,
      }) ?? {};
    const onRowClick = rowAttributes.onClick;
    return h.keyed("div")(
      row.id,
      [
        h.Class("fk-data-grid__row"),
        h.Role("row"),
        h.AriaRowindex(row.index + 2),
        h.Style({
          gridTemplateColumns: templateColumns,
          height: `${rowHeight}px`,
        }),
        h.DataAttribute("row-id", row.id),
        h.DataAttribute("tone", (rowAttributes.tone ?? "Neutral").toLowerCase()),
        h.DataAttribute("row-selected", isRowSelected ? "true" : "false"),
        h.DataAttribute("clickable", onRowClick === undefined ? "false" : "true"),
        ...(isGrouped
          ? [
              h.AriaLevel(row.depth + 1),
              h.AriaPosinset(row.positionInSet),
              h.AriaSetsize(row.setSize),
              h.DataAttribute("depth", String(row.depth)),
              h.DataAttribute("group", row.childCount > 0 ? "true" : "false"),
              ...(row.childCount > 0 ? [h.AriaExpanded(row.isExpanded)] : []),
            ]
          : []),
        ...(hasRowSelection ? [h.AriaSelected(isRowSelected)] : []),
        ...(rowAttributes.label === undefined ? [] : [h.AriaLabel(rowAttributes.label)]),
        ...(onRowClick === undefined ? [] : [h.OnClick(onRowClick)]),
      ],
      [
        ...(config.showRowNumbers === true
          ? [
              h.div(
                [
                  h.Class("fk-data-grid__row-header"),
                  h.Role("rowheader"),
                  h.AriaColindex(1),
                  h.AriaLabel(`Row ${row.index + 1}`),
                  h.DataAttribute("row-number", String(row.index + 1)),
                  h.DataAttribute(
                    "selected",
                    range !== undefined &&
                      row.index >= range.startRowIndex &&
                      row.index <= range.endRowIndex
                      ? "true"
                      : "false",
                  ),
                ],
                [String(row.index + 1)],
              ),
            ]
          : []),
        ...row.cells.map((cell, columnIndex) => {
          const tableColumn = table.columns[columnIndex];
          const isFocus = selected?.rowId === row.id && selected.columnId === cell.column.id;
          const isSelected = isCellInSelection(range, row.index, columnIndex);
          const isTabStop =
            isFocus || (selected === undefined && row.index === 0 && columnIndex === 0);
          const align = cell.column.align ?? "Start";
          const address = { rowId: row.id, columnId: cell.column.id };
          const id = cellId(config.model.id, row.id, cell.column.id);
          const draft = config.model.drafts.find((draft) => sameCell(draft, address));
          const editing = active !== undefined && sameCell(active, address);
          const editor = cell.column.editor;
          const editable = editor !== undefined && config.model.editingMode !== "Disabled";
          const error =
            issues.find((issue) => sameCell(issue, address))?.error || draft?.error || "";
          const start = () =>
            Message.StartedEditing({
              ...address,
              previousValue:
                draft === undefined ? cell.column.accessor(row.original) : draft.previousValue,
              ...parseInput(editor!, cell.value == null ? "" : String(cell.value), row.original),
            });
          const isGroupColumn = isGrouped && cell.column.id === groupColumnId;
          const self = `[id="${id}"]`;
          const stay = (message: ParentMessage) => Option.some({ focusSelector: self, message });
          const cellContext = {
            row: row.original,
            rowId: row.id,
            rowIndex: row.index,
            columnId: cell.column.id,
            value: cell.value,
            depth: row.depth,
          };
          const move = (key: string, modifiers: KeyboardModifiers) => {
            // Editors retain native arrow-key behavior. Enter/Escape are grid actions.
            if (editing)
              return key === "Enter" || key === "Escape"
                ? Option.some({
                    focusSelector: `[id="${id}:editor"]`,
                    message: config.toParentMessage(
                      key === "Escape" ? Message.CancelledEdit() : commitMessage(config),
                    ),
                  })
                : Option.none();
            if (active !== undefined) return Option.none();
            if ((key === "Enter" || key === "F2") && editable && !pending)
              return Option.some({
                focusSelector: self,
                message: config.toParentMessage(start()),
              });
            if (key === "Enter") {
              if (onRowClick !== undefined) return stay(onRowClick);
              return row.childCount > 0
                ? stay(config.toParentMessage(Message.ToggledRowGroup({ rowId: row.id })))
                : Option.none();
            }
            // Jumps may target an unmounted virtual row, so update focuses after rendering.
            const jump = (rowIndex: number, columnIndex: number) => {
              const nextRow = table.rows[Math.min(table.rows.length - 1, Math.max(0, rowIndex))];
              const nextColumn =
                table.columns[Math.min(table.columns.length - 1, Math.max(0, columnIndex))];
              return nextRow === undefined || nextColumn === undefined
                ? Option.none()
                : stay(
                    config.toParentMessage(
                      Message.NavigatedToCell({
                        rowId: nextRow.id,
                        columnId: nextColumn.definition.id,
                      }),
                    ),
                  );
            };
            if (isGroupColumn && !modifiers.shiftKey) {
              if (key === "ArrowRight" && row.childCount > 0 && !row.isExpanded) {
                return stay(
                  config.toParentMessage(
                    Message.ChangedRowGroupExpansion({ rowId: row.id, isExpanded: true }),
                  ),
                );
              }
              if (key === "ArrowLeft" && row.childCount > 0 && row.isExpanded) {
                return stay(
                  config.toParentMessage(
                    Message.ChangedRowGroupExpansion({ rowId: row.id, isExpanded: false }),
                  ),
                );
              }
              if (key === "ArrowLeft" && row.parentId !== undefined) {
                return jump(
                  table.rows.findIndex((item) => item.id === row.parentId),
                  columnIndex,
                );
              }
            }
            const toEdge = modifiers.ctrlKey || modifiers.metaKey;
            const lastColumnIndex = table.columns.length - 1;
            if (key === "PageUp") return jump(row.index - pageSize, columnIndex);
            if (key === "PageDown") return jump(row.index + pageSize, columnIndex);
            if (key === "Home" && toEdge) return jump(0, 0);
            if (key === "End" && toEdge) return jump(table.rows.length - 1, lastColumnIndex);
            const offsets: Record<string, readonly [number, number]> = {
              ArrowUp: [-1, 0],
              ArrowDown: [1, 0],
              ArrowLeft: [0, -1],
              ArrowRight: [0, 1],
              Home: [0, -columnIndex],
              End: [0, lastColumnIndex - columnIndex],
            };
            const offset = offsets[key];
            if (offset === undefined) return Option.none();
            const nextRowIndex = Math.min(
              table.rows.length - 1,
              Math.max(0, row.index + offset[0]),
            );
            const nextColumnIndex = Math.min(lastColumnIndex, Math.max(0, columnIndex + offset[1]));
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
          const details = editing ? undefined : cell.column.details?.(cellContext);
          const hasCellDetails = details !== undefined && details !== "";
          const content =
            editing && editor !== undefined
              ? (cell.column.renderEditor?.(
                  {
                    id: `${id}:editor`,
                    label: `Edit ${cell.column.header}`,
                    input: active.input,
                    value: active.value,
                    error: active.error,
                    onInput: (input) =>
                      config.toParentMessage(
                        Message.ChangedEdit(parseInput(editor, input, row.original)),
                      ),
                    onCommit: config.toParentMessage(commitMessage(config)),
                    onCancel: config.toParentMessage(Message.CancelledEdit()),
                  },
                  h,
                ) ??
                editorView(
                  editor,
                  active,
                  row.original,
                  `${id}:editor`,
                  `Edit ${cell.column.header}`,
                  config.toParentMessage,
                  h,
                ))
              : (cell.column.renderCell?.(cellContext, h) ?? formatValue(cell.value));
          const groupLabel = rowAttributes.label ?? formatValue(cell.value);
          return h.keyed("div")(
            cell.id,
            [
              h.Class("fk-data-grid__cell"),
              h.Id(id),
              h.Role(cell.column.rowHeader === true ? "rowheader" : "gridcell"),
              h.AriaColindex(columnIndex + 1 + columnIndexOffset),
              h.AriaSelected(isSelected),
              h.Tabindex(isTabStop ? 0 : -1),
              h.DataAttribute("cell-column-id", cell.column.id),
              h.DataAttribute("pinned", tableColumn?.pinned?.toLowerCase() ?? "false"),
              h.DataAttribute("pin-boundary", tableColumn?.isPinBoundary ? "true" : "false"),
              ...(tableColumn?.pinned === "Start"
                ? [h.Style({ left: `${tableColumn.pinOffset + rowNumberWidth}px` })]
                : tableColumn?.pinned === "End"
                  ? [h.Style({ right: `${tableColumn.pinOffset}px` })]
                  : []),
              h.DataAttribute("grid-cell-position", cellPosition(row.index, columnIndex)),
              h.DataAttribute("selected", isSelected ? "true" : "false"),
              h.DataAttribute("selection-focus", isFocus ? "true" : "false"),
              h.DataAttribute("align", align.toLowerCase()),
              h.DataAttribute("dirty", draft === undefined ? "false" : "true"),
              h.DataAttribute("editable", editable ? "true" : "false"),
              h.DataAttribute("error", error ? "true" : "false"),
              h.AriaReadonly(!editable || pending),
              h.AriaInvalid(!!error),
              ...(hasCellDetails
                ? [h.DataAttribute("has-details", "true"), h.AriaDescribedBy(detailsId(id))]
                : []),
              ...(draft === undefined
                ? []
                : [
                    h.Title(
                      `Original: ${formatValue(draft.previousValue)}${error ? ` · ${error}` : " · Unsaved change"}`,
                    ),
                  ]),
              ...(editable && !pending && active === undefined
                ? [h.OnDoubleClick(config.toParentMessage(start()))]
                : []),
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
              isGroupColumn
                ? h.span(
                    [
                      h.Class("fk-data-grid__group"),
                      h.Style({ paddingInlineStart: `${row.depth * GROUP_INDENT}px` }),
                    ],
                    [
                      row.childCount > 0
                        ? h.button(
                            [
                              h.Type("button"),
                              h.Class("fk-data-grid__group-toggle"),
                              h.Tabindex(-1),
                              h.AriaLabel(
                                `${row.isExpanded ? "Collapse" : "Expand"} ${groupLabel}`,
                              ),
                              h.AriaExpanded(row.isExpanded),
                              h.DataAttribute("group-toggle", row.id),
                              h.OnClick(
                                config.toParentMessage(Message.ToggledRowGroup({ rowId: row.id })),
                                { propagation: "Stop", focusSelector: self },
                              ),
                            ],
                            [Icon.view({ icon: ChevronRight, size: 14, strokeWidth: 2.25 }, h)],
                          )
                        : h.span([h.Class("fk-data-grid__group-spacer"), h.AriaHidden(true)], []),
                      h.span([h.Class("fk-data-grid__group-content")], [content]),
                    ],
                  )
                : content,
              ...(draft === undefined || editing
                ? []
                : [
                    h.span(
                      [
                        h.Class("fk-data-grid__dirty-marker"),
                        h.AriaLabel(error || "Unsaved change"),
                      ],
                      [error ? "!" : "•"],
                    ),
                  ]),
              ...(editing
                ? [
                    h.span(
                      [h.Id(`${id}:editor:help`), h.Class("fk-data-grid__sr-only")],
                      [active.error || "Enter to commit. Escape to cancel."],
                    ),
                  ]
                : []),
              ...(hasCellDetails
                ? [
                    h.span(
                      [h.Id(detailsId(id)), h.Class("fk-data-grid__details"), h.Hidden(true)],
                      [details],
                    ),
                  ]
                : []),
            ],
          );
        }),
      ],
    );
  };

  const windowRows = renderedRows.map(renderRow);
  const islandRow = islandIndex === undefined ? undefined : table.rows[islandIndex];
  const bodyItems: ReadonlyArray<Html> =
    islandRow === undefined || islandIndex === undefined
      ? [
          ...(rowWindow.paddingTop > 0 ? [spacer("top", rowWindow.paddingTop)] : []),
          ...windowRows,
          ...(rowWindow.paddingBottom > 0 ? [spacer("bottom", rowWindow.paddingBottom)] : []),
        ]
      : islandIndex < rowWindow.startIndex
        ? [
            ...(islandIndex > 0 ? [spacer("top", islandIndex * rowHeight)] : []),
            renderRow(islandRow),
            spacer("gap", (rowWindow.startIndex - islandIndex - 1) * rowHeight),
            ...windowRows,
            ...(rowWindow.paddingBottom > 0 ? [spacer("bottom", rowWindow.paddingBottom)] : []),
          ]
        : [
            ...(rowWindow.paddingTop > 0 ? [spacer("top", rowWindow.paddingTop)] : []),
            ...windowRows,
            spacer("gap", (islandIndex - rowWindow.endIndex) * rowHeight),
            renderRow(islandRow),
            ...(islandIndex < table.rows.length - 1
              ? [spacer("bottom", (table.rows.length - islandIndex - 1) * rowHeight)]
              : []),
          ];

  const grid = h.div(
    [
      h.Class("fk-data-grid"),
      h.Role(isGrouped ? "treegrid" : "grid"),
      h.AriaLabel(config.label ?? "Data grid"),
      h.AriaMultiSelectable(true),
      h.AriaRowcount(table.rows.length + 1),
      h.AriaColcount(table.columns.length + columnIndexOffset),
      h.DataAttribute("grid-id", config.model.id),
      h.DataAttribute("selection-size", String(selectedCount)),
      h.DataAttribute("virtualized", isVirtualized ? "true" : "false"),
      h.DataAttribute(
        "rendered-row-count",
        String(renderedRows.length + (islandIndex === undefined ? 0 : 1)),
      ),
      h.DataAttribute("virtual-start", String(rowWindow.startIndex)),
      h.DataAttribute("virtual-end", String(rowWindow.endIndex)),
      h.DataAttribute("appearance", config.appearance ?? "standalone"),
      h.DataAttribute("resizing", config.model.resizeState._tag === "Resizing" ? "true" : "false"),
      ...(active === undefined && range !== undefined ? [h.OnCopyText(clipboard)] : []),
      ...(config.model.editingMode !== "Disabled" && active === undefined && !pending
        ? [
            h.OnPastePreventDefault((text) =>
              Option.map(pasteMessage(config, text), config.toParentMessage),
            ),
          ]
        : []),
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
              h.Style({ minWidth: `${table.totalWidth + rowNumberWidth}px` }),
            ],
            [
              h.div(
                [
                  h.Class("fk-data-grid__header"),
                  h.Role("row"),
                  h.Style({ gridTemplateColumns: templateColumns }),
                ],
                [
                  ...(config.showRowNumbers === true
                    ? [
                        h.div(
                          [
                            h.Class("fk-data-grid__row-header fk-data-grid__row-header--corner"),
                            h.Role("columnheader"),
                            h.AriaColindex(1),
                            h.AriaLabel("Row numbers"),
                          ],
                          [],
                        ),
                      ]
                    : []),
                  ...table.columns.map((column, columnIndex) => {
                    const definition = column.definition;
                    const canSort = definition.enableSorting !== false;
                    const canResize = definition.enableResizing !== false;
                    const canMoveBefore =
                      columnIndex > 0 && table.columns[columnIndex - 1]?.pinned === column.pinned;
                    const canMoveAfter =
                      columnIndex < table.columns.length - 1 &&
                      table.columns[columnIndex + 1]?.pinned === column.pinned;
                    const canReorder =
                      config.enableColumnReordering === true && (canMoveBefore || canMoveAfter);
                    const ariaSort =
                      column.sortDirection === "Ascending"
                        ? "ascending"
                        : column.sortDirection === "Descending"
                          ? "descending"
                          : "none";
                    return h.keyed("div")(
                      definition.id,
                      [
                        h.Class("fk-data-grid__header-cell"),
                        h.Role("columnheader"),
                        h.AriaColindex(columnIndex + 1 + columnIndexOffset),
                        h.AriaSort(ariaSort),
                        h.DataAttribute("column-id", definition.id),
                        h.DataAttribute("align", (definition.align ?? "Start").toLowerCase()),
                        h.DataAttribute("reordering", canReorder ? "true" : "false"),
                        h.DataAttribute("pinned", column.pinned?.toLowerCase() ?? "false"),
                        h.DataAttribute("pin-boundary", column.isPinBoundary ? "true" : "false"),
                        ...(column.pinned === "Start"
                          ? [h.Style({ left: `${column.pinOffset + rowNumberWidth}px` })]
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
                            definition.renderHeader?.({ column: definition }, h) ??
                              definition.header,
                            canSort
                              ? h.span(
                                  [h.Class("fk-data-grid__sort"), h.AriaHidden(true)],
                                  [
                                    Icon.view(
                                      {
                                        icon:
                                          column.sortDirection === "Ascending"
                                            ? ArrowUp
                                            : column.sortDirection === "Descending"
                                              ? ArrowDown
                                              : ChevronsUpDown,
                                        size: 12,
                                        strokeWidth: 2.25,
                                      },
                                      h,
                                    ),
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
                                    h.Disabled(isBefore ? !canMoveBefore : !canMoveAfter),
                                    h.OnClick(
                                      config.toParentMessage(
                                        Message.ChangedColumnOrder({
                                          columnIds: moveColumn(
                                            columnIds,
                                            definition.id,
                                            direction,
                                          ),
                                        }),
                                      ),
                                    ),
                                  ],
                                  [
                                    Icon.view(
                                      {
                                        icon: isBefore ? ArrowLeft : ArrowRight,
                                        size: 13,
                                        strokeWidth: 2.25,
                                      },
                                      h,
                                    ),
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
                                            minimumWidth:
                                              definition.minimumWidth ?? MIN_COLUMN_WIDTH,
                                            maximumWidth:
                                              definition.maximumWidth ?? MAX_COLUMN_WIDTH,
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
                ],
              ),
              table.rows.length === 0
                ? h.div([h.Class("fk-data-grid__empty")], [config.emptyText ?? "No rows"])
                : h.div([h.Class("fk-data-grid__body"), h.Role("rowgroup")], [...bodyItems]),
            ],
          ),
        ],
      ),
      hasDetails
        ? h.keyed("div")(
            `${config.model.id}:hover-details`,
            [
              h.Class("fk-data-grid__hover-details"),
              h.Popover("manual"),
              h.Role("tooltip"),
              h.AriaHidden(true),
              h.OnMount(Mount.mapMessage(HoverDetails(), config.toParentMessage)),
            ],
            [],
          )
        : h.empty,
    ],
  );
  return config.model.editingMode === "Disabled"
    ? grid
    : h.div(
        [h.Class("fk-data-grid__editable-container")],
        [config.showEditingToolbar === false ? h.empty : editingToolbar(config, h), grid],
      );
};
