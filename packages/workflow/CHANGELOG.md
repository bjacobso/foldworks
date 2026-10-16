# @foldworks/workflow

## 0.3.0

### Minor Changes

- cec341d: Require the tested Effect 4.0.3 and Foldkit 0.168.0 shared runtime peers.
  Migrate renamed Foldkit APIs, textarea values, custom-event messages, and Effect
  AI imports. Update the re-exported headless UI APIs to @foldkit/ui 0.168.0.
  Preserve description linkage and supply the calendar format data required by
  the new headless APIs.

### Patch Changes

- Updated dependencies [cec341d]
- Updated dependencies [6973c08]
- Updated dependencies [4aba469]
  - @foldworks/diagram@0.2.0

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
- Updated dependencies [1015b7a]
  - @foldworks/diagram@0.1.0

## 0.1.0

### Minor Changes

- Publish the initial Foldworks package suite with controlled Foldkit behavior, StyleX styling, themeable UI components, and application primitives for data grids, forms, queries, workflows, navigation, document history, and PDF annotation.
