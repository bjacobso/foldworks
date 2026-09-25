# @foldworks/workflow

## 0.2.0

### Minor Changes

- 80bd69a: Build the structured workflow layout on the `@foldworks/diagram` scene
  contract. `StructuredWorkflowLayout` is now a `DiagramScene` with workflow
  overlays: `connectors` is renamed to `edges`, nodes carry scene metadata, and
  the layout reports `bounds`. Add `toDiagramDocument` to flatten nested flows
  into a normalized diagram with sequence, branch, and merge edges.

### Patch Changes

- 05217a5: Allow applications to supply compatible Effect, Foldkit, and StyleX versions
  through peer dependencies while keeping exact workspace build versions.
- Updated dependencies [80bd69a]
- Updated dependencies [05217a5]
  - @foldworks/diagram@0.1.0

## 0.1.0

### Minor Changes

- Publish the initial Foldworks package suite with controlled Foldkit behavior, StyleX styling, themeable UI components, and application primitives for data grids, forms, queries, workflows, navigation, document history, and PDF annotation.
