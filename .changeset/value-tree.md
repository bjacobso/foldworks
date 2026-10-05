---
"@foldworks/ui": minor
---

Add `ValueTree`, a keyboard-navigable tree for nested values with lazily
loaded branches. Expanding a node without loaded children sends
`RequestedChildren` and shows “Loading…” until the host supplies them, and
“Show N more” sends `RequestedMore`, so values can live behind handles in
another process. `ValueTree.fromValue` builds nodes from plain values.
