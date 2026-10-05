---
"@foldworks/outliner": minor
---

Explain text on hover. When the pointer rests on a character, the outliner
sends `Hovered` and asks the `hover` view input for the range it describes
and content built in the host's boundary; Ctrl+Shift+Space asks the same for
the caret, and Esc dismisses it. A decoration's `diagnostics` are underlined
and listed first in the hover popup. Import
`@foldworks/text-intelligence/styles.css` for the popup styles.
