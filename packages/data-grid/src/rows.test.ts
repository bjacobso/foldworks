import { Option } from "effect";
import { inertHtml, type Html, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { createTable, defineColumns, flattenRows, isRowGroupExpanded } from "./core";
import { editIssues } from "./editing";
import { Message } from "./message";
import { init, type Model } from "./model";
import { update } from "./update";
import { view } from "./view";

type Entry = Readonly<{
  id: string;
  label: string;
  covered: number;
  children?: ReadonlyArray<Entry>;
}>;

const entries: ReadonlyArray<Entry> = [
  {
    id: "field-b",
    label: "Beta field",
    covered: 1,
    children: [
      { id: "condition-b2", label: "Second", covered: 0 },
      { id: "condition-b1", label: "First", covered: 3 },
    ],
  },
  {
    id: "field-a",
    label: "Alpha field",
    covered: 2,
    children: [{ id: "condition-a1", label: "Only", covered: 2 }],
  },
  { id: "field-c", label: "Gamma field", covered: 0 },
];

const columns = defineColumns<Entry, string>()([
  {
    id: "label",
    header: "Field",
    accessor: (entry) => entry.label,
    pinned: "Start",
    rowHeader: true,
    editor: { kind: "Text" },
  },
  {
    id: "covered",
    header: "Covered",
    accessor: (entry) => entry.covered,
    align: "End",
    details: ({ row }) => (row.covered === 0 ? "" : `${row.covered} journeys\nreach this row`),
  },
]);

// The inert builder never dispatches, so it can stand in for any message type.
const h = inertHtml as unknown as HtmlBuilder<string>;
const getRowId = (entry: Entry) => entry.id;
const getSubRows = (entry: Entry) => entry.children;
const table = (model: Model, rows = entries) =>
  createTable({ model, columns, rows, getRowId, getSubRows });
const ids = (model: Model, rows = entries) => table(model, rows).rows.map((row) => row.id);

const find = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  const node = Option.getOrUndefined(Scene.find(html, selector));
  if (node === undefined) throw new Error(`Expected ${selector}`);
  return node;
};
const findAll = (html: Html, selector: string) => {
  if (html === null) throw new Error("Expected rendered HTML");
  return Scene.findAll(html, selector);
};
const attr = (html: Html, selector: string, name: string) =>
  Option.getOrUndefined(Scene.attr(find(html, selector), name));

