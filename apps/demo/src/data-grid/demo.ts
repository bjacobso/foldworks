import { type Html, type HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { DataGrid } from "@foldworks/data-grid";

import { Message } from "./message";
import type { Model } from "./model";
import { className } from "../workflow/styles";
import { dataGridStyles, statusStyles } from "./styles";

import { type Person } from "./rows";

const employeeCell = (
  person: Person,
  h: HtmlBuilder<Message>,
): Html =>
  h.div([h.Class(className(dataGridStyles.person))], [
    h.span([h.Class(className(dataGridStyles.avatar)), h.AriaHidden(true)], [
      person.name.split(" ").map((part) => part[0]).join(""),
    ]),
    h.div([h.Class(className(dataGridStyles.personCopy))], [
      h.span([h.Class(className(dataGridStyles.personName))], [person.name]),
      h.span([h.Class(className(dataGridStyles.personEmail))], [person.email]),
    ]),
  ]);

export const columns = DataGrid.defineColumns<Person, Message>()([
  {
    id: "employee",
    header: "Employee",
    accessor: (person) => person.name,
    width: 280,
    minimumWidth: 210,
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
  { id: "equipmentIssued", header: "Equipment issued", accessor: (person) => person.equipmentIssued, width: 155, editor: { kind: "Checkbox" } },
]);

export const dataGridView = (
  model: Model,
  h: HtmlBuilder<Message>,
): Html =>
  h.div([h.Class(className(dataGridStyles.viewport))], [
    h.section([h.Class(className(dataGridStyles.card))], [
      h.div([h.Class(className(dataGridStyles.cardHeader))], [
        h.div([], [
          h.h2([h.Class(className(dataGridStyles.title))], ["Team directory"]),
          h.p([h.Class(className(dataGridStyles.description))], [
            "A controlled, typed grid assembled from application-owned rows and columns.",
          ]),
        ]),
        h.label([], ["Save behavior ", h.select([
          h.AriaLabel("Save behavior"), h.Value(model.grid.editingMode),
          h.Disabled(model.grid.drafts.length > 0 || model.grid.activeEdit._tag === "Some" || model.grid.pendingSubmission._tag === "Some"),
          h.OnChange((mode) => Message.ChangedEditingMode({ mode: mode === "Immediate" ? "Immediate" : "Batch" })),
        ], [h.option([h.Value("Batch")], ["Batch"]), h.option([h.Value("Immediate")], ["Immediate"])])]),
        h.span([h.Class(className(dataGridStyles.rowCount))], [
          `${model.rows.length} rows`,
        ]),
      ]),
      DataGrid.view(
        {
          model: model.grid,
          columns,
          rows: model.rows,
          getRowId: (person) => person.id,
          toParentMessage: (message) => Message.GotGridMessage({ message }),
          label: "Team directory",
          rowHeight: 52,
          appearance: "embedded",
        },
        h,
      ),
      h.footer([h.Class(className(dataGridStyles.footer))], [
        h.span([], ["Arrow to move · Shift+Arrow to select · ⌘/Ctrl+C or V to copy/paste"]),
        h.span([], ["Enter or double-click to edit · drag a column edge to resize"]),
      ]),
    ]),
  ]);

export const view = defineView<Model, Message>((model, h) => dataGridView(model, h));
