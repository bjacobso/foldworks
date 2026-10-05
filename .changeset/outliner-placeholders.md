---
"@foldworks/outliner": minor
---

Add placeholder rows: ghost children, such as “+ add a question” or “+ step”,
that the host supplies per parent with the `placeholders` view input. They are
not part of the document. Arrow keys move into them like rows, and typing into
one, pressing Return on it, or clicking its “+” sends `FilledPlaceholder` and
creates a real item as one undoable step, with keys typed meanwhile replayed
into it.
