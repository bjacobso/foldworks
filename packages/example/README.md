# Foldkit workflow builder

A browser-only structured workflow demo built with Foldkit, StyleX, and Vite.
It renders a Start → Condition → Switch → Action → End example with orthogonal
branch routing, merge junctions, insertion controls, drag placeholders, and a
node settings sheet.

Reusable flow operations, layout, and drag interaction live in the private
`@foldworks/workflow` workspace package. This application registers the
available node types, their factories, dimensions, palette metadata, and views.

Features include:

- nested Then, Else, and dynamic Switch flows;
- dragging registered types into any valid nested flow location;
- moving complete branch subtrees while rejecting recursive self-drops;
- a dotted placeholder for the complete source subtree and highlighted
  destination control;
- animated rebalancing after insertions, moves, resizing, and deletion;
- a Foldkit dialog sheet for node settings;
- keyboard drag and drop with accessible announcements.

From the repository root:

```sh
pnpm install
pnpm dev
```

Use `pnpm test`, `pnpm typecheck`, and `pnpm build` to verify the example. Run
`pnpm test:e2e` for the Vitest + Playwright interaction suite and screenshots in
`packages/example/test-results/workflow`.
