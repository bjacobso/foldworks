# @foldworks/editor

## 0.1.0

### Minor Changes

- 75f885a: Add a native Foldkit rich-text editor with immutable document transactions,
  selection and undo history, Markdown import/export and source editing, top-level
  block movement, and application-defined Foldkit block views.

### Patch Changes

- 05217a5: Allow applications to supply compatible Effect, Foldkit, and StyleX versions
  through peer dependencies while keeping exact workspace build versions.
- 1015b7a: Emit declarations with TypeScript 7. The JavaScript is unchanged, and the
  public types are equivalent. The declaration files are laid out differently:
  local helpers are declared once and referenced with `typeof`, named aliases are
  reused, and union members may be ordered differently. The field records of
  `defineMessageUnion` schemas (`Message.X.fields`) no longer print `readonly` on
  some keys; the Message types themselves are identical.
