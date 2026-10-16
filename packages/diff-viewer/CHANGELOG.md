# @foldworks/diff-viewer

## 0.2.0

### Minor Changes

- cec341d: Require the tested Effect 4.0.3 and Foldkit 0.168.0 shared runtime peers.
  Migrate renamed Foldkit APIs, textarea values, custom-event messages, and Effect
  AI imports. Update the re-exported headless UI APIs to @foldkit/ui 0.168.0.
  Preserve description linkage and supply the calendar format data required by
  the new headless APIs.
- 6973c08: Map review anchors across revisions conservatively and expand supplied context
  with stale-gap validation; document outdated thread composition.
- 6973c08: Produce and serialize text diffs; add intraline markup, full-row line slots,
  annotations and a semantic highlighting hook.
- 6973c08: Compare decoded configuration values by path and array identity, render semantic
  value changes, and map UTF-16 diagnostics to diff annotations.
- 4aba469: Add generic document-analysis building blocks: positioned PDF text and explicit quote location, multi-region passage highlights, selectable PDF text and bounded viewport rendering, overlap-safe highlighted text and context snippets, read-only graph exploration, word/sentence prose diffs, citation previews, and per-cell grid tones.

### Patch Changes

- 6973c08: Exercise configuration review end to end in a persistent local reference host.
  Retain suggestion drafts through saves, read current replacement text on submit,
  restore composer focus after commit, and harden patch and highlight rendering.

  Use the current Foldkit subscription lifting API in the graph primitive.

- Updated dependencies [0f16fd8]
- Updated dependencies [0f16fd8]
- Updated dependencies [cec341d]
- Updated dependencies [1e3738e]
- Updated dependencies [4aba469]
- Updated dependencies [0f16fd8]
  - @foldworks/text-intelligence@0.1.0

## 0.1.0

### Minor Changes

- 64eb29c: Add a controlled unified and split diff renderer with patch parsing, aligned
  change blocks, syntax treatment, review markers, and mouse and keyboard range
  selection hooks for line-anchored comments.

### Patch Changes

- 05217a5: Allow applications to supply compatible Effect, Foldkit, and StyleX versions
  through peer dependencies while keeping exact workspace build versions.
