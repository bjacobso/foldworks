# @foldworks/history

A small immutable undo/redo utility for application-owned Foldkit documents.

Call `record` before replacing a document, then use `undo` and `redo` with the
current value. Pass a `coalescingKey` for consecutive text edits that should
undo as one operation. Selection, focus, drag state, and other transient UI
state stay outside history.
