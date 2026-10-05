---
"@foldworks/outliner": minor
---

Let hosts layer meaning onto an outline. The view accepts `decorations`, which
paint styled spans beneath each item's editable text, can replace the bullet
with a `marker` and trail the text with a non-editable `suffix`, and set a
`data-tone` on its row, a `rowAccessory` slot for trailing content such as a computed value,
and `spellcheck`. `Replace` applies a host-made edit as one undoable step
without moving focus, with an optional `coalescingKey`, and `Reveal` expands,
unhoists, and focuses an item. `childrenOf`, `insertItems`, `isWithin`, and
`updateItem` are now exported.
