# Foldworks

Polished application primitives for Foldkit and StyleX.

Foldworks is an umbrella collection of reusable packages for building rich,
accessible application interfaces with Foldkit:

- [`@foldworks/ui`](./packages/ui) — opinionated application chrome, semantic
  design tokens, and accessible visual primitives.
- [`@foldworks/data-grid`](./packages/data-grid) — a typed data-grid core with
  sorting, resizing, selection, keyboard navigation, and an accessible view.
- [`@foldworks/query-builder`](./packages/query-builder) — configurable query
  documents, editing, validation, rendering, and rule reordering.
- [`@foldworks/form-builder`](./packages/form-builder) — section-first form
  documents, immutable operations, registries, and drag-and-drop primitives.
- [`@foldworks/workflow`](./packages/workflow) — recursive workflows,
  branch-aware operations, layout, and drag-and-drop primitives.
- [`@foldworks/pdf-annotator`](./packages/pdf-annotator) — multi-page PDF
  previews with draggable, resizable annotations and flattened PDF export.
- [`@foldworks/sidebar`](./packages/sidebar) — collapsible application chrome,
  grouped navigation, inset content, and responsive mobile drawer behavior.
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

## Publishing

Changesets records which packages changed and keeps versions and internal
`workspace:*` dependencies in sync. Add a changeset with every publishable
change:

```sh
pnpm changeset
```

When a release is ready, apply the pending changesets and inspect the generated
versions and changelogs:

```sh
pnpm version-packages
pnpm release:check
```

`release:check` runs the tests and type checks, builds the demo and every
package, inspects the package tarballs, and installs those tarballs into a clean
Vite application. It does not publish. Commit the version and changelog changes,
then publish the public packages to npm with:

```sh
pnpm release
```

The release command refuses to publish while changesets are pending or a
package still has the placeholder `0.0.0` version.

### Automated releases

The `Release` GitHub Actions workflow watches `main`. Pending changesets create
or update a `Release packages` pull request. Merging that version PR validates
and packs the release, publishes it through npm trusted publishing, creates
GitHub releases, and pushes package tags.

Trusted publishing requires a one-time configuration on npm for every
`@foldworks/*` package:

- Provider: GitHub Actions
- Organization or user: `bjacobso`
- Repository: `foldworks`
- Workflow filename: `release.yml`
- Environment: leave blank

In the GitHub repository settings, enable **Allow GitHub Actions to create and
approve pull requests**. The workflow uses short-lived OIDC credentials and
does not require an `NPM_TOKEN` secret.

The initial `0.1.0` release is published. Manual publishing remains available
for maintainers authenticated to the `@foldworks` npm organization, but the
automated trusted-publishing workflow is preferred for future releases.

## Deployment

The demo is deployed to Cloudflare Workers with
[Alchemy](https://alchemy.run):

**[Open the live demo](https://foldworks-demo-prod-acvnipkoj23cgmkb.bjacobso.workers.dev)**

Authenticate with Cloudflare, then deploy the production stage with:

```sh
pnpm run deploy
```
