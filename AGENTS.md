# Working on Foldworks

Foldworks is a pre-1.0 collection of application primitives for Foldkit and
StyleX. Match the existing package patterns and keep changes focused.

## Setup and checks

Use Node.js 24.13 or newer and pnpm 10.20 (pinned in `package.json`). Install
dependencies with `pnpm install --frozen-lockfile`.

The single verification command is `pnpm check`. It builds packages, checks
types, runs unit tests and lint, checks formatting on files changed from
`origin/main`, builds the demo, and validates the generated `llms.txt` and its
documentation links. Use `pnpm format` to fix changed-file formatting.

Run `pnpm dev` for the demo. `pnpm test:e2e` runs browser interactions;
`pnpm test:visual` runs screenshot comparisons. CI also validates the package
tarball and a clean consumer with `scripts/check-packages.mjs`; the same
validation is available locally through `pnpm release:check`.

## Repository layout

- `packages/foldworks/`: the single published `foldworks` package. Each
  `src/<module>/` directory is a `foldworks/<module>` entry point with its
  source, unit tests, and README guide.
- `packages/codebase/`: the private, unpublished codebase workbench. Keep it
  independent of `foldworks`.
- `apps/demo/`: Vite reference applications and browser tests.
- `apps/demo/docs/`: source discovery and the generated package/module catalog.
- `apps/demo/ui-docs.ts`: Markdown guide routes and the generated `/llms.txt` asset.
- `docs/`: designs, planned work, and reference application notes.
- `scripts/`: shared package builds, formatting, and validation.
- `.github/workflows/`: CI, automated releases, and deployment.
- `alchemy.run.ts`: Cloudflare deployment configuration.

## Conventions

Use TypeScript, Effect schemas, Foldkit models/messages/reducers, and StyleX as
the surrounding code does. Keep shared runtime peer ranges in the `peers`
catalog and development versions in the default catalog. Package builds run
through Turborepo and `scripts/build-package.mjs`; use the existing scripts.
Use `foldworksStylexTest()` for view tests without the StyleX compiler.

Modules import each other with relative paths, such as `../ui`; never import
`foldworks/*` from inside the package. A new module is a `src/<module>/`
directory plus `./<module>` entries in the package `exports`. Libraries that
only some modules need are optional peers (`peerDependenciesMeta`), so keep
them out of the root entry of modules that do not need them;
`scripts/check-packages.mjs` builds a consumer without them.

Document behavior and limits in module READMEs. The docs build discovers
exports and READMEs; do not edit generated `dist` files. Add a changeset with
`pnpm changeset` for publishable `foldworks` changes. Site and contributor-guide
changes alone do not require a package release.

## What not to do

Do not add sibling project source imports; Foldworks is independent of WorldVM.
Do not describe planned features or local agent simulations as production
integrations. Do not add a framework to serve documentation assets. Do not
deploy manually, publish packages, or merge a PR without explicit instruction;
the existing workflows handle releases and deployment after merge.
