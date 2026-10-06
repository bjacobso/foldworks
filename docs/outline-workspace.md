# Outline workspace prototype

The `/orchestrator` reference application explores agent orchestration inside a
human-maintained outline. Start the demo with `pnpm dev`, then select **Outline
workspace** under Reference applications.

## Working loop

- Write and rearrange ordinary bullets with the existing outliner keyboard and
  pointer interactions. Notes, `#context` constraints, and mentions coexist with
  tasks. Mentions are annotations, not notifications.
- Type `/agent` or `#agent` at the end of a bullet to attach a thread. `/agent`
  uses the shared completion popup. Attachment does not start a run.
  **New thread** creates a bullet inside the current hoisted branch.
- Start a task from its folded summary or conversation. Multiple threads
  progress independently, including while folded or in another demo.
- Open a thread through its row status. The detail pane shows its conversation,
  captured context, result, and due date. **Focus branch** uses hoisting and
  breadcrumbs. Stop a run to send a new direction.
- Review with **Accept result** or **Discard**. Acceptance creates a thread
  result. **Add result to outline** explicitly promotes it into an editable
  child bullet through the outliner's undoable `Replace`.
- Fold branches into summaries, or turn summaries off for a compact outline.
  Ancestor rows retain activity counts; the attention button opens a waiting
  thread.

Runs are prompt-aware, deterministic local simulations. They make no provider
calls or file changes. Due dates are annotations, not scheduled execution.
Multiplayer transport is future work. Outline content, threads, results, and
dates save in browser local storage; storage failures are visible. Reopening
pauses active runs rather than automatically restarting them.

## Existing primitives used

| Primitive                      | Role                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `@foldworks/outliner`          | Editing, nesting, drag movement, folding, hoisting, breadcrumbs, placeholders, row accessories, folded views      |
| `@foldworks/agent`             | Per-node conversation, stream reduction, tools, review checkpoints, cancellation, follow-ups, transcript controls |
| `@foldworks/agent/testing`     | Deterministic run events                                                                                          |
| `@foldworks/text-intelligence` | Slash completion and mention/tag decorations                                                                      |
| `@foldworks/history`           | Outline undo/redo availability                                                                                    |
| `@foldworks/ui`                | Split panes, buttons, badges, segmented controls, icons, validated date input/calendar, tree diffs                |
| `@foldworks/sidebar`           | Reference-app navigation and application chrome                                                                   |
| Foldkit                        | Schemas, child update/command mapping, subscriptions, keyed views, routing                                        |

The application owns node-to-thread associations, context policy, dates,
promotion, and persistence. No new package API was needed for this composition.

## Context and identity

A new run captures ancestor briefs, `#context` notes in those branches, and
notes beneath the task. Nested thread subtrees and promoted results are
excluded. Sources retain stable node IDs and can be revealed from details.
Editing or moving a running task leaves captured context intact; a new run
captures the current outline.

Moving a bullet carries its attachment by ID. Removing one stops active work,
but retains the attachment for outline undo. Restoring it does not restart it.
The fixture clock advances each active thread independently. Persistence saves
durable conversation state and reconstructs transient UI submodels on load.

## Primitive backlog

These candidates come from concrete host code in
`apps/demo/src/orchestrator`. Keep orchestration policy application-owned.

| Priority | Candidate                            | Evidence and suggested next step                                                                                                                                                                                                                                                |
| -------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Action completions                   | `update.ts` accepts `/agent` as text, recognizes it, removes it, then attaches metadata. Add host-defined completion actions while preserving insertion, keyboard, and caret semantics; exercise outliner and code editor.                                                      |
| P1       | Stable node attachments              | The host maintains thread maps, resolves anchors, retains removed attachments for undo, and stops orphaned work. Explore a generic anchor helper with removed/restored events, coordinated with planned anchored review threads. Keep deletion policy in the host.              |
| P1       | Views attached to leaves             | `foldedView` requires outline children. A thread with no notes has a row status but cannot show a folded result card. Explore disclosure for external content without manufacturing child bullets.                                                                              |
| P1       | Keyed subscription lifetimes         | A shared fixture clock works here; real provider streams require independent lifetimes per node/run. Explore a Foldkit keyed-subscription helper. Adding a thread must never restart another stream. This belongs upstream if generic.                                          |
| P2       | Agent lifecycle and branch attention | `statusOf` and accessories derive working, ready, paused, and descendant attention. Agent `Idle` alone does not distinguish completed and interrupted work. Explore lifecycle selectors and a subtree aggregate with a second host. Keep generated summaries application-owned. |
| P2       | Master/detail focus handoff          | Opening rows, hoisting, changing detail views, and closing details need coordinated keyboard focus restoration and responsive pane navigation. Build on `SplitView` and keyboard primitives.                                                                                    |
| P2       | Artifact surfaces                    | Tree-diff review, prose results, and outline promotion are composed locally. Coding tasks need files, code, diff review, and previews. Test an application-owned artifact registry using existing editors and diff viewer before extracting a result shell.                     |
| P2       | Durable agent documents              | `model.ts` saves a subset of agent state because model-picker Option values and DOM state are transient. Explore a package-owned conversation document/export contract with safe restore and run interruption.                                                                  |
| Later    | Collaboration operations             | Stable IDs exist, but transport, concurrent reparenting, and shared undo do not. Specify operation/conflict semantics first; keep each person's caret, folding, and hoisting separate from the shared document.                                                                 |

Action completions and leaf-node attached views are the smallest first
improvements: both remove concrete host workarounds.
