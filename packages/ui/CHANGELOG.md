# @foldworks/ui

## 0.2.0

### Minor Changes

- c7b54c5: Add a consistent StyleX composition contract with root `sx` overrides and typed
  `slotProps` for component internals. Remove the former `style` override property;
  consumers should migrate those values directly to `sx`.
- ff6f731: Add a controlled Tree explorer with stable IDs, expansion, keyboard navigation,
  typeahead, explicit selection, inline rename, and sibling/indent/outdent move
  requests. Include immutable move helpers, host-defined move restrictions,
  focus recovery, and accessible nested tree semantics.
- 05759a5: Add portal-first styled Menu, Popover, Tooltip, single/multi Combobox, and Toast
  submodels over Foldkit's complete interaction engines. Add responsive Container,
  Grid, Stack, and Row layout; semantic Text, Heading, Link, and VisuallyHidden;
  actionable Tag, controlled NumberField, and journey Stepper primitives. Export
  shared viewport/container breakpoints, content widths, and floating-layer policy.
- 140b35f: Add controlled value inspector, explanation tree, change-set preview, and transaction timeline compositions for operational applications.
- 398d432: Add controlled, nestable Workspace panes with horizontal and vertical splits,
  pointer and keyboard resizing, minimum sizes, collapse/restore with focus recovery,
  and explicit scrolling boundaries. Pane preferences remain serializable and
  application-owned.
- de1cbea: Add actionable and collapsing breadcrumbs, label-shaped button triggers, adorned fields with multiline and keyboard ergonomics, composable stateful tooltip triggers, and richer stateful dialog anatomy with close actions, dividers, and width presets.
- 7c9ef65: Add an opt-in Soft theme with light and dark palettes, rounded surfaces, subtle card elevation, and pastel status badges. Expose shared shape and shadow tokens and align button typography to a 12px compact, 13px default, and 14px large scale while preserving control heights.
- 1a632ef: Add styled Stateful Tabs, Dialog, Select, and Command submodels with Foldkit
  message/update integration, keyboard behavior, and focus handling. Preserve the
  existing view-only APIs with migration guidance and document their capability
  limits. Allow child attribute bundles in Button and catalog controls, expose
  matching surface foreground tokens, and include stateful integration documentation.

### Patch Changes

- c42f7c0: Give light themes a darker gray sidebar, a lighter gray application background, and white cards to establish three distinct surface layers.

## 0.1.0

### Minor Changes

- Publish the initial Foldworks package suite with controlled Foldkit behavior, StyleX styling, themeable UI components, and application primitives for data grids, forms, queries, workflows, navigation, document history, and PDF annotation.
