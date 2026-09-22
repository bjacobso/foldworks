# @foldworks/keyboard

Typed command definitions shared by UI and feature packages without depending on
StyleX or a UI engine. Effect is its only runtime dependency. The host owns execution: `events(bindings, platform)` emits
command IDs through a Foldkit subscription (or mount stream). Cancellation removes
the sole keydown listener. Keep one registry per application and derive bindings
from host state. Bindings can target stable DOM scope IDs; the nearest ancestor
scope wins, then higher priority, then declaration order. `conflicts` reports
ambiguous same-scope bindings. Disabled bindings do not reserve a key.

Use `shortcut("s", "Mod")`, `display`, and `aria` from the same definition.
The host supplies `mac` or `other`, including during SSR. Mod maps to Meta on Mac
and Control elsewhere. Matching uses logical keys, not physical key codes.
Inputs, textareas, selects, contenteditable, composing events, prevented events,
and repeats are ignored unless the corresponding editable/repeat policy opts in.
Modifiers match exactly. Browser/OS-reserved combinations cannot be guaranteed.

Install with `pnpm add @foldworks/keyboard effect foldkit`. UI consumers can use
`Shortcuts` from `@foldworks/ui`; its `registration` helper safely replaces a
keyed mount when controlled bindings change. Headless consumers can use
`events` in `Subscription.make`, with bindings as subscription dependencies or a
getter returning the current definitions. Do not also register the same bindings
through a UI mount. See [the desktop integration guide](../ui/docs/desktop.md)
for shared Button, Menu, Command and shortcut-reference examples.

This package is separate because application and feature code need command
contracts without importing rendering or StyleX. It contains no action store,
application data, or implicit global singleton.
