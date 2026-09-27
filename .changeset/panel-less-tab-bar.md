---
"@foldworks/ui": minor
---

Add `TabBar`, a stateless tab strip for applications that swap whole screens.
Tabs render no panels and accept a `hint`, a `badge`, and an optional `href`.
Disabled navigation tabs stay focusable and explain why ("Not added", "Planned"), and a
`trailing` slot holds status such as a release `Badge`. The default navigation
semantics mark the current tab with `aria-current="page"`; `semantics:
"tablist"` provides a single-tab-stop tablist with Arrow, Home, and End
selection. `TabBar.tabId` links an application-rendered panel.

`Sidebar` items now accept an `onClick` message in place of, or alongside, an
`href`, plus a `count` with an optional accessible `countLabel`. The current
item is now highlighted. `Toggle` accepts a `count`; `ToggleGroup` and
`SegmentedControl` options accept a `count`, a `badge`, `isDisabled`, and a
`needsAttention` state with an announced `attentionLabel`.
