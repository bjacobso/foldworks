# Foldkit workflow

Internal structured-workflow primitives for Foldkit applications.

The package owns:

- recursive flows and branch-aware immutable operations;
- stable flow locations for inserting and moving elements;
- a deterministic orthogonal layout with derived connectors, labels, junctions,
  and insertion targets;
- a workflow-specific facade over Foldkit UI drag and drop;
- a generic node-type registry contract.

The consuming application registers its node catalogue. Definitions provide a
factory, dimensions, palette metadata, and an application-specific renderer, so
the package does not prescribe Action, Condition, Switch, or other business
types.

```ts
const nodeTypes = defineNodeTypes({
  action: {
    create: (id) => action(id),
    size: () => ({ width: 252, height: 62 }),
    palette: {
      label: "Action",
      description: "Run an operation",
      symbol: "‹›",
    },
    render: ActionNode.view,
  },
})
```

Branching definitions create child flows on their node instances. Layout and
drag operations treat those child flows generically, including dynamic switch
cases.
