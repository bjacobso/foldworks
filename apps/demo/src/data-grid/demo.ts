import { type Html, type HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { DataGrid } from "@foldworks/data-grid";

import { Message } from "./message";
import type { Model } from "./model";
import { className } from "../workflow/styles";
import { dataGridStyles, statusStyles } from "./styles";

type EmploymentStatus = "Active" | "On leave" | "Contractor";

type Person = Readonly<{
  id: string;
  name: string;
  email: string;
  status: EmploymentStatus;
  department: string;
  role: string;
  location: string;
  startDate: string;
  salary: number;
}>;

const firstNames = [
  "Maya", "Noah", "Iris", "Leo", "Ava", "Theo", "Nina", "Ezra",
  "Sofia", "Miles", "Lina", "Owen", "Zoe", "Jules", "Amara", "Kai",
];
const lastNames = [
  "Chen", "Williams", "Patel", "Martinez", "Kim", "Johnson", "Okafor", "Silva",
];
const departments = ["Engineering", "Design", "Operations", "Sales", "People"];
const roles = [
  "Software engineer", "Product designer", "Operations lead", "Account executive",
  "People partner", "Data analyst", "Product manager",
];
const locations = ["San Francisco", "New York", "Austin", "London", "Remote"];
const statuses: ReadonlyArray<EmploymentStatus> = ["Active", "Active", "Active", "On leave", "Contractor"];

export const people: ReadonlyArray<Person> = Array.from({ length: 120 }, (_, index) => {
  const firstName = firstNames[index % firstNames.length] ?? "Alex";
  const lastName = lastNames[(index * 3) % lastNames.length] ?? "Morgan";
  const year = 2019 + (index % 7);
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String((index % 24) + 1).padStart(2, "0");
  return {
    id: `person-${index + 1}`,
    name: `${firstName} ${lastName}`,
    email: `${firstName}.${lastName}${index + 1}@example.com`.toLowerCase(),
    status: statuses[index % statuses.length] ?? "Active",
    department: departments[(index * 2) % departments.length] ?? "Operations",
    role: roles[(index * 5) % roles.length] ?? "Specialist",
    location: locations[(index * 3) % locations.length] ?? "Remote",
    startDate: `${year}-${month}-${day}`,
    salary: 72_000 + (index % 18) * 4_500,
  };
});

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
    renderCell: ({ row }, h) =>
      h.span(
        [h.Class(className(dataGridStyles.status, statusStyles[row.status]))],
        [h.span([h.Class(className(dataGridStyles.statusDot)), h.AriaHidden(true)]), row.status],
      ),
  },
  {
    id: "department",
    header: "Department",
    accessor: (person) => person.department,
    width: 170,
  },
  {
    id: "role",
    header: "Role",
    accessor: (person) => person.role,
    width: 220,
  },
  {
    id: "location",
    header: "Location",
    accessor: (person) => person.location,
    width: 170,
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
    renderCell: ({ row }, h) =>
      h.span([h.Class(className(dataGridStyles.money))], [
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(row.salary),
      ]),
  },
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
        h.span([h.Class(className(dataGridStyles.rowCount))], [
          `${people.length} rows`,
        ]),
      ]),
      DataGrid.view(
        {
          model: model.grid,
          columns,
          rows: people,
          getRowId: (person) => person.id,
          toParentMessage: (message) => Message.GotGridMessage({ message }),
          label: "Team directory",
          rowHeight: 52,
          appearance: "embedded",
        },
        h,
      ),
      h.footer([h.Class(className(dataGridStyles.footer))], [
        h.span([], ["Click a cell, then use arrow keys to move"]),
        h.span([], ["Drag a column edge to resize · double-click to reset"]),
      ]),
    ]),
  ]);

export const view = defineView<Model, Message>((model, h) => dataGridView(model, h));
