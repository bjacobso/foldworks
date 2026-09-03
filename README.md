# Foldworks

Polished application primitives for Foldkit and StyleX.

Foldworks is an umbrella collection of reusable packages for building rich,
accessible application interfaces with Foldkit:

- [`@foldworks/ui`](./packages/ui) — opinionated application chrome, semantic
  design tokens, and accessible visual primitives.
- [`@foldworks/workflow`](./packages/workflow) — recursive workflows,
  branch-aware operations, layout, and drag-and-drop primitives.
- [`@foldworks/form-builder`](./packages/form-builder) — section-first form
  documents, immutable operations, registries, and drag-and-drop primitives.
- [`@foldworks/data-grid`](./packages/data-grid) — a typed data-grid core with
  sorting, resizing, selection, keyboard navigation, and an accessible view.
- [`@foldworks/query-builder`](./packages/query-builder) — configurable query
  documents, editing, validation, rendering, and rule reordering.
- [`@foldworks/history`](./packages/history) — immutable undo/redo history for
  application-owned documents.

The browser demo in [`apps/demo`](./apps/demo) exercises the complete package
suite.

## Development

This repository requires Node.js 24.13 or newer and pnpm 10.20 or newer.

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

Run `pnpm dev` to start the demo application. Run `pnpm test:e2e` for its
Playwright interaction suite.

## Deployment

The demo is deployed to Cloudflare Workers with
[Alchemy](https://alchemy.run):

**[Open the live demo](https://foldworks-demo-prod-acvnipkoj23cgmkb.bjacobso.workers.dev)**

Authenticate with Cloudflare, then deploy the production stage with:

```sh
pnpm run deploy
```
