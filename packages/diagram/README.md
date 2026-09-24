# @foldworks/diagram

Compound directed-graph primitives for Foldkit applications. Use it to build
workflow editors, state-machine visualizers, dependency graphs, or any canvas
where nodes nest, connect, and sit beside free-form notes.

The package is layered so each piece can be used alone:

| Layer       | Exports                                                                               |
| ----------- | ------------------------------------------------------------------------------------- |
| Document    | `DiagramDocument`, `DocumentSchema`, graph queries, `validateDocument`                |
| Operations  | `createDiagramOperations(policy)` for immutable edits with adapter rules              |
| Layout      | `createLayeredLayout`, `createFreeformLayout`, `createSceneLayout`, `routeEdges`      |
| Scene       | `DiagramScene`, `LayoutStrategy`, hit testing, coordinate conversion                  |
| Interaction | `Diagram` — a Foldkit submodel for selection, dragging, connecting, panning, and zoom |

## Documents

A document is normalized: nodes, edges, and annotations are flat arrays.
Nesting uses `parentId`, so a compound state, a group, or a subflow is just a
node with children. Positions are relative to the parent's content origin; a
node with a `position` is pinned, and layouts place the rest.

```ts
type DiagramDocument<NodeData, EdgeData, AnnotationData = NoteData> = {
  nodes: ReadonlyArray<{ id; parentId?; data; position?; size?; ports? }>;
  edges: ReadonlyArray<{ id; source: Endpoint; target: Endpoint; data }>;
  annotations: ReadonlyArray<{ id; parentId?; position?; size?; attachedTo?; data }>;
};
```

Cycles and self-loops are valid. Adapters that need a DAG opt in with
`allowCycles: false`, or check `wouldCreateCycle` and `topologicalOrder`.

## Operations and policy

`createDiagramOperations` returns immutable edits that return `undefined`
when a change is rejected. The policy decides what is legal for your domain:

```ts
const operations = createDiagramOperations<StateData, TransitionData, NoteData>({
  canNest: (_document, child, parent) => parent === undefined || parent.data.kind === "compound",
  canConnect: (_document, source) => source.data.kind !== "final",
  canDelete: (node) => node.data.kind !== "initial",
});

operations.reparentNode(document, "billing", "details", { x: 0, y: 80 });
operations.removeElements(document, ["details"]); // cascades to children and edges
```

## Layout strategies

A layout strategy is any `(document) => DiagramScene`. The scene holds
absolute geometry keyed by document ids and never contains semantic data.

- `createLayeredLayout` ranks each container independently after reversing
  feedback edges, orders ranks with barycenter sweeps, and sizes containers
  around their children. It supports `Down` and `Right` directions.
- `createFreeformLayout` uses pinned positions and fills a grid for the rest.
- `createSceneLayout(config, placer)` accepts your own child placer while
  reusing measurement, nesting, ports, and edge routing.

Edges route as straight, curved, or orthogonal paths. Parallel and opposing
edges fan out, and self-loops curl off the node's corner. Use `pathForPoints`
or `smoothPathForPoints` to draw them.

## Interaction

`Diagram` is a Foldkit submodel. It owns the viewport, selection, and the
active gesture; the document stays in your model and changes through
OutMessages.

```ts
const Model = S.Struct({ document: MachineDocument, canvas: Diagram.Model });

// view
h.div([...Diagram.canvasAttributes({ model: model.canvas, toParentMessage }, h)], [
  h.div([h.Style({ transform: Diagram.worldTransform(model.canvas) })], [
    ...nodes.map((node) => h.div([
      ...Diagram.elementAttributes({
        model: model.canvas,
        toParentMessage,
        id: node.id,
        anchor: rectCenter(node),
      }, h),
    ], [/* content */])),
  ]),
]);

// update
Diagram.OutMessage.match(outMessage, {
  MovedElements: ({ ids, deltaX, deltaY, dropX, dropY }) => { /* pin or reparent */ },
  RequestedConnection: ({ source, x, y }) => { /* nodeAt(scene, { x, y }) */ },
  RequestedDelete: ({ ids }) => { /* operations.removeElements */ },
  ...
});
```

Lift `Diagram.subscriptions` so pointer movement and Escape are tracked while
a gesture is active. `maybeDragPreview` and `maybeConnectionPreview` expose
in-flight gestures so the view can re-run the layout with preview positions.
Drop points are reported in world coordinates; resolve them with `nodeAt`,
`toRelative`, and `relativePosition`.

Arrow keys nudge the selection, Shift moves ten units, Delete and Backspace
request removal, and Enter activates the focused element.
