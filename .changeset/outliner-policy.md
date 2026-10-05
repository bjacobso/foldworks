---
"@foldworks/outliner": minor
---

Let hosts refuse moves and protect read-only items. `Outliner.update` takes an
optional policy with `canMove`, which sees each indent, outdent, move, and
drop with the document before and after, and `isReadOnly`, which keeps an
item's text, done state, parent, and children. Refusals are announced, a
refused drag shows a red insertion marker, and read-only text stays
selectable. `reparented` and `keepsReadOnly` are exported. Pass the same
policy to the view.
