# @foldworks/text-intelligence

## 0.1.0

### Minor Changes

- cec341d: Require the tested Effect 4.0.3 and Foldkit 0.168.0 shared runtime peers.
  Migrate renamed Foldkit APIs, textarea values, custom-event messages, and Effect
  AI imports. Update the re-exported headless UI APIs to @foldkit/ui 0.168.0.
  Preserve description linkage and supply the calendar format data required by
  the new headless APIs.
- 1e3738e: Add reusable plain-text mention/tag recognition, host entity lookup, configurable syntax exclusions, completions, diagnostics and shared hover presentation. Normalize completion matching to NFC and retain exact-prefix suggestions when a replacement still has a suffix.

  Add generic synchronous inline text-intelligence hooks to the native editor, using the existing shared popups and editor-owned transactions, selection, composition, and history. Preserve explicitly escaped Markdown markers with an additive literal run mark; consumers decoding the previous mark union need to recognize literal marks when reading documents with escapes.

  Suspend outliner completion and hover during native composition, and commit the finished text before offering suggestions.

- 4aba469: Add generic document-analysis building blocks: positioned PDF text and explicit quote location, multi-region passage highlights, selectable PDF text and bounded viewport rendering, overlap-safe highlighted text and context snippets, read-only graph exploration, word/sentence prose diffs, citation previews, and per-cell grid tones.
- 0f16fd8: Add `@foldworks/text-intelligence`, the shared vocabulary for language
  features on Foldkit text surfaces: `TextRange`, `SemanticToken`, `Diagnostic`,
  and `CompletionItem` schemas; pure completion lists that narrow, track edits,
  and accept items; `segments` for painting text with several range layers;
  DOM geometry for painted text; and `CompletionPopup` and `HoverPopup` views
  anchored in text, with a plain-CSS stylesheet.

### Patch Changes

- 0f16fd8: Plug a language service into the code editor. `SetSemanticTokens` paints a
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
- 0f16fd8: Suggest completions at the caret. Ctrl+Space sends `RequestedCompletion`, and
  a host offers items for a range of an item's text with `ShowCompletions`,
  asked or unasked. While suggestions show they claim ↑, ↓, Return, Tab, and
  Esc ahead of the outline's keys; typing narrows them, and accepting replaces
  the range as one undoable step with held keys replayed after it. Completion
  lists now leave out an item that matches what is typed exactly, and popups
  stay inside clipping ancestors. Keys typed faster than the outline renders are no longer
  overwritten by a render that lags behind them.
