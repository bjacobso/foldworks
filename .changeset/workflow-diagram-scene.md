---
"@foldworks/workflow": minor
---

Build the structured workflow layout on the `@foldworks/diagram` scene
contract. `StructuredWorkflowLayout` is now a `DiagramScene` with workflow
overlays: `connectors` is renamed to `edges`, nodes carry scene metadata, and
the layout reports `bounds`. Add `toDiagramDocument` to flatten nested flows
into a normalized diagram with sequence, branch, and merge edges.
