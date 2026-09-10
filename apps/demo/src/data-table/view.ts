import { Option } from "effect";
import { type Html, type HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import {
  Building2,
  ChevronDown,
  Download,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
} from "@lucide/icons";
import { DataTable } from "@foldworks/data-table";
import * as Icon from "@foldworks/ui/icon";

import { dataTablePath } from "../app/route";
import { className } from "../workflow/styles";
import { contacts, formatLastContact, type Contact } from "./contacts";
import { Message } from "./message";
import type { Model } from "./model";
import { styles } from "./styles";

const icon = (value: Parameters<typeof Icon.view>[0]["icon"], h: HtmlBuilder<Message>) =>
  Icon.view({ icon: value, size: 14, strokeWidth: 2 }, h);

const columns = DataTable.defineColumns<Contact, Message>()([
  {
    id: "person",
    header: "Person",
    accessor: (contact) => contact.name,
    width: 250,
    pinned: "Start",
    isPrimary: true,
    href: (contact) => dataTablePath(contact.id),
    renderCell: ({ row }, h) => h.div([h.Class(className(styles.person))], [
      h.span([h.Class(className(styles.avatar)), h.AriaHidden(true)], [row.initials]),
      h.span([], [row.name]),
    ]),
  },
  {
    id: "company",
    header: "Company",
    accessor: (contact) => contact.company,
    width: 210,
    renderCell: ({ row }, h) => h.div([h.Class(className(styles.company))], [
      h.span([h.Class(className(styles.companyIcon)), h.AriaHidden(true)], [
        icon(Building2, h),
      ]),
      h.span([], [row.company]),
    ]),
  },
  {
    id: "email",
    header: "Email address",
    accessor: (contact) => contact.email,
    width: 250,
    renderCell: ({ row }, h) => h.a([
      h.Class(className(styles.email)),
      h.Href(`mailto:${row.email}`),
    ], [row.email]),
  },
  {
    id: "title",
    header: "Job title",
    accessor: (contact) => contact.title,
    width: 190,
  },
  {
    id: "relationship",
    header: "Connection strength",
    accessor: (contact) => contact.relationship,
    width: 165,
    renderCell: ({ row }, h) => h.span([h.Class(className(styles.status))], [
      h.span([
        h.Class(className(
          styles.dot,
          row.relationship === "Strong"
            ? styles.strong
            : row.relationship === "Warm"
              ? styles.warm
              : styles.weak,
        )),
        h.AriaHidden(true),
      ]),
      row.relationship,
    ]),
  },
  {
    id: "status",
    header: "Lifecycle",
    accessor: (contact) => contact.status,
    width: 125,
  },
  {
    id: "city",
    header: "Location",
    accessor: (contact) => contact.city,
    width: 145,
  },
  {
    id: "lastContact",
    header: "Last contacted",
    accessor: (contact) => contact.lastContactMinutes,
    width: 150,
    renderCell: ({ row }, h) => h.span([h.Class(className(styles.muted))], [
      formatLastContact(row.lastContactMinutes),
    ]),
  },
  {
    id: "actions",
    header: "Actions",
    accessor: () => "",
    width: 80,
    align: "Center",
    pinned: "End",
    enableSorting: false,
    renderCell: ({ rowId, row }, h) => h.button([
      h.Type("button"),
      h.Class(className(styles.actionButton)),
      h.AriaLabel(`Actions for ${row.name}`),
      h.OnClick(Message.ClickedRowActions({ rowId })),
    ], [icon(MoreHorizontal, h)]),
  },
]);

const activeSortLabel = (model: Model): string => Option.match(model.sorting, {
  onNone: () => "Not sorted",
  onSome: (sorting) => {
    const header = columns.find((column) => column.id === sorting.columnId)?.header ?? sorting.columnId;
    return `${header} ${sorting.direction === "Ascending" ? "ascending" : "descending"}`;
  },
});

const detail = (contact: Contact, h: HtmlBuilder<Message>): Html => h.aside([
  h.Class(className(styles.detail)),
  h.AriaLabel(`${contact.name} details`),
  h.DataAttribute("contact-detail", contact.id),
], [
  h.div([h.Class(className(styles.detailHeader))], [
    h.div([], [
      h.h2([h.Class(className(styles.detailTitle))], [contact.name]),
      h.div([h.Class(className(styles.detailCompany))], [
        `${contact.title} at ${contact.company}`,
      ]),
    ]),
    h.a([
      h.Class(className(styles.detailClose)),
      h.Href(dataTablePath()),
      h.AriaLabel("Close person details"),
    ], [icon(X, h)]),
  ]),
  h.div([h.Class(className(styles.detailList))], [
    ...[
      ["Email", contact.email],
      ["Location", contact.city],
      ["Lifecycle", contact.status],
      ["Connection", contact.relationship],
      ["Last contacted", formatLastContact(contact.lastContactMinutes)],
    ].map(([label, value]) => h.div([], [
      h.div([h.Class(className(styles.detailLabel))], [label ?? ""]),
      h.div([h.Class(className(styles.detailValue))], [value ?? ""]),
    ])),
  ]),
]);

export const dataTableView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const query = model.query.trim().toLowerCase();
  const filtered = query === "" ? contacts : contacts.filter((contact) =>
    [contact.name, contact.company, contact.email, contact.title, contact.city]
      .some((value) => value.toLowerCase().includes(query)));
  const sorting = Option.getOrUndefined(model.sorting);
  const rows = DataTable.sortRows(filtered, columns, sorting);
  const active = contacts.find((contact) => contact.id === model.activeContactId);
  return h.div([h.Class(className(styles.viewport))], [
    h.section([h.Class(className(styles.card)), h.DataAttribute("data-table-demo", "true")], [
      h.div([h.Class(className(styles.viewBar))], [
        h.button([h.Type("button"), h.Class(className(styles.button))], [
          icon(SlidersHorizontal, h), "Recently contacted people", icon(ChevronDown, h),
        ]),
        h.div([h.Class(className(styles.spacer))], []),
        h.span([], [icon(Search, h)]),
        h.input([
          h.Class(className(styles.search)),
          h.Type("search"),
          h.AriaLabel("Search people"),
          h.Placeholder("Search people"),
          h.Value(model.query),
          h.OnInput((query) => Message.ChangedQuery({ query })),
        ]),
        h.select([
          h.Class(className(styles.button)),
          h.AriaLabel("Table density"),
          h.Value(model.density),
          h.OnChange((density) => Message.ChangedDensity({
            density: density === "Comfortable" ? "Comfortable" : "Compact",
          })),
        ], [
          h.option([h.Value("Compact")], ["Compact rows"]),
          h.option([h.Value("Comfortable")], ["Comfortable rows"]),
        ]),
        h.button([
          h.Type("button"), h.Class(className(styles.button)),
          h.OnClick(Message.ClickedExport()),
        ], [icon(Download, h), "Export"]),
        h.button([
          h.Type("button"), h.Class(className(styles.button, styles.primaryButton)),
          h.OnClick(Message.ClickedCreate()),
        ], [icon(Plus, h), "New person"]),
      ]),
      h.div([h.Class(className(styles.chipBar))], model.selectedRowIds.length > 0
        ? [
            h.div([h.Class(className(styles.bulk))], [
              `${model.selectedRowIds.length} selected`,
              h.button([
                h.Type("button"), h.Class(className(styles.button)),
                h.OnClick(Message.ClearedSelection()),
              ], ["Clear selection"]),
              h.button([h.Type("button"), h.Class(className(styles.button))], ["Add to list"]),
            ]),
          ]
        : [
            h.span([h.Class(className(styles.chip))], [icon(Settings2, h), "View settings"]),
            h.span([h.Class(className(styles.chip))], [`Sorted by ${activeSortLabel(model)}`]),
            h.span([h.Class(className(styles.chip))], [icon(Filter, h), `${rows.length} people`]),
          ]),
      h.div([h.Class(className(styles.tableFrame))], [
        DataTable.view({
          id: "people-resources",
          label: "People resources",
          columns,
          rows,
          getRowId: (contact) => contact.id,
          getRowLabel: (contact) => contact.name,
          ...(sorting === undefined ? {} : { sorting }),
          onSortingChange: (next) => Message.ChangedSorting({
            sorting: next === undefined ? Option.none() : Option.some(next),
          }),
          selectedRowIds: model.selectedRowIds,
          onSelectedRowsChange: (rowIds) => Message.ChangedSelection({ rowIds }),
          density: model.density,
          emptyText: "No people match this view.",
        }, h),
      ]),
      ...(active === undefined ? [] : [detail(active, h)]),
    ]),
  ]);
};

export const view = defineView<Model, Message>((model, h) => dataTableView(model, h));
