# @foldworks/outliner

A keyboard-first outliner for Foldkit applications, in the spirit of the
classic Mac outliners. Every item is a line of text you can type into. Tab
nests it, Shift+Tab lifts it back out, Return starts the next item, and items
move, fold, and hoist without leaving the keyboard. Drag a bullet to move an
item; slide it left or right while dragging to choose its level.

The package owns the outline document, the editing submodel, undo history, and
a plain-CSS view that uses the `@foldworks/ui` semantic tokens. Applications
own persistence.

```ts
import { Outliner, item, parseOutline } from "@foldworks/outliner";
import "@foldworks/outliner/styles.css";

const outline = Outliner.init({
  id: "notes",
  items: [item("intro", "Start here", [item("next", "Press Tab to nest")])],
});

// Or start from indented text or a Markdown list:
let counter = 0;
const imported = Outliner.init({
  id: "notes",
  items: parseOutline("Plan\n\tResearch\n\tBuild\nShip", () => `notes-${++counter}`),
});
```

Render `Outliner.view` through a Foldkit submodel boundary and fold its
messages with `Outliner.update`. The view accepts `label`, `showCheckboxes`,
`showBreadcrumbs`, and `emptyLabel`.

```ts
h.submodel({
  slotId: "notes",
  model: model.outline,
  view: Outliner.view,
  viewInputs: { label: "Meeting notes", showCheckboxes: true },
  toParentMessage: (message) => Message.GotOutlinerMessage({ message }),
});
```

`model.revision` increases whenever the document changes. Save
`{ version: 1, items: model.items }` and decode it with the exported
`Document` schema. `Outliner.Message.Load({ items })` replaces the document
and clears history. Ids generated for new items are prefixed with the
instance `id`, which must be unique on the page.

## Keyboard

| Keys                                       | Action                                                |
| ------------------------------------------ | ----------------------------------------------------- |
| Return                                     | New item, or split at the caret                       |
| Shift+Return                               | Line break inside an item                             |
| Tab · Shift+Tab (or ⌘] · ⌘[)               | Indent · outdent                                      |
| ⌘⇧↑ · ⌘⇧↓ (also ⌃⌘↑ · ⌃⌘↓)                 | Move up · down                                        |
| ⌘↑ · ⌘↓                                    | Collapse · expand                                     |
| ⌘. · ⌘⇧.                                   | Hoist the item · return to its parent                 |
| ⌘Return                                    | Mark done                                             |
| ↑ ↓ ← →                                    | Move between items at the edges of the text           |
| Backspace at the start · Delete at the end | Join with the item above · below                      |
| Esc                                        | Select the item as a row; Return edits it again       |
| ⇧↑ · ⇧↓                                    | Extend into a row selection once the text is selected |
| ⌘Z · ⌘⇧Z                                   | Undo · redo                                           |

⌘ is Ctrl on Windows and Linux. While rows are selected, ↑ and ↓ move the
selection, ← and → fold and unfold like the Finder, Space marks items done,
Delete removes them, and ⌘C, ⌘X, and ⌘V copy, cut, and paste them as a
Markdown list. Pasting several lines into an item creates one item per line,
with nesting taken from tabs, spaces, or list markers. Press Esc twice to
return focus to the tree; Tab then leaves the outline.

`shortcutHelp(platform)` returns this legend for help panels, and
`resolveKey` exposes the key map itself.

## Behavior

Nesting changes keep the outline visually stable. Outdenting an item keeps it
in place, and the siblings below it become its children. Return on an empty
last child outdents it, like a list. Return at the start of an item opens a
new item above it. Moving an item past the first or last child carries it into
the neighbouring branch at the same depth.

Arrow keys stay native inside wrapped text and only move to the next item from
the first or last visual line. The caret keeps its horizontal position as it
moves between items. Keys typed while a new item is still rendering are held
and replayed into it, so fast typing never lands in the wrong item.

Dragging shows a Mac-style insertion marker. The drop depth is clamped so a
drop never adopts the item below it. Dragging a selected item moves the whole
selection, and the view scrolls when the pointer nears the scroll container's
edges. Esc cancels a drag. Clicking a bullet hoists that item; the breadcrumb
path returns to its ancestors. Option- or Alt-click a disclosure triangle to
open or close every level below it.

Undo history keeps typing in one item together. Undo and redo restore the
caret, and they never refold the outline.

## Document operations

The DOM-independent operations are exported for hosts that edit outlines
directly: `indent`, `outdent`, `moveUp`, `moveDown`, `moveItems`, `split`,
`mergeIntoPrevious`, `mergeNext`, `setCollapsed`, `setAllCollapsed`,
`expandToLevel`, `visibleRows`, and `dropTarget`. `serializeOutline` writes
Markdown lists or tab-indented text, and `parseOutline` reads either back.

## Current limits

Items are plain text. There are no inline styles, notes, columns, or links,
and there is no virtualization, so very large outlines render every visible
row. Drag and drop uses the pointer; keyboard users move items with the move
shortcuts.
