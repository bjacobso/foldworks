# Forma workbench

A private Foldworks app at **https://foldworks.dev/forma/**. It composes the
UI-free Forma language host with Foldworks' agent, code editor, history,
outliner, text intelligence, and UI surfaces. All Forma-specific code stays in
this app; the public `foldworks` package has no Forma dependency.

Imported from [Forma commit 61a546acef2392e6fb8bad33bb1a1f42322f09aa](https://github.com/bjacobso/forma/commit/61a546acef2392e6fb8bad33bb1a1f42322f09aa):

| Forma source               | Foldworks destination                                |
| -------------------------- | ---------------------------------------------------- |
| `packages/workbench/src/`  | `src/workbench/` (internal modules and stylesheet)   |
| `packages/workbench/test/` | `test/`                                              |
| `apps/workbench/`          | This app's shell, example programs, and `e2e/` tests |

The source retains Forma's MIT license in [LICENSE](./LICENSE). The migration
changes local imports, fixture paths, and site links; it preserves the workbench's
language behavior and simulated capabilities.

## Development and checks

From the repository root, with Node 24.13+ and pnpm 10.20:

```sh
pnpm install --frozen-lockfile
pnpm dev:forma
# Open the dev server's /forma/ path.
pnpm --filter @foldworks/forma-workbench test
pnpm --filter @foldworks/forma-workbench test:e2e
pnpm check
pnpm test:e2e
pnpm test:visual
```

The normal demo build includes this app under `dist/forma/`. The same Vite
plugin emits the assets into Alchemy's Cloudflare build. No new server or
separate production deploy is needed. Browser tests run the **assembled production
site** at `/forma/`, including query-string project links. `pnpm check` includes
this app's typecheck, unit tests, tarball checksum validation, and production
build; CI also runs the workbench's browser tests and the existing visual suite.

## Pinned Forma dependencies

Registry versions 0.3.0 predate the current host-prelude APIs and Effect 4.1.
Until 0.4.0 is published, this app alone references the committed tarballs in
[vendor/](./vendor/). [manifest.json](./vendor/manifest.json) records their source
commit and SHA-256. The tarballs retain upstream's `0.3.0` package metadata;
file references and hashes identify the newer source. Both packages use Effect
4.1.1; the app uses Foldkit 0.170.0
from Foldworks' catalog. Public package peer ranges are unchanged.

To refresh from an installed, clean local Forma checkout:

```sh
# In the Forma checkout, until its workbench removal merges:
node scripts/ci-install-registry.mjs
# After removal, use pnpm install --frozen-lockfile there instead.

# In Foldworks:
FORMA_DIR=/absolute/path/to/forma pnpm vendor:forma
pnpm install --no-frozen-lockfile
pnpm format
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
```

The refresh script builds only `@formalang/ts` and `@formalang/host`, packs them,
and updates the manifest and app dependencies. It never edits Forma's source.
The host's **packed** dependency on `@formalang/ts` is changed to the same
app-local tarball, so pnpm cannot silently pull the old engine from npm. Other
package metadata and runtime output come from Forma's build. pnpm resolves this
relative file reference from the consuming app. No global dependency overrides
or sibling source imports are used. Commit the tarballs, manifest, app manifest,
and lockfile together; remove obsolete tarballs after reviewing a refresh.

Once Forma 0.4.0 ships, replace this app's two `file:vendor/…` dependencies with
published `@formalang/ts` and `@formalang/host` ranges (starting at `^0.4.0`),
remove `vendor/` and the refresh/check script, remove the root `vendor:forma`
command and checksum check, regenerate the lockfile, and rerun all checks.
Validate that the published packages share the supported Effect runtime.

Forma's separate removal/redirect PR should merge **after this PR has merged
and deployed**. Its `/workbench/demo/` redirect should target
**https://foldworks.dev/forma/** and preserve the query string.

## Using the app

The example picker opens an onboarding workflow, functions and collections, or a
four-file pricing project. Choose a file, edit its outline or source, and evaluate
expressions in the REPL with Ctrl/⌘+Enter. F12 or Definition ↗ opens a declaration
across imports and re-exports; Back returns to its use. Add file creates a module;
Reset example restores the bundled project. `/forma/?project=functions` and
`/forma/?project=modules` open those examples directly.

The local assistant proposes structural edits such as wrap, unwrap, raise,
splice, rename, and extract. Review the diff before Accept or Discard; acceptance
is one undo step. No model provider or API key is configured by default. The
optional model proposer remains an internal adapter requiring an explicit
Effect LanguageModel layer.

The onboarding Run flow uses simulated directory and chat capabilities. Each
call passes through a real host suspension and permission checkpoint; analysis
and proposal previews perform no capabilities. The REPL evaluates pure
expressions only and replays scratch definitions against current file drafts.

Limits inherited from the original app: drafts and history live in memory and
are lost on reload; evaluation stops at the first failure; observation has no
step trace; host calls have no exact dynamic source span; operational Effect
programs are typed but not executed. This is a reference workbench, with no
production service integrations.
