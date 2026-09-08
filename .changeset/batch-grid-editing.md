---
"@foldworks/data-grid": minor
---

Add opt-in immediate and batch cell editing with text, number, select, and
checkbox editors, validation, draft indicators, save/discard controls, conflict
checks, and partial-save recovery. Applications own row updates and persistence
through SubmittedEdits out-messages and explicit save results.

DataGrid.update now returns an optional out-message, so foldChild integrations
must provide a foldOutMessage handler even for a read-only grid.
