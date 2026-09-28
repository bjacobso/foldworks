# Planned work-surface primitives

Foldworks aims to provide composable primitives for building many kinds of work
surface with Foldkit. This document records areas to explore. The scopes are
proposals, not settled package APIs or implementation commitments. Promote an
area into implementation work after testing it against a real application view.

## Current foundation and adjacent work

The repository already includes application chrome, accessible controls,
keyboard commands, a tree, split panes, data tables and grids, document and code
editors, diagrams, workflows, forms, queries, agent conversations, PDF annotation,
and operational inspection views. See the [package inventory](../README.md) and
[UI capability guide](../packages/ui/docs/capabilities.md) before adding a new
primitive.

As of September 2026, separate workspaces are exploring animation, themes,
responsive split layouts and headers, navigation, read-only form controls,
display components, keyed tables, data-grid row groups, PDF viewing, and CSS and
token setup. The proposals below should build on that work when it lands.

## Next explorations

### Charts and data visualization

Explore a dedicated charting surface for bars, lines, sparklines, and stacked
measures. It should share tokens with `@foldworks/ui`, expose meaningful data
and selection events, and provide an accessible table or text alternative.
Start with the review-dashboard cases already identified in the downstream UI
audit. The current `Chart` in `@foldworks/ui` is a small visual bar display, not
this broader charting model.

### Collection views and boards

Explore a controlled collection model for filtering, sorting, grouping,
selection, and saved views, with adapters for lists, boards, and existing tables
or grids. A Kanban board is a useful first test: cards need stable identity,
keyboard and pointer movement, and application-owned move acceptance. Reuse the
data-grid row-group work rather than creating a second grid engine.

### Anchored review threads

Explore a reusable thread model and view for comments anchored to document
ranges, diff lines, grid cells or rows, diagram nodes, and PDF regions. Include
thread creation, replies, resolution, focus, and anchors that can become stale
after edits. Keep transport, permissions, and persistence in the host app. The
diff viewer already renders thread markers, but does not own thread interaction.
See the [implementation plan](./anchored-review-threads-plan.md) for the first
diff-review and data-grid slices.

## Further explorations

### Time and scheduling

Extend the existing single-date foundation with date ranges, time, and timezone
inputs. Then test agenda, week-calendar, and timeline views against scheduling
and planning workflows. Keep event storage and recurrence policy in the host.

### Files and assets

Explore a file picker and dropzone, an upload queue with validation and progress,
and reusable preview states for common assets. `Attachment` currently renders a
message attachment, while the separate PDF work focuses on reading PDFs. Hosts
should own storage, authorization, and upload transport.

### Dockable workspaces

Explore reorderable tabs and panes, saved layouts, and focus restoration when a
view moves. Build on `Workspace` and the responsive split-layout work. The
current [workspace contract](../packages/ui/docs/workspace.md) supports nested
splits but leaves tab docking and pane reordering open.

### Large hierarchical collections

Explore lazy loading, virtualization, multi-selection, and keyboard-accessible
drag reparenting for `Tree`. Keep hierarchy mutations application-owned. These
features should be driven by a large explorer or outline rather than added to
the existing eager tree without a concrete workload.

### Rich document blocks

Explore tables, images, uploads, mentions, and richer clipboard fragments in
`@foldworks/editor`. Define how each block serializes, imports and exports, and
interacts with selection and undo. The [editor's current limits](../packages/editor/README.md#browser-boundary-and-current-limits)
call out these gaps. Collaboration can follow once the document and anchor
contracts are stable.

## Choosing a primitive

Prefer contracts that let one behavior serve several work surfaces. For each
exploration, start with a real view, state who owns data and side effects, and
show composition with existing Foldworks packages. Preserve keyboard and
screen-reader behavior, controlled state, and a useful small-screen layout.
Avoid introducing a new package when an existing package can hold the behavior
without taking ownership of application-specific policy.
