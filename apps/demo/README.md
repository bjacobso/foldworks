# Foldworks demo

A browser-only demo app built with Foldkit, StyleX, and Vite. The homepage
introduces the Foldworks package family, shows a live component composition,
and explains the boundary between UI components and application primitives.
Use the sidebar to move between every package showcase.

Foldkit's bidirectional router owns navigational state. The project overview
lives at `/`; demos live at `/ui-kit`, `/editor`, `/data-table`, `/data-grid`, `/query-builder`,
`/form-builder`, `/workflow`, `/pdf-annotator`, and `/agent`. Workflow orientation and the
form's example and Editor/Preview mode live in query parameters so those states
can be linked, reloaded, and traversed with browser history. Transient selections,
drag state, column widths, and in-progress document edits remain in the
application model.

The toolbar separates color theme from appearance. Neutral, Zinc, Blue, and Soft
palettes can each use System, Light, or Dark appearance. Both choices are
persisted locally and applied to the document root before the stylesheet loads
to avoid a theme flash; System appearance also responds live when the operating
system preference changes. Shared surface, text, status, selection, and
drop-target tokens keep every demo consistent across the theme matrix.

Workflow and form documents autosave to local storage. Each form example keeps
an independent draft, while the workflow keeps its own persisted document.
Both editors expose validated, versioned JSON import/export and bounded
undo/redo history with `Cmd/Ctrl+Z` and `Cmd/Ctrl+Shift+Z` shortcuts.
Consecutive edits to the same text property coalesce into a single history
step; structural operations such as add, delete, move, reset, and import remain
individual steps. Transient selection, drag, dialog, route, and preview-answer
state is intentionally excluded from history and persistence.

Reusable flow operations, layout, and drag interaction live in the private
`@foldworks/workflow` workspace package. This application registers the
available node types, their factories, dimensions, palette metadata, and views.

The private `@foldworks/data-grid` workspace package provides a typed,
headless table model and a Foldkit DOM view. The demo supplies 120 rows, column
configuration, and custom employee and status cell renderers.

The `@foldworks/data-table` demo is deliberately resource-first: one compact
row per person, semantic table markup, links into a route-driven detail panel,
sorting, search, bulk selection, density, and pinned identity/actions columns.
It owns no spreadsheet editing state; that richer interaction model remains in
`@foldworks/data-grid`.

Features include:

- nested Then, Else, and dynamic Switch flows;
- dragging registered types into any valid nested flow location;
- moving complete branch subtrees while rejecting recursive self-drops;
- a dotted placeholder for the complete source subtree and highlighted
  destination control;
- animated rebalancing after insertions, moves, resizing, and deletion;
- a Foldkit dialog sheet for node settings;
- keyboard drag and drop with accessible announcements.
- undo/redo for node changes and structural edits;
- autosave plus validated workflow JSON import/export.

The data grid currently demonstrates:

- typed application-owned rows and column definitions;
- an Excel-like worksheet shell with sticky row numbers, a live A1-style value
  bar, compact 34px rows, and single-line cells;
- custom cell rendering and numeric/text sorting;
- sticky headers and horizontal/vertical scrolling;
- rectangular keyboard selection with Shift+Arrow and validated TSV copy/paste;
- measured row virtualization with overscan and absolute accessible indices;
- accessible column ordering with stable column state;
- start/end pinned columns across horizontal scrolling;
- resizable columns with a double-click reset.

The form builder demonstrates a section-first, multi-actor document model:

- simple, actor-handoff, and complex example forms;
- Employee → Employer → Employee and Employee → Authorized representative →
  Employer → Employee journeys;
- adding and configuring registered field types;
- moving sections, pages, and fields, including fields between pages;
- an inline editor canvas backed by the same field renderers as preview;
- actor-specific and full-journey preview modes with answers and tracked
  Markdown content views.
- undo/redo for field configuration and structural edits;
- independent autosaved drafts plus validated form JSON import/export.

The UI component showcase demonstrates every `@foldworks/ui` primitive:

- declarative, theme-aware Lucide icons rendered through Foldkit;
- all button intents, sizes, and disabled states;
- badges across neutral, success, warning, danger, and information tones;
- inputs, textareas, native selects, compact density, and disabled controls;
- segmented controls and compact toolbar selects;
- panel, row, stack, and toolbar composition;
- the shared semantic color tokens used by the demos.
- all 61 current shadcn-equivalent component families, including controlled
  overlays, menus, navigation, tables, charts, calendars, and message views.

The agent playground at `/agent` demonstrates the provider-neutral
`@foldworks/agent` conversation runtime with real incremental Effect streams,
tool input and result states, an
inline allow/deny permission checkpoint, model selection, and a multiline
composer. Its model responses and tool results are deterministic local fixtures:
the demo does not call a provider, use an API key, execute a command, or change a
file. The normalized event protocol can later accept AI SDK UI message chunks or
Effect AI `LanguageModel.streamText` parts without changing the package reducer
or application view.

From the repository root:

```sh
pnpm install
pnpm dev
```

Use `pnpm test`, `pnpm typecheck`, and `pnpm build` to verify the example. Run
`pnpm test:e2e` for the Vitest + Playwright interaction suite and screenshots in
`apps/demo/test-results/demo`.

The browser suite discovers the package catalog rendered on the homepage and
captures every linked showcase as `site-docs-<package>.png`. This provides a
consistent screenshot set for the site documentation and fails when the catalog
changes without corresponding screenshot coverage.

## Workers reference workspace

Open `/workbench` for the complete inspect → explain → propose → preview →
apply → history loop. Changes and audit entries are saved in browser storage.
The adapter uses illustrative local rules; it does not connect to Triplex.
See [the reference guide and screenshots](../../docs/workbench/README.md) for
behavior, architecture, and the focused end-to-end test command.
