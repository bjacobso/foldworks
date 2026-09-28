# Adopting from foldkit-plus

[foldkit-plus](https://github.com/doeixd/foldkit-plus) is an MIT-licensed
collection of Foldkit packages by Patrick Glenn. It works at a different layer
from Foldworks. It covers state ownership and integration: agents, server
caches, replication, URL and storage mirrors, server rendering, and React
interop. Foldworks covers finished work surfaces and a StyleX design system.
This document records what is worth bringing into Foldworks and what is not.
The items are proposals, not commitments. Promote one into implementation work
the same way as the [planned primitives](./planned-primitives.md).

Reviewed against foldkit-plus
[`c840594`](https://github.com/doeixd/foldkit-plus/tree/c840594a7ae10abe2445b2ae6d9058d0b6799fbc)
(September 2026). Paths below are relative to that repository unless they point
into Foldworks.

## Constraints

- **No shared dependency today.** foldkit-plus requires `foldkit ^0.163.0` and
  Effect `rc.116`. Foldworks pins `foldkit ^0.156.0` and Effect `rc.112`. On a
  0.x version these ranges do not overlap, so an application cannot install
  packages from both.
- **Port, don't depend.** Most foldkit-plus code sits on its own base layers:
  `foldkit-bundle`, `foldkit-surface`, `foldkit-metadata`, and
  `foldkit-mixins`. Foldworks has none of these. We rewrite small pieces as
  plain Submodels, Mounts, and Commands, and rebuild larger ideas against our
  own models.
- **No upgrade required first.** Foldkit 0.156 exports the modules the ported
  code needs: `foldkit/mount`, `foldkit/subscription`, `foldkit/customElement`,
  and `foldkit/navigation`.
- **Attribution.** Copied or closely adapted code keeps the MIT notice,
  "Copyright (c) 2026 Patrick Glenn", in the file header or a package `NOTICE`.

## Small, contained work

Each item fixes a gap or duplication Foldworks already has. None of them
depends on a Foldkit upgrade. Items 1 to 3 fit together in one change.

### 1. Rich clipboard for `@foldworks/editor`

The editor copies and pastes plain text only
(`packages/editor/src/browser.ts`). foldkit-plus has an allowlist HTML
sanitizer for pasted content (`packages/richtext-dom/src/html.ts`), a URL
safety check (`packages/richtext/src/url.ts`), and a versioned clipboard
`Slice` that gives pasted blocks fresh IDs (`packages/richtext/src/clipboard.ts`).
The sanitizer and URL check port with little change. Rewrite the `Slice` format
against the editor's `Block` and `Run` types. This is the base for the "richer
clipboard fragments" item in
[rich document blocks](./planned-primitives.md#rich-document-blocks).

### 2. Shared browser helpers

Foldworks writes the same browser plumbing more than once:

- ResizeObserver or MutationObserver code in `packages/ui/src/measurement.ts`,
  `packages/ui/src/workspace.ts`, `packages/ui/src/stateful/menu-tree.ts`,
  `packages/data-grid/src/virtualization.ts`, `packages/pdf-viewer`, and
  `packages/code-editor/src/native/mount.ts`.
- Clipboard writes in `packages/ui/src/code-block.ts` and
  `packages/agent/src/update.ts`.
- `matchMedia` subscriptions in `apps/demo/src/app/subscriptions.ts` and
  `packages/pdf-viewer/src/viewer-update.ts`.

`packages/primitives` has observer Mounts (`observers/`), a clipboard Command
(`dom/clipboard.ts`), a media query (`media/mediaquery.ts`), and debounce and
timer helpers (`time/`). Each is roughly 50 to 130 lines. Replace `Bundle.make`
with a plain model, update, and subscriptions, then put them in `@foldworks/ui`
or a small `@foldworks/browser` package.

### 3. Accessibility helpers

Foldworks components handle focus and keyboard behavior internally, but these
are not available as reusable pieces:

- A live-region announcer
  (`packages/primitives/src/interaction/live-announce.ts`). It debounces polite
  and assertive messages and re-announces identical text. Grids, boards, and
  drag and drop all need one.
- Keyboard-versus-pointer focus detection (`input-modality.ts`,
  `focus-visible.ts`).
- Long press (`long-press.ts`).

The `interaction/` versions attach through `foldkit-mixins` Behaviors, so port
the logic, not the attachment.

### 4. Shiki highlighting for `@foldworks/code-editor`

`packages/richtext-code-shiki/src/shiki.ts` (about 110 lines) maps TextMate
scopes to token classes. Connect it to the token format in
`packages/code-editor/src/highlight.ts` to get real grammars.

### 5. Structured Markdown diagnostics

The editor reports import problems as `diagnostics: S.Array(S.String)`.
`packages/richtext-markdown/src/diagnostic.ts` defines a structured diagnostic
Schema: a code (`UnsupportedNode`, `UnsupportedMark`, or `UnsafeUrl`), a detail,
and the node it applies to. Adopting it lets hosts show where an import lost
information.

## Ideas to rebuild

These are worth having, but the foldkit-plus code is too tied to its own
layers to copy.

### 6. URL and storage mirrors

`packages/mirror` keeps a Model slice in the URL or a key-value store while the
Model stays the owner. It leaves defaults out of the URL, chooses push or
replace per key, throttles writes, and restores stored values through a Message
that `update` folds in. It is built on `foldkit-surface` field references, so
rebuild the pattern standalone. `applyToHref` and the push-or-replace logic can
be lifted.

Places in the demo that would use it:

- `apps/demo/src/theme.ts` saves the theme to localStorage by hand.
- `apps/demo/src/document-storage.ts` does the same for workspace documents.
- Route query parameters are built by hand in `apps/demo/src/app/update.ts`.
- Data-table search, sort, and density (`apps/demo/src/data-table/model.ts`)
  and sidebar collapse are not saved at all.

### 7. Agent capabilities

`@foldworks/agent` renders tool calls but cannot run them; the demo scenario is
scripted. `packages/agent` in foldkit-plus exposes existing application
Messages as agent tools. Each tool is opt-in and has an input Schema, a mapping
to a Message, an authorization check, and a completion rule. The completion
rule resolves a call when a matching result Message is applied, not when the
call is dispatched. Invocations go to an audit sink.

Rebuild the contract layer in Foldworks, starting from `forModel.ts`, which
does not need Surface. Its authorization step maps onto the existing
`PermissionRequested` and `ChosePermission` flow. A contract could also produce
an Effect AI `Toolkit`, following `packages/generative-ui/src/mcp.ts`. The
WebMCP adapter (`packages/agent-webmcp`, about 300 lines) could be adapted
nearly as it is. With it, outside agents could drive the data-grid, diagram,
query-builder, and PDF-annotator demos.

The demo needs one change first. It starts with `Runtime.run` in
`apps/demo/src/entry.ts`, and nothing outside the application can read its
Model or dispatch into it.

### 8. Editor document structure

- **Tables and images** as block types with nesting and isolation rules. An
  isolating block stops Backspace from escaping a table cell
  (`packages/richtext/src/kit.ts`, `standard.ts`).
- **Input rules** that undo in one step (`input.ts`), and **decorations** that
  stay out of undo history (`decoration.ts`).
- **Document migrations** and handling of unknown nodes (`migration.ts`).
- **Holding remote updates until IME composition ends**
  (`packages/richtext-dom/src/events.ts`).
- **Operation-based transactions** with a change set and position mapping
  (`transaction.ts`). They are the long-term route to collaboration and to undo
  without full-document snapshots. The code assumes the foldkit-plus document
  shape, so adopting it would replace the editor engine rather than extend it.

Neither project has mentions yet.

### 9. Kanban as the collection-view test

[Collection views and boards](./planned-primitives.md#collection-views-and-boards)
names a Kanban board as the first test. `examples/foldkit-kanban` (about 2,200
lines) already covers keyboard pick-up, arrow and Tab moves, Escape to cancel,
screen-reader announcements, and ordering with `fractional-indexing`. It uses
`@foldkit/ui/dragAndDrop`, which `packages/pdf-annotator` already uses. Its
domain and update logic port easily.

## Process and tooling

### 10. Foldkit upgrade

`docs/foldkit-0.158-to-0.163.md` is a step-by-step record of the upgrade
Foldworks will eventually do. The main changes:

- `evo` is renamed to `modifyFields`.
- Effect moves to `rc.116`, with Vitest 5.
- Subscription event helpers infer their types, and their mapper fields are
  renamed.
- `@effect/platform-browser` becomes a peer.

The published `foldkit@0.163.0` still types `Attribute<Message>` as a tagged
union, so `patches/foldkit@0.156.0.patch` must be redone for 0.163. See the
[upstream log](./foldkit-upstream.md). Foldkit 0.161 also added
`Subscription.keyBindings`, which overlaps with `@foldworks/keyboard`. Compare
the two before adding more to that package.

### 11. Upstream proposals

foldkit-plus writes up Foldkit changes with evidence before filing them
(`docs/upstream-foldkit-ssr.md`, `docs/upstream-combobox-keyboard.md`). It also
pins today's upstream behavior in tests prefixed `upstream:`, so a test fails
when Foldkit changes that behavior. The [upstream log](./foldkit-upstream.md)
could work the same way. The `Attribute` fix has not been filed.

### 12. Agent skill

`skills/foldkit-plus/SKILL.md` teaches coding agents what each package owns,
when to use it, and a basic example. A Foldworks skill would be cheap to write
from the package READMEs.

## Out of scope

- **`mixins-*` views and recipes.** They target foldkit-plus slot styling, not
  StyleX.
- **Full-stack packages.** `remote`, `sync`, `durable`, `entity`, `crud`, `cms`,
  and `ssr` are application infrastructure, which Foldworks leaves to the host.
- **`agent-mcp`.** `@foldworks/generative-ui` already uses Effect's MCP server.
- **`agent-a2a` and `agent-native`.**
- **Undo history.** `@foldworks/history` covers it.
