import { Option } from "effect";
import { type Html, type HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { createTable, DataGrid } from "@foldworks/data-grid";

import { Message } from "./message";
import type { Model } from "./model";
import { className } from "../workflow/styles";
import { dataGridStyles, statusStyles } from "./styles";

import { type Person } from "./rows";

const employeeCell = (
  person: Person,
  h: HtmlBuilder<Message>,
): Html =>
  h.span([h.Class(className(dataGridStyles.personName))], [person.name]);

export const columns = DataGrid.defineColumns<Person, Message>()([
  {
    id: "employee",
    header: "Employee",
    accessor: (person) => person.name,
    width: 190,
    minimumWidth: 150,
    pinned: "Start",
    renderCell: ({ row }, h) => employeeCell(row, h),
  },
  {
    id: "status",
    header: "Status",
    accessor: (person) => person.status,
    width: 130,
    editor: { kind: "Select", options: ["Active", "On leave", "Contractor"].map((value) => ({ value, label: value })) },
    renderCell: ({ value }, h) =>
      h.span(
        [h.Class(className(dataGridStyles.status, statusStyles[value as Person["status"]]))],
        [h.span([h.Class(className(dataGridStyles.statusDot)), h.AriaHidden(true)]), String(value)],
      ),
  },
  {
    id: "department",
    header: "Department",
    accessor: (person) => person.department,
    width: 170,
    editor: { kind: "Text", validate: (value) => String(value).trim() ? undefined : "Enter a value." },
  },
  {
    id: "role",
    header: "Role",
    accessor: (person) => person.role,
    width: 220,
    editor: { kind: "Text" },
    renderEditor: (editor, h) => h.input([
      h.Id(editor.id), h.AriaLabel(editor.label), h.Type("text"),
      h.Class("fk-data-grid__editor"), h.Value(editor.input),
      h.AriaInvalid(editor.error !== ""), h.OnInput(editor.onInput),
    ]),
  },
  {
    id: "location",
    header: "Location",
    accessor: (person) => person.location,
    width: 170,
    editor: { kind: "Text", validate: (value) => String(value).trim() ? undefined : "Enter a value." },
  },
  {
    id: "startDate",
    header: "Start date",
    accessor: (person) => person.startDate,
    width: 140,
  },
  {
    id: "salary",
    header: "Salary",
    accessor: (person) => person.salary,
    width: 130,
    align: "End",
    editor: { kind: "Number", validate: (value) => typeof value === "number" && value >= 0 ? undefined : "Salary must be zero or greater." },
    renderCell: ({ value }, h) =>
      h.span([h.Class(className(dataGridStyles.money))], [
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(Number(value)),
      ]),
  },
  { id: "equipmentIssued", header: "Equipment issued", accessor: (person) => person.equipmentIssued, width: 155, pinned: "End", editor: { kind: "Checkbox" } },
]);

const columnName = (index: number): string => {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
};

const formulaSelection = (model: Model): Readonly<{ address: string; value: string }> => {
  const table = createTable({
    model: model.grid,
    columns,
    rows: model.rows,
    getRowId: (person) => person.id,
  });
  const selected = Option.getOrUndefined(model.grid.selectedCell);
  if (selected === undefined) return { address: "—", value: "Select a cell" };
  const rowIndex = table.rows.findIndex((row) => row.id === selected.rowId);
  const columnIndex = table.columns.findIndex((column) =>
    column.definition.id === selected.columnId);
  if (rowIndex < 0 || columnIndex < 0) return { address: "—", value: "Select a cell" };
  const safeRowIndex = Math.max(0, rowIndex);
  const safeColumnIndex = Math.max(0, columnIndex);
  const value = table.rows[safeRowIndex]?.cells[safeColumnIndex]?.value;
  return {
    address: `${columnName(safeColumnIndex)}${safeRowIndex + 1}`,
    value: value === null || value === undefined
      ? ""
      : typeof value === "boolean"
        ? value ? "TRUE" : "FALSE"
        : String(value),
  };
};

export const dataGridView = (
  model: Model,
  h: HtmlBuilder<Message>,
): Html => {
  const selection = formulaSelection(model);
  return h.div([h.Class(className(dataGridStyles.viewport))], [
    h.section([h.Class(className(dataGridStyles.card))], [
      h.div([h.Class(className(dataGridStyles.cardHeader))], [
        h.div([], [
          h.h2([h.Class(className(dataGridStyles.title))], ["Headcount planning"]),
          h.p([h.Class(className(dataGridStyles.description))], [
            "Editable worksheet · single-line cells · application-owned data",
          ]),
        ]),
        h.label([h.Class(className(dataGridStyles.saveBehavior))], ["Save mode", h.select([
          h.Class(className(dataGridStyles.select)), h.AriaLabel("Save behavior"), h.Value(model.grid.editingMode),
          h.Disabled(model.grid.drafts.length > 0 || model.grid.activeEdit._tag === "Some" || model.grid.pendingSubmission._tag === "Some"),
          h.OnChange((mode) => Message.ChangedEditingMode({ mode: mode === "Immediate" ? "Immediate" : "Batch" })),
        ], [h.option([h.Value("Batch")], ["Batch"]), h.option([h.Value("Immediate")], ["Immediate"])])]),
        h.span([h.Class(className(dataGridStyles.rowCount))], [
          `${model.rows.length} rows × ${columns.length} columns`,
        ]),
      ]),
      h.div([h.Class(className(dataGridStyles.formulaBar)), h.AriaLabel("Selected cell value")], [
        h.span([
          h.Class(className(dataGridStyles.nameBox)),
          h.DataAttribute("grid-cell-address", selection.address),
        ], [selection.address]),
        h.span([h.Class(className(dataGridStyles.formulaIcon)), h.AriaHidden(true)], ["fx"]),
        h.span([
          h.Class(className(dataGridStyles.formulaValue)),
          h.DataAttribute("grid-cell-value", selection.value),
        ], [selection.value]),
      ]),
      DataGrid.view(
        {
          model: model.grid,
          columns,
          rows: model.rows,
          getRowId: (person) => person.id,
          toParentMessage: (message) => Message.GotGridMessage({ message }),
          label: "Headcount planning worksheet",
          rowHeight: 34,
          appearance: "embedded",
          showRowNumbers: true,
          enableColumnReordering: true,
          virtualization: { overscan: 4, initialViewportHeight: 700 },
        },
        h,
      ),
      h.footer([h.Class(className(dataGridStyles.footer))], [
        h.span([h.Class(className(dataGridStyles.sheetTab))], ["Employees"]),
        h.span([], ["Enter or F2 to edit · Shift+Arrow to select · ⌘/Ctrl+C or V to copy/paste"]),
        h.span([], ["Ready"]),
      ]),
    ]),
  ]);
};

export const view = defineView<Model, Message>((model, h) => dataGridView(model, h));
