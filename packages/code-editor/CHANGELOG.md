# @foldworks/code-editor

## 0.2.0

### Minor Changes

- 7b60eb4: Require the tested Effect 4.1.1 and Foldkit 0.170.0 shared runtime peers,
  including @foldkit/ui 0.170.0. Remove the previous Effect peer exceptions.
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
- cec341d: Require the tested Effect 4.0.3 and Foldkit 0.168.0 shared runtime peers.
  Migrate renamed Foldkit APIs, textarea values, custom-event messages, and Effect
  AI imports. Update the re-exported headless UI APIs to @foldkit/ui 0.168.0.
  Preserve description linkage and supply the calendar format data required by
  the new headless APIs.

### Patch Changes

- Updated dependencies [7b60eb4]
- Updated dependencies [0f16fd8]
- Updated dependencies [0f16fd8]
- Updated dependencies [cec341d]
- Updated dependencies [1e3738e]
- Updated dependencies [4aba469]
- Updated dependencies [0f16fd8]
  - @foldworks/text-intelligence@0.1.0

## 0.1.0

### Minor Changes

- e071f6a: Add DescriptionList, Stat, Legend, and CodeBlock components; expand Badge, Tag,
  Progress, and Card presentation options; and expose read-only syntax highlighting
  from the code editor for CodeBlock consumers.
- 48b8206: Add a native Foldkit code editor with model-owned undo history, incremental lexical
  highlighting, visible-line rendering, find/replace, word suggestions, and JSON
  validation. Define shared document, operation, snapshot, and diagnostic contracts
  for future implementations, with version checks on external edits and selections.

### Patch Changes

- 48b8206: Add implementation-independent Effect Schema validation for JSON and YAML through
  the structured entry, with field-level diagnostics and YAML syntax highlighting.
- 05217a5: Allow applications to supply compatible Effect, Foldkit, and StyleX versions
  through peer dependencies while keeping exact workspace build versions.
- 1015b7a: Emit declarations with TypeScript 7. The JavaScript is unchanged, and the
  public types are equivalent. The declaration files are laid out differently:
  local helpers are declared once and referenced with `typeof`, named aliases are
  reused, and union members may be ordered differently. The field records of
  `defineMessageUnion` schemas (`Message.X.fields`) no longer print `readonly` on
  some keys; the Message types themselves are identical.
