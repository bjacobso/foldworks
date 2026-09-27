import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { DataGrid, type RowTone } from "@foldworks/data-grid";
import { Badge, Button, Input, Toggle } from "@foldworks/ui";

import { className } from "../workflow/styles";
import { coverageStyles as styles } from "./coverage-styles";
import {
  CONDITION_COUNT,
  FIELD_COUNT,
  countRows,
  coverageRows,
  filterCoverage,
  flattenedCoverage,
  journeys,
  type CoverageRow,
  type Outcome,
} from "./coverage-rows";
import { Message } from "./message";
import type { CoverageModel } from "./model";
import { dataGridStyles } from "./styles";

const outcomeText = (row: CoverageRow, outcome: Outcome): string =>
  row.kind === "Field"
    ? outcome === "Holds"
      ? "Shown"
      : "Hidden"
    : outcome === "Holds"
      ? "Condition holds"
      : outcome === "Fails"
        ? "Condition fails"
        : "Not evaluated";

const rowTone = (row: CoverageRow): RowTone =>
  row.isGap ? "Danger" : row.gapCount > 0 ? "Warning" : "Neutral";

const statusLabel = (row: CoverageRow): string =>
  row.isGap
    ? "Gap"
    : row.gapCount > 0
      ? `${row.gapCount} ${row.gapCount === 1 ? "gap" : "gaps"}`
      : "Covered";

const journeyColumns = journeys.map((journey, index) => ({
  id: `journey-${index + 1}`,
  header: `J${index + 1}`,
  accessor: (row: CoverageRow) => row.outcomes[index] ?? "Skipped",
  width: 58,
  minimumWidth: 48,
  align: "Center" as const,
  enableResizing: false,
  enableSorting: false,
  renderHeader: (_: unknown, h: HtmlBuilder<Message>) =>
    h.span([h.Title(journey)], [`J${index + 1}`]),
  renderCell: ({ row }: { row: CoverageRow }, h: HtmlBuilder<Message>) => {
    const outcome = row.outcomes[index] ?? "Skipped";
    return h.span(
      [
        h.Class(className(styles.outcome, styles[outcome])),
        h.AriaLabel(outcomeText(row, outcome)),
        h.Role("img"),
      ],
      [],
    );
  },
  details: ({ row }: { row: CoverageRow }) =>
    `J${index + 1} · ${journey}\n${outcomeText(row, row.outcomes[index] ?? "Skipped")}`,
}));

export const coverageColumns = DataGrid.defineColumns<CoverageRow, Message>()([
  {
    id: "label",
    header: "Field / condition",
    accessor: (row) => row.label,
    width: 340,
    minimumWidth: 220,
    pinned: "Start",
    rowHeader: true,
    renderCell: ({ row }, h) =>
      h.span(
        [h.Class(className(styles.label))],
        [
          h.span(
            [h.Class(className(styles.labelText, row.kind === "Condition" && styles.condition))],
            [row.label],
          ),
          h.span([h.Class(className(styles.code))], [row.code]),
        ],
      ),
  },
  { id: "page", header: "Page", accessor: (row) => row.page, width: 124 },
  {
    id: "type",
    header: "Type",
    accessor: (row) => row.type,
    width: 110,
    renderCell: ({ row }, h) =>
      h.span([h.Class(className(row.kind === "Condition" && styles.muted))], [row.type]),
  },
  ...journeyColumns,
  {
    id: "coverage",
    header: "Coverage",
    accessor: (row) => row.covered,
    width: 136,
    align: "End",
    renderCell: ({ row }, h) =>
      h.span(
        [h.Class(className(styles.count))],
        [
          `${row.covered} / ${journeys.length}`,
          h.span(
            [h.Class(className(styles.bar)), h.AriaHidden(true)],
            [
              h.span(
                [
                  h.Class(className(styles.barFill, row.isGap && styles.barFillGap)),
                  h.Style({ width: `${(row.covered / journeys.length) * 100}%` }),
                ],
                [],
              ),
            ],
          ),
        ],
      ),
    details: ({ row }) =>
      row.covered === 0
        ? "No journey reaches this row."
        : `Reached by:\n${journeys.filter((_, index) => row.outcomes[index] === "Holds").join("\n")}`,
  },
  {
    id: "status",
    header: "Status",
    accessor: (row) => statusLabel(row),
    width: 104,
    compare: (left, right) =>
      Number(right.isGap) - Number(left.isGap) || right.gapCount - left.gapCount,
    renderCell: ({ row }, h) =>
      h.span(
        [
          h.Class(
            className(
              styles.status,
              row.isGap
                ? styles.statusGap
                : row.gapCount > 0
                  ? styles.statusPartial
                  : styles.statusCovered,
            ),
          ),
        ],
        [statusLabel(row)],
      ),
  },
]);

const gapFieldCount = coverageRows.filter((row) => row.isGap || row.gapCount > 0).length;
const numberFormat = new Intl.NumberFormat("en-US");

