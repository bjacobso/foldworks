---
"@foldworks/outliner": minor
"@foldworks/text-intelligence": patch
---

Suggest completions at the caret. Ctrl+Space sends `RequestedCompletion`, and
a host offers items for a range of an item's text with `ShowCompletions`,
asked or unasked. While suggestions show they claim ↑, ↓, Return, Tab, and
Esc ahead of the outline's keys; typing narrows them, and accepting replaces
the range as one undoable step with held keys replayed after it. Completion
lists now leave out an item that matches what is typed exactly, and popups
stay inside clipping ancestors.
