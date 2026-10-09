# @foldworks/data-grid

## 0.2.1

### Patch Changes

- Updated dependencies [0d75dc8]
- Updated dependencies [0f16fd8]
- Updated dependencies [0f16fd8]
  - @foldworks/ui@0.3.0

## 0.2.0

### Minor Changes

- cece04c: Add opt-in immediate and batch cell editing with text, number, select, and
  checkbox editors, validation, draft indicators, save/discard controls, conflict
  checks, and partial-save recovery. Applications own row updates and persistence
  through SubmittedEdits out-messages and explicit save results.

  DataGrid.update now returns an optional out-message, so foldChild integrations
  must provide a foldOutMessage handler even for a read-only grid.

- 7d88f93: Add stable-ID column ordering with reconciliation helpers and opt-in accessible
  header controls that preserve sorting, sizing, selection, and editing state.
- 7d88f93: Add validated TSV clipboard paste for editable grids. Pasted matrices map from
  the focused cell, skip read-only columns, preserve original draft values, and
  participate in both batch and immediate save flows.
- 7d88f93: Add declarative start and end pinned columns with width-aware sticky offsets,
  pin-boundary metadata, and ordering-band integration.
- 7d88f93: Add stable-ID rectangular range selection with Shift+Arrow navigation and
  spreadsheet-friendly TSV clipboard copy, including per-column clipboard value
  formatting.
- 6c3953a: Add expandable row groups through `getSubRows`, with treegrid semantics and
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

- 7d88f93: Add opt-in fixed-row virtualization with mount-scoped viewport measurement,
  animation-frame-throttled scroll updates, overscan, stable selection retention,
  and absolute accessible row metadata.
- 7d88f93: Add opt-in sticky row-number headers for spreadsheet-oriented grids, including
  adjusted ARIA column indices and pinned-start offsets.

### Patch Changes

- 05217a5: Allow applications to supply compatible Effect, Foldkit, and StyleX versions
  through peer dependencies while keeping exact workspace build versions.
- 1015b7a: Emit declarations with TypeScript 7. The JavaScript is unchanged, and the
  public types are equivalent. The declaration files are laid out differently:
  local helpers are declared once and referenced with `typeof`, named aliases are
  reused, and union members may be ordered differently. The field records of
  `defineMessageUnion` schemas (`Message.X.fields`) no longer print `readonly` on
  some keys; the Message types themselves are identical.
- Updated dependencies [6e05824]
- Updated dependencies [c7b54c5]
- Updated dependencies [ff6f731]
- Updated dependencies [4db505c]
- Updated dependencies [61cf008]
- Updated dependencies [e071f6a]
- Updated dependencies [473c187]
- Updated dependencies [3227682]
- Updated dependencies [05759a5]
- Updated dependencies [69b5b21]
- Updated dependencies [e768f17]
- Updated dependencies [a974220]
- Updated dependencies [140b35f]
- Updated dependencies [c049320]
- Updated dependencies [398d432]
- Updated dependencies [de1cbea]
- Updated dependencies [05217a5]
- Updated dependencies [c42f7c0]
- Updated dependencies [7c9ef65]
- Updated dependencies [1a632ef]
- Updated dependencies [15f9d0a]
- Updated dependencies [1015b7a]
  - @foldworks/ui@0.2.0

## 0.1.0

### Minor Changes

- Publish the initial Foldworks package suite with controlled Foldkit behavior, StyleX styling, themeable UI components, and application primitives for data grids, forms, queries, workflows, navigation, document history, and PDF annotation.

### Patch Changes

- Updated dependencies
  - @foldworks/ui@0.1.0