describe("row groups", () => {
  it("flattens expanded groups depth-first with tree positions", () => {
    const rows = table(init({ id: "coverage", columns })).rows;

    expect(rows.map((row) => row.id)).toEqual([
      "field-b",
      "condition-b2",
      "condition-b1",
      "field-a",
      "condition-a1",
      "field-c",
    ]);
    expect(rows.map((row) => row.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(rows[1]).toMatchObject({
      depth: 1,
      parentId: "field-b",
      childCount: 0,
      positionInSet: 1,
      setSize: 2,
    });
    expect(rows[0]).toMatchObject({ depth: 0, childCount: 2, isExpanded: true, setSize: 3 });
    expect(rows[5]).toMatchObject({ childCount: 0, isExpanded: false });
  });

  it("starts collapsed when configured and expands by stable row ID", () => {
    const collapsed = init({ id: "coverage", columns, rowGroups: { initiallyExpanded: false } });
    expect(ids(collapsed)).toEqual(["field-b", "field-a", "field-c"]);

    const expanded = update(collapsed, Message.ToggledRowGroup({ rowId: "field-a" })).model;
    expect(isRowGroupExpanded(expanded, "field-a")).toBe(true);
    expect(ids(expanded)).toEqual(["field-b", "field-a", "condition-a1", "field-c"]);

    // Filtering away a group and restoring it keeps the expansion decision.
    const filtered = entries.filter((entry) => entry.id !== "field-a");
    expect(ids(expanded, filtered)).toEqual(["field-b", "field-c"]);
    expect(ids(expanded, [...filtered, entries[1]!])).toEqual([
      "field-b",
      "field-c",
      "field-a",
      "condition-a1",
    ]);
  });

  it("sorts siblings within each level", () => {
    const sorted = update(
      init({ id: "coverage", columns }),
      Message.ToggledSort({ columnId: "label" }),
    ).model;
    expect(ids(sorted)).toEqual([
      "field-a",
      "condition-a1",
      "field-b",
      "condition-b1",
      "condition-b2",
      "field-c",
    ]);
  });

  it("stores explicit expansion idempotently and resets on expand or collapse all", () => {
    const model = init({ id: "coverage", columns });
    expect(
      update(model, Message.ChangedRowGroupExpansion({ rowId: "field-b", isExpanded: true })).model,
    ).toBe(model);

    const collapsed = update(
      model,
      Message.ChangedRowGroupExpansion({ rowId: "field-b", isExpanded: false }),
    ).model;
    expect(collapsed.rowGroups.toggledRowIds).toEqual(["field-b"]);
    expect(
      update(collapsed, Message.ToggledRowGroup({ rowId: "field-b" })).model.rowGroups
        .toggledRowIds,
    ).toEqual([]);

    const none = update(collapsed, Message.CollapsedAllRowGroups()).model;
    expect(none.rowGroups).toEqual({ expandedByDefault: false, toggledRowIds: [] });
    expect(ids(none)).toEqual(["field-b", "field-a", "field-c"]);
    expect(update(none, Message.ExpandedAllRowGroups()).model.rowGroups).toEqual({
      expandedByDefault: true,
      toggledRowIds: [],
    });
  });

  it("flattens every nested row, including collapsed groups, for source lookups", () => {
    expect(flattenRows(entries, getSubRows).map(getRowId)).toEqual([
      "field-b",
      "condition-b2",
      "condition-b1",
      "field-a",
      "condition-a1",
      "field-c",
    ]);
    expect(flattenRows(entries)).toBe(entries);

    const collapsed = {
      ...init({
        id: "coverage",
        columns,
        editing: { mode: "Batch" },
        rowGroups: { initiallyExpanded: false },
      }),
      drafts: [
        {
          rowId: "condition-a1",
          columnId: "label",
          previousValue: "Only",
          value: "Renamed",
          error: "",
        },
      ],
    };
    expect(editIssues({ model: collapsed, columns, rows: entries, getRowId, getSubRows })).toEqual(
      [],
    );
  });
});

describe("row selection", () => {
  it("selects the focused row in single mode, independent of the cell range", () => {
    const model = init({ id: "coverage", columns, rowSelection: "Single" });
    const selected = update(
      model,
      Message.SelectedCell({ rowId: "field-a", columnId: "covered" }),
    ).model;
    expect(Option.getOrUndefined(selected.selectedRowId)).toBe("field-a");

    const extended = update(
      selected,
      Message.ExtendedSelection({
        rowId: "field-c",
        columnId: "covered",
        anchorRowId: "field-a",
        anchorColumnId: "covered",
      }),
    ).model;
    expect(Option.getOrUndefined(extended.selectedRowId)).toBe("field-a");

    const driven = update(extended, Message.SelectedRow({ rowId: "condition-b1" })).model;
    expect(Option.getOrUndefined(driven.selectedRowId)).toBe("condition-b1");
    expect(Option.getOrUndefined(driven.selectedCell)?.rowId).toBe("field-c");
    expect(Option.isNone(update(driven, Message.ClearedRowSelection()).model.selectedRowId)).toBe(
      true,
    );
  });

  it("ignores row selection unless enabled", () => {
    const model = init({ id: "coverage", columns });
    expect(update(model, Message.SelectedRow({ rowId: "field-a" })).model).toBe(model);
    expect(
      Option.isNone(
        update(model, Message.SelectedCell({ rowId: "field-a", columnId: "label" })).model
          .selectedRowId,
      ),
    ).toBe(true);
  });

  it("moves selection and requests focus for keyboard jumps", () => {
    const model = init({ id: "coverage", columns, rowSelection: "Single" });
    const result = update(
      model,
      Message.NavigatedToCell({ rowId: "field-c", columnId: "covered" }),
    );
    expect(Option.getOrUndefined(result.model.selectedCell)).toEqual({
      rowId: "field-c",
      columnId: "covered",
    });
    expect(Option.getOrUndefined(result.model.selectedRowId)).toBe("field-c");
    expect(result.commands).toHaveLength(1);
  });
});

describe("row view", () => {
  const render = (model: Model) =>
    view(
      {
        model,
        columns,
        rows: entries,
        getRowId,
        getSubRows,
        toParentMessage: (message) => message._tag,
        label: "Coverage",
        rowAttributes: (entry, { depth }) => ({
          tone: entry.covered === 0 ? "Danger" : "Neutral",
          label: depth === 0 ? `Field ${entry.label}` : `Condition ${entry.label}`,
          onClick: `open:${entry.id}`,
        }),
      },
      h,
    );

  it("renders tree semantics, row state, and row headers", () => {
    const model = update(
      init({ id: "coverage", columns, rowSelection: "Single" }),
      Message.SelectedRow({ rowId: "field-a" }),
    ).model;
    const html = render(model);

    expect(attr(html, '[aria-label="Coverage"]', "role")).toBe("treegrid");
    expect(attr(html, '[data-row-id="field-b"]', "aria-level")).toBe("1");
    expect(attr(html, '[data-row-id="field-b"]', "aria-expanded")).toBe("true");
    expect(attr(html, '[data-row-id="condition-b1"]', "aria-level")).toBe("2");
    expect(attr(html, '[data-row-id="condition-b1"]', "aria-posinset")).toBe("2");
    expect(attr(html, '[data-row-id="condition-b1"]', "aria-expanded")).toBeUndefined();
    expect(attr(html, '[data-row-id="field-c"]', "data-tone")).toBe("danger");
    expect(attr(html, '[data-row-id="field-c"]', "aria-label")).toBe("Field Gamma field");
    expect(attr(html, '[data-row-id="field-a"]', "aria-selected")).toBe("true");
    expect(attr(html, '[data-row-id="field-a"]', "data-row-selected")).toBe("true");
    expect(attr(html, '[data-row-id="field-b"]', "aria-selected")).toBe("false");
    expect(attr(html, '[data-row-id="field-b"]', "data-clickable")).toBe("true");
    expect(findAll(html, '[role="rowheader"]')).toHaveLength(6);
    expect(attr(html, '[data-column-id="covered"]', "data-align")).toBe("end");
    expect(attr(html, '[data-group-toggle="field-b"]', "aria-label")).toBe(
      "Collapse Field Beta field",
    );
    expect(findAll(html, "[data-group-toggle]")).toHaveLength(2);
  });

  it("describes cells with details through one shared popover", () => {
    const html = render(init({ id: "coverage", columns }));
    const described = findAll(html, '[data-has-details="true"]');

    expect(described).toHaveLength(4);
    const cell = find(html, '[data-row-id="field-b"] [data-cell-column-id="covered"]');
    const describedBy = Option.getOrUndefined(Scene.attr(cell, "aria-describedby"));
    expect(describedBy).toBeDefined();
    expect(Scene.textContent(find(html, `[id="${describedBy}"]`))).toBe(
      "1 journeys\nreach this row",
    );
    expect(findAll(html, '[data-row-id="field-c"] [data-has-details="true"]')).toHaveLength(0);
    expect(findAll(html, ".fk-data-grid__hover-details")).toHaveLength(1);
    expect(attr(html, ".fk-data-grid__hover-details", "popover")).toBe("manual");
  });

  it("keeps a flat grid role without sub-rows", () => {
    const html = view(
      {
        model: init({ id: "flat", columns }),
        columns,
        rows: entries,
        getRowId,
        toParentMessage: (message) => message._tag,
        label: "Flat",
      },
      h,
    );
    expect(attr(html, '[aria-label="Flat"]', "role")).toBe("grid");
    expect(attr(html, '[data-row-id="field-b"]', "aria-level")).toBeUndefined();
    expect(findAll(html, '[role="row"][data-row-id]')).toHaveLength(3);
  });
});

describe("virtualized focus", () => {
  it("keeps a distant focused row mounted without rendering the rows between", () => {
    const many: ReadonlyArray<Entry> = Array.from({ length: 1_000 }, (_, index) => ({
      id: `row-${index}`,
      label: `Row ${index}`,
      covered: index % 3,
    }));
    const model = {
      ...init({ id: "many", columns }),
      viewport: { scrollTop: 0, height: 400 },
      selectedCell: Option.some({ rowId: "row-900", columnId: "label" }),
    };
    const html = view(
      {
        model,
        columns,
        rows: many,
        getRowId,
        toParentMessage: (message) => message._tag,
        rowHeight: 40,
        virtualization: { overscan: 2 },
      },
      h,
    );
    const rows = findAll(html, '[role="row"][data-row-id]');

    expect(rows.length).toBeLessThan(20);
    expect(findAll(html, '[data-row-id="row-900"]')).toHaveLength(1);
    expect(findAll(html, '[data-virtual-spacer="gap"]')).toHaveLength(1);
    expect(findAll(html, '[data-row-id="row-500"]')).toHaveLength(0);
  });
});
