# @foldworks/history

A small immutable undo/redo utility for application-owned Foldkit documents.

Import the `History` namespace. Call `History.record` before replacing a
document, then use `History.undo` and `History.redo` with the current value.
Pass a `coalescingKey` for consecutive text edits that should
undo as one operation. Selection, focus, drag state, and other transient UI
state stay outside history.

Use `History.Schema(DocumentSchema)` when history is part of a Foldkit model.
