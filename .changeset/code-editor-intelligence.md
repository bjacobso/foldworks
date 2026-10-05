---
"@foldworks/code-editor": minor
"@foldworks/text-intelligence": patch
---

Plug a language service into the code editor. `SetSemanticTokens` paints a
host's token kinds over the lexer and carries them through edits until the next
batch. `RequestedCompletion` and `ShowCompletions` let a host supply
suggestions, shown at the caret in the shared popup, and the `suggestions: "host"`
option turns word suggestions off. The `hover` view config explains the text
under the pointer, or at the caret with Ctrl+Shift+Space, with diagnostics
listed first. The `highlights` view config and the `Reveal` operation show the
range another view corresponds to. `ApplyEdits` now leaves focus and scrolling
alone, and mounting keeps diagnostics from other sources. `Diagnostic` is now
the shared `@foldworks/text-intelligence` schema, with the same shape. Text
popups are fixed to the viewport, so clipping containers no longer cut them off.
