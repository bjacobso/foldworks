# @foldworks/code-editor

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
