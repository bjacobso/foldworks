# Foldworks

The UI standard library for Foldkit and StyleX, from design tokens to complete
workbenches.

Foldworks is pre-1.0; APIs are evolving.

**[Explore Foldworks](https://foldworks.dev)**

Foldworks is a higher-order shadcn. It starts where component kits start, with
semantic tokens, themes, buttons, dialogs, and menus, then keeps going up the
stack to the parts every serious product eventually builds by hand: data grids,
rich-text and code editors, outliners, query and form builders, diagrams, diff
review, PDF annotation, and agent conversations.

Every layer is built only from the layers beneath it and follows the same
contract:

- **Your state.** Every primitive is a Foldkit model, message, and update. A
  data grid is as controlled, testable, and replayable as a checkbox.
- **Your tokens.** Semantic CSS variables and StyleX reach every layer. Change
  the theme and the diff viewer, outliner, and PDF annotator change with the
  buttons.
- **The details included.** Keyboard commands, focus management, undo history,
  validation, and responsive behavior ship with each primitive.
- **One package, separate modules.** Install `foldworks` once and import only
  the modules you use, such as `foldworks/ui` or `foldworks/data-grid`. Take
  one layer or the whole stack.

## The stack

```sh
pnpm add foldworks effect foldkit @foldkit/ui @stylexjs/stylex
```

Every module below is a `foldworks/<name>` import path from the
[`foldworks` package](./packages/foldworks). The PDF modules and the MCP Apps
bridge need optional peers; see [Install](./packages/foldworks/README.md#install).

| Layer                      | What it provides                                                                        | Modules                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 05. Workbenches            | Complete tools composed from the layers below                                           | `agent`, `generative-ui`                                                                            |
| 04. Application primitives | Product surfaces with models, messages, and updates included                            | `editor`, `code-editor`, `outliner`, `data-table`, `data-grid`, `query-builder`, `review`, and more |
| 03. Behaviors              | Headless engines that more than one surface shares                                      | `keyboard`, `history`, `text-intelligence`, `diagram`, `pdf`                                        |
| 02. Components             | Accessible controls, overlays, and application chrome                                   | `ui`, `sidebar`                                                                                     |
| 01. Tokens                 | Semantic CSS variables in light and dark, with Shadcn, Polaris, Apple, and other themes | `ui`                                                                                                |

### Components

- [`foldworks/ui`](./packages/foldworks/src/ui): semantic design tokens, themes,
  application chrome, and accessible controls, overlays, menus, trees, split
  views, and feedback.
- [`foldworks/sidebar`](./packages/foldworks/src/sidebar): collapsible application chrome,
  grouped navigation, inset content, and responsive mobile drawer behavior.

### Behaviors

- [`foldworks/keyboard`](./packages/foldworks/src/keyboard): typed, scoped command
  definitions and platform-aware shortcuts with Foldkit lifecycles.
- [`foldworks/history`](./packages/foldworks/src/history): immutable undo/redo history for
  application-owned documents.
- [`foldworks/text-intelligence`](./packages/foldworks/src/text-intelligence): reusable
  host-provided `@mentions` and `#tags`, plus the shared vocabulary and popups
  for hover, completion, highlighting, and diagnostics on text surfaces.
- [`foldworks/diagram`](./packages/foldworks/src/diagram): compound directed-graph
  documents with ports, notes, and cycles; layered and freeform layout
  strategies; and a canvas interaction model for selection, dragging,
  connecting, panning, and zoom.
- [`foldworks/pdf`](./packages/foldworks/src/pdf): PDF page rendering, geometry, and
  composable surfaces.

### Application primitives

- [`foldworks/editor`](./packages/foldworks/src/editor): a native rich-text editor with
  Markdown import/export, draggable blocks, and application-defined Foldkit views.
- [`foldworks/code-editor`](./packages/foldworks/src/code-editor): a native Foldkit editor
  with highlighting, undo/redo, find/replace, diagnostics, and shared
  implementation contracts. See the [architecture](./packages/foldworks/src/code-editor/NATIVE.md).
- [`foldworks/outliner`](./packages/foldworks/src/outliner): a keyboard-first outliner
  with natural indenting, reordering, folding, hoisting, and drag and drop.
- [`foldworks/data-table`](./packages/foldworks/src/data-table): a resource-first CRUD
  table with semantic markup, sortable columns, bulk row selection, resource
  links, density controls, and pinned columns.
- [`foldworks/data-grid`](./packages/foldworks/src/data-grid): a typed data-grid core with
  sorting, resizing, ordering, pinned columns, row virtualization, range
  selection, clipboard copy/paste, editing, and an accessible view.
- [`foldworks/query-builder`](./packages/foldworks/src/query-builder): configurable query
  documents, editing, validation, rendering, and rule reordering.
- [`foldworks/form-builder`](./packages/foldworks/src/form-builder): section-first form
  documents, immutable operations, registries, and drag-and-drop primitives.
- [`foldworks/workflow`](./packages/foldworks/src/workflow): recursive workflows,
  branch-aware operations, layout, and drag-and-drop primitives, built on the
  `foldworks/diagram` scene contract.
- [`foldworks/review`](./packages/foldworks/src/review): review threads, drafts, and host-owned change-request workflows.
- [`foldworks/diff-viewer`](./packages/foldworks/src/diff-viewer): a controlled unified and
  split diff renderer with line selection for code review workflows.
- [`foldworks/pdf-viewer`](./packages/foldworks/src/pdf-viewer): read-only PDF viewing
  with overlay hotspots.
- [`foldworks/pdf-annotator`](./packages/foldworks/src/pdf-annotator): multi-page PDF
  annotation authoring with AcroForm inspection, versioned JSON, custom data,
  zoom-aware editing, and interactive PDF export.

### Workbenches

- [`foldworks/agent`](./packages/foldworks/src/agent): a provider-neutral conversation
  runtime and chat UI with streaming text, tool states, permission checkpoints,
  and retry.
- [`foldworks/generative-ui`](./packages/foldworks/src/generative-ui): an Effect
  Schema-first contract for agent-generated component graphs, a safe Foldkit
  renderer, Effect AI structured generation, and an MCP Apps tool bridge.
  Because every layer has a typed contract, agents can compose the library too.

The repository also contains [`@foldworks/codebase`](./packages/codebase), a
live, read-only web workbench for repository documentation, source, history,
and staged or unstaged Git diffs. It is a private workspace tool: it is not
published and is not part of `foldworks`.

## Live examples

The browser demo in [`apps/demo`](./apps/demo) exercises every Foldworks
module. Its `/docs` website generates searchable references for every public module
and source file, with schemas, messages, source links, README guides, and
interactive state-machine explorers. See [documentation generation](./apps/demo/docs/README.md)
for the source pipeline and how to add reducer explorers. Its `/agent` reference application demonstrates streaming assistant
text, tool calls and results, an interactive permission checkpoint, a model
picker, and a prompt composer. Its `/statechart` editor builds a nested state
machine with cycles, parallel regions, submachines, notes, and a simulator on
`foldworks/diagram`. The agent flow is a deterministic browser-only fixture
and performs no provider calls or tool side effects.

The `/orchestrator` reference application puts independent agent threads inside
a human-maintained outline: attach a thread with `/agent`, fold it into a
summary, inspect captured context, review a result, and promote it into an
editable bullet. It runs local simulations and saves in this browser. See
[Outline workspace](./docs/outline-workspace.md) for behavior and the primitive
backlog discovered while building it.

[Language workbench primitives](./docs/language-workbench.md) records the
contracts a language workbench builds on: shared text intelligence for outline
rows and the code editor, placeholder rows, structure policy, a structural tree
diff, and a lazily loaded value tree.

See [planned work-surface primitives](./docs/planned-primitives.md) for the
next layers of the library to explore, and [document analysis](./docs/document-analysis.md)
for available primitives for checking extracted values against their source documents.

## WorldVM

Foldworks is an independent project, and its modules are useful in any Foldkit
application. It is also the UI layer planned for the developer tools of
[WorldVM](https://worldvm.com), a TypeScript runtime and standard library for
software that models the world, reasons about it, and acts on it. Foldworks does
not depend on WorldVM. WorldVM-specific views belong to WorldVM; generic
pieces they need can become Foldworks primitives. See
[WorldVM developer tools](./docs/worldvm-devtools.md) for the proposed split.

## Dependency compatibility

The `foldworks` package declares Effect, Foldkit, `@foldkit/ui`, and StyleX as
peers. Applications supply compatible versions of these shared runtimes; the
package's peer ranges state what it supports. `pdfjs-dist`, `pdf-lib`, and
`@modelcontextprotocol/ext-apps` are optional peers, needed only by the PDF
modules and `foldworks/generative-ui/mcp-app`. The named `peers`
catalog holds those ranges, while the default catalog and lockfile keep exact
versions for builds and tests. The tested combination is Effect and its platform,
SQL, and Vitest companions `4.1.1`, Foldkit, `@foldkit/ui`, and
`@foldkit/devtools` `0.170.0`, `@foldkit/markdown` `0.15.0`, and
`@foldkit/vite-plugin` `0.29.0`.

These Foldkit releases declare Effect `~4.1.0` peers, which accept `4.1.1`.
Alchemy and its frontend adapter remain on `2.0.0-beta.80`; their Effect
`^4.0.0` ranges also accept the tested runtime. Alchemy's existing SQL companions
are pinned to `4.1.1` within their declared ranges.

Alchemy beta.80 still imports the removed `effect/Crypto` API. The scoped
`patches/alchemy@2.0.0-beta.80.patch` migrates OAuth state and PKCE generation
to Effect 4.1's `SecureRandom` and `Digest` WebCrypto layers, preserves
`OAuthError` failures, and removes the obsolete service from declarations.
Published Alchemy beta.84 still uses the removed API. Remove the patch when
Alchemy ships compatible crypto APIs. Offline tests verify deployment imports,
random state, the S256 challenge, and crypto failures without contacting a
provider. They use `@effect/vitest@4.1.1` with Vitest `5.0.3`.

No Effect peer exceptions are required; the clean-consumer check in
`scripts/check-packages.mjs` installs without peer overrides. The
declaration-only Foldkit attribute patch is still carried for TypeScript
performance; see the [upstream log](./docs/foldkit-upstream.md).

Applications consuming StyleX components must also configure
the StyleX transform and its cascade layers; see the
[`foldworks/ui` setup](./packages/foldworks/src/ui/README.md#setup). To test views without
the StyleX compiler, use `foldworksStylexTest()` from `foldworks/ui/vite`; see
[Testing views](./packages/foldworks/src/ui/README.md#testing-views). The `foldworks` package
uses the same plugin in its Vitest configuration.

## Development

This repository requires Node.js 24.13 or newer and pnpm 10.20 or newer.

```sh
pnpm install
pnpm check
pnpm test
pnpm typecheck
pnpm build
```

`pnpm check` builds the packages once, then runs type checks, unit tests,
linting, and a non-mutating format check on files changed from `main`. Use
`pnpm format` to fix changed files; `pnpm format:all` formats the whole
repository.

It also builds the demo and checks the generated `/llms.txt` structure and
documentation assets. See [AGENTS.md](./AGENTS.md) for contributor guidance.

Run `pnpm dev` to start the demo application. Turborepo prepares only the
demo's transitive workspace dependencies with fast runtime builds, then starts
Vite as an uncached persistent task. Runtime builds emit JavaScript and CSS
together without waiting for declarations; both runtime and full package builds
stage their output before replacing `dist`, so stopping a build leaves the last
usable output in place. Full builds remain available through `pnpm build` (all
packages and the demo) and `pnpm build:packages` (packages only), with outputs
cached in `.turbo` according to the workspace dependency graph. CI restores the
Turbo cache between runs so unchanged package builds can be reused.

Run `pnpm test:e2e` for the demo's Playwright interaction suite.

In Conductor, the Run menu provides **Checks**, **Development**, **Codebase**,
and **Verified Development**. Checks is the default; Development starts the
home page with hot reload, while Verified Development runs the same checks
before starting it. Conductor assigns each local workspace its own ports and
exposes the home page through the terminal panel's Open menu. Each Run action
first checks pnpm's installed lockfile and installs dependencies only when they
are missing or stale, including in a synced cloud workspace checkout.

Run `pnpm codebase` to build and start the live codebase workbench on
`http://127.0.0.1:4310`. Pass `--host` and `--port` to expose it through a
development environment's port forwarding.

## Publishing

`foldworks` is the only published package; `@foldworks/codebase` and the demo
are private. Changesets records release notes and the version bump for
`foldworks`. Add a changeset with every publishable change:

```sh
pnpm changeset
```

When a release is ready, apply the pending changesets and inspect the generated
version and changelog:

```sh
pnpm version-packages
pnpm release:check
```

`release:check` runs the tests and type checks, builds the demo and every
workspace package, inspects the `foldworks` tarball, and installs it into a
clean Vite application, first without and then with the optional peers. The
tarball inspection consumes that completed build without rerunning the
package's `prepack` script; ordinary `pnpm pack` and publish flows still build
through `prepack`. It does not publish. Commit the version and changelog
changes, then publish to npm with:

```sh
pnpm release
```

The release command refuses to publish while changesets are pending or
`foldworks` still has the placeholder `0.0.0` version.

### Automated releases

The `Release` GitHub Actions workflow watches `main`. Pending changesets create
or update a `Release packages` pull request. Merging that version PR validates
and packs the release, publishes it through npm trusted publishing, creates
GitHub releases, and pushes package tags.

Trusted publishing requires a one-time configuration of the `foldworks`
package on npm:

- Provider: GitHub Actions
- Organization or user: `bjacobso`
- Repository: `foldworks`
- Workflow filename: `release.yml`
- Environment: leave blank
- Allowed actions: enable direct publishing with `npm publish`

In the GitHub repository settings, enable **Allow GitHub Actions to create and
approve pull requests**. The workflow uses short-lived OIDC credentials and
does not require an `NPM_TOKEN` secret.

npm cannot configure a trusted publisher before a package exists, so publish
the first `foldworks` version manually from a tarball validated by
`pnpm release:check`. Then connect it to this workflow in the package's npm
settings, or use an authenticated npm CLI (version 11.15 or newer):

```sh
npm trust github foldworks --file release.yml --repository bjacobso/foldworks --allow-publish
```

Subsequent versions publish through the automated workflow. The earlier
`@foldworks/<name>` packages remain on npm; after `foldworks` is published,
deprecate them with a pointer to the matching `foldworks/<name>` module.

## Deployment

The demo is deployed to Cloudflare Workers with
[Alchemy](https://alchemy.run):

**[Open Foldworks](https://foldworks.dev)**

Authenticate with Cloudflare, then deploy the production stage with:

```sh
pnpm run deploy
```

The `Deploy` GitHub Actions workflow also deploys the exact revision validated
by `CI` after every successful push or merge to `main`. In automation, it runs
the non-interactive equivalent, `pnpm exec alchemy deploy --stage prod --yes`,
then verifies that `https://foldworks.dev` serves the Foldworks application.
Alchemy also retains the Worker's generated `workers.dev` URL.

The `production` GitHub environment requires these Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account that owns `foldworks.dev`.
- `CLOUDFLARE_API_TOKEN` — a dedicated deployment token scoped to that account
  and zone.

Give the deployment token only these Cloudflare permissions:

- Account: Workers Scripts Edit
- Account: Account Settings Read
- Account: Secrets Store Edit
- Zone `foldworks.dev`: Zone Read
- Zone `foldworks.dev`: Workers Routes Edit

Desktop command definitions live in `foldworks/keyboard`; UI compositions and
package-boundary decisions are documented in [Desktop primitives](packages/foldworks/src/ui/docs/desktop.md).

The outliner and native Markdown editor share plain-text mentions and tags. See
the [design and adapter contract](./docs/mentions-and-tags.md) for host lookup,
syntax exclusions, stable identity, and persistence.

[Document analysis demo](https://foldworks.dev/document-analysis) composes PDF passage highlights and text selection, transcript ranges, prose diffs, citation previews, and a read-only relationship graph using synthetic documents.
