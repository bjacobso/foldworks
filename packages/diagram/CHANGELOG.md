# @foldworks/diagram

## 0.2.0

### Minor Changes

- 7b60eb4: Require the tested Effect 4.1.1 and Foldkit 0.170.0 shared runtime peers,
  including @foldkit/ui 0.170.0. Remove the previous Effect peer exceptions.
- cec341d: Require the tested Effect 4.0.3 and Foldkit 0.168.0 shared runtime peers.
  Migrate renamed Foldkit APIs, textarea values, custom-event messages, and Effect
  AI imports. Update the re-exported headless UI APIs to @foldkit/ui 0.168.0.
  Preserve description linkage and supply the calendar format data required by
  the new headless APIs.
- 4aba469: Add generic document-analysis building blocks: positioned PDF text and explicit quote location, multi-region passage highlights, selectable PDF text and bounded viewport rendering, overlap-safe highlighted text and context snippets, read-only graph exploration, word/sentence prose diffs, citation previews, and per-cell grid tones.

### Patch Changes

- 6973c08: Exercise configuration review end to end in a persistent local reference host.
  Retain suggestion drafts through saves, read current replacement text on submit,
  restore composer focus after commit, and harden patch and highlight rendering.

  Use the current Foldkit subscription lifting API in the graph primitive.

## 0.1.0

### Minor Changes

- 80bd69a: Add compound directed-graph primitives: normalized documents with nesting,
  ports, cycles, and annotations; policy-driven immutable operations; layered and
  freeform layout strategies that produce a geometry-only scene; hit testing and
  coordinate helpers; and a Foldkit canvas interaction model for selection,
  dragging, connecting, panning, zoom, and keyboard nudging.

### Patch Changes

- 05217a5: Allow applications to supply compatible Effect, Foldkit, and StyleX versions
  through peer dependencies while keeping exact workspace build versions.
- 1015b7a: Emit declarations with TypeScript 7. The JavaScript is unchanged, and the
  public types are equivalent. The declaration files are laid out differently:
  local helpers are declared once and referenced with `typeof`, named aliases are
  reused, and union members may be ordered differently. The field records of
  `defineMessageUnion` schemas (`Message.X.fields`) no longer print `readonly` on
  some keys; the Message types themselves are identical.
