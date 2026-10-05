# Language workbench primitives

A language workbench needs editing surfaces that a language service can plug
into: hover, completion, highlighting, and diagnostics on text; structure
that the language can constrain; and views for reviewing proposed changes and
inspecting values. This note decides which of those Foldworks owns and the
contracts it exposes. The first consumer is a Forma workbench built in the
Forma repository. Nothing here names Forma, Lisp, or any language. Each piece
must also serve a non-language host, such as notes with tags and mentions, a
query or configuration editor, or a form or workflow review.

The `/lisp` exploration ([Structural Lisp](./structural-lisp.md)) is the proof:
it adopts every primitive below that has an interactive surface.

## Principles

- **Surfaces own geometry, focus, and keys. Hosts own meaning and policy.** An
  outliner knows where the pointer is, where the caret is, and which keys it has
  claimed. Only the host knows what a token means, which completions apply, and
  which moves are legal.
- **Requests go out; answers come back as data.** A surface reports what the
  user is asking about (a hover position, a completion request). The host
  answers with plain data, tagged so that a stale answer can be recognized.
  This works the same whether the language service is synchronous, in a
  worker, or in another process.
- **Synchronous hosts pay nothing for that.** A host that can answer at once
  does so in the same update, or computes the answer in its view. The `/lisp`
  demo analyzes in-process and never waits.
- **Content is the host's Html.** Hover content and custom views are built in
  the host's view with the host's messages, like `rowAccessory` today. A
  surface frames, positions, and dismisses them.
- **Models stay serializable.** Functions such as policies and renderers are
  passed to `view` and `update` as arguments, following `Tree`'s `canMove`; they
  never enter a model.

## One vocabulary, not one provider object

Hover, completion, semantic highlighting, and diagnostics should share a
contract across outliner rows and the code editor. A workbench plugs one
language service into both, and a reader expects the same popup and the same
keys in both.

The shared contract is a vocabulary and a protocol, not a provider interface
with methods, for three reasons:

1. The four features have different timing. Highlighting and diagnostics are
   pushed after each change, for a whole text. Hover and completion are pulled
   at a point, on a user gesture, and can be cancelled by the next keystroke.
   One `provide(...)` object would hide that difference instead of modeling it.
2. A provider object would have to be called from somewhere. Called in a view,
   it cannot be asynchronous. Called in a command, every synchronous host pays
   a round trip. Requests and answers let each host choose.
3. Surfaces address text differently: the code editor by document offset, the
   outliner by item and offset. The shared part is what happens inside one
   text, which is where the vocabulary lives.

A new package, `@foldworks/text-intelligence`, holds that vocabulary and the
presentation both surfaces share. It has no dependencies besides Effect and
Foldkit and uses plain CSS with the `@foldworks/ui` tokens, like the outliner.

| Export                          | Purpose                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `TextRange`, `SemanticToken`    | `{ from, to }` in UTF-16 offsets, and a range with an open `kind` string for `data-kind`       |
| `Diagnostic`                    | `{ from, to, severity, message, code? }`, the code editor's existing shape, now shared         |
| `CompletionItem`                | `{ label, insert?, detail?, kind?, filterText? }`                                              |
| `Completion`                    | An open list: the range it replaces, its items, and the active index; filtering and acceptance |
| `segments`                      | Splits a text at the boundaries of several range layers, for painting                          |
| `offsetAtPoint`, `rectAtOffset` | Text geometry over a painted mirror element, using DOM ranges                                  |
| `CompletionPopup`, `HoverPopup` | The shared popup views and stylesheet                                                          |

The code editor re-exports `Diagnostic` from it, so its public shape does not
change. A host writes one adapter from its language service to these types and
uses it on both surfaces.

`@foldworks/ui`'s `HoverCard` wraps its trigger element, so it cannot anchor to
a span of text inside a textarea. The surfaces render `HoverPopup` themselves,
anchored to the hovered range.

## Outliner

### Hover

The outliner reports the item and offset under the pointer after a short
dwell, as `Hovered({ target: { id, offset } | null })`. A host renders hover
content through a view input:

```ts
hover: ({ id, offset, text }) => ({ from, to, content: h.div([], [...]) }) | null
```

The returned range is what the popup anchors to and underlines, and moving the
pointer within it does not re-request. Row diagnostics at the offset are shown
above the host's content, so a host with only diagnostics gets messages on
hover for free. Ctrl+Shift+Space shows the same popup for the caret, so the
information is reachable from the keyboard; Esc dismisses it. An asynchronous
host starts its lookup when it sees `Hovered` and renders a loading state until
the answer arrives.