const selectionSummary = (model: CoverageModel): string => {
  const rowId = Option.getOrUndefined(model.grid.selectedRowId);
  const row = rowId === undefined ? undefined : flattenedCoverage.get(rowId);
  if (row === undefined) return "Select a row to inspect it";
  return `${row.kind} · ${row.label} · ${row.covered} / ${journeys.length} journeys · ${statusLabel(row)}`;
};

export const coverageView = (model: CoverageModel, h: HtmlBuilder<Message>): Html => {
  const rows = filterCoverage(model);
  const visibleCount = countRows(rows);
  return h.section(
    [h.Class(className(dataGridStyles.card))],
    [
      h.div(
        [h.Class(className(dataGridStyles.cardHeader))],
        [
          h.div(
            [],
            [
              h.h2([h.Class(className(dataGridStyles.title))], ["I-9 coverage matrix"]),
              h.p(
                [h.Class(className(dataGridStyles.description))],
                [
                  `${FIELD_COUNT} gated fields · ${numberFormat.format(CONDITION_COUNT)} conditions · ${journeys.length} journeys`,
                ],
              ),
            ],
          ),
          Badge.view({ label: `${gapFieldCount} fields with gaps`, tone: "warning", dot: true }, h),
          h.span(
            [h.Class(className(dataGridStyles.rowCount)), h.Role("status")],
            [
              `${numberFormat.format(visibleCount)} of ${numberFormat.format(countRows(coverageRows))} rows`,
            ],
          ),
        ],
      ),
      h.div(
        [h.Class(className(styles.toolbar)), h.Role("toolbar"), h.AriaLabel("Coverage filters")],
        [
          Input.view(
            {
              value: model.search,
              placeholder: "Filter fields and conditions",
              ariaLabel: "Filter fields and conditions",
              onInput: (search) => Message.ChangedCoverageSearch({ search }),
              sx: styles.search,
            },
            h,
          ),
          Toggle.view(
            {
              label: `Gaps only (${gapFieldCount})`,
              isPressed: model.gapsOnly,
              onToggle: (gapsOnly) => Message.ToggledCoverageGaps({ gapsOnly }),
            },
            h,
          ),
          Button.view(
            {
              label: "Expand all",
              variant: "ghost",
              size: "sm",
              onClick: Message.GotCoverageGridMessage({
                message: DataGrid.Message.ExpandedAllRowGroups(),
              }),
            },
            h,
          ),
          Button.view(
            {
              label: "Collapse all",
              variant: "ghost",
              size: "sm",
              onClick: Message.GotCoverageGridMessage({
                message: DataGrid.Message.CollapsedAllRowGroups(),
              }),
            },
            h,
          ),
          h.span([h.Class(className(styles.spacer))], []),
          h.span(
            [h.Class(className(styles.legend))],
            [
              h.span(
                [h.Class(className(styles.legendItem))],
                [
                  h.span(
                    [h.Class(className(styles.swatch, styles.swatchGap)), h.AriaHidden(true)],
                    [],
                  ),
                  "Uncovered",
                ],
              ),
              h.span(
                [h.Class(className(styles.legendItem))],
                [
                  h.span(
                    [h.Class(className(styles.swatch, styles.swatchPartial)), h.AriaHidden(true)],
                    [],
                  ),
                  "Has gaps",
                ],
              ),
              h.span(
                [h.Class(className(styles.legendItem))],
                [
                  h.span(
                    [h.Class(className(styles.outcome, styles.Holds)), h.AriaHidden(true)],
                    [],
                  ),
                  "Holds",
                ],
              ),
              h.span(
                [h.Class(className(styles.legendItem))],
                [
                  h.span(
                    [h.Class(className(styles.outcome, styles.Fails)), h.AriaHidden(true)],
                    [],
                  ),
                  "Fails",
                ],
              ),
            ],
          ),
        ],
      ),
      DataGrid.view(
        {
          model: model.grid,
          columns: coverageColumns,
          rows,
          getRowId: (row) => row.id,
          getSubRows: (row) => row.children,
          toParentMessage: (message) => Message.GotCoverageGridMessage({ message }),
          label: "I-9 coverage matrix",
          emptyText: "No fields match these filters",
          rowHeight: 34,
          appearance: "embedded",
          virtualization: { overscan: 6, initialViewportHeight: 700 },
          rowAttributes: (row) => ({
            tone: rowTone(row),
            label: `${row.kind} ${row.label}, ${statusLabel(row)}`,
          }),
        },
        h,
      ),
      h.footer(
        [h.Class(className(dataGridStyles.footer))],
        [
          h.span(
            [h.Class(className(styles.selection)), h.DataAttribute("coverage-selection", "true")],
            [selectionSummary(model)],
          ),
          h.span([], ["← → collapse or expand · ↑ ↓ select · Home/End · PageUp/PageDown"]),
        ],
      ),
    ],
  );
};
