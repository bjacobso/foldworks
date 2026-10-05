# @foldworks/text-intelligence

The shared vocabulary for language features on Foldkit text surfaces: hover,
completion, semantic highlighting, and diagnostics. `@foldworks/outliner` rows
use it, and a host can plug one language service, or one mention and tag
lookup, into every surface that does.

The package does not call a language service. Surfaces report what the user
is asking about, such as the character under the pointer or a request for
suggestions at the caret, and the host answers with the data described here.
A synchronous host answers in the same update or in its view; an asynchronous
one answers when its result arrives. See
[Language workbench primitives](../../docs/language-workbench.md) for the
reasoning.

```ts
import { Completion, type Diagnostic } from "@foldworks/text-intelligence";
import "@foldworks/text-intelligence/styles.css";
```

Import the stylesheet once, beside the stylesheet of each surface that shows
popups. Colors come from the `@foldworks/ui` semantic tokens, with fallbacks.

## Vocabulary

All offsets are UTF-16 code units with an exclusive `to`, relative to the text
a surface addresses: one item's text in an outline, or a whole document.

| Schema           | Shape                                             |
| ---------------- | ------------------------------------------------- |
| `TextRange`      | `{ from, to }`                                    |
| `SemanticToken`  | `{ from, to, kind }`; `kind` becomes `data-kind`  |
| `Diagnostic`     | `{ from, to, severity, message, code? }`          |
| `CompletionItem` | `{ label, insert?, detail?, kind?, filterText? }` |

`severity` is `error`, `warning`, `info`, or `hint`. `diagnosticsAt` and
`mostSevere` select the diagnostics for an offset. A hover answer is
`{ from, to, content }`, where `content` is Html built in the host's view, so
it can hold links that send the host's messages.

## Completion lists

`Completion.List` is an open list: the range it replaces, its items, and the
active index. Surfaces keep it in their models and use the pure helpers:

- `matching(items, query)` keeps items whose `filterText` or `label` contains
  the query, case-insensitively, with prefix matches first.
- `visible(list, text, caret)` narrows by the text typed since `from`, and is
  empty once the caret leaves the range.
- `track(list, before, after, caret)` carries a list through an edit; typing
  at the end of the range extends it.
- `move` wraps the active index, and `accept` returns the text and caret after
  inserting an item.
- `wordBefore(text, offset, pattern?)` finds the word a completion replaces.

## Painting and geometry

`segments(text, layers)` splits a text wherever a range in any layer begins
or ends, so a surface paints each piece once with everything that covers it.
`offsetAtPoint`, `rectAtOffset`, and `rangeRects` measure painted text with
DOM ranges, skipping elements marked `data-text-skip`. Surfaces use them to
find the character under the pointer and to anchor popups.

`CompletionPopup.view` and `HoverPopup.view` render the shared popups,
anchored to an offset in painted text. The completion popup never takes focus
from the text; the surface keeps the caret, claims the keys, and points
`aria-activedescendant` at `optionId(listId, index)`. The hover popup lists
diagnostics before the host's content. `.fw-text-diagnostic` with
`data-severity` draws a wavy underline, and `.fw-text-hovered` marks the range
a hover describes.
