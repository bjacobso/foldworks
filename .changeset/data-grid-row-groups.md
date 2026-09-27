---
"@foldworks/data-grid": minor
---

Add expandable row groups through `getSubRows`, with treegrid semantics and
expansion keyed by stable row IDs so it survives filtering, sorting, and
virtualization. Add message-driven single-row selection (`rowSelection:
"Single"`, `SelectedRow`, `ClearedRowSelection`), per-row click messages,
tones, and accessible labels through `rowAttributes`, `rowHeader` columns,
header alignment, and stateless cell `details` shown in one shared top-layer
popover. Keyboard navigation adds Home/End, Ctrl/⌘+Home/End, PageUp/PageDown,
and tree expansion with ArrowLeft/ArrowRight. A focused row far from the
virtual window now renders on its own instead of widening the window.

`DataGrid.Model` gains `rowSelection`, `selectedRowId`, and `rowGroups` fields;
models built with `DataGrid.init` need no changes.