### Diagnostics in rows

`RowDecoration` gains `diagnostics: Diagnostic[]`, painted as wavy underlines
in the mirror beneath the text. Like `spans`, they describe the text the host
was given. `tone` stays for row-level state.

### Completion

The outliner owns the popup, its position at the start of the replaced range,
keyboard navigation, and the edit that accepts an item. The host owns when to
offer and what:

- Ctrl+Space sends `RequestedCompletion({ id, start, end })`. A host may also
  offer completions on its own, for example when it sees `EditedText` after a
  word character or an `@`.
- The host sends `ShowCompletions({ id, from, to, items })`. The offer is
  dropped if the caret is no longer in that item and range.
- While the popup is open, ↑ ↓ move, Return or Tab accept, and Esc dismisses.
  Those keys are claimed before the outliner's key map, so Return never splits
  the item under an open popup. Typing narrows the list by the text between
  `from` and the caret; the popup closes when nothing matches or the caret
  leaves the range.
- Accepting replaces the range as one undoable step and puts the caret after
  the inserted text. Keys typed before that caret is restored are held and
  replayed, like every other focus-moving action.

The textarea carries `aria-autocomplete`, `aria-controls`, and
`aria-activedescendant` for the listbox, and the count is announced.

### Placeholder rows

A placeholder is a ghost child, such as “+ trigger” or “+ add step”, that is
not part of the document. Hosts supply them per parent:

```ts
placeholders: (parentId) => [{ key: "steps", label: "add step", text: "" }];
```

`index` places a placeholder among the real children; the default is last.
Placeholders appear only under expanded parents. Arrow keys move into and out
of them like rows. Typing into one, pressing Return on it, or clicking its
marker sends `FilledPlaceholder({ parentId, index, key, text })`, which creates
a real item with the placeholder's `text` plus anything typed, and puts the
caret in it as one undoable step. Keys typed while the new item renders are
held and replayed into it. A host that wants more, such as completions in the
new item, reacts to the same message.

They are not items: selection, drag and drop, undo snapshots, and `revision`
ignore them, and they are `treeitem`s without a set position.

### Move validation and read-only rows

Both are policy, so both are functions passed to `view` and to `update`, the
way `Tree` takes `canMove`:

```ts
const policy = { canMove, isReadOnly };
update: (outline, message) => Outliner.update(outline, message, policy),
viewInputs: { ...policy, label: "Program" },
```

- `canMove({ cause, ids, before, after })` sees the whole document before and
  after an indent, outdent, move, or drop, because an outdent also reparents
  the siblings it adopts. `reparented(before, after)` lists every item whose
  parent changed, which is what most rules check. A refused keyboard move does
  nothing and is announced. While dragging, a refused depth falls back to the
  nearest allowed depth for the same gap; if none is allowed, the insertion
  marker and the drag ghost show that the drop is refused, and releasing does
  nothing.
- `isReadOnly(item)` marks items whose text, done state, parent, and children
  the user cannot change. Their text is a read-only textarea, so the caret,
  selection, copy, folding, and hoisting still work. Edits that would change
  them, including deleting an ancestor, merging into them, or adopting them
  through an outdent, are refused as a whole and announced. Host edits through
  `Replace` and `Load` are not checked; the host is the authority.

Both checks run on the document, in `update`, so they also cover messages a
host or test dispatches directly.

### Custom row views: designed, not built

A host could render an item's subtree as its own view, such as a workflow as a
diagram. The design that fits the outliner:

- `rowView(row)` returns `{ label, content }` for items rendered this way, and
  `policy.hasView(item)` tells `update` the same thing, because navigation,
  selection, and drop targets must treat the item's descendants as hidden.
- The item's own row stays, with editable text. Its children are replaced by
  one `role="group"` region inside the treeitem, labeled by `label`. ↓ from the
  row focuses the region; inside it the host's view handles keys; Esc returns
  to the row; ↑ and ↓ at the region's edges continue to neighboring rows.
- The view edits the subtree through `Replace`, so undo, diff, and persistence
  work unchanged.

It is not built yet because no consumer needs it before the workbench exists,
and the keyboard contract for leaving an arbitrary host view needs a real view
to test against. The `/lisp` workflow is the intended first use.

### Virtualization: designed, not built

