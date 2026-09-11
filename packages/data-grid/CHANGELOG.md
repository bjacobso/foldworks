# @foldworks/data-grid

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
- 7d88f93: Add opt-in fixed-row virtualization with mount-scoped viewport measurement,
  animation-frame-throttled scroll updates, overscan, stable selection retention,
  and absolute accessible row metadata.
- 7d88f93: Add opt-in sticky row-number headers for spreadsheet-oriented grids, including
  adjusted ARIA column indices and pinned-start offsets.

### Patch Changes

- Updated dependencies [140b35f]
- Updated dependencies [c42f7c0]
- Updated dependencies [7c9ef65]
- Updated dependencies [1a632ef]
  - @foldworks/ui@0.2.0

## 0.1.0

### Minor Changes

- Publish the initial Foldworks package suite with controlled Foldkit behavior, StyleX styling, themeable UI components, and application primitives for data grids, forms, queries, workflows, navigation, document history, and PDF annotation.

### Patch Changes

- Updated dependencies
  - @foldworks/ui@0.1.0
