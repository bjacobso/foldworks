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
// For hover and suggestion popups:
import "@foldworks/text-intelligence/styles.css";

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
`showBreadcrumbs`, `emptyLabel`, and `spellcheck`.

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

## Decorations and host edits

Hosts that give items meaning, such as tags, mentions, or code, can style the
text without taking over editing. `decorations` maps item ids to spans that
spell the item's text exactly; they are painted beneath a transparent
textarea, so the caret, selection, and input stay native, and each span's
`kind` becomes a `data-kind` for the host's stylesheet. Spans that no longer
match the text, for example in the middle of a keystroke, are ignored. A
decoration's `tone` becomes `data-tone` on the row. A `marker` replaces the
bullet with text, such as a status glyph or an opening bracket, and still drags
and hoists. A `suffix` paints styled runs after the text that are not part of
its value, such as a count or closing brackets. `rowAccessory` builds
trailing content for each row, in the host's boundary, so its handlers send
the host's messages.

```ts
viewInputs: {
  label: "Program",
  spellcheck: false,
  decorations: { [id]: { spans: [{ text: "defn", kind: "keyword" }, { text: " total" }], tone: "warning" } },
  rowAccessory: (row) => h.span([], [valueOf(row.id)]),
}
```

## Hover and diagnostics

A host that knows what words mean, such as a language service or a list of
people for mentions, can explain them. When the pointer rests on a character,
the outliner sends `Hovered({ target: { id, offset } })` and asks the `hover`
view input. It returns the range it describes and content built in the host's
boundary, or `null`:

```ts
viewInputs: {
  hover: ({ id, offset, text, source }) => {
    const word = wordAt(text, offset);
    return word === undefined
      ? null
      : { from: word.from, to: word.to, content: h.p([], [describe(word.text)]) };
  },
}
```

The popup anchors to the range and underlines it, and it stays while the
pointer is on the range or inside the popup, so its links can be clicked.
Ctrl+Shift+Space asks for the same information at the caret; `source` is then
`"Keyboard"`, and the textarea is described by the popup until the caret moves
or Esc dismisses it. A host with an asynchronous service starts its lookup
when it sees `Hovered` and renders a loading state until the answer arrives.

A decoration's `diagnostics` are problems with ranges of the text, in the
shape of `@foldworks/text-intelligence`'s `Diagnostic`. They are drawn as wavy
underlines and listed first in the hover popup, so a host that only reports
problems gets their messages on hover without a `hover` input.

## Completion

The outliner shows suggestions at the caret, and the host decides when and
what. Ctrl+Space sends `RequestedCompletion({ id, start, end })`. The host
answers with `ShowCompletions({ id, from, to, items })`, where `from` and `to`
are the text the chosen item replaces and `items` are
`@foldworks/text-intelligence` `CompletionItem`s. A host can also offer
suggestions unasked, for example when it sees `EditedText` after an `@`:

```ts
GotOutlinerMessage: ({ message }) => {
  const result = foldOutliner(model, message);
  const offer = message._tag === "RequestedCompletion" ? lookUp(message.id, message.end) : undefined;
  return offer === undefined
    ? result
    : foldOutliner(result.model, Outliner.Message.ShowCompletions({ id: message.id, ...offer }));
},
```

An offer is ignored unless the caret is in that item and inside the range.
While suggestions show, ↑ and ↓ choose one, Return or Tab accepts it, and Esc
puts them away. Those keys are taken before the outline's own, so Return never
splits an item under open suggestions. Typing narrows the list by the text
between `from` and the caret; it closes when nothing matches, when the caret
moves off the word, or when the outline does anything else. An item that
matches what is typed exactly is left out, so a finished word leaves Return to
start the next item. Accepting replaces the range as one undoable step, and
keys typed before the caret settles are replayed after the insertion.

`Outliner.Message.Replace({ items, announcement, coalescingKey })` applies an
edit the host computed, such as a refactoring or text typed in another view,
as one undoable step. Focus stays put, and replacements with the same
`coalescingKey` undo together. `Outliner.Message.Reveal({ id })` expands an
item's ancestors, leaves a hoist that hides it, and puts the caret at its end.

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
| ⌃Space (Ctrl+Space)                        | Suggest completions                                   |
| ⌃⇧Space (Ctrl+Shift+Space)                 | Show information about the text at the caret          |

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
`expandToLevel`, `visibleRows`, and `dropTarget`, along with the tree helpers
`find`, `locate`, `ancestors`, `isWithin`, `childrenOf`, `updateItem`,
`insertItems`, and `removeItems`. `serializeOutline` writes
Markdown lists or tab-indented text, and `parseOutline` reads either back.

## Current limits

Items are plain text. Decorations can color it, but the document itself has no
inline styles, notes, columns, or links, and there is no virtualization, so very large outlines render every visible
row. Drag and drop uses the pointer; keyboard users move items with the move
shortcuts.
