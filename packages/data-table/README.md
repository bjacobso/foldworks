# @foldworks/data-table

A controlled, accessible resource table for CRUD-oriented Foldkit applications.
It complements `@foldworks/data-grid`: tables optimize for reading and opening
records, while grids optimize for selecting and editing individual cells.

## Features

- semantic `table`, `thead`, `tbody`, `th`, and `td` markup;
- application-owned rows, sorting, selection, filtering, and pagination;
- first-class resource links in primary columns;
- accessible row and visible-page selection with an indeterminate state;
- stable client-side sorting and selection helpers for local datasets;
- compact and comfortable densities;
- declarative start/end pinned columns with computed offsets;
- loading skeletons and an empty state;
- custom header and cell rendering.

```ts
const columns = DataTable.defineColumns<Person, Message>()([
  {
    id: "name",
    header: "Person",
    accessor: (person) => person.name,
    href: (person) => `/people/${person.id}`,
    isPrimary: true,
    pinned: "Start",
  },
  {
    id: "company",
    header: "Company",
    accessor: (person) => person.company,
  },
])

DataTable.view({
  id: "people",
  label: "People",
  columns,
  rows,
  getRowId: (person) => person.id,
  getRowLabel: (person) => person.name,
  sorting,
  onSortingChange: (sorting) => Message.ChangedSorting({ sorting }),
  selectedRowIds,
  onSelectedRowsChange: (rowIds) => Message.ChangedSelection({ rowIds }),
  density: "Compact",
}, h)
```

Import `@foldworks/data-table/styles.css` once in the application.

## Controlled data flow

The table renders rows in the order supplied. It reports requested sort and
selection changes but does not mutate application data or perform requests.
This keeps remote filtering, cursor pagination, permissions, and cache updates
in the host application. `sortRows` is available as an explicit convenience for
small local datasets, and `nextSorting` implements the default ascending →
descending → unsorted cycle.

Visible-page selection preserves IDs selected on other pages. Use
`toggleRowSelection`, `toggleAllRows`, and `selectionState` when building custom
controls or reducers.

## Table versus grid

Use this package when a row represents a resource and users primarily scan,
sort, select, and open records. Links and controls participate in normal Tab
order; arrow keys retain browser behavior.

Use `@foldworks/data-grid` for spreadsheet interactions such as cell focus,
rectangular range selection, arrow-key navigation, clipboard matrices, and
inline editing.