Rows wrap, so their heights vary. The design: render the rows inside the
scroll viewport plus overscan between two spacers, cache measured heights by
item id with an estimate for unmeasured rows, always render the focused row and
the drag source, and scroll a row into view before focusing it. Drop targets
come from row geometry and would use cached positions for rows that are not
rendered. It is deferred because the outliner's `/lisp` and notes uses stay in
the hundreds of rows, and the cost lands mostly in the focus and drag code,
which should not change without a large-outline workload to test it.

## Code editor

- **Highlighting.** `Operation.SetSemanticTokens({ uri, session, revision,
tokens })` paints token kinds over the built-in lexer, as `data-kind`. Like
  `SetDiagnostics`, a batch for another revision is ignored. Unlike
  diagnostics, accepted tokens are mapped through later edits until the next
  batch, so highlighting does not flicker while an asynchronous service catches
  up. A synchronous host sends tokens in the same update as `ChangedDocument`.
  Tokens cover any language, so a pluggable lexer is not added: a lexer would be
  a function the serializable model cannot hold, and tokens already do its job.
- **Hover.** `OutMessage.Hovered({ version, offset, source })`, and `hover` in
  the view config with the same `{ from, to, content }` answer as the outliner.
  Diagnostics show in the popup as well as in the problems list.
- **Completion.** `OutMessage.RequestedCompletion({ version, offset })` and
  `Operation.ShowCompletions({ expected, from, to, items })`, with the same
  popup, keys, and filtering as the outliner. `Options.suggestions` chooses
  `"words"`, today's word list and the default, or `"host"`, which shows only
  host items.
- **External range highlighting.** `highlights: [{ from, to, kind? }]` in the
  view config paints ranges another view corresponds to, and
  `Operation.Reveal({ expected, range })` scrolls one into view without moving
  focus or the selection.

These additions go in the shared `ViewConfig`, `Operation`, and `OutMessage`
contracts, since they do not depend on the native implementation.

## Inspection and review

- **Tree diff.** `diffTrees(before, after)` compares two forests of
  `{ id, label, children }` and classifies each node as added, removed, moved,
  edited, or unchanged. A node is moved when its parent changes or when it
  falls outside the longest run of siblings that kept their order, so
  reorderings are reported minimally. Removed nodes appear at their old
  position. `TreeDiff.view` shows only changed nodes, their ancestors, and one
  row of context, and folds other unchanged runs into “N unchanged”. It lives in
  `@foldworks/ui` beside `ChangeSetPreview`, not inside it: a structural diff is
  one kind of change, and `ChangeSetPreview` gains a `content` slot to hold it
  next to consequences and actions. Inside an `@foldworks/agent` permission
  checkpoint it renders through `renderDetails`, and `PermissionPresentation`
  gains `allowLabel` and `denyLabel` so a proposal reads “Accept” and
  “Discard” rather than “Allow once” and “Deny”.
- **Value tree.** `ValueTree` in `@foldworks/ui` shows nested values with
  keys, previews, and kinds as a keyboard-navigable tree. The host supplies
  nodes; a node may be `expandable` without children, and expanding it sends
  `RequestedChildren({ id })`, so values can live behind handles in another
  process. A partly loaded node shows “Show N more”, which sends
  `RequestedMore`. `ValueTree.fromValue` builds nodes from plain values for
  hosts that have them locally. This closes the structured-payload gap in
  [WorldVM developer tools](./worldvm-devtools.md#gaps).
- **Step-through.** `Stepper` is a journey of a few steps and
  `TransactionTimeline` is a read-only history; neither marks a current entry
  that the reader moves. The smallest missing piece is a current entry:
  `TransactionTimeline` gains `currentId` and `onSelect`, which mark the entry
  with `aria-current` and make it selectable. A host steps through a trace by
  pairing it with previous and next buttons and painting the current
  expression with outliner decorations or code editor `highlights`. A dedicated
  scrubber for long traces waits for a second use.

## Sequence

Each item lands as its own pull request, with a changeset, tests, and the
`/lisp` adoption that proves it:

1. `@foldworks/text-intelligence`, outliner hover, and row diagnostics
2. Outliner completion
3. Outliner placeholder rows
4. Code editor semantic tokens, hover, completion, and highlights; `/lisp`'s
   source pane moves onto the code editor
5. `TreeDiff`, the `ChangeSetPreview` slot, and agent permission labels
6. `ValueTree`
7. Outliner move validation and read-only rows
8. `TransactionTimeline` current entry

Custom row views and virtualization are designed above and deferred.
