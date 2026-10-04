# WorldVM developer tools

[WorldVM](https://worldvm.com) is a TypeScript runtime and standard library for
software that models the world, reasons about it, and acts on it. Its planned
`worldvm dev` command would boot a local runtime alongside developer tools: a
thread inspector, ontology browser, event log, webhook inspector, and admin UI.
Foldworks is the UI layer those tools are planned to use.

This document records which Foldworks packages would build each surface and
where WorldVM-specific code should live. It is a proposal, not a commitment.
WorldVM's packages are not published yet, and nothing in this repository
depends on them. Promote an item into implementation work the same way as the
[planned primitives](./planned-primitives.md).

## Boundary

- **Foldworks stays independent.** No `@foldworks/*` package imports
  `@worldvm/*` or uses WorldVM vocabulary in its public API. Someone should
  always be able to say "I use Foldworks, but I don't use WorldVM."
- **WorldVM-specific views live in WorldVM.** The proposed home is WorldVM's
  `apps/devtools`. It owns the adapters that turn entities, facts, threads,
  events, and connections into Foldworks presentation data, plus the transport
  to the running world.
- **No `@foldworks/worldvm` package.** A component moves into Foldworks only
  when it can be described without WorldVM terms and has a second, non-WorldVM
  use. The [Workers workbench](./workbench/README.md) already counts as one.
- **Same contract as the operational views.** Generic additions follow
  `ValueInspector`, `ExplanationTree`, `ChangeSetPreview`, and
  `TransactionTimeline`: they accept presentation data and application-owned
  actions, and they do not fetch records, evaluate rules, or execute changes.

`@foldworks/codebase` is the nearest precedent for the delivery shape: a local
server that serves a prebuilt, read-only Foldkit workbench. `worldvm dev` could
serve `apps/devtools` the same way. The codebase server itself is Git-specific
and would not be reused.

## Surfaces

Each row names the WorldVM question the surface answers, the existing Foldworks
building blocks, and the part that stays in `apps/devtools`.

| Surface            | Question                          | Foldworks building blocks                                                                                                                                            | WorldVM-owned                                                                               |
| ------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Shell              | —                                 | `@foldworks/sidebar`, `AppHeader`, `Workspace`, `PanelStack`, `Stateful.Command`, `@foldworks/keyboard`                                                              | Navigation between surfaces, connection status to the local runtime                         |
| Thread inspector   | What is happening?                | `TransactionTimeline`, `Stepper`, `DescriptionList`, `@foldworks/diagram` for the current position in a program graph, `@foldworks/agent` for agent threads          | Thread state model, mapping steps to timeline entries, signal and timer controls            |
| Ontology browser   | What exists?                      | `Tree` for the type hierarchy, `@foldworks/data-grid` for entity lists, `ValueInspector` and `DescriptionList` for entity detail, `@foldworks/diagram` for relations | Ontology and Triplex adapters, fact provenance, as-of time selection                        |
| Query console      | What do I know?                   | `@foldworks/query-builder`, `@foldworks/data-grid` for results, `@foldworks/code-editor` for a textual form                                                          | Query compilation and execution                                                             |
| Change preview     | What would change?                | `ChangeSetPreview`, `ExplanationTree`, `@foldworks/diff-viewer`                                                                                                      | Computing a Change and applying it                                                          |
| Policy explanation | What is allowed?                  | `ExplanationTree`, permission checkpoints in `@foldworks/agent`                                                                                                      | Policy evaluation and capability data                                                       |
| Program view       | What could happen?                | `@foldworks/diagram` with layered layout; the `/statechart` demo shows a simulator built on it                                                                       | Adapter from Program IR to a diagram document                                               |
| Event log          | What happened?                    | `@foldworks/data-grid` with row virtualization and pinned columns, `CodeBlock` for payloads, `@foldworks/query-builder` for filters                                  | Event schemas, the live stream, correlation with threads                                    |
| Webhook inspector  | How do I reach the outside world? | `@foldworks/data-table` for deliveries, `CodeBlock` for request and response bodies, `Badge` for status                                                              | Delivery records, replay, signature checks                                                  |
| Admin UI           | —                                 | `@foldworks/data-table`, `@foldworks/form-builder` in runnable mode, field primitives in `@foldworks/ui`                                                             | Standard library resources such as organizations, users, and memberships, and their schemas |

The Workers workbench already exercises the change-preview loop end to end, so
the change preview and the event log are the cheapest first surfaces.

## Gaps

These gaps showed up in the mapping. Each could become a generic Foldworks
primitive if a second use appears; until then, build it in `apps/devtools`.

- **Following a live stream.** `@foldworks/data-grid` virtualizes rows and
  accepts appended data, but keeping the view pinned to new rows, pausing when
  the reader scrolls away, and resuming are not documented behaviors.
- **Structured payloads.** `CodeBlock` shows serialized JSON. A collapsible
  value tree for nested payloads would also serve the agent and generative UI
  demos.
- **Fact origin.** `ValueInspector` accepts a closed set of origins: `Entered`,
  `Imported`, and `Derived`. Facts that arrive through a connection may need
  another value. Widen it with a generic term, not a WorldVM one.
- **Time travel.** Viewing a world as of an earlier time needs an as-of
  selector. The workbench README lists full bitemporal browsing as future work,
  and the [time and scheduling](./planned-primitives.md#time-and-scheduling)
  exploration is the natural home for a generic version.
- **"Thread" means two things.** The planned
  [anchored review threads](./planned-primitives.md#anchored-review-threads)
  are comment threads. A WorldVM Thread is a running program. They should not
  share a component, and Foldworks should keep calling its version a review
  thread.

## Constraints

- **Shared runtimes.** Foldworks currently requires `foldkit@0.156.0`, which
  pins Effect `4.0.0-rc.112`; see
  [dependency compatibility](../README.md#dependency-compatibility). If
  `apps/devtools` imports WorldVM schemas or clients that are built on Effect,
  WorldVM must use the same Effect version or keep those imports out of the
  browser bundle.
- **`@foldworks/workflow` is not an engine.** It edits workflow documents and
  does not run them. It is only relevant to WorldVM as a possible editor for
  Program IR, and only through an adapter in `apps/devtools`.

## Suggested sequence

1. Create `apps/devtools` in WorldVM with the shell and the change preview,
   using the published `@foldworks/*` packages.
2. Add the event log and thread inspector, building any missing pieces locally.
3. When a local piece meets the boundary rule above, propose it here as a
   generic primitive with its own demo.
4. Add the ontology browser, program view, and admin UI as the WorldVM kernel
   and standard library settle.
