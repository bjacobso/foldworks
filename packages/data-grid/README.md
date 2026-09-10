# @foldworks/data-grid

An Excel-like data surface for cell selection, clipboard workflows, and inline
editing. For a traditional resource list with semantic table markup, links,
sorting, and bulk row selection, use [`@foldworks/data-table`](../data-table).

A typed, Foldkit-native data grid with a headless table core.

The first slice supports:

- column definitions and externally owned row data;
- custom cell and header rendering;
- three-state sorting;
- pointer column resizing and double-click reset;
- opt-in accessible column reordering;
- declarative start/end pinned columns with computed sticky offsets;
- rectangular selection with arrow and Shift+Arrow navigation;
- spreadsheet-friendly TSV clipboard copy and validated paste;
- opt-in fixed-row virtualization with measured viewport overscan;
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
    showRowNumbers: true,
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

Set `showRowNumbers: true` for spreadsheet-oriented surfaces. The grid adds a
sticky row-header gutter, adjusts pinned-start offsets, and exposes the gutter
through ARIA row and column indices without changing data-cell coordinates.

## Selection and clipboard

Click a cell or use the arrow keys to create a single-cell selection. Hold
Shift while pressing an arrow key to extend a rectangular range from its
stable row-and-column-ID anchor. Pressing an arrow key without Shift collapses
the range to the new focused cell.

Copying a selection writes its accessor or draft values as tab-separated rows,
ready to paste into a spreadsheet. Tabs, line breaks, and quotes are escaped
using standard quoted-field syntax. A column can provide
`clipboardValue(context): string` when its exported value should differ from
its accessor value. While a cell editor is open, native text-input copying is
left unchanged.

Pasting maps a TSV matrix from the focused cell, clips it at the grid bounds,
and skips read-only columns without shifting the remaining values. Text,
number, select, and checkbox editors use the same parsing and validation rules
as direct edits; select labels and the checkbox values `true`/`false`,
`yes`/`no`, and `1`/`0` are accepted. Invalid values remain highlighted drafts
and block saving. Batch mode stages the matrix for review, while Immediate mode
submits a valid matrix as one application-owned save request.

## Row virtualization

Set `virtualization` on the view when a grid has enough rows to benefit from
windowed rendering:

```ts
DataGrid.view({
  ...config,
  rowHeight: 52,
  virtualization: { overscan: 4, initialViewportHeight: 700 },
}, h)
```

The grid measures its live scroll viewport with a mount-scoped
`ResizeObserver`, throttles scroll updates to animation frames, and renders
only the visible fixed-height rows plus overscan. `initialViewportHeight`
provides the first-render estimate until measurement arrives. Sorting,
selection, editing, and clipboard operations continue to use the complete
headless table, and `aria-rowcount`/`aria-rowindex` retain absolute values.
At least one overscan row is always retained so arrow-key focus can cross a
window boundary safely.

## Column ordering

Set `enableColumnReordering: true` on the view to add accessible move-left and
move-right controls to each column header. The order is stored in the grid
model as stable column IDs, so sorting, resized widths, selections, and staged
edits remain attached to the correct column as it moves.

The table reconciles the stored order with the definitions supplied on every
render: removed IDs are ignored, duplicate IDs are collapsed, and new columns
are appended in definition order. Applications can also build their own
ordering UI with `moveColumn(columnIds, columnId, direction)` and dispatch
`Message.ChangedColumnOrder({ columnIds })`.

## Pinned columns

Set `pinned: "Start"` or `pinned: "End"` on a column definition to keep it
visible while the grid scrolls horizontally:

```ts
const columns = DataGrid.defineColumns<Person, Message>()([
  { id: "name", header: "Name", pinned: "Start", /* ... */ },
  { id: "status", header: "Status", /* ... */ },
  { id: "actions", header: "Actions", pinned: "End", /* ... */ },
])
```

Pinned columns form stable start and end bands around unpinned columns. Their
sticky offsets are derived from the grid model's live column widths, so resizing
one pinned column updates every following offset. Saved ordering is preserved
within each band; the built-in ordering controls do not move columns across a
pin boundary. Header and body cells expose `data-pinned` and
`data-pin-boundary`, while body cells also expose `data-cell-column-id` for
targeted integrations and tests.

## Cell editing

Editing is opt-in. Configure editors on columns and a save mode at initialization:

```ts
const columns = DataGrid.defineColumns<Person, Message>()([
  {
    id: "name",
    header: "Name",
    accessor: (person) => person.name,
    editor: {
      kind: "Text",
      validate: (value) => String(value).trim() ? undefined : "Name is required.",
    },
  },
  {
    id: "department",
    header: "Department",
    accessor: (person) => person.department,
    editor: {
      kind: "Select",
      options: [{ value: "Engineering", label: "Engineering" }],
    },
  },
]);

const grid = DataGrid.init({
  id: "people",
  columns,
  editing: { mode: "Batch" }, // or "Immediate"
});
```

Editors support `Text`, `Number`, `Select` (string option values), and `Checkbox`
(boolean values). `validate(value, sourceRow)` returns an error string or
`undefined`. Number editors reject blank and non-finite input.

Enter, F2, or double-click opens an editor. Enter commits the cell; Escape
cancels the active edit. The toolbar also provides explicit commit/cancel
buttons. Tab can leave the editor without losing its input; finish or cancel
that editor before opening another cell. Invalid input keeps the editor open
with an accessible error message.

In **Batch** mode, committing stages the value. The toolbar counts changed
cells and rows and provides **Save changes** and **Discard changes**. In
**Immediate** mode, committing submits that cell immediately. Both modes lock
editing and discard while a save is pending. Failed edits remain available
for correction or retry; an immediate-mode retry submits the first remaining
edit, one at a time.

Drafts are keyed by stable row and column IDs. Repeated edits retain the first
source value and latest draft, and reverting to the original removes the
draft. Cancelling an editor preserves any earlier staged value. Discard clears
all drafts and displays the latest supplied rows.

The grid overlays drafts on displayed cell values without modifying source
rows. Sorting uses source values, so a drafted cell does not move its row.
Custom `renderCell` callbacks should render `context.value` when displaying an
editable value; `context.row` deliberately remains the source row.

For custom editor presentation, provide a column `renderEditor(context, h)`.
The context supplies `id`, `label`, `input`, `value`, `error`, `onInput`,
`onCommit`, and `onCancel`. Put `id` on the focusable input and wire `onInput`
with its string value. The column's `editor` still owns parsing and validation.
The grid handles Enter/Escape for editor descendants; custom controls can also
dispatch the supplied commit/cancel messages.

### Handling save requests

`DataGrid.update` now returns an optional `DataGrid.OutMessage.SubmittedEdits`:

```ts
{
  _tag: "SubmittedEdits",
  batchId: "people:1",
  edits: [
    { rowId: "person-1", columnId: "name", previousValue: "Alice", value: "Alicia" },
  ],
}
```

Handle it through `Update.foldChild({ ..., foldOutMessage })`. The handler
receives the model with `pendingSubmission` already set and should issue an
application-owned save command. Existing read-only integrations also need a
`foldOutMessage` handler; they can return the parent model unchanged because
editing is disabled by default. The grid performs no network or storage work.

When the command completes, update the application's rows with accepted
values **in the same parent update** that folds this message into the grid:

```ts
DataGrid.Message.CompletedSave({
  batchId,
  accepted: [{ rowId: "person-1", columnId: "name" }],
  rejected: [
    { rowId: "person-2", columnId: "name", error: "You cannot edit this record." },
  ],
});
```

Accepted drafts clear; rejected drafts retain their value and error. Missing
results are retained with an error, and rejection takes precedence if an
address appears in both lists. For a whole-request failure, send
`DataGrid.Message.FailedSave({ batchId, error })`. Responses for an old batch
are ignored. Batch IDs correlate requests within a grid model's lifetime;
applications supply any durable idempotency keys they need.

The demo's `src/data-grid/update.ts` shows a complete parent integration.

### Source changes and custom controls

The view checks each draft against current source rows and columns. A changed
source cell, missing record/column, invalid value, or removed editor blocks
saving. Unrelated source-field changes are allowed. Conflicts require
discarding the draft before starting again. Supply the complete editable row
set; removing a drafted row from `rows` is treated as a missing record.

Use `DataGrid.editIssues({ model, rows, columns, getRowId })` to inspect issues
headlessly. Set `showEditingToolbar: false` to supply your own controls and
dispatch `DataGrid.saveMessage({ model, rows, columns, getRowId })` using the
latest source data. Use `DataGrid.commitMessage` with the same inputs for a
custom active-cell commit control. These helpers include current validation/conflict results;
do not construct an empty issue list to bypass those checks.

Source checks protect local drafts, but the application must still validate
writes against its current data at save time. A submitted batch does not
prescribe atomicity or any particular persistence backend.

Infinite loading remains future work.
