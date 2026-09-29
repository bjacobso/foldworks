# @foldworks/query-builder

## 0.2.0

### Minor Changes

- a3e6a8e: Redesign the query builder with a denser rail layout, AND/OR group selectors, and a plain-language summary. The read-only view now leads with the summary sentence and shows the structured logic in a disclosure. Nested groups can be dragged between groups alongside rules via `moveNode` and `applyNodeReorder`.

## 0.1.1

### Patch Changes

- 05217a5: Allow applications to supply compatible Effect, Foldkit, and StyleX versions
  through peer dependencies while keeping exact workspace build versions.
- 1015b7a: Emit declarations with TypeScript 7. The JavaScript is unchanged, and the
  public types are equivalent. The declaration files are laid out differently:
  local helpers are declared once and referenced with `typeof`, named aliases are
  reused, and union members may be ordered differently. The field records of
  `defineMessageUnion` schemas (`Message.X.fields`) no longer print `readonly` on
  some keys; the Message types themselves are identical.
- Updated dependencies [6e05824]
- Updated dependencies [c7b54c5]
- Updated dependencies [ff6f731]
- Updated dependencies [4db505c]
- Updated dependencies [61cf008]
- Updated dependencies [e071f6a]
- Updated dependencies [473c187]
- Updated dependencies [3227682]
- Updated dependencies [05759a5]
- Updated dependencies [69b5b21]
- Updated dependencies [e768f17]
- Updated dependencies [a974220]
- Updated dependencies [140b35f]
- Updated dependencies [c049320]
- Updated dependencies [398d432]
- Updated dependencies [de1cbea]
- Updated dependencies [05217a5]
- Updated dependencies [c42f7c0]
- Updated dependencies [7c9ef65]
- Updated dependencies [1a632ef]
- Updated dependencies [15f9d0a]
- Updated dependencies [1015b7a]
  - @foldworks/ui@0.2.0

## 0.1.0

### Minor Changes

- Publish the initial Foldworks package suite with controlled Foldkit behavior, StyleX styling, themeable UI components, and application primitives for data grids, forms, queries, workflows, navigation, document history, and PDF annotation.

### Patch Changes

- Updated dependencies
  - @foldworks/ui@0.1.0
