# @foldworks/review

## 0.2.0

### Minor Changes

- 7b60eb4: Require the tested Effect 4.1.1 and Foldkit 0.170.0 shared runtime peers,
  including @foldkit/ui 0.170.0. Remove the previous Effect peer exceptions.
- 6973c08: Add changed-file navigation, checks, merge requirements and change-request
  headers. Extend checkable Tree composition and timeline activity body slots.
- 6973c08: Add checked, atomic suggested changes, pending comment display, controlled
  review submission and reviewer status views.
- 6973c08: Add generic review-thread schemas, acknowledged drafts, mutation out-messages,
  accessible thread, composer and grouped list views.

### Patch Changes

- 6973c08: Map review anchors across revisions conservatively and expand supplied context
  with stale-gap validation; document outdated thread composition.
- 6973c08: Exercise configuration review end to end in a persistent local reference host.
  Retain suggestion drafts through saves, read current replacement text on submit,
  restore composer focus after commit, and harden patch and highlight rendering.

  Use the current Foldkit subscription lifting API in the graph primitive.

- Updated dependencies [7b60eb4]
- Updated dependencies [cec341d]
- Updated dependencies [6973c08]
- Updated dependencies [6973c08]
- Updated dependencies [6973c08]
- Updated dependencies [6973c08]
- Updated dependencies [6973c08]
- Updated dependencies [0d75dc8]
- Updated dependencies [4aba469]
- Updated dependencies [0f16fd8]
- Updated dependencies [0f16fd8]
  - @foldworks/diff-viewer@0.2.0
  - @foldworks/ui@0.3.0
