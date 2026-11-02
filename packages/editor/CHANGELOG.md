# @foldworks/editor

## 0.2.0

### Minor Changes

- 7b60eb4: Require the tested Effect 4.1.1 and Foldkit 0.170.0 shared runtime peers,
  including @foldkit/ui 0.170.0. Remove the previous Effect peer exceptions.
- cec341d: Require the tested Effect 4.0.3 and Foldkit 0.168.0 shared runtime peers.
  Migrate renamed Foldkit APIs, textarea values, custom-event messages, and Effect
  AI imports. Update the re-exported headless UI APIs to @foldkit/ui 0.168.0.
  Preserve description linkage and supply the calendar format data required by
  the new headless APIs.
- 1e3738e: Add reusable plain-text mention/tag recognition, host entity lookup, configurable syntax exclusions, completions, diagnostics and shared hover presentation. Normalize completion matching to NFC and retain exact-prefix suggestions when a replacement still has a suffix.

  Add generic synchronous inline text-intelligence hooks to the native editor, using the existing shared popups and editor-owned transactions, selection, composition, and history. Preserve explicitly escaped Markdown markers with an additive literal run mark; consumers decoding the previous mark union need to recognize literal marks when reading documents with escapes.

  Suspend outliner completion and hover during native composition, and commit the finished text before offering suggestions.

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
