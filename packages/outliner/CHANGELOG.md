# @foldworks/outliner

## 0.1.0

### Minor Changes

- 4bc4456: Add `@foldworks/outliner`, a keyboard-first outliner in the style of classic
  Mac outliners. Return, Tab, and Shift+Tab create and nest items; items move,
  fold, and hoist from the keyboard; and a bullet can be dragged to a new place
  and level with a Mac-style insertion marker. Rows can be selected with Esc,
  Shift+arrows, Shift-click, or a drag across them, then moved, indented,
  deleted, or copied as a Markdown list. Multi-line pastes become items. Undo
  restores the caret, and keys typed while a new item renders are replayed into
  it. The document operations, key map, and Markdown and tab-indented text
  codecs are exported for direct use.
- 0f16fd8: Suggest completions at the caret. Ctrl+Space sends `RequestedCompletion`, and
  a host offers items for a range of an item's text with `ShowCompletions`,
  asked or unasked. While suggestions show they claim ↑, ↓, Return, Tab, and
  Esc ahead of the outline's keys; typing narrows them, and accepting replaces
  the range as one undoable step with held keys replayed after it. Completion
  lists now leave out an item that matches what is typed exactly, and popups
  stay inside clipping ancestors. Keys typed faster than the outline renders are no longer
  overwritten by a render that lags behind them.
- 0f16fd8: Show a host's view of a folded item's children with the `foldedView` view
  input, such as a workflow drawn as a diagram. The view is a labeled group under
  its row that the arrow keys enter and leave, its own controls take the keys,
  and Esc returns to the row; unfolding the item edits its children as rows
  again.
- 0f16fd8: Let hosts layer meaning onto an outline. The view accepts `decorations`, which
  paint styled spans beneath each item's editable text, can replace the bullet
  with a `marker` and trail the text with a non-editable `suffix`, and set a
  `data-tone` on its row, a `rowAccessory` slot for trailing content such as a computed value,
  and `spellcheck`. `Replace` applies a host-made edit as one undoable step
  without moving focus, with an optional `coalescingKey`, and `Reveal` expands,
  unhoists, and focuses an item. `childrenOf`, `insertItems`, `isWithin`, and
  `updateItem` are now exported.
- 0f16fd8: Explain text on hover. When the pointer rests on a character, the outliner
  sends `Hovered` and asks the `hover` view input for the range it describes
  and content built in the host's boundary; Ctrl+Shift+Space asks the same for
  the caret, and Esc dismisses it. A decoration's `diagnostics` are underlined
  and listed first in the hover popup. Import
  `@foldworks/text-intelligence/styles.css` for the popup styles.
- 0f16fd8: Add placeholder rows: ghost children, such as “+ add a question” or “+ step”,
  that the host supplies per parent with the `placeholders` view input. They are
  not part of the document. Arrow keys move into them like rows, and typing into
  one, pressing Return on it, or clicking its “+” sends `FilledPlaceholder` and
  creates a real item as one undoable step, with keys typed meanwhile replayed
  into it.
- 0f16fd8: Let hosts refuse moves and protect read-only items. `Outliner.update` takes an
  optional policy with `canMove`, which sees each indent, outdent, move, and
  drop with the document before and after, and `isReadOnly`, which keeps an
  item's text, done state, parent, and children. Refusals are announced, a
  refused drag shows a red insertion marker, and read-only text stays
  selectable. `reparented` and `keepsReadOnly` are exported. Pass the same
  policy to the view.

### Patch Changes

- 1e3738e: Add reusable plain-text mention/tag recognition, host entity lookup, configurable syntax exclusions, completions, diagnostics and shared hover presentation. Normalize completion matching to NFC and retain exact-prefix suggestions when a replacement still has a suffix.

  Add generic synchronous inline text-intelligence hooks to the native editor, using the existing shared popups and editor-owned transactions, selection, composition, and history. Preserve explicitly escaped Markdown markers with an additive literal run mark; consumers decoding the previous mark union need to recognize literal marks when reading documents with escapes.

  Suspend outliner completion and hover during native composition, and commit the finished text before offering suggestions.

- Updated dependencies [0f16fd8]
- Updated dependencies [0f16fd8]
- Updated dependencies [1e3738e]
- Updated dependencies [0f16fd8]
  - @foldworks/text-intelligence@0.1.0
