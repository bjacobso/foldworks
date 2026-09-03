# @foldworks/data-grid

A typed, Foldkit-native data grid with a headless table core.

The first slice supports:

- column definitions and externally owned row data;
- custom cell and header rendering;
- three-state sorting;
- pointer column resizing and double-click reset;
- single-cell selection and arrow-key navigation;
- sticky headers, horizontal scrolling, and accessible grid semantics.

```ts
const columns = DataGrid.defineColumns<Person, Message>()([
  {
    id: "name",
    header: "Name",
    accessor: (person) => person.name,
    width: 240,
  },
])

const dataGrid = DataGrid.init({ id: "people", columns })

DataGrid.view(
  {
    model,
    columns,
    rows: people,
    getRowId: (person) => person.id,
    toParentMessage: (message) => Message.GotDataGridMessage({ message }),
    appearance: "embedded",
  },
  h,
)
```

Embed `dataGrid` in the application model, wrap `DataGrid.Message` in the
parent message union, call `DataGrid.update` from that message branch, and lift
`DataGrid.subscriptions` into the parent. Rows remain outside the component
model, so server data can be replaced or appended without duplicating it in UI
state.

Import `@foldworks/data-grid/styles.css` once in the application. CSS
custom properties on `.fk-data-grid` provide the initial theming surface.
Use `appearance: "embedded"` when a surrounding panel already owns the outer
border and rounded corners; the default `"standalone"` appearance keeps the
grid's complete frame.

Editing, range selection, clipboard operations, column ordering, pinned
columns, row virtualization, and infinite loading are intentionally deferred.
They can build on the same headless row/column model without changing the basic
configuration contract.
